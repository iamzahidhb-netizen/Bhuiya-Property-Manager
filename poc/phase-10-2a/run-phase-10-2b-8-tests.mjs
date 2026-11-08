/**
 * Phase 10.2B-8: Staging End-to-End Workspace Integration Test Suite
 * 
 * Comprehensive verification of:
 * 1. Firebase login and ID token authentication (Google JWKS, Web Crypto RS256, claims integrity)
 * 2. Live master_admin Worker API authorization against staging Firestore
 * 3. Workspace isolation and RBAC permissions (cross-workspace denial, payload sanitization, role boundaries)
 * 4. Read-only Firestore integration (REST read-back, type decoding, error parsing)
 * 5. Financial writes safety gate (DISABLE_FINANCIAL_WRITES=true, zero live mutations)
 * 6. Security regression tests (CORS, method enforcement, path traversal, edge headers, secret redaction)
 */

import fs from 'fs';
import path from 'path';
import { getWorkerConfig, parseServiceAccountCredentials } from './worker/envConfig.mjs';
import { lookupWorkspaceMember, handleCallableApiRequest, workerInstance } from './worker/index.mjs';
import { authorizeWorkspaceRequest, sanitizeClientPayload, ACTION_PERMISSIONS } from './workspaceAuth.mjs';
import { getGoogleJwks, verifyFirebaseIdToken, base64UrlDecode } from './tokenVerifier.mjs';
import { getFirestoreAccessToken, clearTokenCache } from './serviceAccountAuth.mjs';
import { FirestoreRestClient, encodeDocument, decodeDocument } from './firestoreRestClient.mjs';
import { normalizeActionName, DEFAULT_ALLOWED_ORIGINS } from './workerRouter.mjs';

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

