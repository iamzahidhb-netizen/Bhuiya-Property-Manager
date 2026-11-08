/**
 * Phase 10.2B: Cloudflare Pages Staging Live Deployment Verification Suite
 * 
 * Tests the live Cloudflare Pages staging deployment:
 * https://bhuiya-property-staging.pages.dev
 * 
 * Verifies:
 * 1. Cloudflare Pages edge delivery & CF-Ray headers
 * 2. Real Firebase Authentication ID Token issuance via Identity Toolkit
 * 3. Authoritative Master Admin workspace RBAC resolution
 * 4. Cross-workspace access denial & payload sanitization
 * 5. All 10 financial mutations intercepted by independent write lock
 * 6. Live document reads (Property, Unit, Tenant)
 * 7. Live Firestore zero-write confirmation
 */

import fs from 'fs';
import { pemToBinary, getFirestoreAccessToken } from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';

const STAGING_URL = 'https://bhuiya-property-staging.pages.dev';
const STAGING_PROJECT_ID = 'bhuiya-property-staging';
const WORKSPACE_ID = 'workspace_bhuiya_family';
const MASTER_ADMIN_UID = 'WunBcW1KihNW2DMTs3R0gUpQ0fh2';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

async function run() {
  console.log('========================================================================');
  console.log('PHASE 10.2B: CLOUDFLARE PAGES LIVE STAGING VERIFICATION');
  console.log('Target URL:', STAGING_URL);
  console.log('========================================================================\n');

  // Load service account & staging config
  const devVars = fs.readFileSync('poc/phase-10-2a/.dev.vars', 'utf8');
  let b64 = '';
  for (const l of devVars.split('\n')) {
    if (l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
      b64 = l.substring('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim();
    }
  }
  const saCreds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));

  const envStaging = fs.readFileSync('.env.staging', 'utf8');
  let apiKey = '';
  for (const l of envStaging.split('\n')) {
    if (l.startsWith('VITE_FIREBASE_API_KEY=')) {
      apiKey = l.substring('VITE_FIREBASE_API_KEY='.length).trim();
    }
  }

  // ---------------------------------------------------------------------------
  // SUITE 1: Edge Routing & Static Asset Delivery via Cloudflare Pages
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: Cloudflare Edge Delivery & Asset Serving ---');
  const rootRes = await fetch(`${STAGING_URL}/`);
  assert(rootRes.status === 200, `Root URL returned HTTP 200 OK (${STAGING_URL})`);
  assert(rootRes.headers.get('content-type')?.includes('text/html'), 'Content-Type is text/html');
  assert(rootRes.headers.has('cf-ray'), `Cloudflare Edge active (CF-Ray: ${rootRes.headers.get('cf-ray')})`);

  const html = await rootRes.text();
  assert(html.includes('ভূঁইয়া প্রপার্টি ম্যানেজার'), 'Bengali application title present in SPA shell');
  assert(html.includes('/assets/index-'), 'Bundled JavaScript entry chunk referenced');

  // ---------------------------------------------------------------------------
  // SUITE 2: Real Firebase Auth ID Token Exchange
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Firebase Authentication & ID Token Issuance ---');
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const jwtPayload = {
    iss: saCreds.client_email,
    sub: saCreds.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: MASTER_ADMIN_UID
  };

  const b64Url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tokenMsg = `${b64Url(jwtHeader)}.${b64Url(jwtPayload)}`;
  const keyBinary = pemToBinary(saCreds.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBinary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(tokenMsg));
  const customToken = `${tokenMsg}.${Buffer.from(sig).toString('base64url')}`;

  const authExchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    }
  );

  assert(authExchangeRes.status === 200, 'Identity Toolkit signInWithCustomToken returned HTTP 200');
  const authData = await authExchangeRes.json();
  assert(typeof authData.idToken === 'string' && authData.idToken.length > 50, 'Valid Google Firebase ID Token obtained');
  const idToken = authData.idToken;

  // ---------------------------------------------------------------------------
  // SUITE 3: Unauthenticated & Malformed Request Security Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Edge Security & Authentication Boundaries ---');
  
  // 3.1 Missing token
  const noTokenRes = await fetch(`${STAGING_URL}/api/callable/getOrCreateMonthlyDistributionCallable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ billingMonth: '2026-11' })
  });
  assert(noTokenRes.status === 401, 'Unauthenticated request rejected with HTTP 401');
  const noTokenJson = await noTokenRes.json();
  assert(noTokenJson.error?.code === 'UNAUTHENTICATED', 'Error code is UNAUTHENTICATED');

  // 3.2 Cross-workspace targeting
  const crossWsRes = await fetch(`${STAGING_URL}/api/callable/getOrCreateMonthlyDistributionCallable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
      'x-workspace-id': 'workspace_unauthorized_other'
    },
    body: JSON.stringify({ billingMonth: '2026-11', workspaceId: 'workspace_unauthorized_other' })
  });
  assert(crossWsRes.status === 403, 'Cross-workspace targeting rejected with HTTP 403');
  const crossWsJson = await crossWsRes.json();
  assert(
    crossWsJson.error?.code === 'CROSS_WORKSPACE_DENIED' || crossWsJson.error?.code === 'FORBIDDEN',
    `Error code indicates denial (${crossWsJson.error?.code})`
  );

  // ---------------------------------------------------------------------------
  // SUITE 4: Authoritative Master Admin API Action Dispatch
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Authenticated Master Admin API & Workspace RBAC ---');

  const distRes = await fetch(`${STAGING_URL}/api/callable/getOrCreateMonthlyDistributionCallable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
      'x-workspace-id': WORKSPACE_ID
    },
    body: JSON.stringify({ distributionMonth: '2026-11', workspaceId: WORKSPACE_ID })
  });
  assert(distRes.status === 200, 'getOrCreateMonthlyDistributionCallable returned HTTP 200 OK');
  const distJson = await distRes.json();
  assert(distJson.data && (distJson.data.distributionId || distJson.data.id || distJson.data.success), 'Monthly distribution retrieved successfully via live Worker');

  // ---------------------------------------------------------------------------
  // SUITE 5: Independent Financial Write Lock (All 10 Financial Mutations)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Financial Mutation Write Lock Enforcement (10/10) ---');

  const FINANCIAL_ACTIONS = [
    { action: 'generateMonthlyBillsCallable', payload: { propertyId: 'prop_01', billingMonth: '2026-11' } },
    { action: 'recordRentPaymentCallable', payload: { billId: 'bill_01', amount: 15000, paymentMethod: 'cash', paymentDate: '2026-11-08' } },
    { action: 'createExpenseCallable', payload: { group: 'building', category: 'maintenance_repair', amount: 5000, expenseDate: '2026-11-08', billingMonth: '2026-11', description: 'Plumbing repair' } },
    { action: 'updateExpenseCallable', payload: { expenseId: 'exp_01', amount: 6000, reason: 'Scope increase' } },
    { action: 'reverseExpenseCallable', payload: { expenseId: 'exp_01', reason: 'Billing error' } },
    { action: 'applySpecialAdjustmentCallable', payload: { distributionId: 'dist_01', beneficiaryId: 'ben_01', adjustmentAmount: 1000, reason: 'Eid bonus' } },
    { action: 'recordBeneficiaryPayoutCallable', payload: { distributionId: 'dist_01', beneficiaryId: 'ben_01', amount: 25000, paymentMethod: 'bank_transfer', paymentDate: '2026-11-08' } },
    { action: 'initializeReserveFundCallable', payload: { openingBalance: 500000 } },
    { action: 'withdrawFromReserveCallable', payload: { amount: 30000, reason: 'Emergency generator', recipientName: 'Vendor XYZ', paymentMethod: 'bank_transfer' } },
    { action: 'transferSurplusToReserveCallable', payload: { amount: 20000, fromBillingMonth: '2026-10' } }
  ];

  for (const item of FINANCIAL_ACTIONS) {
    const res = await fetch(`${STAGING_URL}/api/callable/${item.action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        'x-workspace-id': WORKSPACE_ID
      },
      body: JSON.stringify({ ...item.payload, workspaceId: WORKSPACE_ID })
    });

    assert(res.status === 200, `[Safety Gate] ${item.action} returned HTTP 200 OK`);
    const json = await res.json();
    assert(
      json.data && json.data.status === 'PACKAGING_VALIDATED',
      `[Safety Gate] ${item.action} intercepted by disableFinancialWrites (status: PACKAGING_VALIDATED)`
    );
  }

  // ---------------------------------------------------------------------------
  // SUITE 6: Live Staging Firestore Document Reads
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Live Staging Document Reads (Property, Unit, Tenant) ---');
  const tokenProvider = async () => await getFirestoreAccessToken(saCreds, fetch);
  const firestoreClient = new FirestoreRestClient(STAGING_PROJECT_ID, tokenProvider, { fetchImpl: fetch });

  const propDoc = await firestoreClient.getDocument('properties', 'prop_ws_bhuiya_family_01');
  assert(propDoc !== null && propDoc.data, 'Property prop_ws_bhuiya_family_01 readable');
  assert(propDoc.data.name === 'ভূঁইয়া বাড়ি', 'Property name matches "ভূঁইয়া বাড়ি"');

  const unitDoc = await firestoreClient.getDocument('units', 'unit_ws_bhuiya_family_101');
  assert(unitDoc !== null && unitDoc.data, 'Unit unit_ws_bhuiya_family_101 readable');
  assert(unitDoc.data.unitNumber === 'Flat 1A', 'Unit number matches "Flat 1A"');

  const tenantDoc = await firestoreClient.getDocument('tenants', 'tenant_ws_bhuiya_family_001');
  assert(tenantDoc !== null && tenantDoc.data, 'Tenant tenant_ws_bhuiya_family_001 readable');
  assert(tenantDoc.data.name === 'তানভীর আহমেদ', 'Tenant name matches "তানভীর আহমেদ"');

  // ---------------------------------------------------------------------------
  // SUITE 7: Database Zero-Write Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Live Database Zero-Write Verification ---');
  const bills = await firestoreClient.runQuery({ from: [{ collectionId: 'rent_bills' }] });
  assert(bills.length === 0, `Staging "rent_bills" count is strictly 0 (found: ${bills.length})`);

  const payments = await firestoreClient.runQuery({ from: [{ collectionId: 'rent_payments' }] });
  assert(payments.length === 0, `Staging "rent_payments" count is strictly 0 (found: ${payments.length})`);

  const expenses = await firestoreClient.runQuery({ from: [{ collectionId: 'expenses' }] });
  assert(expenses.length === 0, `Staging "expenses" count is strictly 0 (found: ${expenses.length})`);

  const deposits = await firestoreClient.runQuery({ from: [{ collectionId: 'security_deposits' }] });
  assert(deposits.length === 0, `Staging "security_deposits" count is strictly 0 (found: ${deposits.length})`);

  console.log('\n========================================================================');
  console.log(`CLOUDFLARE PAGES VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
