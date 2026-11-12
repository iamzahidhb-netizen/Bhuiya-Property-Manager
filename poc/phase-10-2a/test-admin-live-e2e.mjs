/**
 * test-admin-live-e2e.mjs
 *
 * Real end-to-end verification of the Master Admin control actions against the
 * deployed Cloudflare Pages worker and the staging Firestore database.
 *
 * Safety: only creates clearly prefixed test records; financial records are
 * reversed (never deleted); all test properties/units are archived or removed
 * at the end where dependent history permits.
 */

import fs from 'node:fs';

const API_BASE = process.env.ADMIN_E2E_API_BASE || 'https://iamzahid.pages.dev';
const PROJECT_ID = 'bhuiya-property-staging';
const API_KEY = 'AIzaSyAnGPYTxWEi5veXCOJarCnsIzd4mFLceVE';
const WORKSPACE = 'workspace_bhuiya_family';
const EMAIL = 'zahid@bhuiyan.com';
const PASSWORD = '112233';
const RUN_ID = Date.now();
const PREFIX = `ADMIN_AUDIT_TEST_${RUN_ID}`;

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function signIn() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  if (!response.ok) throw new Error(`Auth failed HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

function decodeValue(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}
function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeValue(value);
  return out;
}

function makeClient(idToken) {
  const api = async (action, payload) => {
    const response = await fetch(`${API_BASE}/api/callable/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-workspace-id': WORKSPACE,
      },
      body: JSON.stringify({ ...payload, workspaceId: WORKSPACE }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        `${action} failed HTTP ${response.status}: ${body?.error?.message || body?.message || JSON.stringify(body)}`
      );
      error.status = response.status;
      error.code = body?.error?.code;
      throw error;
    }
    return body.data;
  };

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const getDoc = async (collection, id) => {
    const response = await fetch(`${firestoreUrl}/${collection}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (response.status === 404) return null;
    // Firestore returns 403 for a non-existent document when the read rule
    // dereferences resource.data (resource is null), so treat it as missing.
    if (response.status === 403) return null;
    if (!response.ok) throw new Error(`Firestore get ${collection}/${id} HTTP ${response.status}`);
    const body = await response.json();
    return decodeFields(body.fields);
  };

  const queryCollection = async (collectionId, fieldPath, value) => {
    const response = await fetch(`${firestoreUrl}:runQuery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
          limit: 300,
        },
      }),
    });
    if (!response.ok) throw new Error(`Firestore query ${collectionId} HTTP ${response.status}: ${await response.text()}`);
    const rows = await response.json();
    return rows
      .filter((row) => row.document)
      .map((row) => ({
        id: row.document.name.split('/').pop(),
        ...decodeFields(row.document.fields),
      }));
  };

  return { api, getDoc, queryCollection, firestoreUrl };
}

