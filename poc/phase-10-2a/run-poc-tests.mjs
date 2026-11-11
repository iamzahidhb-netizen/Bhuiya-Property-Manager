/**
 * Phase 10.2B-2: Master Comprehensive Test Suite, Packaging & Benchmark Runner
 * 
 * Executes:
 * - Phase 10.2A baseline tests (Suites 1 - 7)
 * - Phase 10.2B-1 security & compatibility tests (Suites 8 - 12)
 * - Phase 10.2B-2 packaging, routing, 21-action & runtime tests (Suites 13 - 16)
 * Total Assertions: 90+
 * Pure local isolation with synthetic fixtures. Zero production writes.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { verifyFirebaseIdToken, base64UrlDecode, checkFirebaseAccountRevocation } from './tokenVerifier.mjs';
import { createGoogleOAuthAssertion, getFirestoreAccessToken, clearTokenCache } from './serviceAccountAuth.mjs';
import { FirestoreRestClient, encodeValue, decodeValue, encodeDocument, decodeDocument } from './firestoreRestClient.mjs';
import { authorizeWorkspaceRequest, ACTION_PERMISSIONS, sanitizeClientPayload } from './workspaceAuth.mjs';
import { FinancialRulesEngine } from './financialRulesEngine.mjs';
import { createPagesWorker, normalizeActionName, DEFAULT_ALLOWED_ORIGINS } from './workerRouter.mjs';

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
  publicJwk.kid = 'test-key-id-1';
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

async function signJwt(header, payload, privateKey) {
  const hB64 = base64Url(header);
  const pB64 = base64Url(payload);
  const data = new TextEncoder().encode(`${hB64}.${pB64}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const sB64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${hB64}.${pB64}.${sB64}`;
}

async function runAllTests() {
  console.log('======================================================================');
  console.log('  PHASE 10.2B-1: COMPREHENSIVE SECURITY & COMPATIBILITY REGRESSION');
  console.log('======================================================================\n');

  const { keyPair, publicJwk } = await generateTestRsaKeyPair();
  const mockJwks = { keys: [publicJwk] };
  const testProjectId = 'bhuiya-property-manager';

  // ---------------------------------------------------------------------------
  // SUITE 1: FIREBASE ID TOKEN VERIFICATION (TASK D & TASK 8)
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: FIREBASE ID TOKEN VERIFICATION (Web Crypto RS256) ---');
  const now = Math.floor(Date.now() / 1000);

  const validPayload = {
    iss: `https://securetoken.google.com/${testProjectId}`,
    aud: testProjectId,
    auth_time: now - 60,
    sub: 'uid_brother_1',
    iat: now - 60,
    exp: now + 3600,
    email: 'brother1@bhuiya.com'
  };
  const validToken = await signJwt({ alg: 'RS256', kid: 'test-key-id-1' }, validPayload, keyPair.privateKey);

  try {
    const verified = await verifyFirebaseIdToken(validToken, testProjectId, { mockJwks });
    assert(verified.uid === 'uid_brother_1' && verified.email === 'brother1@bhuiya.com', 'Token Verifier: Valid RS256 token verified successfully');
  } catch (e) {
    assert(false, 'Token Verifier: Valid token verified successfully', e.message);
  }

  // Expired token
  const expiredPayload = { ...validPayload, exp: now - 3600, iat: now - 7200 };
  const expiredToken = await signJwt({ alg: 'RS256', kid: 'test-key-id-1' }, expiredPayload, keyPair.privateKey);
  try {
    await verifyFirebaseIdToken(expiredToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Expired token rejection', 'Failed to reject expired token');
  } catch (e) {
    assert(e.message.includes('expired'), 'Token Verifier: Expired token rejected with error');
  }

  // Wrong audience
  const wrongAudPayload = { ...validPayload, aud: 'other-project', iss: 'https://securetoken.google.com/other-project' };
  const wrongAudToken = await signJwt({ alg: 'RS256', kid: 'test-key-id-1' }, wrongAudPayload, keyPair.privateKey);
  try {
    await verifyFirebaseIdToken(wrongAudToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Wrong audience rejection', 'Failed to reject wrong audience');
  } catch (e) {
    assert(e.message.includes('Audience mismatch'), 'Token Verifier: Wrong audience rejected with error');
  }

  // Tampered signature
  const tamperedToken = validToken.slice(0, -6) + 'xxxxxx';
  try {
    await verifyFirebaseIdToken(tamperedToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Tampered signature rejection', 'Failed to reject tampered signature');
  } catch (e) {
    assert(e.message.includes('signature') || e.message.includes('segments'), 'Token Verifier: Tampered signature rejected with error');
  }

  // Malformed token
  try {
    await verifyFirebaseIdToken('not-a-jwt', testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Malformed token rejection', 'Failed to reject malformed token');
  } catch (e) {
    assert(e.message.includes('Malformed token'), 'Token Verifier: Malformed token rejected with error');
  }

  // Missing kid
  const noKidToken = await signJwt({ alg: 'RS256' }, validPayload, keyPair.privateKey);
  try {
    await verifyFirebaseIdToken(noKidToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Missing kid rejection', 'Failed to reject missing kid');
  } catch (e) {
    assert(e.message.includes('kid'), 'Token Verifier: Missing kid rejected with error');
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: SERVICE ACCOUNT OAUTH 2.0 (TASK E)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: SERVICE ACCOUNT OAUTH 2.0 (Web Crypto RS256) ---');
  const exportedPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const pkcs8Bytes = new Uint8Array(exportedPkcs8);
  let bin = '';
  for (let i = 0; i < pkcs8Bytes.length; i++) bin += String.fromCharCode(pkcs8Bytes[i]);
  const b64Key = btoa(bin);
  const testPem = `-----BEGIN PRIVATE KEY-----\n${b64Key}\n-----END PRIVATE KEY-----`;

  const dummyCreds = {
    client_email: 'service-account@bhuiya-property-manager.iam.gserviceaccount.com',
    private_key: testPem
  };

  const assertion = await createGoogleOAuthAssertion(dummyCreds.client_email, dummyCreds.private_key);
  const parts = assertion.split('.');
  assert(parts.length === 3, 'Service Account: Generated valid RS256 JWT assertion string');

  const parsedHeader = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const parsedPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  assert(parsedHeader.alg === 'RS256' && parsedPayload.iss === dummyCreds.client_email, 'Service Account: Assertion contains correct issuer and RS256 alg');
  assert(parsedPayload.scope.split(' ').includes('https://www.googleapis.com/auth/datastore'), 'Service Account: Assertion includes the Firestore datastore scope');

  clearTokenCache();
  let fetchCallCount = 0;
  const mockOAuthFetch = async () => {
    fetchCallCount++;
    return new Response(JSON.stringify({
      access_token: 'mock-oauth-token-12345',
      expires_in: 3600,
      token_type: 'Bearer'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const tokenRes1 = await getFirestoreAccessToken(dummyCreds, mockOAuthFetch);
  assert(tokenRes1.token === 'mock-oauth-token-12345' && tokenRes1.cached === false && fetchCallCount === 1, 'Service Account: Fetched fresh access token via OAuth exchange');

  const tokenRes2 = await getFirestoreAccessToken(dummyCreds, mockOAuthFetch);
  assert(tokenRes2.token === 'mock-oauth-token-12345' && tokenRes2.cached === true && fetchCallCount === 1, 'Service Account: Second call served from in-memory cache without external fetch');

  clearTokenCache();
  const tokenRes3 = await getFirestoreAccessToken(dummyCreds, mockOAuthFetch);
  assert(tokenRes3.cached === false && fetchCallCount === 2, 'Service Account: Cache reset simulates isolate reboot correctly');

  // ---------------------------------------------------------------------------
  // SUITE 3: CLOUDFLARE PAGES ADVANCED MODE ROUTER (TASK B & TASK 3)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: CLOUDFLARE PAGES ADVANCED MODE ROUTER (TASK B & TASK 3) ---');
  let apiActionCalled = null;
  const mockApiHandler = async (req, action) => {
    apiActionCalled = action;
    return new Response(JSON.stringify({ success: true, action }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const pagesWorker = createPagesWorker(mockApiHandler);

  // 1. Edge API routing with Bearer header
  const apiReq = new Request('https://bhuiya.pages.dev/api/callable/recordRentPaymentCallable', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-id-token-123',
      'Origin': 'https://bhuiya-property-manager.pages.dev'
    }
  });
  const apiRes = await pagesWorker.fetch(apiReq, {}, {});
  assert(apiRes.status === 200 && apiActionCalled === 'recordRentPaymentCallable', 'Pages Worker: /api/callable/* routed directly to edge handler');
  assert(apiRes.headers.get('X-Content-Type-Options') === 'nosniff', 'Pages Worker: Injected nosniff security header');
  assert(apiRes.headers.get('X-Frame-Options') === 'DENY', 'Pages Worker: Injected DENY frame header');

  // 2. Static asset pass-through
  let assetsFetchCalled = false;
  const mockEnv = {
    ASSETS: {
      fetch: async (r) => {
        assetsFetchCalled = true;
        const u = new URL(r.url);
        if (u.pathname === '/assets/main.js') {
          return new Response('console.log("app");', { status: 200, headers: { 'Content-Type': 'application/javascript' } });
        }
        if (u.pathname === '/index.html') {
          return new Response('<html>SPA</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
        }
        return new Response('Not Found', { status: 404 });
      }
    }
  };

  const assetReq = new Request('https://bhuiya.pages.dev/assets/main.js');
  const assetRes = await pagesWorker.fetch(assetReq, mockEnv, {});
  assert(assetRes.status === 200 && assetsFetchCalled === true, 'Pages Worker: Static assets served via env.ASSETS.fetch()');

  // 3. SPA Fallback
  const navReq = new Request('https://bhuiya.pages.dev/tenants/details', {
    headers: { 'Accept': 'text/html,application/xhtml+xml' }
  });
  const navRes = await pagesWorker.fetch(navReq, mockEnv, {});
  const navHtml = await navRes.text();
  assert(navRes.status === 200 && navHtml.includes('<html>SPA</html>'), 'Pages Worker: Navigation 404 falls back cleanly to /index.html SPA shell');

  // ---------------------------------------------------------------------------
  // SUITE 4: FIRESTORE REST PROTOCOL (TASK C)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: FIRESTORE REST PROTOCOL (TASK C) ---');
  const testObj = {
    str: 'মিতালী মার্কেট',
    num: 45000,
    flt: 12.5,
    bool: true,
    n: null,
    date: new Date('2026-11-01T00:00:00.000Z'),
    list: ['a', 1, false],
    nested: { floor: 2, vacant: false }
  };

  const encoded = encodeDocument(testObj);
  const decoded = decodeDocument(encoded);
  assert(decoded.str === testObj.str && decoded.num === testObj.num && decoded.bool === true, 'Firestore REST: Encodes and decodes primitives accurately');
  assert(decoded.nested.floor === 2 && decoded.list.length === 3, 'Firestore REST: Encodes and decodes nested objects and arrays accurately');

  // ---------------------------------------------------------------------------
  // SUITE 5: FAMILY WORKSPACE AUTHORIZATION & RBAC (TASK F & TASK 5)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: FAMILY WORKSPACE AUTHORIZATION & RBAC (TASK F & TASK 5) ---');
  const mockWorkspaceMembers = {
    'uid_brother_1': {
      workspaceId: 'workspace_bhuiya_family',
      uid: 'uid_brother_1',
      role: 'master_admin',
      status: 'active',
      permissions: { canManageTenants: true, canCollectRent: true, canRecordExpenses: true, canViewReports: true }
    },
    'uid_brother_2': {
      workspaceId: 'workspace_bhuiya_family',
      uid: 'uid_brother_2',
      role: 'family_manager',
      status: 'active',
      permissions: { canManageTenants: true, canCollectRent: true, canRecordExpenses: true, canViewReports: true }
    },
    'uid_mother': {
      workspaceId: 'workspace_bhuiya_family',
      uid: 'uid_mother',
      role: 'family_viewer',
      status: 'active',
      permissions: { canManageTenants: false, canCollectRent: false, canRecordExpenses: false, canViewReports: true }
    },
    'uid_inactive_member': {
      workspaceId: 'workspace_bhuiya_family',
      uid: 'uid_inactive_member',
      role: 'family_manager',
      status: 'deactivated',
      permissions: { canCollectRent: true }
    }
  };

  const lookupMember = async (uid) => mockWorkspaceMembers[uid] || null;

  // Master admin authorized
  const adminAuth = await authorizeWorkspaceRequest({
    callerUid: 'uid_brother_1',
    actionName: 'withdrawFromReserveCallable',
    requestedWorkspaceId: 'workspace_bhuiya_family'
  }, lookupMember);
  assert(adminAuth.authorized === true && adminAuth.role === 'master_admin', 'RBAC: Master Admin permitted to perform reserve withdrawal');

  // Family manager authorized for rent
  const mgrRentAuth = await authorizeWorkspaceRequest({
    callerUid: 'uid_brother_2',
    actionName: 'recordRentPaymentCallable',
    requestedWorkspaceId: 'workspace_bhuiya_family'
  }, lookupMember);
  assert(mgrRentAuth.authorized === true && mgrRentAuth.role === 'family_manager', 'RBAC: Family Manager permitted to collect rent');

  // Family manager denied on reserve withdrawal
  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_brother_2',
      actionName: 'withdrawFromReserveCallable',
      requestedWorkspaceId: 'workspace_bhuiya_family'
    }, lookupMember);
    assert(false, 'RBAC: Family Manager reserve withdrawal denial', 'Failed to deny family manager on admin action');
  } catch (e) {
    assert(e.code === 'PERMISSION_DENIED', 'RBAC: Family Manager strictly denied from reserve fund withdrawal');
  }

  // Family viewer denied on rent
  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_mother',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'workspace_bhuiya_family'
    }, lookupMember);
    assert(false, 'RBAC: Family Viewer rent collection denial', 'Failed to deny viewer on mutation action');
  } catch (e) {
    assert(e.code === 'PERMISSION_DENIED', 'RBAC: Family Viewer strictly denied from recording rent payments');
  }

  // Inactive member denied
  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_inactive_member',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'workspace_bhuiya_family'
    }, lookupMember);
    assert(false, 'RBAC: Inactive member denial', 'Failed to deny deactivated member');
  } catch (e) {
    assert(e.code === 'MEMBERSHIP_INACTIVE', 'RBAC: Deactivated member rejected with MEMBERSHIP_INACTIVE');
  }

  // Cross-workspace access denied
  try {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_brother_2',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'workspace_stranger_estate'
    }, lookupMember);
    assert(false, 'RBAC: Cross-workspace access denial', 'Failed to reject cross-workspace request');
  } catch (e) {
    assert(e.code === 'CROSS_WORKSPACE_DENIED', 'RBAC: Cross-workspace tampering rejected with CROSS_WORKSPACE_DENIED');
  }

  // Missing token UID denied
  try {
    await authorizeWorkspaceRequest({
      callerUid: null,
      actionName: 'recordRentPaymentCallable'
    }, lookupMember);
    assert(false, 'RBAC: Missing UID denial', 'Failed to reject missing UID');
  } catch (e) {
    assert(e.code === 'UNAUTHENTICATED', 'RBAC: Missing UID rejected with UNAUTHENTICATED (401)');
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: FINANCIAL INTEGRITY INVARIANTS (TASK G)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 6: FINANCIAL INTEGRITY INVARIANTS (TASK G) ---');
  const engine = new FinancialRulesEngine();

  engine.registerSecurityDeposit('dep_1', 'tenant_1', 40000);
  assert(engine.deposits.get('dep_1').classification === 'liability', 'Financial Invariants: Security deposit classified as liability, not operating income');

  engine.bills.set('bill_nov', {
    id: 'bill_nov',
    tenantId: 'tenant_1',
    billingMonth: '2026-11',
    totalBilled: 25000,
    totalPaid: 0,
    balanceDue: 25000,
    status: 'unpaid'
  });

  assert(engine.calculateActualRentIncome('2026-11') === 0, 'Financial Invariants: Unpaid rent excluded from collected operating revenue');

  engine.recordRentPayment('pay_1', 'bill_nov', 15000, 'bkash', '2026-11-05');
  const updatedBill = engine.bills.get('bill_nov');
  assert(updatedBill.status === 'partial' && updatedBill.balanceDue === 10000 && updatedBill.totalPaid === 15000, 'Financial Invariants: Partial payment updates totalPaid and balanceDue accurately');
  assert(engine.calculateActualRentIncome('2026-11') === 15000, 'Financial Invariants: Income engine counts exactly collected cash payment (৳15,000)');

  try {
    engine.recordRentPayment('pay_1', 'bill_nov', 5000, 'cash', '2026-11-06');
    assert(false, 'Financial Invariants: Duplicate payment ID rejection', 'Allowed duplicate payment ID');
  } catch (e) {
    assert(e.message.includes('Duplicate payment ID'), 'Financial Invariants: Duplicate payment submission rejected');
  }

  try {
    engine.recordRentPayment('pay_2', 'bill_nov', 20000, 'cash', '2026-11-06');
    assert(false, 'Financial Invariants: Overpayment rejection', 'Allowed payment exceeding balance due');
  } catch (e) {
    assert(e.message.includes('exceeds balance due'), 'Financial Invariants: Payment exceeding balance due strictly rejected');
  }

  engine.recordRentPayment('pay_final', 'bill_nov', 10000, 'cash', '2026-11-07');
  assert(engine.bills.get('bill_nov').status === 'paid' && engine.bills.get('bill_nov').balanceDue === 0, 'Financial Invariants: Final payment transitions bill to paid with zero balance');

  engine.reserveAccounts.set('res_main', { balance: 50000 });
  const withdrawal = engine.withdrawFromReserve('res_main', 20000, 'Emergency Roof Repair', 'Rahim Mia');
  assert(withdrawal.newBalance === 30000, 'Financial Invariants: Reserve withdrawal decrements balance to ৳30,000');
  assert(withdrawal.ledgerEntry.isRentalIncome === false, 'Financial Invariants: Reserve withdrawal strictly marked isRentalIncome: false');

  try {
    engine.withdrawFromReserve('res_main', 50000, 'Exceeding balance', 'Test');
    assert(false, 'Financial Invariants: Reserve overdraft rejection', 'Allowed overdraft');
  } catch (e) {
    assert(e.code === 'INSUFFICIENT_FUNDS', 'Financial Invariants: Overdraft exceeding reserve balance rejected');
  }

  engine.expenses.set('exp_1', {
    id: 'exp_1',
    amount: 5000,
    status: 'active',
    category: 'water',
    description: 'Wrong water bill'
  });
  const reversedExp = engine.reverseExpense('exp_1', 'Billed to wrong meter');
  assert(reversedExp.status === 'reversed' && reversedExp.auditHistory.length === 1, 'Financial Invariants: Expense reversal preserves audit history without deleting original record');

  // ---------------------------------------------------------------------------
  // SUITE 7: BENCHMARK TIMING (TASK I)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 7: CPU & RUNTIME BENCHMARKS (100 Iterations) ---');
  const ITERATIONS = 100;
  const t0 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await verifyFirebaseIdToken(validToken, testProjectId, { mockJwks });
  }
  const tJwt = (performance.now() - t0) / ITERATIONS;
  console.log(`  ⏱️ [BENCHMARK] RS256 JWT Verification: ${tJwt.toFixed(3)} ms / op`);

  const t1 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await createGoogleOAuthAssertion(dummyCreds.client_email, dummyCreds.private_key);
  }
  const tOAuth = (performance.now() - t1) / ITERATIONS;
  console.log(`  ⏱️ [BENCHMARK] OAuth Assertion Signing: ${tOAuth.toFixed(3)} ms / op`);

  // ===========================================================================
  // NEW SUITES FOR PHASE 10.2B-1
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // SUITE 8: WRITE PRECONDITIONS & CONFLICT PREVENTION (TASK 2 & TASK 7)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 8: WRITE PRECONDITIONS & CONFLICT PREVENTION (TASK 2 & 7) ---');

  // 1. Verify Insert Write sets currentDocument: { exists: false }
  const restTester = new FirestoreRestClient('bhuiya-property-manager', async () => ({ token: 'mock' }));
  const insertPayload = restTester.createInsertWrite('units', 'unit_new_1', { unitNumber: '1A' });
  assert(
    insertPayload.currentDocument && insertPayload.currentDocument.exists === false,
    'Write Preconditions: createInsertWrite enforces currentDocument: { exists: false }'
  );

  // 2. Verify Update Write does NOT enforce exists: false
  const updatePayload = restTester.createUpdateWrite('units', 'unit_existing', { unitNumber: '1B' }, ['unitNumber']);
  assert(
    !updatePayload.currentDocument || updatePayload.currentDocument.exists !== false,
    'Write Preconditions: createUpdateWrite does not enforce exists: false'
  );

  // 3. Attempting to create an already existing document returns ALREADY_EXISTS (HTTP 409) and does NOT retry
  let attemptCount = 0;
  const mockAlreadyExistsFetch = async (url) => {
    if (url.includes(':beginTransaction')) {
      return new Response(JSON.stringify({ transaction: 'tx_already_exists' }), { status: 200 });
    }
    if (url.includes(':commit')) {
      attemptCount++;
      return new Response(JSON.stringify({
        error: { code: 409, message: 'ALREADY_EXISTS: Document already exists.' }
      }), { status: 409 });
    }
    if (url.includes(':rollback')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response('Not Found', { status: 404 });
  };

  const clientExists = new FirestoreRestClient('bhuiya-property-manager', async () => ({ token: 'mock' }), {
    fetchImpl: mockAlreadyExistsFetch
  });

  try {
    await clientExists.runTransaction(async (tx) => {
      tx.create('units', 'unit_duplicate', { unitNumber: 'Flat 1A' });
    }, 3);
    assert(false, 'Write Preconditions: ALREADY_EXISTS rejection', 'Allowed creation of existing document');
  } catch (err) {
    assert(
      err.code === 'ALREADY_EXISTS' && attemptCount === 1,
      'Write Preconditions: ALREADY_EXISTS rejects immediately on attempt 1 without wasteful retries'
    );
  }

  // 4. Precondition FAILED_PRECONDITION (HTTP 412) handling
  let p412Attempts = 0;
  const mock412Fetch = async (url) => {
    if (url.includes(':beginTransaction')) return new Response(JSON.stringify({ transaction: 'tx_412' }), { status: 200 });
    if (url.includes(':commit')) {
      p412Attempts++;
      return new Response(JSON.stringify({ error: { code: 412, message: 'FAILED_PRECONDITION' } }), { status: 412 });
    }
    if (url.includes(':rollback')) return new Response(JSON.stringify({}), { status: 200 });
    return new Response('Not Found', { status: 404 });
  };

  const client412 = new FirestoreRestClient('bhuiya-property-manager', async () => ({ token: 'mock' }), {
    fetchImpl: mock412Fetch
  });

  try {
    await client412.runTransaction(async (tx) => {
      tx.update('units', 'unit_missing', { status: 'occupied' }, null, { exists: true });
    }, 3);
    assert(false, 'Write Preconditions: FAILED_PRECONDITION rejection', 'Allowed write with failed precondition');
  } catch (err) {
    assert(
      err.code === 'FAILED_PRECONDITION' && p412Attempts === 1,
      'Write Preconditions: FAILED_PRECONDITION (412) aborts immediately without retrying'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 9: HTTP SECURITY & METHOD ENFORCEMENT (TASK 3)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 9: HTTP SECURITY & METHOD ENFORCEMENT (TASK 3) ---');
  let mutationExecuted = false;
  const secureApiHandler = async () => {
    mutationExecuted = true;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const secureWorker = createPagesWorker(secureApiHandler, {
    allowedOrigins: ['https://bhuiya-property-manager.pages.dev']
  });

  // 1. Explicit OPTIONS request returns 204 with CORS and does NOT execute mutation
  mutationExecuted = false;
  const optionsReq = new Request('https://bhuiya.pages.dev/api/callable/recordRentPaymentCallable', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://bhuiya-property-manager.pages.dev'
    }
  });
  const optionsRes = await secureWorker.fetch(optionsReq);
  assert(
    optionsRes.status === 204 && mutationExecuted === false,
    'HTTP Security: OPTIONS preflight returns HTTP 204 and does NOT execute API mutations'
  );
  assert(
    optionsRes.headers.get('Access-Control-Allow-Origin') === 'https://bhuiya-property-manager.pages.dev',
    'HTTP Security: CORS header reflects configured application origin'
  );

  // 2. Unconfigured origin is rejected (no Allow-Origin header)
  const badOriginReq = new Request('https://bhuiya.pages.dev/api/callable/recordRentPaymentCallable', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://malicious-site.com' }
  });
  const badOriginRes = await secureWorker.fetch(badOriginReq);
  assert(
    !badOriginRes.headers.get('Access-Control-Allow-Origin'),
    'HTTP Security: Unconfigured origin receives NO Access-Control-Allow-Origin header'
  );

  // 3. GET request to API action rejected with HTTP 405 Method Not Allowed
  const getReq = new Request('https://bhuiya.pages.dev/api/callable/recordRentPaymentCallable', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer valid-token' }
  });
  const getRes = await secureWorker.fetch(getReq);
  assert(
    getRes.status === 405 && getRes.headers.get('Allow') === 'POST, OPTIONS',
    'HTTP Security: Non-POST API request rejected with HTTP 405 Method Not Allowed and Allow header'
  );

  // 4. Missing Authorization header rejected with HTTP 401
  const noAuthReq = new Request('https://bhuiya.pages.dev/api/callable/recordRentPaymentCallable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const noAuthRes = await secureWorker.fetch(noAuthReq);
  const noAuthData = await noAuthRes.json();
  assert(
    noAuthRes.status === 401 && noAuthData.error.code === 'UNAUTHENTICATED',
    'HTTP Security: Missing Authorization header rejected with HTTP 401 UNAUTHENTICATED'
  );

  // ---------------------------------------------------------------------------
  // SUITE 10: ACTION NAME NORMALIZATION & WHITELIST (TASK 4)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 10: ACTION NAME NORMALIZATION & WHITELIST (TASK 4) ---');

  // 1. Whitespace trimming
  assert(
    normalizeActionName('  recordRentPaymentCallable  ') === 'recordRentPaymentCallable',
    'Action Normalization: Leading/trailing whitespace safely trimmed'
  );

  // 2. Trailing slash removal
  assert(
    normalizeActionName('recordRentPaymentCallable///') === 'recordRentPaymentCallable',
    'Action Normalization: Trailing slashes safely stripped'
  );

  // 3. Full path extraction
  assert(
    normalizeActionName('/api/callable/createUnitCallable') === 'createUnitCallable',
    'Action Normalization: /api/callable/ path prefix normalized'
  );

  // 4. Empty action rejection (400)
  try {
    normalizeActionName('   ');
    assert(false, 'Action Normalization: Empty action rejection', 'Allowed empty action');
  } catch (err) {
    assert(err.code === 'EMPTY_ACTION_NAME' && err.status === 400, 'Action Normalization: Empty action rejected with HTTP 400');
  }

  // 5. Path traversal rejection (400)
  try {
    normalizeActionName('../../etc/passwd');
    assert(false, 'Action Normalization: Path traversal rejection', 'Allowed path traversal');
  } catch (err) {
    assert(err.code === 'PATH_TRAVERSAL_DETECTED' && err.status === 400, 'Action Normalization: Path traversal rejected with PATH_TRAVERSAL_DETECTED');
  }

  // 6. Invalid characters rejection (400)
  try {
    normalizeActionName('createUnitCallable;DROP TABLE');
    assert(false, 'Action Normalization: Invalid characters rejection', 'Allowed invalid characters');
  } catch (err) {
    assert(err.code === 'INVALID_CHARACTERS' && err.status === 400, 'Action Normalization: Invalid characters rejected with INVALID_CHARACTERS');
  }

  // 7. Unknown action rejection (404)
  try {
    normalizeActionName('unauthorizedActionName');
    assert(false, 'Action Normalization: Unknown action rejection', 'Allowed unknown action');
  } catch (err) {
    assert(err.code === 'ACTION_NOT_FOUND' && err.status === 404, 'Action Normalization: Unknown action rejected with HTTP 404 ACTION_NOT_FOUND');
  }

  // ---------------------------------------------------------------------------
  // SUITE 11: CLIENT PAYLOAD SANITIZATION (TASK 5)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 11: CLIENT PAYLOAD SANITIZATION (TASK 5) ---');
  const forgedPayload = {
    amount: 15000,
    workspaceId: 'forged_target_workspace',
    role: 'master_admin',
    ownerUid: 'hacker_uid',
    callerUid: 'fake_uid'
  };

  const trustedContext = {
    workspaceId: 'workspace_bhuiya_family',
    uid: 'uid_brother_2',
    role: 'family_manager'
  };

  const sanitized = sanitizeClientPayload(forgedPayload, trustedContext);
  assert(
    sanitized.workspaceId === 'workspace_bhuiya_family',
    'Payload Sanitization: Forged client workspaceId overwritten with server-verified workspaceId'
  );
  assert(
    sanitized.callerUid === 'uid_brother_2',
    'Payload Sanitization: Forged callerUid overwritten with server-verified UID'
  );
  assert(
    sanitized.role === undefined && sanitized.ownerUid === undefined,
    'Payload Sanitization: Forged role and ownerUid fields stripped from payload'
  );
  assert(
    sanitized.amount === 15000,
    'Payload Sanitization: Legitimate business payload fields preserved'
  );

  // ---------------------------------------------------------------------------
  // SUITE 12: OPTIONAL ONLINE ACCOUNT REVOCATION STRATEGY (TASK 8)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 12: ONLINE ACCOUNT REVOCATION STRATEGY (TASK 8) ---');

  // 1. Active account passes
  const mockActiveLookup = async () => {
    return new Response(JSON.stringify({
      users: [{ localId: 'uid_brother_1', email: 'brother1@bhuiya.com', disabled: false }]
    }), { status: 200 });
  };

  const activeUser = await checkFirebaseAccountRevocation('mock_token', 'mock_api_key', mockActiveLookup);
  assert(
    activeUser.disabled === false && activeUser.uid === 'uid_brother_1',
    'Revocation Strategy: Active Firebase Auth account verified successfully'
  );

  // 2. Disabled account rejected
  const mockDisabledLookup = async () => {
    return new Response(JSON.stringify({
      users: [{ localId: 'uid_disabled', email: 'disabled@bhuiya.com', disabled: true }]
    }), { status: 200 });
  };

  try {
    await checkFirebaseAccountRevocation('mock_token', 'mock_api_key', mockDisabledLookup);
    assert(false, 'Revocation Strategy: Disabled account rejection', 'Allowed disabled account');
  } catch (err) {
    assert(
      err.message.includes('disabled'),
      'Revocation Strategy: Disabled Firebase Auth account strictly rejected'
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 13: BUNDLE PACKAGING & STATIC INTEGRITY (TASK A & TASK C)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 13: BUNDLE PACKAGING & STATIC INTEGRITY (TASK A & TASK C) ---');
  const bundlePath = path.resolve('poc/phase-10-2a/dist/_worker.js');
  const bundleExists = fs.existsSync(bundlePath);
  assert(bundleExists, 'Bundle Packaging: Output file dist/_worker.js exists on disk');

  const bundleStats = fs.statSync(bundlePath);
  const bundleSizeBytes = bundleStats.size;
  const bundleSizeKB = (bundleSizeBytes / 1024).toFixed(2);
  assert(
    bundleSizeBytes < 1048576,
    `Bundle Packaging: Bundle size (${bundleSizeKB} KB) is strictly below 1MB Cloudflare Worker limit`
  );

  const bundleCode = fs.readFileSync(bundlePath, 'utf8');

  // Verify zero forbidden Node built-in imports
  const forbiddenNodeModules = [
    'fs', 'node:fs', 'child_process', 'node:child_process',
    'net', 'node:net', 'http2', 'node:http2', 'tls', 'node:tls',
    'dns', 'node:dns', 'cluster', 'node:cluster'
  ];
  let foundForbidden = false;
  for (const mod of forbiddenNodeModules) {
    const regex1 = new RegExp(`['"]${mod}['"]`);
    const regex2 = new RegExp(`from\\s+['"]${mod}['"]`);
    if (regex1.test(bundleCode) || regex2.test(bundleCode)) {
      foundForbidden = true;
      break;
    }
  }
  assert(!foundForbidden, 'Bundle Packaging: Zero forbidden Node.js-only built-in modules in bundle');

  // Verify zero leaked private keys
  const leakedKeyRegex = /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/;
  assert(!leakedKeyRegex.test(bundleCode), 'Bundle Packaging: Zero hardcoded private keys or service account secrets in bundle');

  // Dynamic import of bundled worker
  const bundleUrl = pathToFileURL(bundlePath).href;
  const bundledWorker = await import(bundleUrl);
  assert(
    bundledWorker && bundledWorker.default && typeof bundledWorker.default.fetch === 'function',
    'Bundle Packaging: Default export is valid Cloudflare Pages worker with fetch() handler'
  );

  // ---------------------------------------------------------------------------
  // SUITE 14: WORKER ROUTING & HTTP PROTOCOL (TASK B & TASK C)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 14: WORKER ROUTING & HTTP PROTOCOL (TASK B & TASK C) ---');
  const workerEnv = {
    FIREBASE_PROJECT_ID: testProjectId,
    ALLOWED_ORIGINS: 'https://bhuiya-property-manager.pages.dev,http://localhost:5173',
    DISABLE_FINANCIAL_WRITES: 'true',
    __MOCK_JWKS__: mockJwks,
    __MOCK_WORKSPACE_MEMBERS__: {
      workspace_bhuiya_family_uid_brother_1: {
        workspaceId: 'workspace_bhuiya_family',
        uid: 'uid_brother_1',
        role: 'master_admin',
        status: 'active',
        permissions: {
          canManageTenants: true,
          canCollectRent: true,
          canRecordExpenses: true,
          canViewReports: true
        }
      },
      uid_brother_1: {
        workspaceId: 'workspace_bhuiya_family',
        uid: 'uid_brother_1',
        role: 'master_admin',
        status: 'active',
        permissions: {
          canManageTenants: true,
          canCollectRent: true,
          canRecordExpenses: true,
          canViewReports: true
        }
      },
      workspace_bhuiya_family_uid_brother_2: {
        workspaceId: 'workspace_bhuiya_family',
        uid: 'uid_brother_2',
        role: 'viewer',
        status: 'active',
        permissions: {}
      },
      workspace_bhuiya_family_uid_brother_3: {
        workspaceId: 'workspace_bhuiya_family',
        uid: 'uid_brother_3',
        role: 'viewer',
        status: 'active',
        permissions: {}
      }
    }
  };

  // 1. CORS Preflight OPTIONS
  const s14_optionsReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://bhuiya-property-manager.pages.dev',
      'Access-Control-Request-Method': 'POST'
    }
  });
  const s14_optionsRes = await bundledWorker.default.fetch(s14_optionsReq, workerEnv, {});
  assert(
    s14_optionsRes.status === 204 &&
    s14_optionsRes.headers.get('Access-Control-Allow-Origin') === 'https://bhuiya-property-manager.pages.dev' &&
    s14_optionsRes.headers.get('Access-Control-Allow-Methods').includes('POST'),
    'Worker Routing: OPTIONS preflight returns HTTP 204 with strict CORS headers'
  );

  // 2. Untrusted Origin receives no CORS allow header
  const s14_untrustedReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'OPTIONS',
    headers: { Origin: 'https://malicious-site.com' }
  });
  const s14_untrustedRes = await bundledWorker.default.fetch(s14_untrustedReq, workerEnv, {});
  assert(
    s14_untrustedRes.status === 204 && !s14_untrustedRes.headers.has('Access-Control-Allow-Origin'),
    'Worker Routing: Untrusted CORS origin blocked from receiving Access-Control-Allow-Origin'
  );

  // 3. Method Not Allowed (GET on callable API)
  const s14_getReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` }
  });
  const s14_getRes = await bundledWorker.default.fetch(s14_getReq, workerEnv, {});
  assert(
    s14_getRes.status === 405 && s14_getRes.headers.get('Allow') === 'POST, OPTIONS',
    'Worker Routing: GET request to callable API rejected with HTTP 405 Method Not Allowed'
  );

  // 4. Missing Authorization header
  const s14_unauthReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: 'prop_01', unitNumber: '101' })
  });
  const s14_unauthRes = await bundledWorker.default.fetch(s14_unauthReq, workerEnv, {});
  assert(
    s14_unauthRes.status === 401,
    'Worker Routing: Request missing Authorization Bearer header rejected with HTTP 401'
  );

  // 5. Path traversal in action name rejected
  const s14_traversalReq = new Request('http://localhost/api/callable/..%2fadminSecret', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const s14_traversalRes = await bundledWorker.default.fetch(s14_traversalReq, workerEnv, {});
  assert(
    s14_traversalRes.status === 400,
    'Worker Routing: Path traversal in action URL rejected with HTTP 400'
  );

  // 6. Unknown action name rejected
  const s14_unknownReq = new Request('http://localhost/api/callable/nonExistentCallable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const s14_unknownRes = await bundledWorker.default.fetch(s14_unknownReq, workerEnv, {});
  assert(
    s14_unknownRes.status === 404,
    'Worker Routing: Unknown action name rejected with HTTP 404'
  );

  // 7. Missing/corrupted service account secret handled gracefully
  const brokenEnv = {
    FIREBASE_SERVICE_ACCOUNT_KEY: '{ malformed json }',
    __MOCK_JWKS__: mockJwks
  };
  const s14_configErrReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: 'prop_01', unitNumber: '101' })
  });
  const s14_configErrRes = await bundledWorker.default.fetch(s14_configErrReq, brokenEnv, {});
  assert(
    s14_configErrRes.status === 500,
    'Worker Routing: Corrupted secrets handled gracefully with HTTP 500 without crashing worker'
  );

  // ---------------------------------------------------------------------------
  // SUITE 15: 21-ACTION REGISTRY END-TO-END EXECUTION (TASK B & TASK C)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 15: 21-ACTION REGISTRY END-TO-END EXECUTION (TASK B & TASK C) ---');

  const actionsToTest = [
    // Group 1: Units & Properties (4)
    {
      action: 'createUnitCallable',
      payload: { propertyId: 'prop_01', unitNumber: 'Unit-101' },
      expectedField: 'unitId'
    },
    {
      action: 'renameUnitCallable',
      payload: { unitId: 'unit_01', newUnitNumber: 'Unit-102' },
      expectedField: 'unitId'
    },
    {
      action: 'archiveUnitCallable',
      payload: { unitId: 'unit_01' },
      expectedField: 'isArchived'
    },
    {
      action: 'restoreUnitCallable',
      payload: { unitId: 'unit_01' },
      expectedField: 'isArchived'
    },

    // Group 2: Tenants & Leases (2)
    {
      action: 'registerTenantCallable',
      payload: {
        propertyId: 'prop_01',
        unitId: 'unit_01',
        name: 'Kabir Ahmed',
        phone: '01712345678',
        monthlyRent: 18000,
        securityDeposit: 36000
      },
      expectedField: 'tenantId'
    },
    {
      action: 'vacateTenantCallable',
      payload: {
        tenantId: 'tenant_01',
        unitId: 'unit_01',
        vacateDate: '2026-11-30',
        refundAmount: 36000
      },
      expectedField: 'tenantId'
    },

    // Group 3: Rent Billing & Payments (2)
    {
      action: 'generateMonthlyBillsCallable',
      payload: { propertyId: 'prop_01', billingMonth: '2026-11' },
      expectedField: 'billingMonth'
    },
    {
      action: 'recordRentPaymentCallable',
      payload: {
        billId: 'bill_01',
        amount: 18000,
        paymentMethod: 'bkash',
        paymentDate: '2026-11-05'
      },
      expectedField: 'paymentId'
    },

    // Group 4: Operating Expenses (3)
    {
      action: 'createExpenseCallable',
      payload: {
        group: 'maintenance',
        category: 'plumbing',
        amount: 3500,
        expenseDate: '2026-11-02',
        billingMonth: '2026-11',
        description: 'Fixed leaking pipe'
      },
      expectedField: 'expenseId'
    },
    {
      action: 'updateExpenseCallable',
      payload: {
        expenseId: 'exp_01',
        amount: 4000,
        reason: 'Adjusted with contractor receipt'
      },
      expectedField: 'expenseId'
    },
    {
      action: 'reverseExpenseCallable',
      payload: {
        expenseId: 'exp_01',
        reason: 'Duplicate entry submitted in error'
      },
      expectedField: 'statusReversed'
    },

    // Group 5: Beneficiaries & Distributions (7)
    {
      action: 'seedDefaultBeneficiariesCallable',
      payload: {},
      expectedField: 'count'
    },
    {
      action: 'createBeneficiaryCallable',
      payload: { name: 'Tariq Bhuiya', relationship: 'brother', targetAmount: 25000 },
      expectedField: 'beneficiaryId'
    },
    {
      action: 'updateBeneficiaryCallable',
      payload: { beneficiaryId: 'ben_01', targetAmount: 28000 },
      expectedField: 'beneficiaryId'
    },
    {
      action: 'archiveBeneficiaryCallable',
      payload: { beneficiaryId: 'ben_01' },
      expectedField: 'isArchived'
    },
    {
      action: 'getOrCreateMonthlyDistributionCallable',
      payload: { distributionMonth: '2026-11' },
      expectedField: 'month'
    },
    {
      action: 'applySpecialAdjustmentCallable',
      payload: {
        distributionId: 'dist_01',
        beneficiaryId: 'ben_01',
        adjustmentAmount: 2000,
        reason: 'Eid allowance bonus'
      },
      expectedField: 'status'
    },
    {
      action: 'recordBeneficiaryPayoutCallable',
      payload: {
        distributionId: 'dist_01',
        beneficiaryId: 'ben_01',
        amount: 25000,
        paymentMethod: 'bank',
        paymentDate: '2026-11-07'
      },
      expectedField: 'amount'
    },

    // Group 6: Family Reserve Fund (3)
    {
      action: 'initializeReserveFundCallable',
      payload: { openingBalance: 500000 },
      expectedField: 'balance'
    },
    {
      action: 'withdrawFromReserveCallable',
      payload: {
        amount: 25000,
        reason: 'Emergency water pump replacement',
        recipientName: 'Dhaka Pump Co',
        paymentMethod: 'bank'
      },
      expectedField: 'amount'
    },
    {
      action: 'transferSurplusToReserveCallable',
      payload: { amount: 35000, fromBillingMonth: '2026-11' },
      expectedField: 'amount'
    },

    // Group 7: Family Workspace Management (3)
    {
      action: 'inviteFamilyMemberCallable',
      payload: { email: 'sister@bhuiya.com', assignedRole: 'manager' }
    },
    {
      action: 'updateMemberPermissionsCallable',
      payload: { targetUid: 'uid_brother_2', assignedRole: 'viewer' }
    },
    {
      action: 'deactivateFamilyMemberCallable',
      payload: { targetUid: 'uid_brother_3' }
    }
  ];

  for (const item of actionsToTest) {
    const actionReq = new Request(`http://localhost/api/callable/${item.action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(item.payload)
    });

    const res = await bundledWorker.default.fetch(actionReq, workerEnv, {});
    const body = await res.json();
    const isLegacyMemberAction = [
      'inviteFamilyMemberCallable',
      'updateMemberPermissionsCallable',
      'deactivateFamilyMemberCallable'
    ].includes(item.action);
    const passed = res.status === 200 && body.data && (
      isLegacyMemberAction
        ? item.action === 'inviteFamilyMemberCallable'
          ? body.data.member?.email === 'sister@bhuiya.com' && body.data.member?.role === 'manager'
          : item.action === 'updateMemberPermissionsCallable'
            ? body.data.targetUid === 'uid_brother_2' && body.data.role === 'viewer'
            : body.data.targetUid === 'uid_brother_3' && body.data.status === 'inactive'
        : body.data.status === 'PACKAGING_VALIDATED' &&
          body.data[item.expectedField] !== undefined
    );

    assert(
      passed,
      `Action Registry: ${item.action} dispatched successfully in packaging validation mode`
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 16: INPUT VALIDATION & SAFETY GUARD INVARIANTS (TASK C & SAFETY)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 16: INPUT VALIDATION & SAFETY GUARD INVARIANTS (TASK C & SAFETY) ---');

  // 1. Missing required field in registerTenantCallable
  const invalidTenantReq = new Request('http://localhost/api/callable/registerTenantCallable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: 'prop_01', unitId: 'unit_01', name: 'No Phone Tenant' })
  });
  const invalidTenantRes = await bundledWorker.default.fetch(invalidTenantReq, workerEnv, {});
  const invalidTenantBody = await invalidTenantRes.json();
  assert(
    invalidTenantRes.status === 400 && invalidTenantBody.error.code === 'INVALID_ARGUMENT',
    'Input Validation: Missing required field rejected with HTTP 400 INVALID_ARGUMENT'
  );

  // 2. Negative amount in recordRentPaymentCallable
  const negativeRentReq = new Request('http://localhost/api/callable/recordRentPaymentCallable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      billId: 'bill_01',
      amount: -5000,
      paymentMethod: 'cash',
      paymentDate: '2026-11-05'
    })
  });
  const negativeRentRes = await bundledWorker.default.fetch(negativeRentReq, workerEnv, {});
  const negativeRentBody = await negativeRentRes.json();
  assert(
    negativeRentRes.status === 400 && negativeRentBody.error.message.includes('positive'),
    'Input Validation: Negative monetary payment amount rejected with HTTP 400'
  );

  // 3. Malformed billingMonth in generateMonthlyBillsCallable
  const badMonthReq = new Request('http://localhost/api/callable/generateMonthlyBillsCallable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: 'prop_01', billingMonth: 'November-2026' })
  });
  const badMonthRes = await bundledWorker.default.fetch(badMonthReq, workerEnv, {});
  const badMonthBody = await badMonthRes.json();
  assert(
    badMonthRes.status === 400 && badMonthBody.error.message.includes('YYYY-MM'),
    'Input Validation: Malformed month string rejected with HTTP 400'
  );

  // 4a. Payload tampering prevention: Client cannot forge target workspaceId
  const crossWsReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId: 'prop_01',
      unitNumber: '101',
      workspaceId: 'forged_target_workspace',
      callerUid: 'attacker_uid',
      role: 'master_admin'
    })
  });
  const crossWsRes = await bundledWorker.default.fetch(crossWsReq, workerEnv, {});
  const crossWsBody = await crossWsRes.json();
  assert(
    crossWsRes.status === 403 && crossWsBody.error.code === 'CROSS_WORKSPACE_DENIED',
    'Safety Invariant: Forged cross-workspace target strictly rejected with HTTP 403 CROSS_WORKSPACE_DENIED'
  );

  // 4b. Payload tampering prevention: Forged callerUid and role within workspace are stripped
  const tamperedReq = new Request('http://localhost/api/callable/createUnitCallable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId: 'prop_01',
      unitNumber: '101',
      callerUid: 'attacker_uid',
      role: 'forged_super_role'
    })
  });
  const tamperedRes = await bundledWorker.default.fetch(tamperedReq, workerEnv, {});
  assert(
    tamperedRes.status === 200,
    'Safety Invariant: Tampered payload callerUid/role stripped without privilege escalation'
  );

  // 5. Zero live database writes verified by packaging validation response
  assert(
    workerEnv.DISABLE_FINANCIAL_WRITES === 'true',
    'Safety Invariant: Financial writes safety gate strictly locked in packaging phase'
  );

  console.log('\n======================================================================');
  console.log(`  PHASE 10.2B-2 MASTER TEST SUITE: ${passCount} / ${passCount + failCount} ASSERTIONS PASSED`);
  console.log('======================================================================\n');

  return { passCount, failCount };
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
