/**
 * test-admin-control.mjs
 *
 * Server-side functional tests for the Master Admin CRUD actions added to the
 * Cloudflare Worker action registry. Uses an in-memory Firestore-compatible
 * transaction double, so no network or live database is touched.
 */

import assert from 'node:assert';
import {
  ACTION_REGISTRY,
  dispatchAction,
} from './worker/actionRegistry.mjs';
import { ACTION_PERMISSIONS, authorizeWorkspaceRequest } from './workspaceAuth.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}

class MemoryFirestore {
  constructor() {
    this.docs = new Map();
    this.audit = [];
  }
  key(collection, id) {
    return `${collection}/${id}`;
  }
  seed(collection, id, data) {
    this.docs.set(this.key(collection, id), { ...data });
  }
  async getDocument(collection, id) {
    const data = this.docs.get(this.key(collection, id));
    return data ? { id, data: { ...data } } : null;
  }
  async queryByField(collection, field, _op, value) {
    const out = [];
    for (const [key, data] of this.docs.entries()) {
      const [coll, id] = key.split('/');
      if (coll === collection && data[field] === value) out.push({ id, data: { ...data } });
    }
    return out;
  }
  async createDocument(collection, id, data) {
    if (collection === 'audit_logs') {
      this.audit.push({ id, ...data });
      return;
    }
    if (this.docs.has(this.key(collection, id))) {
      const error = new Error('ALREADY_EXISTS');
      error.code = 'ALREADY_EXISTS';
      throw error;
    }
    this.docs.set(this.key(collection, id), { ...data });
  }
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: async (collection, id) => {
        const data = this.docs.get(this.key(collection, id));
        return data ? { id, data: { ...data } } : null;
      },
      create: (collection, id, data) => {
        if (this.docs.has(this.key(collection, id))) {
          const error = new Error('ALREADY_EXISTS');
          error.code = 'ALREADY_EXISTS';
          throw error;
        }
        writes.push({ type: 'create', collection, id, data });
      },
      update: (collection, id, data) => {
        if (!this.docs.has(this.key(collection, id))) {
          const error = new Error('NOT_FOUND');
          error.code = 'NOT_FOUND';
          throw error;
        }
        writes.push({ type: 'update', collection, id, data });
      },
      set: (collection, id, data) => writes.push({ type: 'set', collection, id, data }),
      delete: (collection, id) => writes.push({ type: 'delete', collection, id }),
    };
    const result = await fn(tx);
    for (const write of writes) {
      const key = this.key(write.collection, write.id);
      if (write.type === 'delete') {
        this.docs.delete(key);
      } else if (write.type === 'create') {
        this.docs.set(key, { ...write.data });
      } else {
        this.docs.set(key, { ...(this.docs.get(key) || {}), ...write.data });
      }
    }
    return result;
  }
}

const WORKSPACE = 'workspace_bhuiya_family';
const MASTER_UID = 'master_uid_001';

function context(firestore, overrides = {}) {
  return {
    env: {},
    firestore,
    ctx: {},
    config: { disableFinancialWrites: false },
    verifiedUser: { uid: MASTER_UID, email: 'master@bhuiya.test' },
    authContext: {
      uid: MASTER_UID,
      workspaceId: WORKSPACE,
      role: 'master_admin',
      isMasterAdmin: true,
      permissions: {},
    },
    ...overrides,
  };
}

function seedWorkspace(firestore) {
  firestore.seed('properties', 'prop_1', {
    name: 'Test Property',
    nameEn: 'Test Property',
    code: 'test',
    type: 'residential',
    address: 'Dhaka',
    totalFloors: 3,
    description: '',
    isArchived: false,
    status: 'active',
    activeUnitNumbers: {},
    workspaceId: WORKSPACE,
    ownerUid: MASTER_UID,
  });
}

