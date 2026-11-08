import { db, FieldValue } from '../firebaseAdmin.ts';
import {
  ApiError,
  validateId,
  validateNumber,
  validateOptionalString,
} from '../validation.ts';

const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'bank', 'bkash', 'nagad', 'other']);
const BILLING_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function generateMonthlyBillsCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{
  success: boolean;
  billingMonth: string;
  countCreated: number;
  countSkipped: number;
  totalAmountBilled: number;
  message?: string;
}> {
  const billingMonth = typeof payload.billingMonth === 'string' ? payload.billingMonth.trim() : '';
  if (!BILLING_MONTH_REGEX.test(billingMonth)) {
    throw new ApiError('invalid-argument', 'billingMonth must be in YYYY-MM format (e.g. 2026-11).');
  }

  const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : null;

  // 1. Fetch active tenants for this owner
  let tenantsQuery = db.collection('tenants')
    .where('ownerUid', '==', callerUid)
    .where('status', '==', 'active');

  if (propertyId) {
    tenantsQuery = tenantsQuery.where('propertyId', '==', propertyId);
  }

  const [tenantsSnap, propsSnap, unitsSnap] = await Promise.all([
    tenantsQuery.get(),
    db.collection('properties').where('ownerUid', '==', callerUid).get(),
    db.collection('units').where('ownerUid', '==', callerUid).get(),
  ]);

  if (tenantsSnap.empty) {
    return {
      success: true,
      billingMonth,
      countCreated: 0,
      countSkipped: 0,
      totalAmountBilled: 0,
      message: 'No active tenants found to bill.',
    };
  }

  // Build property and unit lookup maps
  const propMap = new Map<string, Record<string, unknown>>();
  propsSnap.forEach((doc) => propMap.set(doc.id, doc.data()));

  const unitMap = new Map<string, Record<string, unknown>>();
  unitsSnap.forEach((doc) => unitMap.set(doc.id, doc.data()));

  // 2. Fetch existing bills for this billingMonth to guarantee duplicate prevention
  const existingBillsSnap = await db.collection('rent_bills')
    .where('ownerUid', '==', callerUid)
    .where('billingMonth', '==', billingMonth)
    .get();

  const existingTenantBillSet = new Set<string>();
  existingBillsSnap.forEach((doc) => {
    existingTenantBillSet.add(doc.data().tenantId as string);
  });

  const batch = db.batch();
  let countCreated = 0;
  let countSkipped = 0;
  let totalAmountBilled = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    if (existingTenantBillSet.has(tenantId)) {
      countSkipped++;
      continue;
    }

    const tenant = tenantDoc.data();
    const prop = propMap.get(tenant.propertyId as string) || {};
    const unit = unitMap.get(tenant.unitId as string) || {};

    const rentAmount = Number(tenant.monthlyRent) || 0;
    const gasCharge = Number(tenant.gasCharge) || 0;
    const waterCharge = Number(tenant.waterCharge) || 0;
    const serviceCharge = Number(unit.serviceCharge) || 0;
    const totalDue = rentAmount + gasCharge + waterCharge + serviceCharge;

    // Deterministic Bill Document ID for idempotent generation
    const billDocId = `bill_${tenant.propertyId}_${tenantId}_${billingMonth.replace('-', '')}`;
    const billRef = db.collection('rent_bills').doc(billDocId);

    batch.set(billRef, {
      ownerUid: callerUid,
      propertyId: tenant.propertyId,
      propertyName: prop.name || 'Property',
      unitId: tenant.unitId,
      unitNumber: unit.unitNumber || 'Unit',
      tenantId,
      tenantName: tenant.name || 'Tenant',
      tenantMobile: tenant.mobile || '',
      billingMonth,
      rentAmount,
      gasCharge,
      waterCharge,
      serviceCharge,
      otherCharges: 0,
      totalDue,
      totalPaid: 0,
      balanceDue: totalDue,
      status: 'unpaid',
      dueDate: `${billingMonth}-10`,
      notes: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    countCreated++;
    totalAmountBilled += totalDue;
  }

  if (countCreated > 0) {
    await batch.commit();
  }

  return {
    success: true,
    billingMonth,
    countCreated,
    countSkipped,
    totalAmountBilled,
  };
}

export async function recordRentPaymentCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const billId = validateId(payload.billId, 'billId');
  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });

  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : '';
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new ApiError('invalid-argument', `Invalid payment method. Allowed: ${Array.from(ALLOWED_PAYMENT_METHODS).join(', ')}`);
  }

  const transactionId = typeof payload.transactionId === 'string' ? payload.transactionId.trim() : null;
  if (transactionId && transactionId.length > 100) {
    throw new ApiError('invalid-argument', 'transactionId cannot exceed 100 characters.');
  }

  const notes = validateOptionalString(payload.notes, 'notes', 500);
  const paymentDate = typeof payload.paymentDate === 'string' ? payload.paymentDate.trim() : null;

  // Duplicate digital transaction ID guard
  if (transactionId) {
    const existingTxSnap = await db.collection('rent_payments')
      .where('ownerUid', '==', callerUid)
      .where('transactionId', '==', transactionId)
      .where('entryType', '==', 'payment')
      .limit(1)
      .get();

    if (!existingTxSnap.empty) {
      throw new ApiError('already-exists', `Duplicate transaction ID "${transactionId}". This payment has already been recorded.`);
    }
  }

  return await db.runTransaction(async (tx) => {
    const billRef = db.collection('rent_bills').doc(billId);
    const billSnap = await tx.get(billRef);

    if (!billSnap.exists) {
      throw new ApiError('not-found', 'Rent bill not found.');
    }

    const bill = billSnap.data()!;
    if (bill.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized: bill does not belong to user.');
    }

    if (bill.status === 'paid' || (bill.balanceDue as number) <= 0) {
      throw new ApiError('failed-precondition', 'This bill is already fully paid.');
    }

    if (amount > (bill.balanceDue as number)) {
      throw new ApiError(
        'invalid-argument',
        `Payment amount (৳${amount.toLocaleString('en-IN')}) exceeds remaining balance due (৳${(bill.balanceDue as number).toLocaleString('en-IN')}).`
      );
    }

    // Generate formatted receipt number
    const timestampStr = Date.now().toString().slice(-4);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString().slice(-2);
    const receiptNumber = `REC-${(bill.billingMonth as string).replace('-', '')}-${timestampStr}${randomSuffix}`;

    const newTotalPaid = (bill.totalPaid as number) + amount;
    const newBalanceDue = Math.max(0, (bill.totalDue as number) - newTotalPaid);
    const newStatus = newBalanceDue === 0 ? 'paid' : 'partial';

    // 1. Create Payment Record (append-only ledger)
    const paymentRef = db.collection('rent_payments').doc();
    tx.set(paymentRef, {
      ownerUid: callerUid,
      billId,
      propertyId: bill.propertyId,
      propertyName: bill.propertyName,
      unitId: bill.unitId,
      unitNumber: bill.unitNumber,
      tenantId: bill.tenantId,
      tenantName: bill.tenantName,
      billingMonth: bill.billingMonth,
      amount,
      paymentMethod,
      transactionId: transactionId || null,
      receiptNumber,
      notes,
      entryType: 'payment',
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Atomically update Bill balances and status
    tx.update(billRef, {
      totalPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      paymentId: paymentRef.id,
      receiptNumber,
      amount,
      totalPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      status: newStatus,
      tenantName: bill.tenantName,
      unitNumber: bill.unitNumber,
      propertyName: bill.propertyName,
      billingMonth: bill.billingMonth,
    };
  });
}
