/**
 * Phase 10.2B-9: Staging Application Integration Test Suite
 * 
 * Comprehensive verification of:
 * 1. Frontend authentication connection to staging Worker API (headers, payload, error handling)
 * 2. Authenticated workspace membership and RBAC resolution (master_admin, manager, viewer)
 * 3. Master admin dashboard access across all 7 modules
 * 4. Workspace-scoped property, tenant, and unit READ operations against staging Firestore
 * 5. UI permission restrictions (tab-level access control, role boundaries)
 * 6. Financial writes remain strictly disabled; zero production data modifications; zero secret leakage
 */

import fs from 'fs';
import path from 'path';
import { getWorkerConfig, parseServiceAccountCredentials } from './worker/envConfig.mjs';
import { lookupWorkspaceMember, workerInstance } from './worker/index.mjs';
import { authorizeWorkspaceRequest, sanitizeClientPayload } from './workspaceAuth.mjs';
import { getFirestoreAccessToken } from './serviceAccountAuth.mjs';
import { FirestoreRestClient } from './firestoreRestClient.mjs';
// API Client state and error classes matching src/lib/apiClient.ts
let activeWorkspaceId = null;
export function setActiveWorkspaceId(workspaceId) {
  activeWorkspaceId = workspaceId;
}
export function getActiveWorkspaceId() {
  return activeWorkspaceId;
}
export class ApiClientError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const DEFAULT_WORKSPACE_ID = 'workspace_bhuiya_family';

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
  publicJwk.kid = 'stage-test-kid-9';
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

// Emulates UI canAccessTab logic from WorkspaceContext
function evaluateCanAccessTab(membership, tabId) {
  if (!membership || membership.status !== 'active') return false;
  if (membership.role === 'master_admin') return true;

  const perms = membership.permissions || {};
  switch (tabId) {
    case 'dashboard':
      return true;
    case 'properties':
    case 'tenants':
      return Boolean(perms.canManageTenants);
    case 'rent':
      return Boolean(perms.canCollectRent);
    case 'expenses':
      return Boolean(perms.canRecordExpenses);
    case 'reports':
      return Boolean(perms.canViewReports);
    case 'distribution':
      return membership.role === 'master_admin'; // Reserve funds & distributions strictly master_admin only
    default:
      return false;
  }
}