async function run() {
  console.log('========================================================');
  console.log('MASTER ADMIN CONTROL — SERVER ACTION TESTS');
  console.log('========================================================');

  console.log('\n[1] Registry & permission matrix');
  for (const action of [
    'createUnitCallable', 'updateUnitCallable', 'deleteUnitCallable',
    'registerTenantCallable', 'updateTenantCallable', 'vacateTenantCallable',
    'updateExpenseCallable', 'reverseExpenseCallable', 'deletePropertyCallable',
  ]) {
    test(`${action} is registered`, () => assert.ok(ACTION_REGISTRY[action], action));
    test(`${action} requires master_admin`, () =>
      assert.ok((ACTION_PERMISSIONS[action] || []).includes('master_admin'), action));
  }

  console.log('\n[2] RBAC enforcement (viewer denied, master allowed)');
  const viewerLookup = async () => ({
    workspaceId: WORKSPACE, uid: 'viewer_uid', role: 'viewer', status: 'active', permissions: {},
  });
  const masterLookup = async () => ({
    workspaceId: WORKSPACE, uid: MASTER_UID, role: 'master_admin', status: 'active', permissions: {},
  });
  await testAsync('viewer cannot call updateUnitCallable', async () => {
    await assert.rejects(
      authorizeWorkspaceRequest(
        { callerUid: 'viewer_uid', actionName: 'updateUnitCallable', requestedWorkspaceId: WORKSPACE },
        viewerLookup
      ),
      /permission/i
    );
  });
  await testAsync('master admin can call updateUnitCallable', async () => {
    const ctx = await authorizeWorkspaceRequest(
      { callerUid: MASTER_UID, actionName: 'updateUnitCallable', requestedWorkspaceId: WORKSPACE },
      masterLookup
    );
    assert.equal(ctx.role, 'master_admin');
  });

  console.log('\n[3] Unit lifecycle with audit trail');
  const firestore = new MemoryFirestore();
  seedWorkspace(firestore);
  const ctx = context(firestore);

  await testAsync('createUnitCallable persists unit and property mapping', async () => {
    const result = await dispatchAction(
      'createUnitCallable',
      { propertyId: 'prop_1', unitNumber: 'A-101', type: 'flat', floor: 1, monthlyRent: 12000 },
      ctx.authContext,
      ctx
    );
    assert.equal(result.success, true);
    const unit = await firestore.getDocument('units', result.unitId);
    assert.equal(unit.data.unitNumber, 'A-101');
    assert.equal(unit.data.monthlyRent, 12000);
    assert.equal(unit.data.workspaceId, WORKSPACE);
    const property = await firestore.getDocument('properties', 'prop_1');
    assert.equal(property.data.activeUnitNumbers.a101, result.unitId);
    assert.ok(firestore.audit.some((entry) => entry.action === 'createUnitCallable' && entry.status === 'success'));
  });

  await testAsync('duplicate unit number is rejected', async () => {
    await assert.rejects(
      dispatchAction('createUnitCallable', { propertyId: 'prop_1', unitNumber: 'A-101' }, ctx.authContext, ctx),
      /already exists/i
    );
  });

  const unitId = [...firestore.docs.keys()].find((key) => key.startsWith('units/')).split('/')[1];

  await testAsync('updateUnitCallable updates rent and number atomically', async () => {
    await dispatchAction(
      'updateUnitCallable',
      { unitId, unitNumber: 'A-102', monthlyRent: 15000, serviceCharge: 500 },
      ctx.authContext,
      ctx
    );
    const unit = await firestore.getDocument('units', unitId);
    assert.equal(unit.data.unitNumber, 'A-102');
    assert.equal(unit.data.monthlyRent, 15000);
    const property = await firestore.getDocument('properties', 'prop_1');
    assert.equal(property.data.activeUnitNumbers.a102, unitId);
    assert.equal(property.data.activeUnitNumbers.a101, undefined);
  });

  await testAsync('archive and restore unit update property mapping', async () => {
    await dispatchAction('archiveUnitCallable', { unitId }, ctx.authContext, ctx);
    let unit = await firestore.getDocument('units', unitId);
    assert.equal(unit.data.isArchived, true);
    let property = await firestore.getDocument('properties', 'prop_1');
    assert.equal(property.data.activeUnitNumbers.a102, undefined);
    await dispatchAction('restoreUnitCallable', { unitId }, ctx.authContext, ctx);
    unit = await firestore.getDocument('units', unitId);
    property = await firestore.getDocument('properties', 'prop_1');
    assert.equal(unit.data.isArchived, false);
    assert.equal(property.data.activeUnitNumbers.a102, unitId);
  });

  console.log('\n[4] Tenant registration & vacancy (deposit liability preserved)');
  await testAsync('registerTenantCallable occupies unit and creates liability', async () => {
    const result = await dispatchAction(
      'registerTenantCallable',
      {
        propertyId: 'prop_1', unitId, name: 'Test Tenant', mobile: '01700000000',
        monthlyRent: 15000, advanceDeposit: 30000, moveInDate: '2026-11-01',
      },
      ctx.authContext,
      ctx
    );
    const tenant = await firestore.getDocument('tenants', result.tenantId);
    assert.equal(tenant.data.status, 'active');
    const unit = await firestore.getDocument('units', unitId);
    assert.equal(unit.data.status, 'occupied');
    assert.equal(unit.data.currentTenantId, result.tenantId);
    const deposit = await firestore.getDocument('security_deposits', result.depositId);
    assert.equal(deposit.data.classification, 'liability');
    assert.equal(deposit.data.isRentalIncome, false);
    assert.equal(deposit.data.depositAmount, 30000);
  });

  await testAsync('second active tenant on the same unit is rejected', async () => {
    await assert.rejects(
      dispatchAction(
        'registerTenantCallable',
        { propertyId: 'prop_1', unitId, name: 'Second', mobile: '018', monthlyRent: 1, advanceDeposit: 0 },
        ctx.authContext,
        ctx
      ),
      /not vacant/i
    );
  });

  await testAsync('updateTenantCallable edits profile fields only', async () => {
    const tenantEntry = [...firestore.docs.entries()].find(([key]) => key.startsWith('tenants/'));
    const tenantId = tenantEntry[0].split('/')[1];
    await dispatchAction(
      'updateTenantCallable',
      { tenantId, name: 'Tenant Updated', mobile: '01999999999', notes: 'edited' },
      ctx.authContext,
      ctx
    );
    const tenant = await firestore.getDocument('tenants', tenantId);
    assert.equal(tenant.data.name, 'Tenant Updated');
    assert.equal(tenant.data.mobile, '01999999999');
    assert.equal(tenant.data.monthlyRent, 15000);
  });

  await testAsync('vacateTenantCallable restores unit and settles deposit', async () => {
    const tenantEntry = [...firestore.docs.entries()].find(([key]) => key.startsWith('tenants/'));
    const tenantId = tenantEntry[0].split('/')[1];
    await dispatchAction(
      'vacateTenantCallable',
      { tenantId, vacatingDate: '2026-11-30', refundAmount: 25000, damageDeductions: 5000, settlementNotes: 'settled' },
      ctx.authContext,
      ctx
    );
    const tenant = await firestore.getDocument('tenants', tenantId);
    assert.equal(tenant.data.status, 'vacated');
    const unit = await firestore.getDocument('units', unitId);
    assert.equal(unit.data.status, 'vacant');
    assert.equal(unit.data.currentTenantId, null);
    const depositEntry = [...firestore.docs.entries()].find(([key]) => key.startsWith('security_deposits/'));
    const deposit = depositEntry[1];
    assert.equal(deposit.refundedAmount, 25000);
    assert.equal(deposit.damageDeductionAmount, 5000);
    assert.equal(deposit.status, 'fully_refunded');
  });

  console.log('\n[5] Expense create / edit / reverse');
  await testAsync('create, edit with audit reason, then reverse expense', async () => {
    const created = await dispatchAction(
      'createExpenseCallable',
      { title: 'Audit test expense', amount: 1200, group: 'building', category: 'maintenance_repair', expenseDate: '2026-11-05', paymentMethod: 'cash', description: 'Audit test expense' },
      ctx.authContext,
      ctx
    );
    const expenseId = created.expenseId;
    await dispatchAction(
      'updateExpenseCallable',
      { expenseId, title: 'Audit test expense edited', amount: 1500, group: 'building', category: 'maintenance_repair', expenseDate: '2026-11-06', reason: 'correction', paymentMethod: 'cash', description: 'edited' },
      ctx.authContext,
      ctx
    );
    let expense = await firestore.getDocument('expenses', expenseId);
    assert.equal(expense.data.amount, 1500);
    assert.equal(expense.data.auditHistory.length, 1);
    assert.equal(expense.data.auditHistory[0].reason, 'correction');
    await dispatchAction('reverseExpenseCallable', { expenseId, reason: 'test reversal' }, ctx.authContext, ctx);
    expense = await firestore.getDocument('expenses', expenseId);
    assert.equal(expense.data.status, 'reversed');
    assert.equal(expense.data.reversalReason, 'test reversal');
    assert.equal(expense.data.auditHistory.length, 2);
  });

  console.log('\n[6] Rent billing & payment integrity');
  firestore.seed('properties', 'prop_rent', {
    name: 'Rent Test Property', isArchived: false, status: 'active',
    activeUnitNumbers: {}, workspaceId: WORKSPACE, ownerUid: MASTER_UID,
  });
  const rentUnit = await dispatchAction(
    'createUnitCallable',
    { propertyId: 'prop_rent', unitNumber: 'R-1', type: 'flat', floor: 1, monthlyRent: 15000, serviceCharge: 100 },
    ctx.authContext,
    ctx
  );
  const rentUnitId = rentUnit.unitId;
  let rentBillId = null;

  await testAsync('generateMonthlyBills creates one bill per active tenant with correct totals', async () => {
    const tenant = await dispatchAction(
      'registerTenantCallable',
      { propertyId: 'prop_rent', unitId: rentUnitId, name: 'Rent Tenant', mobile: '01711111111', monthlyRent: 15000, gasCharge: 500, waterCharge: 200, advanceDeposit: 0 },
      ctx.authContext,
      ctx
    );
    assert.ok(tenant.tenantId);
    const result = await dispatchAction(
      'generateMonthlyBillsCallable',
      { billingMonth: '2026-11', propertyId: 'prop_rent' },
      ctx.authContext,
      ctx
    );
    assert.equal(result.countCreated, 1);
    assert.equal(result.countSkipped, 0);
    const billEntry = [...firestore.docs.entries()].find(([key]) => key.startsWith('rent_bills/'));
    rentBillId = billEntry[0].split('/')[1];
    assert.equal(billEntry[1].tenantId, tenant.tenantId);
    assert.equal(billEntry[1].totalDue, 15800);
    assert.equal(billEntry[1].balanceDue, 15800);
    assert.equal(billEntry[1].status, 'unpaid');
  });

  await testAsync('generating the same month again is idempotent (no duplicates)', async () => {
    const result = await dispatchAction(
      'generateMonthlyBillsCallable',
      { billingMonth: '2026-11', propertyId: 'prop_rent' },
      ctx.authContext,
      ctx
    );
    assert.equal(result.countCreated, 0);
    assert.equal(result.countSkipped, 1);
    const bills = [...firestore.docs.keys()].filter((key) => key.startsWith('rent_bills/'));
    assert.equal(new Set(bills).size, bills.length);
  });

  await testAsync('partial payment updates bill and creates payment ledger entry', async () => {
    const result = await dispatchAction(
      'recordRentPaymentCallable',
      { billId: rentBillId, amount: 5000, paymentMethod: 'cash', paymentDate: '2026-11-12' },
      ctx.authContext,
      ctx
    );
    assert.equal(result.status, 'partial');
    assert.equal(result.totalPaid, 5000);
    assert.equal(result.balanceDue, 10800);
    const bill = await firestore.getDocument('rent_bills', rentBillId);
    assert.equal(bill.data.status, 'partial');
    const payment = await firestore.getDocument('rent_payments', result.paymentId);
    assert.equal(payment.data.amount, 5000);
    assert.equal(payment.data.entryType, 'payment');
    assert.equal(payment.data.isRentalIncome, true);
  });

  await testAsync('overpaying a bill is rejected', async () => {
    await assert.rejects(
      dispatchAction(
        'recordRentPaymentCallable',
        { billId: rentBillId, amount: 20000, paymentMethod: 'cash', paymentDate: '2026-11-12' },
        ctx.authContext,
        ctx
      ),
      /exceeds/i
    );
  });

  await testAsync('full remaining payment marks bill paid and cannot be paid again', async () => {
    const result = await dispatchAction(
      'recordRentPaymentCallable',
      { billId: rentBillId, amount: 10800, paymentMethod: 'bkash', paymentDate: '2026-11-13' },
      ctx.authContext,
      ctx
    );
    assert.equal(result.status, 'paid');
    assert.equal(result.balanceDue, 0);
    await assert.rejects(
      dispatchAction(
        'recordRentPaymentCallable',
        { billId: rentBillId, amount: 1, paymentMethod: 'cash', paymentDate: '2026-11-14' },
        ctx.authContext,
        ctx
      ),
      /fully paid/i
    );
  });

  await testAsync('payment against a missing bill is rejected (no phantom bill)', async () => {
    await assert.rejects(
      dispatchAction(
        'recordRentPaymentCallable',
        { billId: 'does-not-exist', amount: 100, paymentMethod: 'cash', paymentDate: '2026-11-14' },
        ctx.authContext,
        ctx
      ),
      /not found/i
    );
    assert.equal(await firestore.getDocument('rent_bills', 'does-not-exist'), null);
  });

  console.log('\n[7] Dependent delete guards');
  await testAsync('unit with billing history cannot be deleted', async () => {
    firestore.seed('rent_bills', 'bill_1', { unitId, propertyId: 'prop_1', balanceDue: 0 });
    await assert.rejects(
      dispatchAction('deleteUnitCallable', { unitId }, ctx.authContext, ctx),
      /billing history/i
    );
  });

  await testAsync('property with tenant history cannot be deleted', async () => {
    await dispatchAction('archivePropertyCallable', { propertyId: 'prop_1', isArchived: true }, ctx.authContext, ctx);
    await assert.rejects(
      dispatchAction('deletePropertyCallable', { propertyId: 'prop_1' }, ctx.authContext, ctx),
      /history/i
    );
  });

  await testAsync('empty archived property can be deleted permanently', async () => {
    firestore.seed('properties', 'prop_2', {
      name: 'Empty Property', isArchived: true, status: 'archived',
      activeUnitNumbers: {}, workspaceId: WORKSPACE, ownerUid: MASTER_UID,
    });
    const result = await dispatchAction(
      'deletePropertyCallable',
      { propertyId: 'prop_2' },
      ctx.authContext,
      ctx
    );
    assert.equal(result.success, true);
    assert.equal(await firestore.getDocument('properties', 'prop_2'), null);
  });

  console.log('\n[7] Invalid payloads are rejected before writes');
  await testAsync('updateUnitCallable rejects invalid rent', async () => {
    await assert.rejects(
      dispatchAction('updateUnitCallable', { unitId, monthlyRent: -5 }, ctx.authContext, ctx),
      /range/i
    );
  });
  await testAsync('reverseExpenseCallable requires a reason', async () => {
    await assert.rejects(
      dispatchAction('reverseExpenseCallable', { expenseId: 'x' }, ctx.authContext, ctx),
      /reason/i
    );
  });

  console.log('\n========================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================');
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error('Test runner crashed:', error);
  process.exitCode = 1;
});



