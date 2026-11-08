/**
 * Phase 10.2A Proof-of-Concept: Master Isolated Test Suite & Benchmark Runner
 * 
 * Executes all Task B, C, D, E, F, G, H, I verification tests in pure local isolation.
 * Uses synthetic fixtures and Web Standards. Does NOT touch production data.
 */

import { verifyFirebaseIdToken, base64UrlDecode } from './tokenVerifier.mjs';
import { createGoogleOAuthAssertion, getFirestoreAccessToken, clearTokenCache } from './serviceAccountAuth.mjs';
import { FirestoreRestClient, encodeValue, decodeValue, encodeDocument, decodeDocument } from './firestoreRestClient.mjs';
import { authorizeWorkspaceRequest, ACTION_PERMISSIONS } from './workspaceAuth.mjs';
import { FinancialRulesEngine } from './financialRulesEngine.mjs';
import { createPagesWorker } from './workerRouter.mjs';

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

// =============================================================================
// TEST HELPERS: KEY PAIR GENERATOR FOR RS256 TESTING
// =============================================================================
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

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================
async function runAllTests() {
  console.log('======================================================================');
  console.log('  PHASE 10.2A: CLOUDFLARE COMPATIBILITY & SECURITY TEST SUITE');
  console.log('======================================================================\n');

  const { keyPair, publicJwk } = await generateTestRsaKeyPair();
  const mockJwks = { keys: [publicJwk] };
  const testProjectId = 'bhuiya-property-manager';

  // ---------------------------------------------------------------------------
  // SUITE 1: FIREBASE ID TOKEN VERIFICATION (TASK D)
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: FIREBASE ID TOKEN VERIFICATION (Web Crypto RS256) ---');
  const now = Math.floor(Date.now() / 1000);

  // 1. Valid token
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

  // 2. Expired token
  const expiredPayload = { ...validPayload, exp: now - 3600, iat: now - 7200 };
  const expiredToken = await signJwt({ alg: 'RS256', kid: 'test-key-id-1' }, expiredPayload, keyPair.privateKey);
  try {
    await verifyFirebaseIdToken(expiredToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Expired token rejection', 'Failed to reject expired token');
  } catch (e) {
    assert(e.message.includes('expired'), 'Token Verifier: Expired token rejected with error');
  }

  // 3. Wrong project ID / audience
  const wrongAudPayload = { ...validPayload, aud: 'other-project', iss: 'https://securetoken.google.com/other-project' };
  const wrongAudToken = await signJwt({ alg: 'RS256', kid: 'test-key-id-1' }, wrongAudPayload, keyPair.privateKey);
  try {
    await verifyFirebaseIdToken(wrongAudToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Wrong audience rejection', 'Failed to reject wrong audience');
  } catch (e) {
    assert(e.message.includes('Audience mismatch'), 'Token Verifier: Wrong audience rejected with error');
  }

  // 4. Invalid signature
  const tamperedToken = validToken.slice(0, -6) + 'xxxxxx';
  try {
    await verifyFirebaseIdToken(tamperedToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Tampered signature rejection', 'Failed to reject tampered signature');
  } catch (e) {
    assert(e.message.includes('signature') || e.message.includes('segments'), 'Token Verifier: Tampered signature rejected with error');
  }

  // 5. Malformed token
  try {
    await verifyFirebaseIdToken('not-a-jwt', testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Malformed token rejection', 'Failed to reject malformed token');
  } catch (e) {
    assert(e.message.includes('Malformed token'), 'Token Verifier: Malformed token rejected with error');
  }

  // 6. Missing kid
  const noKidToken = await signJwt({ alg: 'RS256' }, validPayload, keyPair.privateKey);
  try {
    await verifyFirebaseIdToken(noKidToken, testProjectId, { mockJwks });
    assert(false, 'Token Verifier: Missing kid rejection', 'Failed to reject missing kid');
  } catch (e) {
    assert(e.message.includes('kid'), 'Token Verifier: Missing kid rejected with error');
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: SERVICE ACCOUNT OAUTH 2.0 CREDENTIAL HANDLING (TASK E)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: SERVICE ACCOUNT OAUTH 2.0 (Web Crypto RS256) ---');
  // Export private key to PKCS#8 PEM format for testing
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
  assert(parsedPayload.scope === 'https://www.googleapis.com/auth/datastore', 'Service Account: Assertion targets datastore scope');

  // Test OAuth token caching
  clearTokenCache();
  let fetchCallCount = 0;
  const mockOAuthFetch = async (url, opts) => {
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
  // SUITE 3: CLOUDFLARE PAGES ADVANCED MODE (_worker.js) ROUTER (TASK B)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: CLOUDFLARE PAGES ADVANCED MODE ROUTER (TASK B) ---');
  let apiActionCalled = null;
  const mockApiHandler = async (req, action) => {
    apiActionCalled = action;
    return new Response(JSON.stringify({ success: true, action }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const pagesWorker = createPagesWorker(mockApiHandler);

  // 1. Edge API routing
  const apiReq = new Request('https://bhuiya.pages.dev/api/callable/recordRentPaymentCallable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
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
  // SUITE 4: FIRESTORE REST API PROTOCOL & TRANSACTIONS (TASK C)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: FIRESTORE REST API PROTOCOL & TRANSACTIONS (TASK C) ---');
  // 1. Data Type Encoding & Decoding
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

  // 2. Mock Transaction & Conflict Retry Simulator
  let txAttempts = 0;
  const mockFirestoreFetch = async (url, opts) => {
    if (url.includes(':beginTransaction')) {
      return new Response(JSON.stringify({ transaction: `tx_${Date.now()}_${txAttempts}` }), { status: 200 });
    }
    if (url.includes('/rent_bills/bill_1')) {
      return new Response(JSON.stringify({
        name: 'projects/bhuiya-property-manager/databases/(default)/documents/rent_bills/bill_1',
        fields: encodeDocument({ totalBilled: 20000, totalPaid: 10000, balanceDue: 10000, status: 'partial' }).fields
      }), { status: 200 });
    }
    if (url.includes(':commit')) {
      txAttempts++;
      if (txAttempts === 1) {
        // First attempt simulates concurrent conflict (HTTP 409 ABORTED)
        return new Response(JSON.stringify({
          error: { code: 409, message: 'ABORTED: Transaction was aborted due to concurrent modification.' }
        }), { status: 409 });
      }
      // Second attempt succeeds
      return new Response(JSON.stringify({
        commitTime: new Date().toISOString(),
        writeResults: [{ updateTime: new Date().toISOString() }]
      }), { status: 200 });
    }
    if (url.includes(':rollback')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response('Not Found', { status: 404 });
  };

  const restClient = new FirestoreRestClient('bhuiya-property-manager', async () => ({ token: 'mock-token' }), {
    fetchImpl: mockFirestoreFetch
  });

  const txResult = await restClient.runTransaction(async (tx) => {
    const billDoc = await tx.get('rent_bills', 'bill_1');
    const paymentAmount = 5000;
    const newPaid = billDoc.data.totalPaid + paymentAmount;
    const newDue = billDoc.data.totalBilled - newPaid;
    tx.update('rent_bills', 'bill_1', {
      totalPaid: newPaid,
      balanceDue: newDue,
      status: newDue === 0 ? 'paid' : 'partial'
    });
    return { success: true, newDue };
  }, 3);

  assert(txResult.success === true && txResult.newDue === 5000 && txAttempts === 2, 'Firestore REST: Transaction successfully recovered and committed after HTTP 409 ABORTED retry');

  // ---------------------------------------------------------------------------
  // SUITE 5: FAMILY WORKSPACE AUTHORIZATION & RBAC (TASK F)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: FAMILY WORKSPACE AUTHORIZATION & RBAC (TASK F) ---');
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

  // 1. Master admin authorized for everything
  const adminAuth = await authorizeWorkspaceRequest({
    callerUid: 'uid_brother_1',
    actionName: 'withdrawFromReserveCallable',
    requestedWorkspaceId: 'workspace_bhuiya_family'
  }, lookupMember);
  assert(adminAuth.authorized === true && adminAuth.role === 'master_admin', 'RBAC: Master Admin permitted to perform reserve withdrawal');

  // 2. Family manager authorized for rent collection
  const mgrRentAuth = await authorizeWorkspaceRequest({
    callerUid: 'uid_brother_2',
    actionName: 'recordRentPaymentCallable',
    requestedWorkspaceId: 'workspace_bhuiya_family'
  }, lookupMember);
  assert(mgrRentAuth.authorized === true && mgrRentAuth.role === 'family_manager', 'RBAC: Family Manager permitted to collect rent');

  // 3. Family manager denied for reserve withdrawal (Admin-only action)
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

  // 4. Family viewer denied for rent collection
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

  // 5. Inactive member denied
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

  // 6. Cross-workspace access denied
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

  // 7. Missing token UID denied
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

  // Rule 4: Security deposit liability
  engine.registerSecurityDeposit('dep_1', 'tenant_1', 40000);
  assert(engine.deposits.get('dep_1').classification === 'liability', 'Financial Invariants: Security deposit classified as liability, not operating income');

  // Rule 1 & 2: Rent billing & payment
  engine.bills.set('bill_nov', {
    id: 'bill_nov',
    tenantId: 'tenant_1',
    billingMonth: '2026-11',
    totalBilled: 25000,
    totalPaid: 0,
    balanceDue: 25000,
    status: 'unpaid'
  });

  // Verify unpaid rent does NOT count as income
  assert(engine.calculateActualRentIncome('2026-11') === 0, 'Financial Invariants: Unpaid rent excluded from collected operating revenue');

  // Rule 3: Partial payment
  engine.recordRentPayment('pay_1', 'bill_nov', 15000, 'bkash', '2026-11-05');
  const updatedBill = engine.bills.get('bill_nov');
  assert(updatedBill.status === 'partial' && updatedBill.balanceDue === 10000 && updatedBill.totalPaid === 15000, 'Financial Invariants: Partial payment updates totalPaid and balanceDue accurately');
  assert(engine.calculateActualRentIncome('2026-11') === 15000, 'Financial Invariants: Income engine counts exactly collected cash payment (৳15,000)');

  // Duplicate payment prevention
  try {
    engine.recordRentPayment('pay_1', 'bill_nov', 5000, 'cash', '2026-11-06');
    assert(false, 'Financial Invariants: Duplicate payment ID rejection', 'Allowed duplicate payment ID');
  } catch (e) {
    assert(e.message.includes('Duplicate payment ID'), 'Financial Invariants: Duplicate payment submission rejected');
  }

  // Overpayment prevention
  try {
    engine.recordRentPayment('pay_2', 'bill_nov', 20000, 'cash', '2026-11-06'); // balance due is 10000
    assert(false, 'Financial Invariants: Overpayment rejection', 'Allowed payment exceeding balance due');
  } catch (e) {
    assert(e.message.includes('exceeds balance due'), 'Financial Invariants: Payment exceeding balance due strictly rejected');
  }

  // Final payment clears bill
  engine.recordRentPayment('pay_final', 'bill_nov', 10000, 'cash', '2026-11-07');
  assert(engine.bills.get('bill_nov').status === 'paid' && engine.bills.get('bill_nov').balanceDue === 0, 'Financial Invariants: Final payment transitions bill to paid with zero balance');

  // Rule 8: Reserve withdrawal
  engine.reserveAccounts.set('res_main', { balance: 50000 });
  const withdrawal = engine.withdrawFromReserve('res_main', 20000, 'Emergency Roof Repair', 'Rahim Mia');
  assert(withdrawal.newBalance === 30000, 'Financial Invariants: Reserve withdrawal decrements balance to ৳30,000');
  assert(withdrawal.ledgerEntry.isRentalIncome === false, 'Financial Invariants: Reserve withdrawal strictly marked isRentalIncome: false');

  // Reserve overdraft prevention
  try {
    engine.withdrawFromReserve('res_main', 50000, 'Exceeding balance', 'Test');
    assert(false, 'Financial Invariants: Reserve overdraft rejection', 'Allowed overdraft');
  } catch (e) {
    assert(e.code === 'INSUFFICIENT_FUNDS', 'Financial Invariants: Overdraft exceeding reserve balance rejected');
  }

  // Rule 10 & 11: Expense reversal
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

  // 1. Benchmark JWT Verification
  const t0 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await verifyFirebaseIdToken(validToken, testProjectId, { mockJwks });
  }
  const tJwt = (performance.now() - t0) / ITERATIONS;
  console.log(`  ⏱️ [BENCHMARK] RS256 JWT Verification: ${tJwt.toFixed(3)} ms / operation (Wall-clock, Node.js runtime)`);

  // 2. Benchmark Service Account Assertion Signing
  const t1 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await createGoogleOAuthAssertion(dummyCreds.client_email, dummyCreds.private_key);
  }
  const tOAuth = (performance.now() - t1) / ITERATIONS;
  console.log(`  ⏱️ [BENCHMARK] OAuth Assertion Signing: ${tOAuth.toFixed(3)} ms / operation (Wall-clock, Node.js runtime)`);

  // 3. Benchmark Document Encoding & Decoding
  const t2 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const enc = encodeDocument(testObj);
    decodeDocument(enc);
  }
  const tDoc = (performance.now() - t2) / ITERATIONS;
  console.log(`  ⏱️ [BENCHMARK] Firestore Document Encode/Decode: ${tDoc.toFixed(3)} ms / operation`);

  // 4. Benchmark Workspace Permission Resolution
  const t3 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await authorizeWorkspaceRequest({
      callerUid: 'uid_brother_2',
      actionName: 'recordRentPaymentCallable',
      requestedWorkspaceId: 'workspace_bhuiya_family'
    }, lookupMember);
  }
  const tRbac = (performance.now() - t3) / ITERATIONS;
  console.log(`  ⏱️ [BENCHMARK] Workspace RBAC Authorization: ${tRbac.toFixed(3)} ms / operation`);

  console.log('\n======================================================================');
  console.log(`  POC AUDIT COMPLETE: ${passCount} / ${passCount + failCount} ASSERTIONS PASSED`);
  console.log('======================================================================\n');

  return { passCount, failCount, benchmarks: { tJwt, tOAuth, tDoc, tRbac } };
}

runAllTests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
