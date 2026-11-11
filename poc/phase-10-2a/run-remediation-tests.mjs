/**
 * Final Remediation Comprehensive Verification Suite
 * 
 * Verifies all 5 remediation priorities:
 * 1. Collection Path Alignment (Root collections with workspaceId/ownerUid)
 * 2. DTO Normalization & Permissive Aliasing (All 7 contract divergences)
 * 3. Property Mutation Callables (create, update, archive with master_admin RBAC)
 * 4. Build Pipeline & Bundle Integrity (dist/_worker.js existence, size, exports)
 * 5. Token Clock Skew & Legacy Compatibility (60s skew tolerance, ownerUid preservation)
 */

import fs from 'fs';
import path from 'path';
import { ACTION_REGISTRY, dispatchAction, normalizeActionPayload } from './worker/actionRegistry.mjs';
import { ACTION_PERMISSIONS, authorizeWorkspaceRequest } from './workspaceAuth.mjs';
import { verifyFirebaseIdToken } from './tokenVerifier.mjs';
import { packageWorker } from './package-worker.mjs';

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
  console.log('FINAL REMEDIATION COMPREHENSIVE VERIFICATION SUITE');
  console.log('========================================================================\n');

  const mockMasterAdminCtx = {
    workspaceId: 'workspace_bhuiya_family',
    uid: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2',
    role: 'master_admin',
    member: { status: 'active', role: 'master_admin', workspaceId: 'workspace_bhuiya_family' }
  };

  const mockManagerCtx = {
    workspaceId: 'workspace_bhuiya_family',
    uid: 'manager_uid_001',
    role: 'manager',
    member: { status: 'active', role: 'manager', workspaceId: 'workspace_bhuiya_family', permissions: { canManageTenants: true, canCollectRent: true } }
  };

  const mockViewerCtx = {
    workspaceId: 'workspace_bhuiya_family',
    uid: 'viewer_uid_001',
    role: 'viewer',
    member: { status: 'active', role: 'viewer', workspaceId: 'workspace_bhuiya_family', permissions: { canViewReports: true } }
  };

  const mockWorkerEnv = {
    config: { disableFinancialWrites: true }
  };

  // ---------------------------------------------------------------------------
  // PRIORITY 1: FIRESTORE COLLECTION PATH & SCHEMA ALIGNMENT
  // ---------------------------------------------------------------------------
  console.log('--- PRIORITY 1: Worker Firestore Collection Path & Schema Alignment ---');

  const actionRegistryCode = fs.readFileSync('poc/phase-10-2a/worker/actionRegistry.mjs', 'utf8');

  // Verify that subcollection paths are completely eliminated
  assert(!actionRegistryCode.includes('workspaces/${workspaceId}/tenants'), 'Subcollection workspaces/.../tenants replaced with root tenants');
  assert(!actionRegistryCode.includes('workspaces/${workspaceId}/liabilities'), 'Subcollection workspaces/.../liabilities replaced with root security_deposits');
  assert(!actionRegistryCode.includes('workspaces/${workspaceId}/bills'), 'Subcollection workspaces/.../bills replaced with root rent_bills');
  assert(!actionRegistryCode.includes('workspaces/${workspaceId}/payments'), 'Subcollection workspaces/.../payments replaced with root rent_payments');
  assert(!actionRegistryCode.includes('workspaces/${workspaceId}/expenses'), 'Subcollection workspaces/.../expenses replaced with root expenses');
  assert(!actionRegistryCode.includes('workspaces/${workspaceId}/reserveFund'), 'Subcollection workspaces/.../reserveFund replaced with root reserve_funds');
  assert(!actionRegistryCode.includes('workspaces/${workspaceId}/reserveTransactions'), 'Subcollection workspaces/.../reserveTransactions replaced with root reserve_ledger');

  // Verify that canonical root collections are targeted
  assert(actionRegistryCode.includes("tx.create(tenantPath, tenantId,") && actionRegistryCode.includes("tenantPath = 'tenants'"), 'Tenant mutations target root "tenants" collection');
  assert(actionRegistryCode.includes("liabilityPath = 'security_deposits'"), 'Deposit liability mutations target root "security_deposits" collection');
  assert(actionRegistryCode.includes("billPath = 'rent_bills'"), 'Bill mutations target root "rent_bills" collection');
  assert(actionRegistryCode.includes("paymentPath = 'rent_payments'"), 'Payment mutations target root "rent_payments" collection');
  assert(actionRegistryCode.includes("expensePath = 'expenses'"), 'Expense mutations target root "expenses" collection');
  assert(actionRegistryCode.includes("reservePath = 'reserve_funds'"), 'Reserve fund mutations target root "reserve_funds" collection');
  assert(actionRegistryCode.includes("txPath = 'reserve_ledger'"), 'Reserve ledger mutations target root "reserve_ledger" collection');

  // ---------------------------------------------------------------------------
  // PRIORITY 2: FRONTEND/BACKEND DTO NORMALIZATION & PERMISSIVE ALIASING
  // ---------------------------------------------------------------------------
  console.log('\n--- PRIORITY 2: Frontend/Backend DTO Normalization & Permissive Aliasing ---');

  // 2.1 registerTenantCallable: accepts mobile & advanceDeposit
  const rawTenantDTO = {
    propertyId: 'prop_01',
    unitId: 'unit_101',
    name: 'Rahim Uddin',
    mobile: '01711223344',
    advanceDeposit: 40000,
    monthlyRent: 20000
  };
  const normalizedTenantDTO = normalizeActionPayload('registerTenantCallable', rawTenantDTO);
  assert(normalizedTenantDTO.phone === '01711223344', 'registerTenant: mobile aliased to phone');
  assert(normalizedTenantDTO.securityDeposit === 40000, 'registerTenant: advanceDeposit aliased to securityDeposit');
  // Dispatch test
  const tenantRes = await dispatchAction('registerTenantCallable', rawTenantDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(tenantRes.status === 'PACKAGING_VALIDATED', 'registerTenantCallable dispatches with frontend DTO');

  // 2.2 vacateTenantCallable: accepts vacatingDate, unitId optional
  const rawVacateDTO = {
    tenantId: 'tenant_01',
    vacatingDate: '2026-11-30',
    refundAmount: 35000
  };
  const normalizedVacateDTO = normalizeActionPayload('vacateTenantCallable', rawVacateDTO);
  assert(normalizedVacateDTO.vacateDate === '2026-11-30', 'vacateTenant: vacatingDate aliased to vacateDate');
  const vacateRes = await dispatchAction('vacateTenantCallable', rawVacateDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(vacateRes.status === 'PACKAGING_VALIDATED', 'vacateTenantCallable dispatches with frontend DTO without unitId');

  // 2.3 createExpenseCallable: auto-derives billingMonth from expenseDate, defaults description
  const rawExpenseDTO = {
    title: 'Generator Fuel',
    amount: 5500,
    group: 'building',
    category: 'maintenance_repair',
    expenseDate: '2026-11-08'
  };
  const normalizedExpenseDTO = normalizeActionPayload('createExpenseCallable', rawExpenseDTO);
  assert(normalizedExpenseDTO.billingMonth === '2026-11', 'createExpense: billingMonth auto-derived from expenseDate');
  assert(normalizedExpenseDTO.description === 'Generator Fuel', 'createExpense: description defaulted from title');
  const expenseRes = await dispatchAction('createExpenseCallable', rawExpenseDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(expenseRes.status === 'PACKAGING_VALIDATED', 'createExpenseCallable dispatches with frontend ExpenseFormData');

  // 2.4 initializeReserveFundCallable: accepts initialBalance
  const rawReserveInitDTO = { initialBalance: 500000 };
  const normalizedReserveInitDTO = normalizeActionPayload('initializeReserveFundCallable', rawReserveInitDTO);
  assert(normalizedReserveInitDTO.openingBalance === 500000, 'initializeReserveFund: initialBalance aliased to openingBalance');
  const reserveInitRes = await dispatchAction('initializeReserveFundCallable', rawReserveInitDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(reserveInitRes.status === 'PACKAGING_VALIDATED', 'initializeReserveFundCallable dispatches with initialBalance');

  // 2.5 withdrawFromReserveCallable: defaults recipientName and paymentMethod
  const rawReserveWithdrawDTO = {
    amount: 25000,
    reason: 'Emergency generator overhaul',
    distributionMonth: '2026-11'
  };
  const normalizedReserveWithdrawDTO = normalizeActionPayload('withdrawFromReserveCallable', rawReserveWithdrawDTO);
  assert(normalizedReserveWithdrawDTO.recipientName === 'Authorized Member', 'withdrawFromReserve: recipientName defaulted');
  assert(normalizedReserveWithdrawDTO.paymentMethod === 'cash', 'withdrawFromReserve: paymentMethod defaulted');
  const reserveWithdrawRes = await dispatchAction('withdrawFromReserveCallable', rawReserveWithdrawDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(reserveWithdrawRes.status === 'PACKAGING_VALIDATED', 'withdrawFromReserveCallable dispatches with ReserveWithdrawalInput');

  // 2.6 transferSurplusToReserveCallable: accepts distributionMonth
  const rawTransferDTO = {
    amount: 18000,
    distributionMonth: '2026-10'
  };
  const normalizedTransferDTO = normalizeActionPayload('transferSurplusToReserveCallable', rawTransferDTO);
  assert(normalizedTransferDTO.fromBillingMonth === '2026-10', 'transferSurplus: distributionMonth aliased to fromBillingMonth');
  const transferRes = await dispatchAction('transferSurplusToReserveCallable', rawTransferDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(transferRes.status === 'PACKAGING_VALIDATED', 'transferSurplusToReserveCallable dispatches with ReserveTransferInput');

  // 2.7 applySpecialAdjustmentCallable & recordBeneficiaryPayoutCallable: accepts distributionMonth
  const rawAdjDTO = {
    distributionMonth: '2026-11',
    beneficiaryId: 'ben_mother',
    adjustmentAmount: 5000,
    reason: 'Medical support'
  };
  const normalizedAdjDTO = normalizeActionPayload('applySpecialAdjustmentCallable', rawAdjDTO);
  assert(normalizedAdjDTO.distributionId === '2026-11', 'applySpecialAdjustment: distributionMonth aliased to distributionId');
  const adjRes = await dispatchAction('applySpecialAdjustmentCallable', rawAdjDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(adjRes.status === 'PACKAGING_VALIDATED', 'applySpecialAdjustmentCallable dispatches with distributionMonth');

  const rawPayoutDTO = {
    distributionMonth: '2026-11',
    beneficiaryId: 'ben_brother1',
    amount: 20000,
    paymentMethod: 'bank_transfer'
  };
  const normalizedPayoutDTO = normalizeActionPayload('recordBeneficiaryPayoutCallable', rawPayoutDTO);
  assert(normalizedPayoutDTO.distributionId === '2026-11', 'recordBeneficiaryPayout: distributionMonth aliased to distributionId');
  assert(Boolean(normalizedPayoutDTO.paymentDate), 'recordBeneficiaryPayout: paymentDate auto-populated if omitted');
  const payoutRes = await dispatchAction('recordBeneficiaryPayoutCallable', rawPayoutDTO, mockMasterAdminCtx, mockWorkerEnv);
  assert(payoutRes.status === 'PACKAGING_VALIDATED', 'recordBeneficiaryPayoutCallable dispatches with RecordPayoutInput');

  // ---------------------------------------------------------------------------
  // PRIORITY 3: PROPERTY LIFECYCLE CALLABLE APIS & MASTER ADMIN RBAC
  // ---------------------------------------------------------------------------
  console.log('\n--- PRIORITY 3: Property Lifecycle Callable APIs & Authorization ---');

  // 3.1 Permission mapping in ACTION_PERMISSIONS
  assert(Array.isArray(ACTION_PERMISSIONS['createPropertyCallable']) && ACTION_PERMISSIONS['createPropertyCallable'].includes('master_admin'), 'createPropertyCallable mapped to master_admin');
  assert(Array.isArray(ACTION_PERMISSIONS['updatePropertyCallable']) && ACTION_PERMISSIONS['updatePropertyCallable'].includes('master_admin'), 'updatePropertyCallable mapped to master_admin');
  assert(Array.isArray(ACTION_PERMISSIONS['archivePropertyCallable']) && ACTION_PERMISSIONS['archivePropertyCallable'].includes('master_admin'), 'archivePropertyCallable mapped to master_admin');

  // 3.2 Master Admin positive authorization
  const createPropRes = await dispatchAction('createPropertyCallable', {
    name: 'ধানমন্ডি ভিলা',
    nameEn: 'Dhanmondi Villa',
    code: 'dhanmondi-villa',
    type: 'residential',
    totalFloors: 4,
    address: 'ধানমন্ডি, ঢাকা'
  }, mockMasterAdminCtx, mockWorkerEnv);
  assert(createPropRes.status === 'PACKAGING_VALIDATED' && createPropRes.action === 'createPropertyCallable', 'Master Admin successfully creates property');

  const updatePropRes = await dispatchAction('updatePropertyCallable', {
    propertyId: 'prop_01',
    name: 'ধানমন্ডি ভিলা (আপডেট)'
  }, mockMasterAdminCtx, mockWorkerEnv);
  assert(updatePropRes.status === 'PACKAGING_VALIDATED' && updatePropRes.action === 'updatePropertyCallable', 'Master Admin successfully updates property');

  const archivePropRes = await dispatchAction('archivePropertyCallable', {
    propertyId: 'prop_01',
    archive: true
  }, mockMasterAdminCtx, mockWorkerEnv);
  assert(archivePropRes.status === 'PACKAGING_VALIDATED' && archivePropRes.isArchived === true, 'Master Admin successfully archives property with archive: true alias');

  // 3.3 Non-master_admin authorization rejection
  const lookupMember = async (uid) => {
    if (uid === 'manager_uid_001') return mockManagerCtx.member;
    if (uid === 'viewer_uid_001') return mockViewerCtx.member;
    return null;
  };

  try {
    await authorizeWorkspaceRequest({ callerUid: 'manager_uid_001', actionName: 'createPropertyCallable', requestedWorkspaceId: 'workspace_bhuiya_family' }, lookupMember);
    assert(false, 'Manager should be denied from createPropertyCallable');
  } catch (err) {
    assert(err.status === 403 && err.code === 'PERMISSION_DENIED', 'Manager denied from createPropertyCallable (HTTP 403 PERMISSION_DENIED)');
  }

  try {
    await authorizeWorkspaceRequest({ callerUid: 'viewer_uid_001', actionName: 'createPropertyCallable', requestedWorkspaceId: 'workspace_bhuiya_family' }, lookupMember);
    assert(false, 'Viewer should be denied from createPropertyCallable');
  } catch (err) {
    assert(err.status === 403 && err.code === 'PERMISSION_DENIED', 'Viewer denied from createPropertyCallable (HTTP 403 PERMISSION_DENIED)');
  }

  try {
    await authorizeWorkspaceRequest({ callerUid: 'manager_uid_001', actionName: 'archivePropertyCallable', requestedWorkspaceId: 'workspace_bhuiya_family' }, lookupMember);
    assert(false, 'Manager should be denied from archivePropertyCallable');
  } catch (err) {
    assert(err.status === 403 && err.code === 'PERMISSION_DENIED', 'Manager denied from archivePropertyCallable (HTTP 403 PERMISSION_DENIED)');
  }

  // 3.4 Input validation negative tests
  try {
    ACTION_REGISTRY['createPropertyCallable'].validate({});
    assert(false, 'createPropertyCallable should fail on empty payload');
  } catch (err) {
    assert(err.code === 'INVALID_ARGUMENT' && err.message.includes('name'), 'createPropertyCallable rejects missing name');
  }

  try {
    ACTION_REGISTRY['updatePropertyCallable'].validate({});
    assert(false, 'updatePropertyCallable should fail on empty payload');
  } catch (err) {
    assert(err.code === 'INVALID_ARGUMENT' && err.message.includes('propertyId'), 'updatePropertyCallable rejects missing propertyId');
  }

  // 3.5 Frontend propertyService.ts inspection
  const propertyServiceCode = fs.readFileSync('src/services/propertyService.ts', 'utf8').replace(/\r\n/g, '\n');
  assert(propertyServiceCode.includes("createCallable<PropertyInput, { success: boolean; propertyId: string }>(\n    'createPropertyCallable'"), 'frontend createProperty calls createPropertyCallable');
  assert(propertyServiceCode.includes("'updatePropertyCallable'"), 'frontend updateProperty calls updatePropertyCallable');
  assert(propertyServiceCode.includes("'archivePropertyCallable'"), 'frontend archiveProperty calls archivePropertyCallable');
  assert(!propertyServiceCode.includes("runTransaction(db, async (tx) => {\n    tx.set(newDocRef"), 'Direct client tx.set on properties completely removed');

  // ---------------------------------------------------------------------------
  // PRIORITY 4: WORKER PACKAGING INTEGRATION IN ROOT BUILD PIPELINE
  // ---------------------------------------------------------------------------
  console.log('\n--- PRIORITY 4: Worker Packaging & Build Pipeline Integration ---');

  const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert(pkgJson.scripts.build.includes('node poc/phase-10-2a/package-worker.mjs'), 'package.json build script packages the worker');

  const packageResult = await packageWorker();
  assert(packageResult.success === true, 'Worker packaging executes cleanly');
  assert(fs.existsSync('dist/_worker.js'), 'dist/_worker.js exists on disk in root distribution directory');
  assert(fs.existsSync('poc/phase-10-2a/dist/_worker.js'), 'poc/phase-10-2a/dist/_worker.js exists on disk');
  assert(packageResult.isSizeWithinLimit === true, `Worker bundle size (${packageResult.bundleSizeKb} KB) is strictly < 1MB limit`);
  assert(packageResult.forbiddenModulesFound.length === 0, 'Worker bundle has zero forbidden Node.js built-ins');
  assert(packageResult.secretsFound.length === 0, 'Worker bundle has zero leaked private keys or secrets');
  assert(packageResult.hasDefaultExport === true, 'Worker bundle has valid default export with fetch() handler');

  // ---------------------------------------------------------------------------
  // PRIORITY 5: TOKEN CLOCK-SKEW TOLERANCE & LEGACY COMPATIBILITY
  // ---------------------------------------------------------------------------
  console.log('\n--- PRIORITY 5: Token Clock-Skew Tolerance & Legacy Compatibility ---');

  const tokenVerifierCode = fs.readFileSync('poc/phase-10-2a/tokenVerifier.mjs', 'utf8');
  assert(tokenVerifierCode.includes('clockSkewSec = 60'), 'Default clockSkewSec tightened to 60 seconds');

  // Legacy ownerUid compatibility verification
  const rulesCode = fs.readFileSync('poc/phase-10-2a/firestore.workspace-candidate.rules', 'utf8');
  assert(rulesCode.includes("('ownerUid' in resource.data && resource.data.ownerUid == request.auth.uid)"), 'Firestore rules preserve backward-compatible ownerUid read access');
  assert(rulesCode.includes("('workspaceId' in resource.data && isWorkspaceMember(resource.data.workspaceId))"), 'Firestore rules enforce modern workspaceId access');

  const memberManagementCode = fs.readFileSync('src/components/members/MemberManagementModal.tsx', 'utf8');
  assert(!memberManagementCode.includes('112233'), 'Member UI does not expose a shared sample password');
  assert(!actionRegistryCode.includes('TemporaryPass2026!'), 'Legacy member invite never creates accounts with a shared default password');

  console.log('\n========================================================================');
  console.log(`FINAL REMEDIATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
