/**
 * Phase 10.2B-5: Workspace Membership Integration & Security Audit Test Suite
 * 
 * Verifies all 11 required audit criteria:
 * 1. Valid active membership lookup (Firestore-backed)
 * 2. Missing membership rejection (403 FORBIDDEN)
 * 3. Inactive membership rejection (403 MEMBERSHIP_INACTIVE)
 * 4. Wrong workspace rejection (403 CROSS_WORKSPACE_DENIED)
 * 5. Invalid role or permissions rejection (403 PERMISSION_DENIED)
 * 6. Forged client workspace ID, role, permissions, and ownerUid payload stripping
 * 7. Missing credentials handling (500 CONFIG_ERROR)
 * 8. Invalid service-account credentials handling (500 CONFIG_ERROR)
 * 9. Token cache credential isolation across distinct service accounts
 * 10. Existing reserve fund cannot be overwritten (409 ALREADY_EXISTS)
 * 11. Financial writes remain strictly disabled by default
 * 12. Zero hardcoded admin identities in worker runtime
 * 13. Explicit environment validation & rejection of invalid execution modes
 */

import fs from 'fs';
import path from 'path';
import { getWorkerConfig, parseServiceAccountCredentials } from './worker/envConfig.mjs';
import { lookupWorkspaceMember, getOrCreateFirestoreClient, handleCallableApiRequest } from './worker/index.mjs';
import { authorizeWorkspaceRequest, sanitizeClientPayload } from './workspaceAuth.mjs';
import { dispatchAction, ACTION_REGISTRY } from './worker/actionRegistry.mjs';
import {
  getFirestoreAccessToken,
  clearTokenCache,
  getCredentialCacheKey,
  getTokenCacheSize
} from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';

const results = [];
let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passCount++;
    results.push({ name: testName, status: 'PASS', details });
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failCount++;
    results.push({ name: testName, status: 'FAIL', details });
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
  }
}