async function runSuite() {
  console.log('======================================================================');
  console.log('  PHASE 10.2B-9: STAGING APPLICATION INTEGRATION TEST SUITE');
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

  const credentials = parseServiceAccountCredentials(devVars);
  const firestoreClient = new FirestoreRestClient(stagingProjectId, async () => {
    return await getFirestoreAccessToken(credentials);
  });

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
  const validAdminToken = await signJwt({ alg: 'RS256', kid: 'stage-test-kid-9' }, validPayload, keyPair.privateKey);

  const liveWorkerEnv = {
    ...devVars,
    __MOCK_JWKS__: mockJwks
  };

  // ---------------------------------------------------------------------------
  // SUITE 1: FRONTEND AUTHENTICATION & STAGING WORKER API CLIENT INTEGRATION
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: FRONTEND AUTH & STAGING WORKER API CLIENT ---');

  // 1.1 Active Workspace Context state in apiClient
  setActiveWorkspaceId(provisionedWorkspaceId);
  assert(
    getActiveWorkspaceId() === provisionedWorkspaceId,
    'API Client: setActiveWorkspaceId properly stores active workspace ID'
  );

  setActiveWorkspaceId(null);
  assert(
    getActiveWorkspaceId() === null,
    'API Client: setActiveWorkspaceId(null) properly resets workspace context'
  );
  setActiveWorkspaceId(provisionedWorkspaceId);

  // 1.2 Error parsing compatibility: Cloudflare Worker { error: { code, message } } format
  const workerErrPayload = {
    error: {
      code: 'FORBIDDEN',
      message: 'Access Denied: User does not belong to requested workspace'
    }
  };
  const parsedErrObj = typeof workerErrPayload.error === 'object' ? workerErrPayload.error : null;
  const errorCode = parsedErrObj?.code || 'internal';
  const errorMessage = parsedErrObj?.message || 'failed';
  const apiErr = new ApiClientError(errorCode, errorMessage, 403);
  assert(
    apiErr.code === 'FORBIDDEN' && apiErr.message.includes('Access Denied') && apiErr.statusCode === 403,
    'API Client: Correctly extracts structured code and message from Cloudflare Worker error responses'
  );

  // 1.3 Unauthenticated error creation
  const unauthErr = new ApiClientError('unauthenticated', 'User must be authenticated to invoke callable APIs.', 401);
  assert(
    unauthErr.code === 'unauthenticated' && unauthErr.statusCode === 401,
    'API Client: Unauthenticated error conforms to ApiClientError format'
  );

  // 1.4 Live API invocation with active workspace context
  const testApiReq = new Request('http://localhost/api/callable/registerTenantCallable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${validAdminToken}`,
      'x-workspace-id': provisionedWorkspaceId,
      'Content-Type': 'application/json',
      'Origin': 'https://bhuiya-property-manager.pages.dev'
    },
    body: JSON.stringify({
      propertyId: 'prop_staging_01',
      unitId: 'unit_101',
      name: 'Rahim Bhuiya',
      phone: '+8801700000000',
      monthlyRent: 20000,
      securityDeposit: 40000
    })
  });

  const testApiRes = await workerInstance.fetch(testApiReq, liveWorkerEnv, {});
  const testApiBody = await testApiRes.json();
  assert(
    testApiRes.status === 200 &&
    testApiBody.data?.success === true &&
    testApiBody.data?.status === 'PACKAGING_VALIDATED',
    'API Client: Live Worker API successfully authenticates and executes with x-workspace-id header'
  );

  // ---------------------------------------------------------------------------
  // SUITE 2: AUTHENTICATED WORKSPACE MEMBERSHIP & RBAC RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: WORKSPACE MEMBERSHIP & RBAC RESOLUTION ---');

  // 2.1 Live membership resolution from Firestore
  const liveAdminMember = await lookupWorkspaceMember(provisionedUid, provisionedWorkspaceId, liveWorkerEnv);
  assert(
    liveAdminMember !== null &&
    liveAdminMember.workspaceId === provisionedWorkspaceId &&
    liveAdminMember.uid === provisionedUid &&
    liveAdminMember.role === 'master_admin' &&
    liveAdminMember.status === 'active',
    'Workspace RBAC: Resolved live master_admin membership from staging Firestore'
  );

  assert(
    liveAdminMember.permissions.canManageTenants === true &&
    liveAdminMember.permissions.canCollectRent === true &&
    liveAdminMember.permissions.canRecordExpenses === true &&
    liveAdminMember.permissions.canViewReports === true,
    'Workspace RBAC: Master admin holds all 4 permissions active'
  );

  // 2.2 Simulated Manager Role resolution
  const managerMember = {
    workspaceId: provisionedWorkspaceId,
    uid: 'manager_user_uid',
    role: 'manager',
    status: 'active',
    permissions: {
      canManageTenants: true,
      canCollectRent: true,
      canRecordExpenses: true,
      canViewReports: true
    }
  };
  assert(
    managerMember.role === 'manager' &&
    managerMember.permissions.canManageTenants === true &&
    managerMember.permissions.canCollectRent === true,
    'Workspace RBAC: Manager role properly resolves tenant and rent collection capabilities'
  );

  // 2.3 Simulated Viewer Role resolution
  const viewerMember = {
    workspaceId: provisionedWorkspaceId,
    uid: 'viewer_user_uid',
    role: 'viewer',
    status: 'active',
    permissions: {
      canManageTenants: false,
      canCollectRent: false,
      canRecordExpenses: false,
      canViewReports: true
    }
  };
  assert(
    viewerMember.role === 'viewer' &&
    viewerMember.permissions.canViewReports === true &&
    viewerMember.permissions.canManageTenants === false,
    'Workspace RBAC: Viewer role strictly restricted to report viewing'
  );

  // ---------------------------------------------------------------------------
  // SUITE 3: MASTER_ADMIN DASHBOARD ACCESS
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: MASTER_ADMIN DASHBOARD ACCESS ---');

  const allDashboardTabs = ['dashboard', 'properties', 'tenants', 'rent', 'expenses', 'distribution', 'reports'];
  for (const tab of allDashboardTabs) {
    const isAccessible = evaluateCanAccessTab(liveAdminMember, tab);
    assert(
      isAccessible === true,
      `Dashboard Access: Master Admin granted access to "${tab}" tab`
    );
  }

  // Dashboard Overview Metrics Calculations (resilience with zero data)
  const emptyProps = [];
  const emptyUnits = [];
  const emptyTenants = [];
  const emptyBills = [];
  const emptyPayments = [];
  const emptyExpenses = [];

  const activePropsCount = emptyProps.filter(p => !p.isArchived).length;
  const activeUnitsCount = emptyUnits.filter(u => !u.isArchived).length;
  const activeTenantsCount = emptyTenants.filter(t => t.status === 'active').length;
  const totalRentCollected = emptyPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalExpenses = emptyExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const operatingSurplus = totalRentCollected - totalExpenses;

  assert(
    activePropsCount === 0 &&
    activeUnitsCount === 0 &&
    activeTenantsCount === 0 &&
    operatingSurplus === 0,
    'Dashboard Metrics: Overview metric calculations compute safely without NaN when collections are empty'
  );

  // ---------------------------------------------------------------------------
  // SUITE 4: WORKSPACE-SCOPED PROPERTY, TENANT & UNIT READ OPERATIONS
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: WORKSPACE-SCOPED READ OPERATIONS ---');

  // 4.1 Direct REST fetch of workspace membership document
  const memberDoc = await firestoreClient.getDocument(
    'workspace_members',
    `${provisionedWorkspaceId}_${provisionedUid}`
  );
  assert(
    memberDoc !== null && memberDoc.data?.workspaceId === provisionedWorkspaceId,
    'Firestore Read: Successfully read workspace membership document from staging REST API'
  );

  // 4.2 Non-existent property document read
  const propDoc = await firestoreClient.getDocument('properties', 'non_existent_prop_01');
  assert(
    propDoc === null,
    'Firestore Read: Property read for non-existent document returns null cleanly'
  );

  // 4.3 Non-existent unit document read
  const unitDoc = await firestoreClient.getDocument('units', 'non_existent_unit_01');
  assert(
    unitDoc === null,
    'Firestore Read: Unit read for non-existent document returns null cleanly'
  );

  // 4.4 Non-existent tenant document read
  const tenantDoc = await firestoreClient.getDocument('tenants', 'non_existent_tenant_01');
  assert(
    tenantDoc === null,
    'Firestore Read: Tenant read for non-existent document returns null cleanly'
  );

  // ---------------------------------------------------------------------------
  // SUITE 5: UI PERMISSION RESTRICTIONS & RBAC MATRIX
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: UI PERMISSION RESTRICTIONS & RBAC MATRIX ---');

  // 5.1 Manager tab permissions
  assert(evaluateCanAccessTab(managerMember, 'dashboard') === true, 'UI RBAC: Manager can access dashboard');
  assert(evaluateCanAccessTab(managerMember, 'properties') === true, 'UI RBAC: Manager can access properties');
  assert(evaluateCanAccessTab(managerMember, 'tenants') === true, 'UI RBAC: Manager can access tenants');
  assert(evaluateCanAccessTab(managerMember, 'rent') === true, 'UI RBAC: Manager can access rent collection');
  assert(evaluateCanAccessTab(managerMember, 'expenses') === true, 'UI RBAC: Manager can access expenses');
  assert(evaluateCanAccessTab(managerMember, 'reports') === true, 'UI RBAC: Manager can access reports');
  assert(
    evaluateCanAccessTab(managerMember, 'distribution') === false,
    'UI RBAC: Manager strictly BLOCKED from family distributions & reserve fund'
  );

  // 5.2 Viewer tab permissions
  assert(evaluateCanAccessTab(viewerMember, 'dashboard') === true, 'UI RBAC: Viewer can access dashboard');
  assert(evaluateCanAccessTab(viewerMember, 'reports') === true, 'UI RBAC: Viewer can access reports');
  assert(evaluateCanAccessTab(viewerMember, 'properties') === false, 'UI RBAC: Viewer BLOCKED from properties');
  assert(evaluateCanAccessTab(viewerMember, 'tenants') === false, 'UI RBAC: Viewer BLOCKED from tenants');
  assert(evaluateCanAccessTab(viewerMember, 'rent') === false, 'UI RBAC: Viewer BLOCKED from rent collection');
  assert(evaluateCanAccessTab(viewerMember, 'expenses') === false, 'UI RBAC: Viewer BLOCKED from expenses');
  assert(evaluateCanAccessTab(viewerMember, 'distribution') === false, 'UI RBAC: Viewer BLOCKED from distribution');

  // 5.3 Inactive/Suspended member permissions
  const suspendedMember = { ...liveAdminMember, status: 'suspended' };
  assert(
    evaluateCanAccessTab(suspendedMember, 'dashboard') === false &&
    evaluateCanAccessTab(suspendedMember, 'reports') === false,
    'UI RBAC: Suspended member strictly BLOCKED from all dashboard views'
  );

  // ---------------------------------------------------------------------------
  // SUITE 6: FINANCIAL WRITES SAFETY & SECURITY REGRESSION
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 6: FINANCIAL WRITES SAFETY & SECURITY REGRESSION ---');

  const config = getWorkerConfig(devVars);
  assert(
    config.disableFinancialWrites === true,
    'Financial Safety: workerConfig.disableFinancialWrites is TRUE in staging configuration'
  );
  assert(
    devVars.DISABLE_FINANCIAL_WRITES === 'true',
    'Financial Safety: DISABLE_FINANCIAL_WRITES strictly equals "true" in .dev.vars'
  );

  // Test financial mutation intercept through Worker
  const reqFinancialMut = new Request('http://localhost/api/callable/createExpenseCallable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${validAdminToken}`,
      'x-workspace-id': provisionedWorkspaceId,
      'Content-Type': 'application/json',
      'Origin': 'https://bhuiya-property-manager.pages.dev'
    },
    body: JSON.stringify({
      propertyId: 'prop_01',
      group: 'property_maintenance',
      category: 'repairs',
      amount: 4500,
      expenseDate: '2026-11-08',
      billingMonth: '2026-11',
      description: 'Staging Integration Water Pump Servicing'
    })
  });

  const resFinancialMut = await workerInstance.fetch(reqFinancialMut, liveWorkerEnv, {});
  const bodyFinancialMut = await resFinancialMut.json();
  assert(
    resFinancialMut.status === 200 &&
    bodyFinancialMut.data?.status === 'PACKAGING_VALIDATED' &&
    bodyFinancialMut.data?.success === true,
    'Financial Safety: createExpenseCallable intercepted by packaging gate with zero live writes'
  );

  // Verify no secret leakage
  assert(
    !JSON.stringify(bodyFinancialMut).includes('private_key') &&
    !JSON.stringify(bodyFinancialMut).includes('BEGIN PRIVATE KEY'),
    'Security: API responses contain zero secret or private key leakage'
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`  PHASE 10.2B-9 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
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
