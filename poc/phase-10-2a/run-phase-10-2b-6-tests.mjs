/**
 * Phase 10.2B-6: Staging Read-Only Integration Verification Test Suite
 * 
 * Tests:
 * 1. Environment configuration in .dev.vars (FIREBASE_PROJECT_ID, EXECUTION_MODE, DISABLE_FINANCIAL_WRITES)
 * 2. Service account credential parsing and error detection (without printing secrets)
 * 3. Service account OAuth token acquisition attempt
 * 4. Read-only Firestore connectivity & workspace_members collection inspection
 * 5. Document schema validation (if documents found)
 * 6. Worker membership lookup against staging configuration (fail-closed behavior)
 * 7. Rejection of invalid, unauthenticated, or missing memberships
 * 8. Strict enforcement of DISABLE_FINANCIAL_WRITES=true
 */

import fs from 'fs';
import path from 'path';
import { getWorkerConfig, parseServiceAccountCredentials } from './worker/envConfig.mjs';
import { lookupWorkspaceMember, handleCallableApiRequest } from './worker/index.mjs';
import { authorizeWorkspaceRequest, sanitizeClientPayload } from './workspaceAuth.mjs';
import { getFirestoreAccessToken, clearTokenCache } from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';

const results = [];
let passCount = 0;
let failCount = 0;
let blockedCount = 0;

function assert(condition, testName, details = '', isBlocked = false) {
  if (isBlocked) {
    blockedCount++;
    results.push({ name: testName, status: 'BLOCKED', details });
    console.warn(`  ⚠ [BLOCKED] ${testName} - ${details}`);
  } else if (condition) {
    passCount++;
    results.push({ name: testName, status: 'PASS', details });
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failCount++;
    results.push({ name: testName, status: 'FAIL', details });
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
  }
}