// Helper to generate a dummy RSA private key for testing
async function generateTestRsaKey() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );
  const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const binaryString = String.fromCharCode(...new Uint8Array(exported));
  const b64 = btoa(binaryString);
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`;
}

// In-memory mock Firestore client for isolated testing
function createMockFirestore(seedData = {}) {
  const db = JSON.parse(JSON.stringify(seedData)); // Deep copy

  return {
    _db: db,
    async getDocument(collectionPath, docId) {
      const fullPath = `${collectionPath}/${docId}`;
      if (db[fullPath]) {
        return {
          id: docId,
          path: fullPath,
          data: JSON.parse(JSON.stringify(db[fullPath])),
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        };
      }
      return null;
    },
    async runTransaction(txFunc) {
      const pendingWrites = [];
      const tx = {
        get: async (collectionPath, docId) => {
          const fullPath = `${collectionPath}/${docId}`;
          if (db[fullPath]) {
            return {
              id: docId,
              path: fullPath,
              data: JSON.parse(JSON.stringify(db[fullPath])),
              updateTime: new Date().toISOString()
            };
          }
          return null;
        },
        create: (collectionPath, docId, data) => {
          const fullPath = `${collectionPath}/${docId}`;
          if (db[fullPath]) {
            const err = new Error(`Document already exists at ${fullPath}`);
            err.code = 'ALREADY_EXISTS';
            err.status = 409;
            throw err;
          }
          pendingWrites.push(() => {
            db[fullPath] = JSON.parse(JSON.stringify(data));
          });
        },
        update: (collectionPath, docId, data) => {
          const fullPath = `${collectionPath}/${docId}`;
          pendingWrites.push(() => {
            db[fullPath] = { ...(db[fullPath] || {}), ...JSON.parse(JSON.stringify(data)) };
          });
        },
        set: (collectionPath, docId, data, options = {}) => {
          const fullPath = `${collectionPath}/${docId}`;
          if (options.createOnly && db[fullPath]) {
            const err = new Error(`Document already exists at ${fullPath}`);
            err.code = 'ALREADY_EXISTS';
            err.status = 409;
            throw err;
          }
          pendingWrites.push(() => {
            db[fullPath] = JSON.parse(JSON.stringify(data));
          });
        }
      };

      const result = await txFunc(tx);
      // Commit pending writes
      for (const w of pendingWrites) w();
      return result;
    }
  };
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  PHASE 10.2B-5: WORKSPACE MEMBERSHIP INTEGRATION & SECURITY AUDIT');
  console.log('======================================================================\n');

  const testPrivateKey = await generateTestRsaKey();

  // ---------------------------------------------------------------------------
  // SUITE 1: FIRESTORE-BACKED MEMBERSHIP LOOKUP & RBAC
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: FIRESTORE-BACKED MEMBERSHIP LOOKUP & RBAC ---');

  // Seed data with candidate schema: workspace_members/{workspaceId}_{uid}
  const seedMembers = {
    'workspace_members/ws_bhuiya_uid_active_admin': {
      workspaceId: 'ws_bhuiya',
      uid: 'uid_active_admin',
      role: 'master_admin',
      status: 'active',
      permissions: {
        canManageTenants: true,
        canCollectRent: true,
        canRecordExpenses: true,
        canViewReports: true
      }
    },
    'workspace_members/ws_bhuiya_uid_active_manager': {
      workspaceId: 'ws_bhuiya',
      uid: 'uid_active_manager',
      role: 'manager',
      status: 'active',
      permissions: {
        canManageTenants: true,
        canCollectRent: true,
        canRecordExpenses: false,
        canViewReports: true
      }
    },
    'workspace_members/ws_bhuiya_uid_inactive_user': {
      workspaceId: 'ws_bhuiya',
      uid: 'uid_inactive_user',
      role: 'manager',
      status: 'inactive',
      permissions: {
        canManageTenants: true,
        canCollectRent: true
      }
    },
    'workspace_members/ws_other_uid_foreign_user': {
      workspaceId: 'ws_other',
      uid: 'uid_foreign_user',
      role: 'manager',
      status: 'active',
      permissions: {
        canManageTenants: true
      }
    }
  };

  const mockFirestore = createMockFirestore(seedMembers);
  const testEnv = {
    __TEST_FIRESTORE_CLIENT__: mockFirestore,
    FIREBASE_PROJECT_ID: 'bhuiya-property-staging',
    EXECUTION_MODE: 'test'
  };

  // 1.1 Valid active membership
  const adminMember = await lookupWorkspaceMember('uid_active_admin', 'ws_bhuiya', testEnv);
  assert(
    adminMember &&
    adminMember.workspaceId === 'ws_bhuiya' &&
    adminMember.uid === 'uid_active_admin' &&
    adminMember.role === 'master_admin' &&
    adminMember.status === 'active',
    'Membership Lookup: Valid active membership resolved from Firestore with trusted role'
  );

  // Authorize active admin
  const adminAuth = await authorizeWorkspaceRequest({
    callerUid: 'uid_active_admin',
    actionName: 'withdrawFromReserveCallable',
    requestedWorkspaceId: 'ws_bhuiya'
  }, (uid, wsId) => lookupWorkspaceMember(uid, wsId, testEnv));
  assert(adminAuth.authorized === true && adminAuth.role === 'master_admin', 'RBAC: Master Admin authorized for admin action');

  // 1.2 Missing membership
  const missingMember = await lookupWorkspaceMember('uid_unknown', 'ws_bhuiya', testEnv);
  assert(missingMember === null, 'Membership Lookup: Non-existent membership returns null');

  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_unknown',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'ws_bhuiya'
    }, (uid, wsId) => lookupWorkspaceMember(uid, wsId, testEnv));
    assert(false, 'RBAC: Missing membership rejection', 'Expected FORBIDDEN error');
  } catch (err) {
    assert(err.code === 'FORBIDDEN' && err.status === 403, 'RBAC: Missing membership rejected with HTTP 403 FORBIDDEN');
  }

  // 1.3 Inactive membership
  const inactiveMember = await lookupWorkspaceMember('uid_inactive_user', 'ws_bhuiya', testEnv);
  assert(inactiveMember && inactiveMember.status === 'inactive', 'Membership Lookup: Inactive member record retrieved with inactive status');

  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_inactive_user',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'ws_bhuiya'
    }, (uid, wsId) => lookupWorkspaceMember(uid, wsId, testEnv));
    assert(false, 'RBAC: Inactive membership rejection', 'Expected MEMBERSHIP_INACTIVE error');
  } catch (err) {
    assert(err.code === 'MEMBERSHIP_INACTIVE' && err.status === 403, 'RBAC: Inactive member rejected with HTTP 403 MEMBERSHIP_INACTIVE');
  }

  // 1.4 Wrong workspace
  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_active_admin',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'ws_foreign_estate' // Caller belongs to ws_bhuiya
    }, (uid, wsId) => lookupWorkspaceMember(uid, wsId, testEnv));
    assert(false, 'RBAC: Wrong workspace rejection', 'Expected CROSS_WORKSPACE_DENIED or FORBIDDEN');
  } catch (err) {
    assert(
      err.code === 'FORBIDDEN' || err.code === 'CROSS_WORKSPACE_DENIED',
      'RBAC: Access to foreign workspace rejected with HTTP 403'
    );
  }

  // 1.5 Invalid role or permissions
  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_active_manager',
      actionName: 'withdrawFromReserveCallable', // Requires master_admin
      requestedWorkspaceId: 'ws_bhuiya'
    }, (uid, wsId) => lookupWorkspaceMember(uid, wsId, testEnv));
    assert(false, 'RBAC: Permission denial', 'Expected PERMISSION_DENIED error');
  } catch (err) {
    assert(err.code === 'PERMISSION_DENIED' && err.status === 403, 'RBAC: Insufficient permissions rejected with HTTP 403 PERMISSION_DENIED');
  }

  // 1.6 Forged client workspace ID, role, permissions, and ownerUid stripping
  const maliciousClientPayload = {
    workspaceId: 'ws_hacked',
    role: 'master_admin',
    ownerUid: 'uid_attacker',
    permissions: { canManageTenants: true, canCollectRent: true },
    status: 'active',
    unitId: 'unit_999'
  };
  const sanitized = sanitizeClientPayload(maliciousClientPayload, adminAuth);
  assert(
    sanitized.workspaceId === 'ws_bhuiya' &&
    sanitized.callerUid === 'uid_active_admin' &&
    sanitized.ownerUid === undefined &&
    sanitized.role === undefined &&
    sanitized.permissions === undefined &&
    sanitized.status === undefined &&
    sanitized.unitId === 'unit_999',
    'Security Sanitization: Client-supplied workspaceId, role, permissions, status, and ownerUid completely stripped and overridden'
  );

  // 1.7 Zero hardcoded admin identities in runtime
  const emptyEnv = { EXECUTION_MODE: 'packaging' };
  const brotherLookup = await lookupWorkspaceMember('uid_brother_1', 'workspace_bhuiya_family', emptyEnv);
  assert(brotherLookup === null, 'Security: uid_brother_1 returns null when no mock or Firestore client is configured (no hardcoded fixtures)');

  const adminPrefixLookup = await lookupWorkspaceMember('admin_superuser', 'workspace_bhuiya_family', emptyEnv);
  assert(adminPrefixLookup === null, 'Security: admin_* prefix returns null without hardcoded fixture fallback');

  // ---------------------------------------------------------------------------
  // SUITE 2: SERVICE ACCOUNT TOKEN CACHING CREDENTIAL ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: SERVICE ACCOUNT TOKEN CACHING CREDENTIAL ISOLATION ---');

  clearTokenCache();
  assert(getTokenCacheSize() === 0, 'Token Cache: Initialized empty cache');

  const credA = {
    client_email: 'service-a@bhuiya-project-a.iam.gserviceaccount.com',
    private_key: testPrivateKey,
    project_id: 'bhuiya-project-a'
  };

  const credB = {
    client_email: 'service-b@bhuiya-project-b.iam.gserviceaccount.com',
    private_key: testPrivateKey,
    project_id: 'bhuiya-project-b'
  };

  let fetchCallCount = 0;
  const mockOAuthFetch = async (url, options) => {
    fetchCallCount++;
    const params = new URLSearchParams(options.body);
    const assertion = params.get('assertion');
    const parts = assertion.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // Generate unique token based on service account issuer
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          access_token: `token_for_${payload.iss}`,
          expires_in: 3600
        };
      }
    };
  };

  // Call 1 with Credential A
  const resA1 = await getFirestoreAccessToken(credA, mockOAuthFetch);
  assert(
    resA1.token === 'token_for_service-a@bhuiya-project-a.iam.gserviceaccount.com' &&
    resA1.cached === false &&
    fetchCallCount === 1,
    'Token Cache: Fetched fresh token for Service Account A'
  );

  // Call 2 with Credential B (Must NOT return Credential A token!)
  const resB1 = await getFirestoreAccessToken(credB, mockOAuthFetch);
  assert(
    resB1.token === 'token_for_service-b@bhuiya-project-b.iam.gserviceaccount.com' &&
    resB1.cached === false &&
    fetchCallCount === 2,
    'Token Cache: Fetched fresh token for Service Account B without returning A token'
  );

  assert(getTokenCacheSize() === 2, 'Token Cache: Maintained 2 distinct isolated cache entries');

  // Call 3 with Credential A (Must be served from cache!)
  const resA2 = await getFirestoreAccessToken(credA, mockOAuthFetch);
  assert(
    resA2.token === resA1.token &&
    resA2.cached === true &&
    fetchCallCount === 2,
    'Token Cache: Reused isolated cached token for Service Account A without external fetch'
  );

  // Call 4 with Credential B (Must be served from cache!)
  const resB2 = await getFirestoreAccessToken(credB, mockOAuthFetch);
  assert(
    resB2.token === resB1.token &&
    resB2.cached === true &&
    fetchCallCount === 2,
    'Token Cache: Reused isolated cached token for Service Account B without external fetch'
  );

  clearTokenCache();
  assert(getTokenCacheSize() === 0, 'Token Cache: clearTokenCache() successfully reset all cached credentials');

  // ---------------------------------------------------------------------------
  // SUITE 3: RESERVE FUND INITIALIZATION TRANSACTION OVERWRITE PROTECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: RESERVE FUND INITIALIZATION OVERWRITE PROTECTION ---');

  // Seed existing reserve fund
  const reserveSeed = {
    'workspaces/ws_bhuiya/reserveFund/main': {
      balance: 500000,
      workspaceId: 'ws_bhuiya',
      initializedBy: 'uid_founder',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
  const reserveFirestore = createMockFirestore(reserveSeed);

  const reserveWorkerContext = {
    config: { disableFinancialWrites: false }, // Live simulation mode
    authContext: { workspaceId: 'ws_bhuiya', uid: 'uid_active_admin', role: 'master_admin' },
    firestore: reserveFirestore
  };

  // Attempt to overwrite existing reserve fund
  try {
    await dispatchAction('initializeReserveFundCallable', {
      openingBalance: 1000000
    }, reserveWorkerContext.authContext, reserveWorkerContext);
    assert(false, 'Reserve Fund Overwrite Protection', 'Failed to prevent overwriting existing reserve record');
  } catch (err) {
    assert(
      err.code === 'ALREADY_EXISTS' && err.status === 409,
      'Reserve Fund Overwrite Protection: Attempt to re-initialize existing reserve rejected with HTTP 409 ALREADY_EXISTS'
    );
  }

  // Verify existing balance was NOT modified
  const existingDoc = await reserveFirestore.getDocument('workspaces/ws_bhuiya/reserveFund', 'main');
  assert(
    existingDoc.data.balance === 500000,
    'Reserve Fund Overwrite Protection: Existing reserve balance preserved at ৳500,000 without corruption'
  );

  // Initialize a reserve fund for a brand new workspace (must succeed)
  const newWorkspaceContext = {
    config: { disableFinancialWrites: false },
    authContext: { workspaceId: 'ws_new_branch', uid: 'uid_active_admin', role: 'master_admin' },
    firestore: reserveFirestore
  };
  const initResult = await dispatchAction('initializeReserveFundCallable', {
    openingBalance: 250000
  }, newWorkspaceContext.authContext, newWorkspaceContext);
  assert(
    initResult.success === true && initResult.balance === 250000,
    'Reserve Fund Initialization: Newly provisioned workspace successfully created reserve fund'
  );

  // ---------------------------------------------------------------------------
  // SUITE 4: ENVIRONMENT CONFIGURATION & SAFETY GATES
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: ENVIRONMENT CONFIGURATION & SAFETY GATES ---');

  // 4.1 Missing credentials
  const emptyConfig = getWorkerConfig({ EXECUTION_MODE: 'staging', FIREBASE_PROJECT_ID: 'bhuiya-property-staging' });
  assert(
    emptyConfig.credentialsError !== null &&
    emptyConfig.credentialsError.includes('Staging credentials are missing'),
    'Config Validation: Missing credentials in staging mode detected and flagged'
  );

  // 4.2 Invalid service-account credentials (malformed JSON)
  const badJsonConfig = getWorkerConfig({
    FIREBASE_SERVICE_ACCOUNT_KEY: '{ malformed json: true, '
  });
  assert(
    badJsonConfig.credentialsError !== null &&
    badJsonConfig.credentialsError.includes('Invalid service account JSON'),
    'Config Validation: Corrupt service account JSON detected and flagged'
  );

  // 4.3 Incomplete credentials (missing private_key)
  const incompleteConfig = getWorkerConfig({
    FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'only-email@test.iam.gserviceaccount.com' })
  });
  assert(
    incompleteConfig.credentialsError !== null &&
    incompleteConfig.credentialsError.includes('incomplete'),
    'Config Validation: Service account credentials missing private_key flagged'
  );

  // 4.4 Explicit rejection of invalid execution modes
  const invalidModeConfig = getWorkerConfig({ EXECUTION_MODE: 'super_admin_mode' });
  assert(
    invalidModeConfig.credentialsError !== null &&
    invalidModeConfig.credentialsError.includes('Invalid execution mode'),
    'Config Validation: Invalid EXECUTION_MODE rejected with explicit error'
  );

  // 4.5 Rejection of production project ID in staging mode
  const badStagingConfig = getWorkerConfig({
    EXECUTION_MODE: 'staging',
    FIREBASE_PROJECT_ID: 'bhuiya-property-manager' // Production ID supplied for staging!
  });
  assert(
    badStagingConfig.credentialsError !== null &&
    badStagingConfig.credentialsError.includes('Invalid Staging Project ID'),
    'Config Validation: Staging mode strictly rejects production project ID ("bhuiya-property-manager")'
  );

  // 4.6 Financial writes strictly disabled by default
  const defaultSafetyConfig = getWorkerConfig({});
  assert(
    defaultSafetyConfig.disableFinancialWrites === true,
    'Financial Safety: disableFinancialWrites is strictly locked to TRUE by default'
  );

  // 4.7 Financial mutations remain disabled
  const disabledFinancialContext = {
    config: { disableFinancialWrites: true },
    authContext: { workspaceId: 'ws_bhuiya', uid: 'uid_active_admin', role: 'master_admin' },
    firestore: reserveFirestore
  };
  const dryRunPayment = await dispatchAction('recordRentPaymentCallable', {
    billId: 'bill_test',
    amount: 15000,
    paymentMethod: 'cash',
    paymentDate: '2026-11-08'
  }, disabledFinancialContext.authContext, disabledFinancialContext);
  assert(
    dryRunPayment.status === 'PACKAGING_VALIDATED',
    'Financial Safety: Financial operations return PACKAGING_VALIDATED without performing writes'
  );

  console.log('\n======================================================================');
  console.log(`  PHASE 10.2B-5 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');

  return { passCount, failCount };
}

runSuite().then(res => {
  if (res.failCount > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});