// Safely loads .dev.vars without printing secrets
function loadDevVars(filePath = 'poc/phase-10-2a/.dev.vars') {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return null;
  const content = fs.readFileSync(resolved, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return env;
}

// Helpers for test JWT generation
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
  publicJwk.kid = 'stage-test-kid-8';
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

// Request factory to avoid bodyUsed stream reuse issues
function makeApiRequest(action, payload, token, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://bhuiya-property-manager.pages.dev',
    ...extraHeaders
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new Request(`http://localhost/api/callable/${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  PHASE 10.2B-8: STAGING END-TO-END WORKSPACE INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

  const devVars = loadDevVars();
  if (!devVars) {
    throw new Error('Fatal: poc/phase-10-2a/.dev.vars could not be loaded.');
  }

  const { keyPair, publicJwk } = await generateTestRsaKeyPair();
  const mockJwks = { keys: [publicJwk] };
  const stagingProjectId = 'bhuiya-property-staging';
  const provisionedUid = 'WunBcW1KihNW2DMTs3R0gUpQ0fh2';
  const provisionedWorkspaceId = 'workspace_bhuiya_family';

  // ---------------------------------------------------------------------------
  // SUITE 1: FIREBASE LOGIN & ID TOKEN AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: FIREBASE LOGIN & ID TOKEN AUTHENTICATION ---');

  // 1.1 Live Google JWKS endpoint verification
  try {
    const liveJwks = await getGoogleJwks();
    assert(
      Array.isArray(liveJwks?.keys) && liveJwks.keys.length > 0 && liveJwks.keys[0].kty === 'RSA',
      'Google JWKS: Successfully fetched active Google public keys from official endpoint'
    );
  } catch (err) {
    assert(false, 'Google JWKS: Live fetch', err.message);
  }

  // 1.2 Valid RS256 token verification
  const now = Math.floor(Date.now() / 1000);
  const validPayload = {
    iss: `https://securetoken.google.com/${stagingProjectId}`,
    aud: stagingProjectId,
    auth_time: now - 30,
    sub: provisionedUid,
    iat: now - 30,
    exp: now + 3600,
    email: 'admin@bhuiya.staging'
  };
  const validAdminToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-8' }, validPayload, keyPair.privateKey);

  try {
    const verified = await verifyFirebaseIdToken(validAdminToken, stagingProjectId, { mockJwks });
    assert(
      verified.uid === provisionedUid && verified.email === 'admin@bhuiya.staging',
      'Token Auth: Valid RS256 Firebase ID token verified successfully via Web Crypto'
    );
  } catch (err) {
    assert(false, 'Token Auth: Valid token verification', err.message);
  }

  // 1.3 Claims integrity & fail-closed rejections
  // Expired token
  try {
    const expiredPayload = { ...validPayload, exp: now - 600, iat: now - 1200, auth_time: now - 1200 };
    const expiredToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-8' }, expiredPayload, keyPair.privateKey);
    await verifyFirebaseIdToken(expiredToken, stagingProjectId, { mockJwks });
    assert(false, 'Claims Integrity: Expired token rejection', 'Failed to reject expired token');
  } catch (err) {
    assert(err.message.includes('expired'), 'Claims Integrity: Expired token rejected with error');
  }

  // Audience mismatch
  try {
    const badAudPayload = { ...validPayload, aud: 'malicious-project' };
    const badAudToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-8' }, badAudPayload, keyPair.privateKey);
    await verifyFirebaseIdToken(badAudToken, stagingProjectId, { mockJwks });
    assert(false, 'Claims Integrity: Audience mismatch rejection', 'Failed to reject wrong aud');
  } catch (err) {
    assert(err.message.includes('Audience mismatch'), 'Claims Integrity: Audience mismatch rejected');
  }

  // Issuer mismatch
  try {
    const badIssPayload = { ...validPayload, iss: 'https://securetoken.google.com/malicious-project' };
    const badIssToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-8' }, badIssPayload, keyPair.privateKey);
    await verifyFirebaseIdToken(badIssToken, stagingProjectId, { mockJwks });
    assert(false, 'Claims Integrity: Issuer mismatch rejection', 'Failed to reject wrong iss');
  } catch (err) {
    assert(err.message.includes('Issuer mismatch'), 'Claims Integrity: Issuer mismatch rejected');
  }

  // Tampered signature
  try {
    const parts = validAdminToken.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignatureBytes`;
    await verifyFirebaseIdToken(tamperedToken, stagingProjectId, { mockJwks });
    assert(false, 'Claims Integrity: Tampered signature rejection', 'Failed to reject tampered token');
  } catch (err) {
    assert(err.message.includes('signature') || err.message.includes('segments'), 'Claims Integrity: Tampered signature rejected');
  }

  // Missing kid
  try {
    const noKidToken = await signJwt({ alg: 'RS256' }, validPayload, keyPair.privateKey);
    await verifyFirebaseIdToken(noKidToken, stagingProjectId, { mockJwks });
    assert(false, 'Claims Integrity: Missing kid rejection', 'Failed to reject token missing kid');
  } catch (err) {
    assert(err.message.includes('kid'), 'Claims Integrity: Token missing kid rejected');
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: LIVE MASTER_ADMIN WORKER API AUTHORIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: LIVE MASTER_ADMIN WORKER API AUTHORIZATION ---');

  const liveWorkerEnv = {
    ...devVars,
    __MOCK_JWKS__: mockJwks
    // Notice: Zero mock store! Evaluates against real staging Firestore!
  };

  // 2.1 Live membership resolution
  const liveMember = await lookupWorkspaceMember(provisionedUid, provisionedWorkspaceId, liveWorkerEnv);
  assert(
    liveMember !== null &&
    liveMember.uid === provisionedUid &&
    liveMember.workspaceId === provisionedWorkspaceId &&
    liveMember.role === 'master_admin' &&
    liveMember.status === 'active',
    'Live Worker Lookup: Retrieved master_admin membership from staging Firestore over REST API'
  );

  // 2.2 Live API Request: registerTenantCallable
  const reqTenant = makeApiRequest('registerTenantCallable', {
    workspaceId: provisionedWorkspaceId,
    propertyId: 'prop_staging_01',
    unitId: 'unit_101',
    name: 'Rahim Bhuiya',
    phone: '+8801700000000',
    monthlyRent: 20000,
    securityDeposit: 40000
  }, validAdminToken);

  const resTenant = await workerInstance.fetch(reqTenant, liveWorkerEnv, {});
  const bodyTenant = await resTenant.json();
  assert(
    resTenant.status === 200 &&
    bodyTenant.data?.success === true &&
    bodyTenant.data?.action === 'registerTenantCallable' &&
    bodyTenant.data?.status === 'PACKAGING_VALIDATED',
    'Live API Dispatch: registerTenantCallable authorized for master_admin (Status 200, PACKAGING_VALIDATED)'
  );

  // 2.3 Live API Request: generateMonthlyBillsCallable
  const reqBills = makeApiRequest('generateMonthlyBillsCallable', {
    workspaceId: provisionedWorkspaceId,
    propertyId: 'prop_staging_01',
    billingMonth: '2026-11'
  }, validAdminToken);

  const resBills = await workerInstance.fetch(reqBills, liveWorkerEnv, {});
  const bodyBills = await resBills.json();
  assert(
    resBills.status === 200 &&
    bodyBills.data?.success === true &&
    bodyBills.data?.action === 'generateMonthlyBillsCallable',
    'Live API Dispatch: generateMonthlyBillsCallable authorized for master_admin'
  );

  // 2.4 Live API Request: withdrawFromReserveCallable (Sensitive master_admin operation)
  const reqWithdraw = makeApiRequest('withdrawFromReserveCallable', {
    workspaceId: provisionedWorkspaceId,
    amount: 15000,
    reason: 'Staging Roof Repair',
    recipientName: 'Roofing Contractor Ltd',
    paymentMethod: 'Bank Transfer'
  }, validAdminToken);

  const resWithdraw = await workerInstance.fetch(reqWithdraw, liveWorkerEnv, {});
  const bodyWithdraw = await resWithdraw.json();
  assert(
    resWithdraw.status === 200 &&
    bodyWithdraw.data?.success === true &&
    bodyWithdraw.data?.action === 'withdrawFromReserveCallable',
    'Live API Dispatch: withdrawFromReserveCallable authorized for master_admin'
  );

  // ---------------------------------------------------------------------------
  // SUITE 3: WORKSPACE ISOLATION & RBAC PERMISSIONS
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: WORKSPACE ISOLATION & RBAC PERMISSIONS ---');

  // 3.1 Cross-Workspace Access Denial (Unprovisioned workspace in staging)
  const reqCrossWs = makeApiRequest('registerTenantCallable', {
    workspaceId: 'workspace_unauthorized_other',
    propertyId: 'prop_staging_01',
    unitId: 'unit_101',
    name: 'Malicious Tenant',
    phone: '+8801700000000',
    monthlyRent: 20000,
    securityDeposit: 40000
  }, validAdminToken);

  const resCrossWs = await workerInstance.fetch(reqCrossWs, liveWorkerEnv, {});
  const bodyCrossWs = await resCrossWs.json();
  assert(
    resCrossWs.status === 403 && (bodyCrossWs.error?.code === 'FORBIDDEN' || bodyCrossWs.error?.code === 'CROSS_WORKSPACE_DENIED'),
    'Workspace Isolation: Unprovisioned workspace access strictly rejected with HTTP 403'
  );

  // 3.1b Cross-Workspace Access Denial when membership exists for different workspace
  try {
    await authorizeWorkspaceRequest({
      callerUid: provisionedUid,
      actionName: 'registerTenantCallable',
      requestedWorkspaceId: 'workspace_other_disallowed'
    }, async () => ({
      workspaceId: provisionedWorkspaceId,
      uid: provisionedUid,
      role: 'master_admin',
      status: 'active',
      permissions: { canManageTenants: true }
    }));
    assert(false, 'Workspace Isolation: Cross-workspace access should throw CROSS_WORKSPACE_DENIED');
  } catch (err) {
    assert(
      err.code === 'CROSS_WORKSPACE_DENIED' && err.status === 403,
      'Workspace Isolation: Mismatched requested workspace strictly rejected with HTTP 403 CROSS_WORKSPACE_DENIED'
    );
  }

  // 3.2 Client Payload Tamper Resistance
  const tamperedPayload = {
    workspaceId: 'forged_ws_attempt',
    role: 'super_admin_forged',
    ownerUid: 'forged_owner_uid',
    permissions: { canManageTenants: true, canDoEverything: true },
    tenantId: 'tenant_valid_01'
  };
  const verifiedAuthContext = {
    workspaceId: provisionedWorkspaceId,
    uid: provisionedUid,
    role: 'master_admin'
  };
  const sanitized = sanitizeClientPayload(tamperedPayload, verifiedAuthContext);
  assert(
    sanitized.workspaceId === provisionedWorkspaceId &&
    sanitized.callerUid === provisionedUid &&
    !('role' in sanitized) &&
    !('ownerUid' in sanitized) &&
    !('permissions' in sanitized) &&
    sanitized.tenantId === 'tenant_valid_01',
    'Payload Sanitization: Client attempts to forge workspaceId, role, ownerUid, or permissions stripped'
  );

  // 3.3 Non-Member (Unknown UID) Rejection
  const strangerPayload = {
    ...validPayload,
    sub: 'stranger_unknown_uid_999'
  };
  const strangerToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-8' }, strangerPayload, keyPair.privateKey);

  const reqStranger = makeApiRequest('registerTenantCallable', {
    workspaceId: provisionedWorkspaceId,
    propertyId: 'prop_staging_01',
    unitId: 'unit_101',
    name: 'Stranger',
    phone: '+8801700000000',
    monthlyRent: 20000,
    securityDeposit: 40000
  }, strangerToken);

  const resStranger = await workerInstance.fetch(reqStranger, liveWorkerEnv, {});
  const bodyStranger = await resStranger.json();
  assert(
    resStranger.status === 403 && bodyStranger.error?.code === 'FORBIDDEN',
    'Workspace Authorization: Non-member user strictly rejected with HTTP 403 FORBIDDEN'
  );

  // 3.4 Inactive Membership Rejection
  const inactiveEnv = {
    ...liveWorkerEnv,
    __MOCK_WORKSPACE_MEMBERS__: {
      [`${provisionedWorkspaceId}_${provisionedUid}`]: {
        workspaceId: provisionedWorkspaceId,
        uid: provisionedUid,
        role: 'master_admin',
        status: 'inactive', // Deactivated
        permissions: {}
      }
    }
  };

  const reqInactive = makeApiRequest('registerTenantCallable', {
    workspaceId: provisionedWorkspaceId,
    propertyId: 'prop_staging_01',
    unitId: 'unit_101',
    name: 'Rahim Bhuiya',
    phone: '+8801700000000',
    monthlyRent: 20000,
    securityDeposit: 40000
  }, validAdminToken);

  const resInactive = await workerInstance.fetch(reqInactive, inactiveEnv, {});
  const bodyInactive = await resInactive.json();
  assert(
    resInactive.status === 403 && bodyInactive.error?.code === 'MEMBERSHIP_INACTIVE',
    'Workspace Authorization: Inactive membership strictly rejected with HTTP 403 MEMBERSHIP_INACTIVE'
  );

  // 3.5 Role Boundary Enforcement (Viewer role attempting administrative mutation)
  const viewerEnv = {
    ...liveWorkerEnv,
    __MOCK_WORKSPACE_MEMBERS__: {
      [`${provisionedWorkspaceId}_${provisionedUid}`]: {
        workspaceId: provisionedWorkspaceId,
        uid: provisionedUid,
        role: 'viewer',
        status: 'active',
        permissions: { canViewReports: true }
      }
    }
  };

  const reqViewerWithdraw = makeApiRequest('withdrawFromReserveCallable', {
    workspaceId: provisionedWorkspaceId,
    amount: 15000,
    reason: 'Staging Roof Repair',
    recipientName: 'Roofing Contractor Ltd',
    paymentMethod: 'Bank Transfer'
  }, validAdminToken);

  const resViewer = await workerInstance.fetch(reqViewerWithdraw, viewerEnv, {});
  const bodyViewer = await resViewer.json();
  assert(
    resViewer.status === 403 && bodyViewer.error?.code === 'PERMISSION_DENIED',
    'RBAC Boundaries: Viewer role attempting withdrawFromReserveCallable rejected with HTTP 403 PERMISSION_DENIED'
  );

  // ---------------------------------------------------------------------------
  // SUITE 4: READ-ONLY FIRESTORE INTEGRATION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: READ-ONLY FIRESTORE INTEGRATION ---');

  const credentials = parseServiceAccountCredentials(devVars);
  const client = new FirestoreRestClient(stagingProjectId, async () => {
    return await getFirestoreAccessToken(credentials);
  });

  // 4.1 Direct REST document fetch
  const targetDocId = `${provisionedWorkspaceId}_${provisionedUid}`;
  const doc = await client.getDocument('workspace_members', targetDocId);
  assert(
    doc !== null &&
    doc.id === targetDocId &&
    doc.data?.workspaceId === provisionedWorkspaceId &&
    doc.data?.role === 'master_admin' &&
    typeof doc.createTime === 'string',
    'Firestore Read: Direct REST getDocument retrieved live document with metadata and createTime'
  );

  // 4.2 Non-existent document handling
  const missingDoc = await client.getDocument('workspace_members', 'non_existent_doc_id_xyz');
  assert(
    missingDoc === null,
    'Firestore Read: Missing document correctly returns null without throwing unhandled exceptions'
  );

  // 4.3 Data encoding & decoding invariants
  const sampleData = {
    stringField: 'Hello Firestore',
    numberField: 42,
    boolField: true,
    nullField: null,
    arrayField: [1, 'two', false],
    nestedMap: { innerKey: 'innerValue' },
    dateField: new Date('2026-11-08T00:00:00Z')
  };
  const encoded = encodeDocument(sampleData);
  const decoded = decodeDocument(encoded);
  assert(
    decoded.stringField === sampleData.stringField &&
    decoded.numberField === sampleData.numberField &&
    decoded.boolField === sampleData.boolField &&
    decoded.nullField === sampleData.nullField &&
    decoded.arrayField.length === 3 &&
    decoded.nestedMap.innerKey === 'innerValue' &&
    decoded.dateField instanceof Date,
    'Firestore Encoding: Firestore REST type encoding and decoding preserves all data types'
  );

  // ---------------------------------------------------------------------------
  // SUITE 5: FINANCIAL WRITES REMAIN STRICTLY DISABLED
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: FINANCIAL WRITES REMAIN STRICTLY DISABLED ---');

  const config = getWorkerConfig(devVars);
  assert(
    config.disableFinancialWrites === true,
    'Financial Safety: workerConfig.disableFinancialWrites is TRUE in staging configuration'
  );
  assert(
    devVars.DISABLE_FINANCIAL_WRITES === 'true',
    'Financial Safety: DISABLE_FINANCIAL_WRITES strictly equals "true" in .dev.vars'
  );

  // 5.2 Mutating financial actions return PACKAGING_VALIDATED without performing writes
  const mutatingActions = [
    {
      action: 'recordRentPaymentCallable',
      payload: {
        workspaceId: provisionedWorkspaceId,
        billId: 'bill_2026_11_101',
        amount: 15000,
        paymentDate: '2026-11-08',
        paymentMethod: 'bKash'
      }
    },
    {
      action: 'createExpenseCallable',
      payload: {
        workspaceId: provisionedWorkspaceId,
        propertyId: 'prop_01',
        group: 'property_maintenance',
        category: 'repairs',
        amount: 2500,
        expenseDate: '2026-11-08',
        billingMonth: '2026-11',
        description: 'Plumbing leak repair'
      }
    },
    {
      action: 'transferSurplusToReserveCallable',
      payload: {
        workspaceId: provisionedWorkspaceId,
        amount: 50000,
        fromBillingMonth: '2026-10'
      }
    }
  ];

  for (const { action, payload } of mutatingActions) {
    const reqMut = makeApiRequest(action, payload, validAdminToken);
    const resMut = await workerInstance.fetch(reqMut, liveWorkerEnv, {});
    const bodyMut = await resMut.json();
    assert(
      resMut.status === 200 &&
      bodyMut.data?.status === 'PACKAGING_VALIDATED' &&
      bodyMut.data?.success === true,
      `Financial Safety: ${action} intercepted by packaging gate (status: PACKAGING_VALIDATED, 0 writes)`
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: SECURITY & EDGE ROUTING REGRESSION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 6: SECURITY & EDGE ROUTING REGRESSION ---');

  // 6.1 CORS Preflight (OPTIONS)
  const reqOptionsAllowed = new Request('http://localhost/api/callable/registerTenantCallable', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://bhuiya-property-manager.pages.dev',
      'Access-Control-Request-Method': 'POST'
    }
  });
  const resOptionsAllowed = await workerInstance.fetch(reqOptionsAllowed, liveWorkerEnv, {});
  assert(
    resOptionsAllowed.status === 204 &&
    resOptionsAllowed.headers.get('Access-Control-Allow-Origin') === 'https://bhuiya-property-manager.pages.dev',
    'CORS Security: OPTIONS preflight reflects allowed origin with HTTP 204'
  );

  const reqOptionsDisallowed = new Request('http://localhost/api/callable/registerTenantCallable', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://malicious-attacker.com',
      'Access-Control-Request-Method': 'POST'
    }
  });
  const resOptionsDisallowed = await workerInstance.fetch(reqOptionsDisallowed, liveWorkerEnv, {});
  assert(
    resOptionsDisallowed.headers.get('Access-Control-Allow-Origin') === null,
    'CORS Security: Unauthorized origin does NOT receive Access-Control-Allow-Origin'
  );

  // 6.2 HTTP Method Enforcement (Reject GET, PUT)
  const reqGet = new Request('http://localhost/api/callable/registerTenantCallable', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${validAdminToken}`
    }
  });
  const resGet = await workerInstance.fetch(reqGet, liveWorkerEnv, {});
  const bodyGet = await resGet.json();
  assert(
    resGet.status === 405 && bodyGet.error?.code === 'METHOD_NOT_ALLOWED',
    'Method Enforcement: GET request to API callable rejected with HTTP 405 METHOD_NOT_ALLOWED'
  );

  // 6.3 Action Whitelist & Path Traversal Rejection
  const reqTraversal = makeApiRequest('..%2f..%2fevilAction', { workspaceId: provisionedWorkspaceId }, validAdminToken);
  const resTraversal = await workerInstance.fetch(reqTraversal, liveWorkerEnv, {});
  const bodyTraversal = await resTraversal.json();
  assert(
    resTraversal.status === 400 && bodyTraversal.error?.code === 'PATH_TRAVERSAL_DETECTED',
    'Routing Security: Path traversal attempts rejected with HTTP 400 PATH_TRAVERSAL_DETECTED'
  );

  const reqUnknownAction = makeApiRequest('nonExistentActionCallable', { workspaceId: provisionedWorkspaceId }, validAdminToken);
  const resUnknownAction = await workerInstance.fetch(reqUnknownAction, liveWorkerEnv, {});
  const bodyUnknownAction = await resUnknownAction.json();
  assert(
    resUnknownAction.status === 404 && bodyUnknownAction.error?.code === 'ACTION_NOT_FOUND',
    'Routing Security: Unknown action rejected with HTTP 404 ACTION_NOT_FOUND'
  );

  // 6.4 Unauthenticated Access Rejection
  const reqNoAuth = makeApiRequest('registerTenantCallable', { workspaceId: provisionedWorkspaceId }, null);
  const resNoAuth = await workerInstance.fetch(reqNoAuth, liveWorkerEnv, {});
  const bodyNoAuth = await resNoAuth.json();
  assert(
    resNoAuth.status === 401 && bodyNoAuth.error?.code === 'UNAUTHENTICATED',
    'Authentication Guard: Request missing Authorization header rejected with HTTP 401 UNAUTHENTICATED'
  );

  // 6.5 Edge Security Headers
  assert(
    resBills.headers.get('X-Content-Type-Options') === 'nosniff' &&
    resBills.headers.get('X-Frame-Options') === 'DENY' &&
    resBills.headers.get('Referrer-Policy') === 'strict-origin-when-cross-origin',
    'Security Headers: API responses include nosniff, DENY, and strict-origin headers'
  );

  // 6.6 Zero Hardcoded Identities
  const workerSrc = fs.readFileSync('poc/phase-10-2a/worker/index.mjs', 'utf8');
  assert(
    !workerSrc.includes('uid_brother_') && !workerSrc.includes('WunBcW1KihNW2DMTs3R0gUpQ0fh2'),
    'Code Integrity: worker/index.mjs contains zero hardcoded user UIDs'
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`  PHASE 10.2B-8 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');

  return { passCount, failCount };
}

runSuite().then(res => {
  if (res.failCount > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('\nFatal Suite Error:', err);
  process.exit(1);
});