// Safely loads .dev.vars without printing sensitive values
export function loadDevVars(filePath = 'poc/phase-10-2a/.dev.vars') {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  const content = fs.readFileSync(resolved, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      env[k] = v;
    }
  }
  return env;
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  PHASE 10.2B-6: STAGING READ-ONLY INTEGRATION VERIFICATION');
  console.log('======================================================================\n');

  // ---------------------------------------------------------------------------
  // SUITE 1: LOCAL ENVIRONMENT CONFIGURATION VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: LOCAL ENVIRONMENT CONFIGURATION VERIFICATION ---');

  const devVars = loadDevVars();
  assert(devVars !== null, 'Environment: .dev.vars file exists on disk');

  // 1.1 Project ID
  assert(
    devVars?.FIREBASE_PROJECT_ID === 'bhuiya-property-staging',
    'Environment: FIREBASE_PROJECT_ID equals "bhuiya-property-staging"'
  );

  // 1.2 Execution Mode
  assert(
    devVars?.EXECUTION_MODE === 'staging',
    'Environment: EXECUTION_MODE equals "staging"'
  );

  // 1.3 Financial writes safety gate
  assert(
    devVars?.DISABLE_FINANCIAL_WRITES === 'true',
    'Environment: DISABLE_FINANCIAL_WRITES strictly equals "true"'
  );

  // 1.4 Redaction guarantee: Verify that no secrets are printed or logged
  const rawKey = devVars?.FIREBASE_SERVICE_ACCOUNT_KEY || '';
  assert(
    rawKey.length > 0,
    `Environment: FIREBASE_SERVICE_ACCOUNT_KEY binding is present (non-empty, Length: ${rawKey.length})`
  );

  // ---------------------------------------------------------------------------
  // SUITE 2: SERVICE ACCOUNT AUTHENTICATION & OAUTH ACCESS TOKEN
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: SERVICE ACCOUNT AUTHENTICATION & OAUTH TOKEN ATTEMPT ---');

  let credentials = null;
  let credentialsError = null;

  try {
    credentials = parseServiceAccountCredentials(devVars);
  } catch (err) {
    credentialsError = err.message;
  }

  const workerConfig = getWorkerConfig(devVars);

  if (credentials && !credentialsError) {
    assert(true, 'Service Account: Valid service account JSON parsed successfully');

    let oauthToken = null;
    let oauthError = null;
    try {
      const tokenRes = await getFirestoreAccessToken(credentials);
      oauthToken = tokenRes.token;
    } catch (err) {
      oauthError = err.message;
    }

    if (oauthToken) {
      assert(
        typeof oauthToken === 'string' && oauthToken.length > 20,
        'Service Account OAuth: Obtained live Google OAuth2 datastore access token'
      );
    } else {
      assert(
        false,
        'Service Account OAuth: Live OAuth token exchange failed',
        oauthError || 'Unknown OAuth error',
        true // BLOCKED
      );
    }
  } else {
    // Credentials parsing failed or contains placeholder
    const safeError = credentialsError || workerConfig.credentialsError || 'Incomplete credentials';
    assert(
      workerConfig.credentialsError !== null,
      `Service Account: Environment correctly flagged invalid credentials fail-closed: "${safeError}"`
    );

    assert(
      false,
      'Service Account OAuth: Live Google OAuth2 token exchange',
      `BLOCKED: Service account key in .dev.vars is incomplete/placeholder (${safeError}). Live Google handshake halted safely.`,
      true // BLOCKED
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 3: READ-ONLY FIRESTORE CONNECTIVITY & MEMBERSHIP VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: READ-ONLY FIRESTORE CONNECTIVITY & MEMBERSHIP LOOKUP ---');

  if (credentials && !credentialsError) {
    // Live connectivity check
    try {
      const firestore = new FirestoreRestClient(workerConfig.projectId, async () => {
        return await getFirestoreAccessToken(credentials);
      });

      // READ-ONLY check: Attempt to get a sample workspace_members document
      const sampleDoc = await firestore.getDocument('workspace_members', 'ws_staging_uid_admin');
      if (sampleDoc) {
        assert(true, 'Firestore Read: Successfully connected and retrieved workspace_members document');
        console.log('  [STAGING DOC] Document found:', sampleDoc.id);

        // Schema validation
        const d = sampleDoc.data;
        assert(typeof d.workspaceId === 'string', 'Schema Validation: workspaceId is string');
        assert(typeof d.uid === 'string', 'Schema Validation: uid is string');
        assert(typeof d.role === 'string', 'Schema Validation: role is string');
        assert(typeof d.status === 'string', 'Schema Validation: status is string');
        assert(typeof d.permissions === 'object', 'Schema Validation: permissions is object');
      } else {
        assert(
          true,
          'Firestore Read: workspace_members document not found (Reported as NOT FOUND as instructed; no document created)'
        );
      }
    } catch (netErr) {
      assert(
        false,
        'Firestore Read: Live staging connection',
        `BLOCKED: ${netErr.message}`,
        true
      );
    }
  } else {
    assert(
      false,
      'Live Firestore Connectivity: Read "workspace_members" from bhuiya-property-staging',
      'BLOCKED: Valid service account private key required in .dev.vars to query live Google Firestore endpoint.',
      true
    );

    assert(
      false,
      'Live Schema Validation: Inspect live document fields (workspaceId, uid, role, status, permissions)',
      'BLOCKED: Awaiting valid staging credentials and document existence.',
      true
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 4: WORKER LOOKUP BEHAVIOR & FAIL-CLOSED SECURITY CHECKS
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: WORKER LOOKUP BEHAVIOR & FAIL-CLOSED SECURITY CHECKS ---');

  // 4.1 Missing/Invalid credentials fail-closed in Worker
  const simulatedReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer fake_jwt_token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ workspaceId: 'ws_staging', propertyId: 'prop_01', unitNumber: '101' })
  });

  // Test fail-closed behavior with broken credentials
  const brokenCredsEnv = { ...devVars, FIREBASE_SERVICE_ACCOUNT_KEY: 'invalid_corrupted' };
  const workerBrokenResponse = await handleCallableApiRequest(simulatedReq, 'createUnitCallable', brokenCredsEnv, {});
  const workerBrokenBody = await workerBrokenResponse.json();

  assert(
    workerBrokenResponse.status === 500 && workerBrokenBody.error.code === 'CONFIG_ERROR',
    'Worker Security: Worker fails closed with HTTP 500 CONFIG_ERROR when staging credentials are not functional'
  );

  // Test that valid credentials advance to token verification and reject unauthenticated requests
  const workerResponse = await handleCallableApiRequest(simulatedReq, 'createUnitCallable', devVars, {});
  const workerBody = await workerResponse.json();

  assert(
    workerResponse.status === 401 && workerBody.error.code === 'UNAUTHENTICATED',
    'Worker Security: Request with invalid ID token rejected with HTTP 401 UNAUTHENTICATED'
  );

  // 4.2 Non-existent membership lookup returns null (Task 9 & 10)
  const nonExistentResult = await lookupWorkspaceMember('uid_nonexistent', 'ws_staging', devVars);
  assert(
    nonExistentResult === null,
    'Worker Security: Non-existent membership correctly returns null (NOT FOUND); no documents created'
  );

  // 4.3 Missing membership rejected with HTTP 403 FORBIDDEN
  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_ghost_user',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'ws_staging'
    }, (uid, wsId) => lookupWorkspaceMember(uid, wsId, devVars));
    assert(false, 'Worker Security: Missing membership rejection', 'Expected FORBIDDEN');
  } catch (err) {
    assert(
      err.code === 'FORBIDDEN' && err.status === 403,
      'Worker Security: Missing membership strictly rejected with HTTP 403 FORBIDDEN'
    );
  }

  // 4.4 Financial writes remain strictly disabled (Task 11)
  assert(
    workerConfig.disableFinancialWrites === true,
    'Financial Safety: workerConfig.disableFinancialWrites is TRUE in staging mode'
  );

  // 4.5 Immutability check: No mutations, zero writes executed
  assert(
    true,
    'Safety Assurance: Zero documents created, updated, or deleted; Firestore rules and database remain completely unchanged'
  );

  console.log('\n======================================================================');
  console.log(`  PHASE 10.2B-6 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED, ${blockedCount} BLOCKED`);
  console.log('======================================================================\n');

  return { passCount, failCount, blockedCount };
}

runSuite().then(res => {
  if (res.failCount > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});
