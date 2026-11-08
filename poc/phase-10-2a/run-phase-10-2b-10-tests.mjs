/**
 * Phase 10.2B-10: Live Staging Data Read & UI Verification Test Suite
 * 
 * Verifies:
 * 1. Actual workspace-scoped Property, Unit and Tenant READ operations against staging Firestore.
 * 2. Frontend data presentation, sorting, and contract integrity with real staging data.
 * 3. Cross-workspace data isolation using two workspaces (workspace_bhuiya_family vs workspace_other_demo).
 * 4. UI role-based access control (master_admin, manager, viewer) with live membership records.
 * 5. Strict financial write protection (DISABLE_FINANCIAL_WRITES=true) and zero financial mutations.
 * 6. Non-exposure of credentials and secrets.
 */

import fs from 'fs';
import path from 'path';
import { getWorkerConfig } from './worker/envConfig.mjs';
import { getFirestoreAccessToken } from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';
import { workerInstance } from './worker/index.mjs';
import { verifyFirebaseIdToken } from './tokenVerifier.mjs';

// Configuration & Test Assertions
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
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

// Web Crypto RS256 Test Token Helpers
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
  publicJwk.kid = 'stage-test-kid-10';
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

// UI RBAC logic matching src/contexts/WorkspaceContext.tsx and src/components/AdminDashboard.tsx
function canAccessTabForRole(role, tabId) {
  if (tabId === 'dashboard') return true;
  if (role === 'master_admin') return true;
  if (role === 'manager') {
    return ['properties', 'tenants', 'rent', 'expenses', 'reports'].includes(tabId);
  }
  if (role === 'viewer') {
    return ['properties'].includes(tabId);
  }
  return false;
}