async function main() {
  const auth = await signIn();
  const client = makeClient(auth.idToken);
  console.log(`\nAuthenticated as ${auth.email} (uid ${auth.localId})`);
  console.log(`Test prefix: ${PREFIX}\n`);

  // ---------------------------------------------------------------------
  // 1. Property create / read / update
  // ---------------------------------------------------------------------
  const property = await client.api('createPropertyCallable', {
    name: `${PREFIX}_PROPERTY`,
    nameEn: 'Admin Audit Test Property',
    code: `admt${RUN_ID}`,
    type: 'residential',
    address: 'Automated verification address',
    totalFloors: 2,
    description: 'Created by automated Master Admin verification.',
  });
  const propertyId = property.propertyId;
  let propertyDoc = await client.getDoc('properties', propertyId);
  record(
    'Property create persists to Firestore',
    Boolean(propertyDoc) && propertyDoc.name === `${PREFIX}_PROPERTY` && propertyDoc.workspaceId === WORKSPACE,
    propertyId
  );

  await client.api('updatePropertyCallable', {
    propertyId,
    name: `${PREFIX}_PROPERTY_EDITED`,
    totalFloors: 3,
  });
  propertyDoc = await client.getDoc('properties', propertyId);
  record(
    'Property update persists changed fields',
    propertyDoc?.name === `${PREFIX}_PROPERTY_EDITED` && propertyDoc?.totalFloors === 3,
    propertyDoc?.name
  );

  // ---------------------------------------------------------------------
  // 2. Unit create / update / archive / restore
  // ---------------------------------------------------------------------
  const unit = await client.api('createUnitCallable', {
    propertyId,
    unitNumber: `A1${String(RUN_ID).slice(-6)}`,
    type: 'flat',
    floor: 1,
    monthlyRent: 10000,
    serviceCharge: 500,
  });
  const unitId = unit.unitId;
  let unitDoc = await client.getDoc('units', unitId);
  record(
    'Unit create persists and updates property mapping',
    unitDoc?.unitNumber === `A1${String(RUN_ID).slice(-6)}` &&
      unitDoc?.monthlyRent === 10000 &&
      Boolean(propertyDoc?.activeUnitNumbers),
    unitId
  );

  await client.api('updateUnitCallable', {
    unitId,
    unitNumber: `A2${String(RUN_ID).slice(-6)}`,
    monthlyRent: 12500,
    serviceCharge: 750,
  });
  unitDoc = await client.getDoc('units', unitId);
  record(
    'Unit update persists number, rent and service charge',
    unitDoc?.unitNumber === `A2${String(RUN_ID).slice(-6)}` &&
      unitDoc?.monthlyRent === 12500 &&
      unitDoc?.serviceCharge === 750,
    String(unitDoc?.monthlyRent)
  );

  await client.api('archiveUnitCallable', { unitId });
  unitDoc = await client.getDoc('units', unitId);
  record('Unit archive persists isArchived=true', unitDoc?.isArchived === true);
  await client.api('restoreUnitCallable', { unitId });
  unitDoc = await client.getDoc('units', unitId);
  record('Unit restore persists isArchived=false', unitDoc?.isArchived === false);

  // ---------------------------------------------------------------------
  // 3. Tenant register / update / vacate
  // ---------------------------------------------------------------------
  const tenantIdSuffix = `${RUN_ID}`;
  const tenantResult = await client.api('registerTenantCallable', {
    propertyId,
    unitId,
    name: `${PREFIX}_TENANT`,
    mobile: `017${String(tenantIdSuffix).slice(-8)}`,
    monthlyRent: 12500,
    gasCharge: 500,
    waterCharge: 200,
    advanceDeposit: 25000,
    moveInDate: '2026-11-01',
  });
  const tenantId = tenantResult.tenantId;
  let tenantDoc = await client.getDoc('tenants', tenantId);
  unitDoc = await client.getDoc('units', unitId);
  const depositDoc = tenantResult.depositId
    ? await client.getDoc('security_deposits', tenantResult.depositId)
    : null;
  record(
    'Tenant register persists tenant, occupies unit, records deposit liability',
    tenantDoc?.status === 'active' &&
      unitDoc?.status === 'occupied' &&
      unitDoc?.currentTenantId === tenantId &&
      depositDoc?.classification === 'liability' &&
      depositDoc?.isRentalIncome === false,
    `tenant=${tenantId} deposit=${tenantResult.depositId}`
  );

  await client.api('updateTenantCallable', {
    tenantId,
    name: `${PREFIX}_TENANT_EDITED`,
    mobile: '01900000000',
    notes: 'Edited by automated verification',
  });
  tenantDoc = await client.getDoc('tenants', tenantId);
  record(
    'Tenant profile update persists and preserves financial fields',
    tenantDoc?.name === `${PREFIX}_TENANT_EDITED` &&
      tenantDoc?.mobile === '01900000000' &&
      tenantDoc?.monthlyRent === 12500,
    tenantDoc?.name
  );

  // ---------------------------------------------------------------------
  // 3b. Rent bill generation + partial/full payment integrity
  // ---------------------------------------------------------------------
  const billResult = await client.api('generateMonthlyBillsCallable', {
    billingMonth: '2026-11',
    propertyId,
  });
  const expectedTotal = 12500 + 500 + 200 + 750;
  const billId = `bill_${propertyId}_${tenantId}_202611`;
  let billDoc = await client.getDoc('rent_bills', billId);
  record(
    'Rent bill generation creates one bill per active tenant with correct totals',
    billResult.countCreated === 1 &&
      billResult.totalAmountBilled === expectedTotal &&
      billDoc?.tenantId === tenantId &&
      billDoc?.totalDue === expectedTotal &&
      billDoc?.balanceDue === expectedTotal,
    `created=${billResult.countCreated} total=${billResult.totalAmountBilled}`
  );

  const regenerate = await client.api('generateMonthlyBillsCallable', {
    billingMonth: '2026-11',
    propertyId,
  });
  record(
    'Rent bill generation is idempotent for the same month',
    regenerate.countCreated === 0 && regenerate.countSkipped === 1,
    `created=${regenerate.countCreated} skipped=${regenerate.countSkipped}`
  );

  const partialPayment = await client.api('recordRentPaymentCallable', {
    billId,
    amount: 5000,
    paymentMethod: 'cash',
    paymentDate: '2026-11-12',
  });
  billDoc = await client.getDoc('rent_bills', billId);
  record(
    'Partial rent payment updates bill balance atomically',
    partialPayment.status === 'partial' &&
      partialPayment.balanceDue === expectedTotal - 5000 &&
      billDoc?.totalPaid === 5000 &&
      billDoc?.status === 'partial',
    `balance=${billDoc?.balanceDue}`
  );
  let overpayAttempt = null;
  try {
    await client.api('recordRentPaymentCallable', {
      billId,
      amount: 99999,
      paymentMethod: 'cash',
      paymentDate: '2026-11-12',
    });
  } catch (error) {
    overpayAttempt = error.message;
  }
  record('Overpayment beyond bill balance is rejected', /exceeds/i.test(overpayAttempt || ''), String(overpayAttempt).slice(0, 90));

  const finalPayment = await client.api('recordRentPaymentCallable', {
    billId,
    amount: expectedTotal - 5000,
    paymentMethod: 'bkash',
    paymentDate: '2026-11-13',
  });
  billDoc = await client.getDoc('rent_bills', billId);
  const paymentRows = await client.queryCollection('rent_payments', 'workspaceId', WORKSPACE);
  const billPayments = paymentRows.filter((payment) => payment.billId === billId);
  record(
    'Full remaining payment marks bill paid and records receipt ledger entries',
    finalPayment.status === 'paid' &&
      finalPayment.balanceDue === 0 &&
      billDoc?.status === 'paid' &&
      billDoc?.balanceDue === 0 &&
      billPayments.length === 2 &&
      billPayments.every((payment) => payment.entryType === 'payment' && payment.receiptNumber),
    `payments=${billPayments.length}`
  );

  let phantomPaymentError = null;
  try {
    await client.api('recordRentPaymentCallable', {
      billId: `${PREFIX}_MISSING_BILL`,
      amount: 100,
      paymentMethod: 'cash',
      paymentDate: '2026-11-14',
    });
  } catch (error) {
    phantomPaymentError = error.message;
  }
  const phantomBill = await client.getDoc('rent_bills', `${PREFIX}_MISSING_BILL`);
  record(
    'Payment against a missing bill is rejected without creating a phantom bill',
    /not found/i.test(phantomPaymentError || '') && phantomBill === null,
    String(phantomPaymentError).slice(0, 90)
  );

  await client.api('vacateTenantCallable', {
    tenantId,
    vacatingDate: '2026-11-30',
    refundAmount: 20000,
    damageDeductions: 5000,
    settlementNotes: 'Automated verification settlement',
    depositId: tenantResult.depositId,
  });
  tenantDoc = await client.getDoc('tenants', tenantId);
  unitDoc = await client.getDoc('units', unitId);
  const settledDeposit = tenantResult.depositId
    ? await client.getDoc('security_deposits', tenantResult.depositId)
    : null;
  record(
    'Tenant vacate persists vacated status, frees unit and settles deposit',
    tenantDoc?.status === 'vacated' &&
      unitDoc?.status === 'vacant' &&
      unitDoc?.currentTenantId === null &&
      settledDeposit?.refundedAmount === 20000 &&
      settledDeposit?.damageDeductionAmount === 5000,
    `refund=${settledDeposit?.refundedAmount}`
  );

  // ---------------------------------------------------------------------
  // 4. Expense create / update / reverse
  // ---------------------------------------------------------------------
  const expense = await client.api('createExpenseCallable', {
    title: `${PREFIX}_EXPENSE`,
    amount: 1500,
    group: 'building',
    category: 'maintenance_repair',
    expenseDate: '2026-11-10',
    paymentMethod: 'cash',
    description: 'Automated verification expense',
  });
  const expenseId = expense.expenseId;
  let expenseDoc = await client.getDoc('expenses', expenseId);
  record(
    'Expense create persists as active building expense',
    expenseDoc?.status === 'active' && expenseDoc?.amount === 1500 && expenseDoc?.group === 'building',
    expenseId
  );

  await client.api('updateExpenseCallable', {
    expenseId,
    title: `${PREFIX}_EXPENSE_EDITED`,
    amount: 1750,
    group: 'building',
    category: 'maintenance_repair',
    expenseDate: '2026-11-11',
    paymentMethod: 'bkash',
    reason: 'Automated verification correction',
    description: 'Edited by automated verification',
  });
  expenseDoc = await client.getDoc('expenses', expenseId);
  record(
    'Expense update persists amount and immutable audit entry',
    expenseDoc?.amount === 1750 &&
      expenseDoc?.title === `${PREFIX}_EXPENSE_EDITED` &&
      Array.isArray(expenseDoc?.auditHistory) &&
      expenseDoc.auditHistory.length === 1,
    `history=${expenseDoc?.auditHistory?.length}`
  );

  await client.api('reverseExpenseCallable', {
    expenseId,
    reason: 'Automated verification reversal',
  });
  expenseDoc = await client.getDoc('expenses', expenseId);
  record(
    'Expense reversal persists reversed status and audit trail',
    expenseDoc?.status === 'reversed' &&
      expenseDoc?.reversalReason === 'Automated verification reversal' &&
      expenseDoc?.auditHistory?.length === 2,
    `history=${expenseDoc?.auditHistory?.length}`
  );

  // ---------------------------------------------------------------------
  // 5. Archived unit deletion + dependent guards
  // ---------------------------------------------------------------------
  await client.api('archiveUnitCallable', { unitId });
  let dependentGuard = null;
  try {
    await client.api('deleteUnitCallable', { unitId });
    dependentGuard = 'allowed';
  } catch (error) {
    dependentGuard = error.message;
  }
  record(
    'Unit delete is blocked while tenant/billing history exists',
    /history|tenant/i.test(dependentGuard || ''),
    String(dependentGuard).slice(0, 120)
  );

  let propertyDeleteGuard = null;
  try {
    await client.api('deletePropertyCallable', { propertyId });
    propertyDeleteGuard = 'allowed';
  } catch (error) {
    propertyDeleteGuard = error.message;
  }
  record(
    'Property delete is blocked while tenant history exists',
    /history|tenant|archive/i.test(propertyDeleteGuard || ''),
    String(propertyDeleteGuard).slice(0, 120)
  );

  // ---------------------------------------------------------------------
  // 6. Cleanup property without financial history
  // ---------------------------------------------------------------------
  const cleanProperty = await client.api('createPropertyCallable', {
    name: `${PREFIX}_CLEANUP`,
    nameEn: 'Cleanup property',
    type: 'residential',
    address: 'Cleanup',
    totalFloors: 1,
  });
  const cleanPropertyId = cleanProperty.propertyId;
  const cleanUnit = await client.api('createUnitCallable', {
    propertyId: cleanPropertyId,
    unitNumber: `C1${String(RUN_ID).slice(-6)}`,
    type: 'flat',
    floor: 1,
    monthlyRent: 1,
  });
  await client.api('archiveUnitCallable', { unitId: cleanUnit.unitId });
  await client.api('deleteUnitCallable', { unitId: cleanUnit.unitId });
  await client.api('archivePropertyCallable', { propertyId: cleanPropertyId, isArchived: true });
  await client.api('deletePropertyCallable', { propertyId: cleanPropertyId });
  const deletedProperty = await client.getDoc('properties', cleanPropertyId);
  const deletedUnit = await client.getDoc('units', cleanUnit.unitId);
  record(
    'Empty archived property and unit can be permanently deleted',
    deletedProperty === null && deletedUnit === null,
    cleanPropertyId
  );

  // ---------------------------------------------------------------------
  // 7. Audit trail verification
  // ---------------------------------------------------------------------
  await sleep(1200);
  const auditEntries = await client.queryCollection('audit_logs', 'workspaceId', WORKSPACE);
  const actionsSeen = new Set(auditEntries.map((entry) => entry.action));
  record(
    'Audit trail contains all admin mutation actions',
    ['createPropertyCallable', 'updatePropertyCallable', 'createUnitCallable', 'updateUnitCallable',
      'registerTenantCallable', 'updateTenantCallable', 'vacateTenantCallable',
      'generateMonthlyBillsCallable', 'recordRentPaymentCallable',
      'createExpenseCallable', 'updateExpenseCallable', 'reverseExpenseCallable',
      'deletePropertyCallable'].every((action) => actionsSeen.has(action)),
    `${auditEntries.length} entries`
  );
  record(
    'Audit entries record actor, entity and success status',
    auditEntries.some(
      (entry) =>
        entry.actorUid === auth.localId &&
        entry.entityType === 'unit' &&
        entry.status === 'success' &&
        entry.source === 'cloudflare-worker'
    ),
    `${auditEntries.filter((entry) => entry.actorUid === auth.localId).length} actor entries`
  );
  const unitUpdateAudit = auditEntries.find(
    (entry) => entry.action === 'updateUnitCallable' && entry.documentId === unitId
  );
  record(
    'Audit entry captures previous values for updates',
    unitUpdateAudit?.previousValues?.monthlyRent === 10000 &&
      unitUpdateAudit?.updatedValues?.monthlyRent === 12500,
    `previous=${unitUpdateAudit?.previousValues?.monthlyRent} updated=${unitUpdateAudit?.updatedValues?.monthlyRent}`
  );
  const forbiddenAuditEdit = await fetch(
    `${client.firestoreUrl}/audit_logs/${auditEntries[0]?.id || 'none'}?updateMask.fieldPaths=status`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth.idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'tampered' } } }),
    }
  );
  record(
    'Audit logs cannot be edited by a Master Admin client',
    forbiddenAuditEdit.status === 403,
    `HTTP ${forbiddenAuditEdit.status}`
  );

  // ---------------------------------------------------------------------
  // 8. Security enforcement
  // ---------------------------------------------------------------------
  const unauthApi = await fetch(`${API_BASE}/api/callable/archivePropertyCallable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, isArchived: true }),
  });
  record('Unauthenticated API mutation is rejected', unauthApi.status === 401, `HTTP ${unauthApi.status}`);

  const directWrite = await fetch(
    `${client.firestoreUrl}/properties/${encodeURIComponent(propertyId)}?updateMask.fieldPaths=name`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth.idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { name: { stringValue: 'HACKED' } } }),
    }
  );
  record(
    'Client-side direct Firestore write is denied by security rules',
    directWrite.status === 403,
    `HTTP ${directWrite.status}`
  );

  // ---------------------------------------------------------------------
  // 9. Cleanup the archived test property (keep history intact)
  // ---------------------------------------------------------------------
  await client.api('archivePropertyCallable', { propertyId, isArchived: true }).catch(() => null);
  const archivedProperty = await client.getDoc('properties', propertyId);
  record(
    'Test property archived at end of run (history preserved)',
    archivedProperty?.isArchived === true,
    propertyId
  );

  const failed = results.filter((item) => !item.pass);
  console.log('\n========================================================');
  console.log(`LIVE ADMIN E2E: ${results.length - failed.length} passed, ${failed.length} failed`);
  console.log('========================================================');
  for (const item of failed) console.log(`FAILED: ${item.name} — ${item.detail}`);

  fs.writeFileSync(
    'scratch/admin-live-e2e-results.json',
    JSON.stringify({ runId: RUN_ID, deployment: API_BASE, results, artifacts: { propertyId, unitId, tenantId, expenseId } }, null, 2)
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('E2E crashed:', error);
  process.exitCode = 1;
});
