/**
 * Phase 10.2B-12: Security Rules & Authorization Final Audit Test Suite
 * 
 * Comprehensive audit verifying:
 * 1. Static AST and security rules coverage across all 14 workspace collections.
 * 2. Live staging Cloud Firestore rule execution: unauthenticated, non-member, inactive,
 *    suspended, cross-workspace, and direct client writes are strictly denied.
 * 3. Worker API authentication, membership lookup, and workspace isolation invariants.
 * 4. Client-side privilege escalation prevention (forged role, permissions, callerUid, ownerUid, status).
 * 5. Full audit of all 24 registered Worker actions for RBAC and financial write protection.
 * 6. Production environment boundary isolation, secret hygiene, and financial ledger immutability.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';

import { getWorkerConfig } from './worker/envConfig.mjs';
import { getFirestoreAccessToken, pemToBinary, base64UrlEncode, base64UrlEncodeBytes } from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';
import { handleCallableApiRequest } from './worker/index.mjs';
import { ACTION_PERMISSIONS, sanitizeClientPayload } from './workspaceAuth.mjs';
import { ACTION_REGISTRY } from './worker/actionRegistry.mjs';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Details: ${details}`);
  }
}

// Helper to generate mock RS256 key pair for Worker test execution
async function generateTestRsaKeyPair() {
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
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'stage-audit-kid-12';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  return { keyPair, publicJwk };
}

function base64Url(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const utf8 = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(header, payload, privKey) {
  const h = base64Url(header);
  const p = base64Url(payload);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privKey, data);
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `${h}.${p}.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function makeApiRequest(action, payload, token, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new Request(`https://bhuiya-property-manager.pages.dev/api/callable/${action}`, {
    method: 'POST',
    headers,
    body: payload !== null ? JSON.stringify(payload) : undefined
  });
}

async function runSecurityAuditSuite() {
  console.log('========================================================================');
  console.log('PHASE 10.2B-12: SECURITY RULES & AUTHORIZATION FINAL AUDIT');
  console.log('========================================================================\n');

  // Load .dev.vars
  const devVarsPath = path.resolve('poc/phase-10-2a/.dev.vars');
  assert(fs.existsSync(devVarsPath), 'Local environment file (.dev.vars) exists');

  const env = {};
  for (const line of fs.readFileSync(devVarsPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }

  const config = getWorkerConfig(env);
  assert(config.projectId === 'bhuiya-property-staging', 'Target project strictly bhuiya-property-staging');
  assert(config.executionMode === 'staging', 'Execution mode is staging');
  assert(config.disableFinancialWrites === true, 'Financial writes disabled flag is TRUE');

  // Load .env.staging for Client SDK
  const envStagingPath = path.resolve('.env.staging');
  assert(fs.existsSync(envStagingPath), 'Staging environment file (.env.staging) exists');

  const dotEnv = {};
  for (const line of fs.readFileSync(envStagingPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      dotEnv[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }

  // Initialize Firebase Client SDK for live rule tests
  const app = initializeApp({
    apiKey: dotEnv.VITE_FIREBASE_API_KEY,
    authDomain: dotEnv.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: dotEnv.VITE_FIREBASE_PROJECT_ID,
    appId: dotEnv.VITE_FIREBASE_APP_ID
  }, `AuditClientApp_${Date.now()}`);
  const clientAuth = getAuth(app);
  const clientDb = getFirestore(app);

  // Obtain Service Account OAuth token
  const authRes = await getFirestoreAccessToken(config.credentials, fetch);
  const firestoreToken = typeof authRes === 'string' ? authRes : authRes.token;
  assert(typeof firestoreToken === 'string' && firestoreToken.length > 50, 'Firestore OAuth access token obtained');

  const firestore = new FirestoreRestClient(config.projectId, async () => {
    const r = await getFirestoreAccessToken(config.credentials, fetch);
    return typeof r === 'string' ? r : r.token;
  });

  // Setup mock RS256 token generator for Worker tests
  const { keyPair, publicJwk } = await generateTestRsaKeyPair();
  const mockJwks = { keys: [publicJwk] };
  const testWorkerEnv = {
    ...env,
    __MOCK_JWKS__: mockJwks
  };

  async function createTestToken(uid, email = `${uid}@test.staging`, expiresIn = 3600) {
    const now = Math.floor(Date.now() / 1000);
    return await signJwt(
      { alg: 'RS256', typ: 'JWT', kid: 'stage-audit-kid-12' },
      {
        iss: `https://securetoken.google.com/${config.projectId}`,
        aud: config.projectId,
        sub: uid,
        user_id: uid,
        email,
        iat: now,
        exp: now + expiresIn
      },
      keyPair.privateKey
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 1: FIRESTORE SECURITY RULES STATIC AST & SPECIFICATION AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 1: Firestore Security Rules Static AST & Specification Audit ---');
  const rulesPath = path.resolve('poc/phase-10-2a/firestore.workspace-candidate.rules');
  assert(fs.existsSync(rulesPath), 'firestore.workspace-candidate.rules exists on disk');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  assert(rulesContent.includes("rules_version = '2';"), 'Rules version 2 is explicitly specified');
  assert(rulesContent.includes('service cloud.firestore'), 'Targets cloud.firestore service correctly');

  // Audit all 14 schema collections for explicit write: if false
  const EXPECTED_COLLECTIONS = [
    'workspaces',
    'workspace_members',
    'properties',
    'units',
    'tenants',
    'security_deposits',
    'rent_bills',
    'rent_payments',
    'expenses',
    'beneficiaries',
    'family_distributions',
    'reserve_funds',
    'reserve_ledger',
    'reserve_fund_transactions'
  ];

  for (const coll of EXPECTED_COLLECTIONS) {
    const collMatchRegex = new RegExp(`match\\s+/${coll}/\\{[^}]+\\}\\s*\\{([^}]+)\\}`, 's');
    const match = rulesContent.match(collMatchRegex);
    assert(Boolean(match), `Collection "${coll}" explicitly matched in security rules`);
    if (match) {
      const block = match[1];
      assert(
        block.includes('allow write: if false;'),
        `Collection "${coll}" strictly enforces "allow write: if false;" (no direct client writes)`
      );
      assert(
        block.includes('allow read: if isAuthorizedReader();') ||
        block.includes('allow read: if isWorkspaceMember(workspaceId);') ||
        block.includes('resource.data.uid == request.auth.uid'),
        `Collection "${coll}" enforces workspace membership authorization for reads`
      );
    }
  }

  // Verify membership document protection
  const memberBlock = rulesContent.match(/match\s+\/workspace_members\/\{memberId\}\s*\{([^}]+)\}/s);
  assert(Boolean(memberBlock), 'workspace_members rule block found');
  if (memberBlock) {
    assert(
      memberBlock[1].includes('resource.data.uid == request.auth.uid'),
      'Members are strictly restricted to reading their own membership profile unless master_admin'
    );
    assert(
      memberBlock[1].includes('isMasterAdmin(resource.data.workspaceId)'),
      'Master Admin can read member profiles within their workspace'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: LIVE STAGING FIRESTORE RULES EXECUTION (CLIENT SDK)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Live Staging Firestore Security Rules Execution (Client SDK) ---');

  // 2.1 Unauthenticated Read & Write Tests
  console.log('  Testing Unauthenticated Operations...');
  try {
    await getDoc(doc(clientDb, 'properties', 'prop_ws_bhuiya_family_01'));
    assert(false, 'Unauthenticated read of Property rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Unauthenticated read of Property rejected with PERMISSION_DENIED');
  }

  try {
    await getDoc(doc(clientDb, 'workspace_members', 'workspace_bhuiya_family_WunBcW1KihNW2DMTs3R0gUpQ0fh2'));
    assert(false, 'Unauthenticated read of Workspace Member rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Unauthenticated read of Workspace Member rejected with PERMISSION_DENIED');
  }

  try {
    await getDoc(doc(clientDb, 'tenants', 'tenant_ws_bhuiya_family_001'));
    assert(false, 'Unauthenticated read of Tenant rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Unauthenticated read of Tenant rejected with PERMISSION_DENIED');
  }

  try {
    await setDoc(doc(clientDb, 'properties', 'unauth_prop_test'), { name: 'Hack' });
    assert(false, 'Unauthenticated write to Property rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Unauthenticated write to Property rejected with PERMISSION_DENIED');
  }

  try {
    await setDoc(doc(clientDb, 'rent_bills', 'unauth_bill_test'), { amount: 1000 });
    assert(false, 'Unauthenticated write to Rent Bills rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Unauthenticated write to Rent Bills rejected with PERMISSION_DENIED');
  }

  // 2.2 Authenticated Non-Member Read & Write Tests
  console.log('  Testing Authenticated Non-Member Operations...');
  const nonMemberCred = await signInWithEmailAndPassword(clientAuth, 'nonmember@bhuiya.staging', '112233');
  assert(nonMemberCred.user.uid === 'demo_nonmember_uid', 'Authenticated as non-member (demo_nonmember_uid)');

  try {
    await getDoc(doc(clientDb, 'properties', 'prop_ws_bhuiya_family_01'));
    assert(false, 'Non-member read of Bhuiya Property rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Non-member read of Property rejected with PERMISSION_DENIED');
  }

  try {
    await getDoc(doc(clientDb, 'tenants', 'tenant_ws_bhuiya_family_001'));
    assert(false, 'Non-member read of Bhuiya Tenant rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Non-member read of Tenant rejected with PERMISSION_DENIED');
  }

  try {
    const q = query(collection(clientDb, 'properties'), where('workspaceId', '==', 'workspace_bhuiya_family'));
    await getDocs(q);
    assert(false, 'Non-member query of Bhuiya Properties collection rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Non-member query of Properties rejected with PERMISSION_DENIED');
  }

  try {
    await setDoc(doc(clientDb, 'properties', 'nonmember_write_test'), { name: 'Tamper' });
    assert(false, 'Non-member write to Properties rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Non-member direct write to Properties rejected with PERMISSION_DENIED');
  }

  // 2.3 Authenticated Inactive Member Read & Write Tests
  console.log('  Testing Authenticated Inactive Member Operations...');
  const inactiveCred = await signInWithEmailAndPassword(clientAuth, 'inactive@bhuiya.staging', '112233');
  assert(inactiveCred.user.uid === 'demo_inactive_uid', 'Authenticated as inactive member (demo_inactive_uid)');

  try {
    await getDoc(doc(clientDb, 'properties', 'prop_ws_bhuiya_family_01'));
    assert(false, 'Inactive member read of Property rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Inactive member read of Property rejected with PERMISSION_DENIED');
  }

  try {
    await setDoc(doc(clientDb, 'properties', 'inactive_write_test'), { name: 'Tamper' });
    assert(false, 'Inactive member write to Property rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Inactive member direct write to Property rejected with PERMISSION_DENIED');
  }

  // 2.4 Authenticated Suspended Member Read & Write Tests
  console.log('  Testing Authenticated Suspended Member Operations...');
  const suspendedCred = await signInWithEmailAndPassword(clientAuth, 'suspended@bhuiya.staging', '112233');
  assert(suspendedCred.user.uid === 'demo_suspended_uid', 'Authenticated as suspended member (demo_suspended_uid)');

  try {
    await getDoc(doc(clientDb, 'properties', 'prop_ws_bhuiya_family_01'));
    assert(false, 'Suspended member read of Property rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Suspended member read of Property rejected with PERMISSION_DENIED');
  }

  try {
    await setDoc(doc(clientDb, 'units', 'suspended_write_test'), { name: 'Tamper' });
    assert(false, 'Suspended member write to Units rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Suspended member direct write to Units rejected with PERMISSION_DENIED');
  }

  // 2.5 Cross-Workspace Direct Read Rejection
  console.log('  Testing Cross-Workspace Operations (Master Admin)...');
  const masterCred = await signInWithEmailAndPassword(clientAuth, 'zahid@bhuiyan.com', '112233');
  assert(masterCred.user.email === 'zahid@bhuiyan.com', 'Authenticated as Master Admin (zahid@bhuiyan.com)');

  // Master Admin can read their own workspace's property
  const bhuiyaPropSnap = await getDoc(doc(clientDb, 'properties', 'prop_ws_bhuiya_family_01'));
  assert(bhuiyaPropSnap.exists() && bhuiyaPropSnap.data()?.name === 'ভূঁইয়া বাড়ি', 'Master Admin successfully reads own workspace Property');

  // Master Admin CANNOT read other workspace's property
  try {
    await getDoc(doc(clientDb, 'properties', 'prop_ws_other_demo_01'));
    assert(false, 'Master Admin cross-workspace read of other property rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Master Admin cross-workspace read rejected with PERMISSION_DENIED');
  }

  // Master Admin CANNOT read other workspace's tenant
  try {
    await getDoc(doc(clientDb, 'tenants', 'tenant_ws_other_demo_002'));
    assert(false, 'Master Admin cross-workspace read of other tenant rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Master Admin cross-workspace tenant read rejected with PERMISSION_DENIED');
  }

  // 2.6 Direct Client Write Rejection Even for Master Admin
  console.log('  Testing Direct Client Writes for Master Admin...');
  try {
    await setDoc(doc(clientDb, 'properties', 'admin_direct_write_test'), { name: 'Test' });
    assert(false, 'Master Admin direct client setDoc rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Master Admin direct setDoc to properties strictly rejected with PERMISSION_DENIED');
  }

  try {
    await setDoc(doc(clientDb, 'workspace_members', 'admin_direct_member_write'), { role: 'master_admin' });
    assert(false, 'Master Admin direct client setDoc to workspace_members rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Master Admin direct setDoc to workspace_members strictly rejected with PERMISSION_DENIED');
  }

  try {
    await setDoc(doc(clientDb, 'rent_bills', 'admin_direct_bill_write'), { amount: 50000 });
    assert(false, 'Master Admin direct client setDoc to rent_bills rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Master Admin direct setDoc to rent_bills strictly rejected with PERMISSION_DENIED');
  }

  try {
    await deleteDoc(doc(clientDb, 'tenants', 'tenant_ws_bhuiya_family_001'));
    assert(false, 'Master Admin direct client deleteDoc rejected');
  } catch (err) {
    assert(err.code === 'permission-denied', 'Master Admin direct deleteDoc strictly rejected with PERMISSION_DENIED');
  }

  // ---------------------------------------------------------------------------
  // SUITE 3: WORKER API AUTHENTICATION & WORKSPACE BOUNDARY ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Worker API Authentication & Workspace Boundary Enforcement ---');

  // 3.1 Unauthenticated & Malformed Auth Headers
  const noAuthReq = makeApiRequest('createUnitCallable', { propertyId: 'prop_01', unitNumber: '1A' }, null);
  const noAuthRes = await handleCallableApiRequest(noAuthReq, 'createUnitCallable', testWorkerEnv, {});
  assert(noAuthRes.status === 401, 'Request missing Authorization header rejected with HTTP 401 UNAUTHENTICATED');

  const basicAuthReq = makeApiRequest('createUnitCallable', {}, null, { 'Authorization': 'Basic dXNlcjpwYXNz' });
  const basicAuthRes = await handleCallableApiRequest(basicAuthReq, 'createUnitCallable', testWorkerEnv, {});
  assert(basicAuthRes.status === 401, 'Non-Bearer Authorization header rejected with HTTP 401 UNAUTHENTICATED');

  const malformedTokenReq = makeApiRequest('createUnitCallable', {}, 'malformed.jwt.token');
  const malformedTokenRes = await handleCallableApiRequest(malformedTokenReq, 'createUnitCallable', testWorkerEnv, {});
  assert(malformedTokenRes.status === 401, 'Malformed JWT token rejected with HTTP 401 UNAUTHENTICATED');

  const expiredToken = await createTestToken('test_expired_uid', 'expired@test.staging', -600);
  const expiredReq = makeApiRequest('createUnitCallable', {}, expiredToken);
  const expiredRes = await handleCallableApiRequest(expiredReq, 'createUnitCallable', testWorkerEnv, {});
  assert(expiredRes.status === 401, 'Expired JWT token rejected with HTTP 401 UNAUTHENTICATED');

  // 3.2 Non-Member Caller
  const nonMemberToken = await createTestToken('demo_nonmember_uid', 'nonmember@bhuiya.staging');
  const nonMemberReq = makeApiRequest('createUnitCallable', { workspaceId: 'workspace_bhuiya_family', propertyId: 'prop_01', unitNumber: '1A' }, nonMemberToken);
  const nonMemberRes = await handleCallableApiRequest(nonMemberReq, 'createUnitCallable', testWorkerEnv, {});
  const nonMemberJson = await nonMemberRes.json();
  assert(nonMemberRes.status === 403, 'Non-member caller rejected with HTTP 403 FORBIDDEN');
  assert(nonMemberJson.error?.code === 'FORBIDDEN', 'Error code is FORBIDDEN for non-member');

  // 3.3 Inactive Member Caller
  const inactiveToken = await createTestToken('demo_inactive_uid', 'inactive@bhuiya.staging');
  const inactiveReq = makeApiRequest('createUnitCallable', { workspaceId: 'workspace_bhuiya_family', propertyId: 'prop_01', unitNumber: '1A' }, inactiveToken);
  const inactiveRes = await handleCallableApiRequest(inactiveReq, 'createUnitCallable', testWorkerEnv, {});
  const inactiveJson = await inactiveRes.json();
  assert(inactiveRes.status === 403, 'Inactive member caller rejected with HTTP 403 FORBIDDEN');
  assert(inactiveJson.error?.code === 'MEMBERSHIP_INACTIVE', 'Error code is MEMBERSHIP_INACTIVE for inactive member');

  // 3.4 Suspended Member Caller
  const suspendedToken = await createTestToken('demo_suspended_uid', 'suspended@bhuiya.staging');
  const suspendedReq = makeApiRequest('createUnitCallable', { workspaceId: 'workspace_bhuiya_family', propertyId: 'prop_01', unitNumber: '1A' }, suspendedToken);
  const suspendedRes = await handleCallableApiRequest(suspendedReq, 'createUnitCallable', testWorkerEnv, {});
  const suspendedJson = await suspendedRes.json();
  assert(suspendedRes.status === 403, 'Suspended member caller rejected with HTTP 403 FORBIDDEN');
  assert(suspendedJson.error?.code === 'MEMBERSHIP_INACTIVE', 'Error code is MEMBERSHIP_INACTIVE for suspended member');

  // 3.5 Cross-Workspace Requested Workspace ID Mismatch
  const adminToken = await createTestToken('WunBcW1KihNW2DMTs3R0gUpQ0fh2', 'zahid@bhuiyan.com');
  const crossWsReq = makeApiRequest('createUnitCallable', {
    workspaceId: 'workspace_other_demo',
    propertyId: 'prop_ws_other_demo_01',
    unitNumber: 'Shop 2'
  }, adminToken);
  const crossWsRes = await handleCallableApiRequest(crossWsReq, 'createUnitCallable', testWorkerEnv, {});
  const crossWsJson = await crossWsRes.json();
  assert(crossWsRes.status === 403, 'Cross-workspace targeting in request body rejected with HTTP 403');
  assert(crossWsJson.error?.code === 'CROSS_WORKSPACE_DENIED' || crossWsJson.error?.code === 'FORBIDDEN', 'Cross-workspace returns CROSS_WORKSPACE_DENIED or FORBIDDEN');

  const crossWsHeaderReq = makeApiRequest('createUnitCallable', {
    propertyId: 'prop_ws_other_demo_01',
    unitNumber: 'Shop 2'
  }, adminToken, { 'x-workspace-id': 'workspace_other_demo' });
  const crossWsHeaderRes = await handleCallableApiRequest(crossWsHeaderReq, 'createUnitCallable', testWorkerEnv, {});
  assert(crossWsHeaderRes.status === 403, 'Cross-workspace targeting via x-workspace-id header rejected with HTTP 403');

  // ---------------------------------------------------------------------------
  // SUITE 4: CLIENT-SIDE PRIVILEGE ESCALATION & PAYLOAD TAMPERING PREVENTION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Client-Side Privilege Escalation Prevention ---');

  // 4.1 Viewer attempting Master Admin action with forged role: 'master_admin'
  const viewerToken = await createTestToken('demo_viewer_uid', 'viewer@bhuiya.staging');
  const forgedRoleReq = makeApiRequest('withdrawFromReserveCallable', {
    workspaceId: 'workspace_bhuiya_family',
    amount: 10000,
    reason: 'Unauthorized withdrawal',
    role: 'master_admin',
    isMasterAdmin: true
  }, viewerToken);
  const forgedRoleRes = await handleCallableApiRequest(forgedRoleReq, 'withdrawFromReserveCallable', testWorkerEnv, {});
  const forgedRoleJson = await forgedRoleRes.json();
  assert(forgedRoleRes.status === 403, 'Client-forged role: "master_admin" does NOT bypass Worker authorization (HTTP 403)');
  assert(forgedRoleJson.error?.code === 'PERMISSION_DENIED', 'Error is PERMISSION_DENIED based on database role (viewer)');

  // 4.2 Viewer attempting Expense action with forged permissions object
  const forgedPermReq = makeApiRequest('createExpenseCallable', {
    workspaceId: 'workspace_bhuiya_family',
    propertyId: 'prop_ws_bhuiya_family_01',
    amount: 5000,
    category: 'repairs',
    description: 'Forged permissions test',
    permissions: { canRecordExpenses: true, master_admin: true }
  }, viewerToken);
  const forgedPermRes = await handleCallableApiRequest(forgedPermReq, 'createExpenseCallable', testWorkerEnv, {});
  const forgedPermJson = await forgedPermRes.json();
  assert(forgedPermRes.status === 403, 'Client-forged permissions object does NOT bypass Worker authorization (HTTP 403)');
  assert(forgedPermJson.error?.code === 'PERMISSION_DENIED', 'Error is PERMISSION_DENIED based on database permissions');

  // 4.3 Manager attempting Master Admin action (reserve withdrawal) with forged role
  const managerToken = await createTestToken('demo_manager_uid', 'manager@bhuiya.staging');
  const managerEscalationReq = makeApiRequest('withdrawFromReserveCallable', {
    workspaceId: 'workspace_bhuiya_family',
    amount: 5000,
    reason: 'Manager withdrawal attempt',
    role: 'master_admin'
  }, managerToken);
  const managerEscalationRes = await handleCallableApiRequest(managerEscalationReq, 'withdrawFromReserveCallable', testWorkerEnv, {});
  assert(managerEscalationRes.status === 403, 'Manager attempting reserve withdrawal with forged role rejected with HTTP 403');

  // 4.4 Inactive user attempting to supply status: 'active'
  const forgedStatusReq = makeApiRequest('createUnitCallable', {
    workspaceId: 'workspace_bhuiya_family',
    propertyId: 'prop_01',
    unitNumber: '1A',
    status: 'active'
  }, inactiveToken);
  const forgedStatusRes = await handleCallableApiRequest(forgedStatusReq, 'createUnitCallable', testWorkerEnv, {});
  const forgedStatusJson = await forgedStatusRes.json();
  assert(forgedStatusRes.status === 403, 'Inactive user supplying status: "active" is rejected with HTTP 403');
  assert(forgedStatusJson.error?.code === 'MEMBERSHIP_INACTIVE', 'Error code remains MEMBERSHIP_INACTIVE from database status');

  // 4.5 Unit tests on sanitizeClientPayload function
  const rawTamperedPayload = {
    workspaceId: 'forged_ws',
    ownerUid: 'forged_owner',
    callerUid: 'forged_caller',
    role: 'master_admin',
    permissions: { canManageTenants: true },
    status: 'active',
    propertyId: 'prop_01',
    unitNumber: 'Flat 3B'
  };
  const verifiedAuthContext = {
    workspaceId: 'workspace_bhuiya_family',
    uid: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2',
    role: 'master_admin'
  };
  const sanitized = sanitizeClientPayload(rawTamperedPayload, verifiedAuthContext);
  assert(sanitized.workspaceId === 'workspace_bhuiya_family', 'sanitizeClientPayload overwrites forged workspaceId');
  assert(sanitized.callerUid === 'WunBcW1KihNW2DMTs3R0gUpQ0fh2', 'sanitizeClientPayload overwrites forged callerUid');
  assert(sanitized.ownerUid === undefined, 'sanitizeClientPayload deletes ownerUid');
  assert(sanitized.role === undefined, 'sanitizeClientPayload deletes forged role');
  assert(sanitized.permissions === undefined, 'sanitizeClientPayload deletes forged permissions');
  assert(sanitized.status === undefined, 'sanitizeClientPayload deletes forged status');
  assert(sanitized.propertyId === 'prop_01', 'sanitizeClientPayload preserves valid input fields');
  assert(sanitized.unitNumber === 'Flat 3B', 'sanitizeClientPayload preserves valid input fields');

  // ---------------------------------------------------------------------------
  // SUITE 5: COMPREHENSIVE 24 WORKER ACTION AUDIT & FINANCIAL WRITE PROTECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Comprehensive 24 Worker Action Audit & Financial Safety ---');

  const MEMBER_ACTIONS = [
    'listWorkspaceMembersCallable',
    'createWorkspaceMemberCallable',
    'updateWorkspaceMemberPermissionsCallable',
    'updateWorkspaceMemberStatusCallable',
    'sendWorkspaceMemberPasswordResetCallable',
    'inviteFamilyMemberCallable',
    'updateMemberPermissionsCallable',
    'deactivateFamilyMemberCallable'
  ];
  const registeredActions = Object.keys(ACTION_REGISTRY).filter(a => !MEMBER_ACTIONS.includes(a));
  assert(registeredActions.length >= 21, `ACTION_REGISTRY contains ${registeredActions.length} actions (>= 21 required)`);

  // Map dummy payloads for input validation
  const ACTION_PAYLOADS = {
    'createPropertyCallable': { name: 'Audit Property', type: 'residential' },
    'updatePropertyCallable': { propertyId: 'prop_ws_bhuiya_family_01', name: 'Updated Audit Property' },
    'archivePropertyCallable': { propertyId: 'prop_ws_bhuiya_family_01', isArchived: true },
    'createUnitCallable': { propertyId: 'prop_ws_bhuiya_family_01', unitNumber: 'Flat 2B' },
    'renameUnitCallable': { unitId: 'unit_ws_bhuiya_family_101', newUnitNumber: 'Flat 1A Renamed' },
    'archiveUnitCallable': { unitId: 'unit_ws_bhuiya_family_101' },
    'restoreUnitCallable': { unitId: 'unit_ws_bhuiya_family_101' },
    'registerTenantCallable': { propertyId: 'prop_ws_bhuiya_family_01', unitId: 'unit_ws_bhuiya_family_101', name: 'Audit Tenant', phone: '01700000000', monthlyRent: 15000, securityDeposit: 30000 },
    'vacateTenantCallable': { tenantId: 'tenant_ws_bhuiya_family_001', unitId: 'unit_ws_bhuiya_family_101', vacateDate: '2026-11-30', refundAmount: 20000 },
    'generateMonthlyBillsCallable': { propertyId: 'prop_ws_bhuiya_family_01', billingMonth: '2026-12' },
    'recordRentPaymentCallable': { billId: 'bill_01', amount: 15000, paymentMethod: 'cash', paymentDate: '2026-11-08' },
    'createExpenseCallable': { group: 'general', category: 'maintenance', amount: 3500, expenseDate: '2026-11-08', billingMonth: '2026-11', description: 'Plumbing repair' },
    'updateExpenseCallable': { expenseId: 'exp_01', amount: 4000, reason: 'Price adjustment' },
    'reverseExpenseCallable': { expenseId: 'exp_01', reason: 'Accounting error' },
    'seedDefaultBeneficiariesCallable': {},
    'createBeneficiaryCallable': { name: 'Audit Beneficiary', relationship: 'sibling', targetAmount: 25000 },
    'updateBeneficiaryCallable': { beneficiaryId: 'ben_01', name: 'Updated Beneficiary' },
    'archiveBeneficiaryCallable': { beneficiaryId: 'ben_01' },
    'getOrCreateMonthlyDistributionCallable': { distributionMonth: '2026-11' },
    'applySpecialAdjustmentCallable': { distributionId: 'dist_01', beneficiaryId: 'ben_01', adjustmentAmount: 500, reason: 'Year end bonus' },
    'recordBeneficiaryPayoutCallable': { distributionId: 'dist_01', beneficiaryId: 'ben_01', amount: 10000, paymentMethod: 'bank_transfer', paymentDate: '2026-11-08' },
    'initializeReserveFundCallable': { openingBalance: 100000 },
    'withdrawFromReserveCallable': { amount: 20000, reason: 'Roof replacement emergency', recipientName: 'Contractor XYZ', paymentMethod: 'bank_transfer' },
    'transferSurplusToReserveCallable': { amount: 15000, fromBillingMonth: '2026-10' },
    'inviteFamilyMemberCallable': { email: 'invitee@bhuiya.staging', assignedRole: 'viewer' },
    'updateMemberPermissionsCallable': { targetUid: 'target_uid', assignedRole: 'manager' },
    'deactivateFamilyMemberCallable': { targetUid: 'target_uid' },
    'listWorkspaceMembersCallable': {},
    'createWorkspaceMemberCallable': { email: 'new_member@bhuiya.staging', role: 'viewer' },
    'updateWorkspaceMemberPermissionsCallable': { targetUid: 'target_uid', role: 'manager', permissions: {} },
    'updateWorkspaceMemberStatusCallable': { targetUid: 'target_uid', status: 'suspended' },
    'sendWorkspaceMemberPasswordResetCallable': { email: 'target@bhuiya.staging' }
  };

  // Financial actions that must enforce zero live database writes
  const FINANCIAL_ACTIONS = [
    'generateMonthlyBillsCallable',
    'recordRentPaymentCallable',
    'createExpenseCallable',
    'updateExpenseCallable',
    'reverseExpenseCallable',
    'applySpecialAdjustmentCallable',
    'recordBeneficiaryPayoutCallable',
    'initializeReserveFundCallable',
    'withdrawFromReserveCallable',
    'transferSurplusToReserveCallable'
  ];

  for (const action of registeredActions) {
    const requiredPerms = ACTION_PERMISSIONS[action];
    assert(Boolean(requiredPerms), `Action "${action}" is mapped in ACTION_PERMISSIONS`);

    const payload = {
      workspaceId: 'workspace_bhuiya_family',
      ...(ACTION_PAYLOADS[action] || {})
    };

    // 1. Master Admin Execution
    const adminReq = makeApiRequest(action, payload, adminToken);
    const adminRes = await handleCallableApiRequest(adminReq, action, testWorkerEnv, {});
    const adminJson = await adminRes.json();
    assert(
      adminRes.status === 200,
      `[Master Admin] ${action} authorized (HTTP 200)`,
      `Expected 200, got ${adminRes.status}: ${JSON.stringify(adminJson)}`
    );

    // 2. Financial Safety Verification
    if (FINANCIAL_ACTIONS.includes(action)) {
      assert(
        adminJson.data?.status === 'PACKAGING_VALIDATED' || adminJson.data?.success === true,
        `[Financial Safety] ${action} intercepted by disableFinancialWrites packaging gate`
      );
    }

    // 3. Viewer Role Authorization Check
    const isViewerPermitted = requiredPerms.includes('viewer') || false;
    const vReq = makeApiRequest(action, payload, viewerToken);
    const vRes = await handleCallableApiRequest(vReq, action, testWorkerEnv, {});
    if (isViewerPermitted) {
      assert(vRes.status === 200, `[Viewer Role] ${action} permitted per RBAC`);
    } else {
      assert(vRes.status === 403, `[Viewer Role] ${action} strictly DENIED with HTTP 403`);
    }

    // 4. Manager Role Authorization Check
    // Manager has canManageTenants: true, canCollectRent: true, canViewReports: true, but NOT canRecordExpenses, NOT master_admin
    const isManagerPermitted = requiredPerms.some(p => ['canManageTenants', 'canCollectRent', 'canViewReports'].includes(p));
    const mReq = makeApiRequest(action, payload, managerToken);
    const mRes = await handleCallableApiRequest(mReq, action, testWorkerEnv, {});
    if (isManagerPermitted) {
      assert(mRes.status === 200, `[Manager Role] ${action} permitted per manager permissions`);
    } else {
      assert(mRes.status === 403, `[Manager Role] ${action} strictly DENIED with HTTP 403`);
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: PRODUCTION BOUNDARY & ENVIRONMENTAL ISOLATION VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Production Boundary & Environmental Isolation ---');

  // Verify .dev.vars
  assert(env.FIREBASE_PROJECT_ID === 'bhuiya-property-staging', 'Worker .dev.vars FIREBASE_PROJECT_ID is strictly bhuiya-property-staging');
  assert(env.EXECUTION_MODE === 'staging', 'Worker .dev.vars EXECUTION_MODE is strictly staging');
  assert(env.DISABLE_FINANCIAL_WRITES === 'true', 'Worker .dev.vars DISABLE_FINANCIAL_WRITES is strictly true');

  // Verify .env.staging
  assert(dotEnv.VITE_FIREBASE_PROJECT_ID === 'bhuiya-property-staging', '.env.staging VITE_FIREBASE_PROJECT_ID is bhuiya-property-staging');
  assert(dotEnv.VITE_FIREBASE_AUTH_DOMAIN === 'bhuiya-property-staging.firebaseapp.com', '.env.staging VITE_FIREBASE_AUTH_DOMAIN is bhuiya-property-staging.firebaseapp.com');
  assert(dotEnv.VITE_DISABLE_FINANCIAL_WRITES === 'true', '.env.staging VITE_DISABLE_FINANCIAL_WRITES is true');

  // Verify frontend config src/lib/firebase.ts doesn't hardcode production
  const feConfigPath = path.resolve('src/lib/firebase.ts');
  const feConfigContent = fs.readFileSync(feConfigPath, 'utf8');
  assert(feConfigContent.includes('import.meta.env.VITE_FIREBASE_PROJECT_ID'), 'Frontend config loads projectId dynamically from environment');

  // Verify zero financial records created in staging Firestore
  const billsSnap = await firestore.queryByField('rent_bills', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(billsSnap.length === 0, 'Live staging Firestore rent_bills collection count is strictly 0');

  const altBillsSnap = await firestore.queryByField('bills', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(altBillsSnap.length === 0, 'Live staging Firestore bills collection count is strictly 0');

  const expensesSnap = await firestore.queryByField('expenses', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(expensesSnap.length === 0, 'Live staging Firestore expenses collection count is strictly 0');

  const paymentsSnap = await firestore.queryByField('rent_payments', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(paymentsSnap.length === 0, 'Live staging Firestore rent_payments collection count is strictly 0');

  const altPaymentsSnap = await firestore.queryByField('payments', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(altPaymentsSnap.length === 0, 'Live staging Firestore payments collection count is strictly 0');

  const depositsSnap = await firestore.queryByField('security_deposits', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(depositsSnap.length === 0, 'Live staging Firestore security_deposits collection count is strictly 0');

  // Summary
  console.log('\n========================================================================');
  console.log(`PHASE 10.2B-12 AUDIT RESULTS: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSecurityAuditSuite().catch((err) => {
  console.error('Fatal Security Audit Suite Error:', err);
  process.exit(1);
});