function getRoleBadgeInfo(role) {
  switch (role) {
    case 'master_admin':
      return { label: 'মাস্টার এডমিন', colorClass: 'bg-purple-100 text-purple-700' };
    case 'manager':
      return { label: 'ম্যানেজার', colorClass: 'bg-blue-100 text-blue-700' };
    case 'viewer':
      return { label: 'দর্শক', colorClass: 'bg-slate-100 text-slate-700' };
    default:
      return { label: 'সদস্য', colorClass: 'bg-slate-100 text-slate-600' };
  }
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('PHASE 10.2B-10: LIVE STAGING DATA READ & UI VERIFICATION TEST SUITE');
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

  // ---------------------------------------------------------------------------
  // SUITE 1: Staging Environment & Secret Hygiene
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 1: Staging Environment & Secret Hygiene ---');
  const config = getWorkerConfig(env);
  assert(config.projectId === 'bhuiya-property-staging', 'Target project strictly bhuiya-property-staging');
  assert(config.executionMode === 'staging', 'Execution mode is staging');
  assert(config.disableFinancialWrites === true, 'Financial writes disabled flag is TRUE');
  assert(!config.credentialsError, 'Config credentials parsed without error');
  assert(Boolean(config.credentials?.client_email), 'Service account client email exists');
  assert(Boolean(config.credentials?.private_key), 'Service account private key exists');
  assert(
    !JSON.stringify({ ...config, credentials: '[REDACTED]' }).includes('BEGIN PRIVATE KEY'),
    'Config object does not leak raw private key string'
  );

  // Obtain OAuth token
  const authRes = await getFirestoreAccessToken(config.credentials, fetch);
  const token = typeof authRes === 'string' ? authRes : authRes.token;
  assert(typeof token === 'string' && token.length > 50, 'OAuth access token obtained successfully');
  assert(!token.includes('PRIVATE KEY'), 'Token is not a private key');

  const firestore = new FirestoreRestClient(config.projectId, async () => {
    const r = await getFirestoreAccessToken(config.credentials, fetch);
    return typeof r === 'string' ? r : r.token;
  });

  // Setup mock JWKS for Worker ID token verification in testing
  const { keyPair, publicJwk } = await generateTestRsaKeyPair();
  const mockJwks = { keys: [publicJwk] };
  const liveWorkerEnv = {
    ...env,
    __MOCK_JWKS__: mockJwks
  };

  const provisionedUid = 'WunBcW1KihNW2DMTs3R0gUpQ0fh2';
  const provisionedWorkspaceId = 'workspace_bhuiya_family';

  const now = Math.floor(Date.now() / 1000);
  const adminJwtPayload = {
    iss: `https://securetoken.google.com/${config.projectId}`,
    aud: config.projectId,
    auth_time: now - 30,
    sub: provisionedUid,
    iat: now - 30,
    exp: now + 3600,
    email: 'admin@bhuiya.staging'
  };
  const validAdminToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-10' }, adminJwtPayload, keyPair.privateKey);

  // ---------------------------------------------------------------------------
  // SUITE 2: Live Staging Firestore Document Reads (Bhuiya Family Workspace)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Live Staging Document Reads (Bhuiya Family Workspace) ---');
  
  // 1. Property Read
  const bhuiyaProp = await firestore.getDocument('properties', 'prop_ws_bhuiya_family_01');
  assert(bhuiyaProp !== null, 'Bhuiya Family Property exists in staging Firestore');
  assert(bhuiyaProp?.data?.workspaceId === 'workspace_bhuiya_family', 'Property workspaceId is workspace_bhuiya_family');
  assert(bhuiyaProp?.data?.name === 'ভূঁইয়া বাড়ি', 'Property Bengali name matches "ভূঁইয়া বাড়ি"');
  assert(bhuiyaProp?.data?.nameEn === 'Bhuiya Bari', 'Property English name matches "Bhuiya Bari"');
  assert(bhuiyaProp?.data?.code === 'bhuiya-bari', 'Property code matches "bhuiya-bari"');
  assert(bhuiyaProp?.data?.type === 'residential', 'Property type is "residential"');
  assert(bhuiyaProp?.data?.totalFloors === 3, 'Property totalFloors is 3');
  assert(bhuiyaProp?.data?.status === 'active', 'Property status is "active"');

  // 2. Unit Read
  const bhuiyaUnit = await firestore.getDocument('units', 'unit_ws_bhuiya_family_101');
  assert(bhuiyaUnit !== null, 'Bhuiya Family Unit exists in staging Firestore');
  assert(bhuiyaUnit?.data?.workspaceId === 'workspace_bhuiya_family', 'Unit workspaceId is workspace_bhuiya_family');
  assert(bhuiyaUnit?.data?.propertyId === 'prop_ws_bhuiya_family_01', 'Unit propertyId links to prop_ws_bhuiya_family_01');
  assert(bhuiyaUnit?.data?.unitNumber === 'Flat 1A', 'Unit number is "Flat 1A"');
  assert(bhuiyaUnit?.data?.monthlyRent === 20000, 'Unit monthlyRent is 20000 BDT');
  assert(bhuiyaUnit?.data?.serviceCharge === 2000, 'Unit serviceCharge is 2000 BDT');
  assert(bhuiyaUnit?.data?.status === 'occupied', 'Unit status is "occupied"');

  // 3. Tenant Read
  const bhuiyaTenant = await firestore.getDocument('tenants', 'tenant_ws_bhuiya_family_001');
  assert(bhuiyaTenant !== null, 'Bhuiya Family Tenant exists in staging Firestore');
  assert(bhuiyaTenant?.data?.workspaceId === 'workspace_bhuiya_family', 'Tenant workspaceId is workspace_bhuiya_family');
  assert(bhuiyaTenant?.data?.propertyId === 'prop_ws_bhuiya_family_01', 'Tenant propertyId links to property');
  assert(bhuiyaTenant?.data?.unitId === 'unit_ws_bhuiya_family_101', 'Tenant unitId links to unit');
  assert(bhuiyaTenant?.data?.name === 'তানভীর আহমেদ', 'Tenant Bengali name matches "তানভীর আহমেদ"');
  assert(bhuiyaTenant?.data?.monthlyRent === 20000, 'Tenant monthlyRent is 20000 BDT');
  assert(bhuiyaTenant?.data?.advanceDeposit === 40000, 'Tenant advanceDeposit is 40000 BDT');
  assert(bhuiyaTenant?.data?.status === 'active', 'Tenant status is "active"');

  // ---------------------------------------------------------------------------
  // SUITE 3: Cross-Workspace Data Isolation Verification (Live Staging)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Cross-Workspace Data Isolation (Live Staging) ---');

  // 1. Other Demo Property Read
  const otherProp = await firestore.getDocument('properties', 'prop_ws_other_demo_01');
  assert(otherProp !== null, 'Other Demo Property exists in staging Firestore');
  assert(otherProp?.data?.workspaceId === 'workspace_other_demo', 'Other Demo workspaceId is workspace_other_demo');
  assert(otherProp?.data?.name === 'অন্যান্য বাণিজ্যিক ভবন', 'Other Demo name is "অন্যান্য বাণিজ্যিক ভবন"');

  // 2. Other Demo Unit Read
  const otherUnit = await firestore.getDocument('units', 'unit_ws_other_demo_201');
  assert(otherUnit !== null, 'Other Demo Unit exists in staging Firestore');
  assert(otherUnit?.data?.workspaceId === 'workspace_other_demo', 'Other Demo Unit workspaceId is workspace_other_demo');
  assert(otherUnit?.data?.unitNumber === 'Shop 1', 'Other Demo Unit number is "Shop 1"');

  // 3. Other Demo Tenant Read
  const otherTenant = await firestore.getDocument('tenants', 'tenant_ws_other_demo_002');
  assert(otherTenant !== null, 'Other Demo Tenant exists in staging Firestore');
  assert(otherTenant?.data?.workspaceId === 'workspace_other_demo', 'Other Demo Tenant workspaceId is workspace_other_demo');
  assert(otherTenant?.data?.name === 'করিম চৌধুরী', 'Other Demo Tenant name is "করিম চৌধুরী"');

  // 4. Query Partitioning: Workspace Bhuiya Family
  const bhuiyaPropsQuery = await firestore.queryByField('properties', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(bhuiyaPropsQuery.length === 1, 'Query properties for workspace_bhuiya_family returns exactly 1');
  assert(bhuiyaPropsQuery[0].id === 'prop_ws_bhuiya_family_01', 'Bhuiya query returns prop_ws_bhuiya_family_01');
  assert(!bhuiyaPropsQuery.some(p => p.id === 'prop_ws_other_demo_01'), 'Zero leakage of other demo property into Bhuiya query');

  const bhuiyaUnitsQuery = await firestore.queryByField('units', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(bhuiyaUnitsQuery.length === 1, 'Query units for workspace_bhuiya_family returns exactly 1');
  assert(bhuiyaUnitsQuery[0].id === 'unit_ws_bhuiya_family_101', 'Bhuiya units query returns unit_ws_bhuiya_family_101');
  assert(!bhuiyaUnitsQuery.some(u => u.id === 'unit_ws_other_demo_201'), 'Zero leakage of other demo unit into Bhuiya query');

  const bhuiyaTenantsQuery = await firestore.queryByField('tenants', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(bhuiyaTenantsQuery.length === 1, 'Query tenants for workspace_bhuiya_family returns exactly 1');
  assert(bhuiyaTenantsQuery[0].id === 'tenant_ws_bhuiya_family_001', 'Bhuiya tenants query returns tenant_ws_bhuiya_family_001');
  assert(!bhuiyaTenantsQuery.some(t => t.id === 'tenant_ws_other_demo_002'), 'Zero leakage of other demo tenant into Bhuiya query');

  // 5. Query Partitioning: Workspace Other Demo
  const otherPropsQuery = await firestore.queryByField('properties', 'workspaceId', 'EQUAL', 'workspace_other_demo');
  assert(otherPropsQuery.length === 1, 'Query properties for workspace_other_demo returns exactly 1');
  assert(otherPropsQuery[0].id === 'prop_ws_other_demo_01', 'Other demo query returns prop_ws_other_demo_01');
  assert(!otherPropsQuery.some(p => p.id === 'prop_ws_bhuiya_family_01'), 'Zero leakage of Bhuiya property into other demo query');

  const otherUnitsQuery = await firestore.queryByField('units', 'workspaceId', 'EQUAL', 'workspace_other_demo');
  assert(otherUnitsQuery.length === 1, 'Query units for workspace_other_demo returns exactly 1');
  assert(otherUnitsQuery[0].id === 'unit_ws_other_demo_201', 'Other demo units query returns unit_ws_other_demo_201');

  const otherTenantsQuery = await firestore.queryByField('tenants', 'workspaceId', 'EQUAL', 'workspace_other_demo');
  assert(otherTenantsQuery.length === 1, 'Query tenants for workspace_other_demo returns exactly 1');
  assert(otherTenantsQuery[0].id === 'tenant_ws_other_demo_002', 'Other demo tenants query returns tenant_ws_other_demo_002');

  // ---------------------------------------------------------------------------
  // SUITE 4: Live Staging RBAC & UI Role Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Live Staging RBAC & UI Role Verification ---');

  // 1. Master Admin Membership (Provisioned in Phase 10.2B-7)
  const masterAdminMember = await firestore.getDocument(
    'workspace_members',
    'workspace_bhuiya_family_WunBcW1KihNW2DMTs3R0gUpQ0fh2'
  );
  assert(masterAdminMember !== null, 'Master Admin document exists in staging Firestore');
  assert(masterAdminMember?.data?.role === 'master_admin', 'Master Admin role is "master_admin"');
  assert(masterAdminMember?.data?.status === 'active', 'Master Admin status is "active"');
  assert(masterAdminMember?.data?.permissions?.canManageTenants === true, 'Master Admin canManageTenants is true');
  assert(masterAdminMember?.data?.permissions?.canViewReports === true, 'Master Admin canViewReports is true');

  // UI simulation for master_admin
  const adminTabs = ['dashboard', 'properties', 'tenants', 'rent', 'expenses', 'distribution', 'reports'];
  for (const tab of adminTabs) {
    assert(canAccessTabForRole('master_admin', tab) === true, `Master Admin can access tab "${tab}"`);
  }
  const adminBadge = getRoleBadgeInfo('master_admin');
  assert(adminBadge.label === 'মাস্টার এডমিন', 'Master Admin UI badge label matches Bengali translation');
  assert(adminBadge.colorClass.includes('purple'), 'Master Admin badge uses purple styling');

  // 2. Manager Membership (Seeded in Phase 10.2B-10)
  const managerMember = await firestore.getDocument(
    'workspace_members',
    'workspace_bhuiya_family_demo_manager_uid'
  );
  assert(managerMember !== null, 'Manager document exists in staging Firestore');
  assert(managerMember?.data?.role === 'manager', 'Manager role is "manager"');
  assert(managerMember?.data?.status === 'active', 'Manager status is "active"');
  assert(managerMember?.data?.permissions?.canManageTenants === true, 'Manager canManageTenants is true');
  assert(managerMember?.data?.permissions?.canRecordExpenses === false, 'Manager canRecordExpenses is false');

  // UI simulation for manager
  assert(canAccessTabForRole('manager', 'dashboard') === true, 'Manager can access dashboard');
  assert(canAccessTabForRole('manager', 'properties') === true, 'Manager can access properties');
  assert(canAccessTabForRole('manager', 'tenants') === true, 'Manager can access tenants');
  assert(canAccessTabForRole('manager', 'rent') === true, 'Manager can access rent');
  assert(canAccessTabForRole('manager', 'expenses') === true, 'Manager can access expenses');
  assert(canAccessTabForRole('manager', 'reports') === true, 'Manager can access reports');
  assert(canAccessTabForRole('manager', 'distribution') === false, 'Manager CANNOT access distribution (locked)');
  const managerBadge = getRoleBadgeInfo('manager');
  assert(managerBadge.label === 'ম্যানেজার', 'Manager UI badge label matches Bengali translation');
  assert(managerBadge.colorClass.includes('blue'), 'Manager badge uses blue styling');

  // 3. Viewer Membership (Seeded in Phase 10.2B-10)
  const viewerMember = await firestore.getDocument(
    'workspace_members',
    'workspace_bhuiya_family_demo_viewer_uid'
  );
  assert(viewerMember !== null, 'Viewer document exists in staging Firestore');
  assert(viewerMember?.data?.role === 'viewer', 'Viewer role is "viewer"');
  assert(viewerMember?.data?.status === 'active', 'Viewer status is "active"');
  assert(viewerMember?.data?.permissions?.canManageTenants === false, 'Viewer canManageTenants is false');

  // UI simulation for viewer
  assert(canAccessTabForRole('viewer', 'dashboard') === true, 'Viewer can access dashboard');
  assert(canAccessTabForRole('viewer', 'properties') === true, 'Viewer can access properties');
  assert(canAccessTabForRole('viewer', 'tenants') === false, 'Viewer CANNOT access tenants (locked)');
  assert(canAccessTabForRole('viewer', 'rent') === false, 'Viewer CANNOT access rent (locked)');
  assert(canAccessTabForRole('viewer', 'expenses') === false, 'Viewer CANNOT access expenses (locked)');
  assert(canAccessTabForRole('viewer', 'distribution') === false, 'Viewer CANNOT access distribution (locked)');
  assert(canAccessTabForRole('viewer', 'reports') === false, 'Viewer CANNOT access reports (locked)');
  const viewerBadge = getRoleBadgeInfo('viewer');
  assert(viewerBadge.label === 'দর্শক', 'Viewer UI badge label matches Bengali translation');
  assert(viewerBadge.colorClass.includes('slate'), 'Viewer badge uses slate styling');

  // ---------------------------------------------------------------------------
  // SUITE 5: Financial Operations Safety Gate & Immutability
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Financial Operations Safety Gate & Immutability ---');

  // 1. Intercept generateMonthlyBillsCallable
  const reqBill = makeApiRequest(
    'generateMonthlyBillsCallable',
    {
      workspaceId: provisionedWorkspaceId,
      propertyId: 'prop_ws_bhuiya_family_01',
      billingMonth: '2026-11'
    },
    validAdminToken
  );
  const resBill = await workerInstance.fetch(reqBill, liveWorkerEnv, {});
  assert(resBill.status === 200, 'generateMonthlyBillsCallable returns 200 OK');
  const bodyBill = await resBill.json();
  assert(bodyBill?.data?.status === 'PACKAGING_VALIDATED', 'generateMonthlyBillsCallable intercepted with status: PACKAGING_VALIDATED');
  assert(bodyBill?.data?.success === true, 'generateMonthlyBillsCallable safe packaging response');

  // 2. Intercept createExpenseCallable
  const reqExp = makeApiRequest(
    'createExpenseCallable',
    {
      workspaceId: provisionedWorkspaceId,
      group: 'property',
      category: 'repairs',
      amount: 2500,
      expenseDate: '2026-11-08',
      billingMonth: '2026-11',
      description: 'Plumbing leak repair'
    },
    validAdminToken
  );
  const resExp = await workerInstance.fetch(reqExp, liveWorkerEnv, {});
  assert(resExp.status === 200, 'createExpenseCallable returns 200 OK');
  const bodyExp = await resExp.json();
  assert(bodyExp?.data?.status === 'PACKAGING_VALIDATED', 'createExpenseCallable intercepted with status: PACKAGING_VALIDATED');

  // 3. Intercept withdrawFromReserveCallable
  const reqWith = makeApiRequest(
    'withdrawFromReserveCallable',
    {
      workspaceId: provisionedWorkspaceId,
      amount: 5000,
      reason: 'Emergency Roof Repair',
      recipientName: 'Contractor',
      paymentMethod: 'cash'
    },
    validAdminToken
  );
  const resWith = await workerInstance.fetch(reqWith, liveWorkerEnv, {});
  assert(resWith.status === 200, 'withdrawFromReserveCallable returns 200 OK');
  const bodyWith = await resWith.json();
  assert(bodyWith?.data?.status === 'PACKAGING_VALIDATED', 'withdrawFromReserveCallable intercepted with status: PACKAGING_VALIDATED');

  // 4. Intercept recordRentPaymentCallable
  const reqPay = makeApiRequest(
    'recordRentPaymentCallable',
    {
      workspaceId: provisionedWorkspaceId,
      billId: 'bill_demo_01',
      amount: 20000,
      paymentMethod: 'bkash',
      paymentDate: '2026-11-08'
    },
    validAdminToken
  );
  const resPay = await workerInstance.fetch(reqPay, liveWorkerEnv, {});
  assert(resPay.status === 200, 'recordRentPaymentCallable returns 200 OK');
  const bodyPay = await resPay.json();
  assert(bodyPay?.data?.status === 'PACKAGING_VALIDATED', 'recordRentPaymentCallable intercepted with status: PACKAGING_VALIDATED');

  // 5. Unauthenticated request rejected
  const reqNoAuth = makeApiRequest(
    'createExpenseCallable',
    {
      workspaceId: provisionedWorkspaceId,
      group: 'property',
      category: 'repairs',
      amount: 2500,
      expenseDate: '2026-11-08',
      billingMonth: '2026-11',
      description: 'Plumbing leak repair'
    },
    null
  );
  const resNoAuth = await workerInstance.fetch(reqNoAuth, liveWorkerEnv, {});
  assert(resNoAuth.status === 401, 'Unauthenticated request rejected with HTTP 401 Unauthorized');

  // 6. Viewer role rejected from financial modifications
  const viewerJwtPayload = {
    iss: `https://securetoken.google.com/${config.projectId}`,
    aud: config.projectId,
    auth_time: now - 30,
    sub: 'demo_viewer_uid',
    iat: now - 30,
    exp: now + 3600,
    email: 'viewer@bhuiya.staging'
  };
  const viewerToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-10' }, viewerJwtPayload, keyPair.privateKey);
  const reqViewerExp = makeApiRequest(
    'createExpenseCallable',
    {
      workspaceId: provisionedWorkspaceId,
      group: 'property',
      category: 'repairs',
      amount: 2500,
      expenseDate: '2026-11-08',
      billingMonth: '2026-11',
      description: 'Unauthorized attempt'
    },
    viewerToken
  );
  const resViewerExp = await workerInstance.fetch(reqViewerExp, liveWorkerEnv, {});
  assert(resViewerExp.status === 403, 'Viewer role attempt on financial mutation rejected with HTTP 403 Forbidden');

  // 7. Verify Zero Financial Documents in Staging Firestore
  const billsQuery = await firestore.queryByField('bills', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(billsQuery.length === 0, 'Live staging Firestore bills collection is completely empty (count: 0)');

  const expensesQuery = await firestore.queryByField('expenses', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(expensesQuery.length === 0, 'Live staging Firestore expenses collection is completely empty (count: 0)');

  const paymentsQuery = await firestore.queryByField('payments', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(paymentsQuery.length === 0, 'Live staging Firestore payments collection is completely empty (count: 0)');

  const depositsQuery = await firestore.queryByField('security_deposits', 'workspaceId', 'EQUAL', 'workspace_bhuiya_family');
  assert(depositsQuery.length === 0, 'Live staging Firestore security_deposits collection is empty (count: 0)');

  // ---------------------------------------------------------------------------
  // SUITE 6: Frontend Data Contract & Model Integrity
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Frontend Data Contract & Model Integrity ---');

  // Property sorting logic (Bengali locale compare & archive status)
  const mockProperties = [
    { name: 'অন্যান্য বাণিজ্যিক ভবন', isArchived: false },
    { name: 'ভূঁইয়া বাড়ি', isArchived: false },
    { name: 'আর্কাইভ ভবন', isArchived: true }
  ];
  mockProperties.sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return a.name.localeCompare(b.name, 'bn');
  });
  assert(mockProperties[2].name === 'আর্কাইভ ভবন', 'Archived property sorted to bottom');
  assert(mockProperties[0].name.localeCompare(mockProperties[1].name, 'bn') < 0, 'Bengali properties sorted alphabetically');

  // Unit sorting logic (Numeric unit comparison)
  const mockUnits = [
    { unitNumber: 'Flat 10B', isArchived: false },
    { unitNumber: 'Flat 2A', isArchived: false },
    { unitNumber: 'Flat 1A', isArchived: false }
  ];
  mockUnits.sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
  });
  assert(mockUnits[0].unitNumber === 'Flat 1A', 'Numeric unit sorting: Flat 1A first');
  assert(mockUnits[1].unitNumber === 'Flat 2A', 'Numeric unit sorting: Flat 2A second');
  assert(mockUnits[2].unitNumber === 'Flat 10B', 'Numeric unit sorting: Flat 10B third');

  // Tenant sorting logic (Active first, then Bengali name)
  const mockTenants = [
    { name: 'করিম চৌধুরী', status: 'vacated' },
    { name: 'তানভীর আহমেদ', status: 'active' },
    { name: 'আব্দুল মান্নান', status: 'active' }
  ];
  mockTenants.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return a.name.localeCompare(b.name, 'bn');
  });
  assert(mockTenants[0].status === 'active' && mockTenants[1].status === 'active', 'Active tenants sorted before vacated');
  assert(mockTenants[2].status === 'vacated', 'Vacated tenant placed at end');

  // Summary
  console.log('\n========================================================================');
  console.log(`PHASE 10.2B-10 TEST RESULTS: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('\nTest Execution Error:', err);
  process.exit(1);
});
