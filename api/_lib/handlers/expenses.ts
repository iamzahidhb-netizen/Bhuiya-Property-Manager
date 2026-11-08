import { db, FieldValue } from '../firebaseAdmin.ts';
import {
  ApiError,
  validateId,
  validateNumber,
  validateOptionalString,
  DATE_REGEX,
} from '../validation.ts';

const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'bank', 'bkash', 'nagad', 'other']);

const ALLOWED_BUILDING_CATEGORIES = new Set([
  'electricity',
  'gas',
  'water',
  'caretaker_salary',
  'maintenance_repair',
  'cleaning',
  'security',
  'other_building',
]);

const ALLOWED_FAMILY_CATEGORIES = new Set([
  'bazaar',
  'invitation_event',
  'gift',
  'medical',
  'transport',
  'emergency',
  'other_family',
]);

function validateExpenseCategory(group: string, category: string): void {
  if (group === 'building') {
    if (!ALLOWED_BUILDING_CATEGORIES.has(category)) {
      throw new ApiError(
        'invalid-argument',
        `Invalid building expense category "${category}". Allowed: ${Array.from(ALLOWED_BUILDING_CATEGORIES).join(', ')}`
      );
    }
  } else if (group === 'family') {
    if (!ALLOWED_FAMILY_CATEGORIES.has(category)) {
      throw new ApiError(
        'invalid-argument',
        `Invalid family expense category "${category}". Allowed: ${Array.from(ALLOWED_FAMILY_CATEGORIES).join(', ')}`
      );
    }
  } else {
    throw new ApiError('invalid-argument', 'Expense group must be either "building" or "family".');
  }
}

export async function createExpenseCallable(
  callerUid: string,
  payload: Record<string, unknown>,
  userEmail?: string
): Promise<Record<string, unknown>> {
  const title = validateOptionalString(payload.title, 'title', 150);
  if (!title) {
    throw new ApiError('invalid-argument', 'Expense title is required.');
  }

  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const group = typeof payload.group === 'string' ? payload.group.toLowerCase().trim() : '';
  const category = typeof payload.category === 'string' ? payload.category.toLowerCase().trim() : '';
  validateExpenseCategory(group, category);

  const expenseDate = typeof payload.expenseDate === 'string' ? payload.expenseDate.trim() : '';
  if (!DATE_REGEX.test(expenseDate)) {
    throw new ApiError('invalid-argument', 'expenseDate must be in YYYY-MM-DD format.');
  }
  const billingMonth = expenseDate.slice(0, 7);

  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : 'cash';
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new ApiError('invalid-argument', `Invalid payment method "${paymentMethod}".`);
  }

  let propertyId: string | null = null;
  let propertyName: string | null = null;

  if (payload.propertyId) {
    propertyId = validateId(payload.propertyId, 'propertyId');
    const propSnap = await db.collection('properties').doc(propertyId).get();
    if (!propSnap.exists || propSnap.data()?.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Property does not exist or unauthorized.');
    }
    propertyName = propSnap.data()?.name || propSnap.data()?.nameEn || 'Property';
  }

  const paidTo = validateOptionalString(payload.paidTo, 'paidTo', 150);
  const description = validateOptionalString(payload.description, 'description', 1000);
  const receiptUrl = validateOptionalString(payload.receiptUrl, 'receiptUrl', 500);

  const expenseRef = db.collection('expenses').doc();
  await expenseRef.set({
    ownerUid: callerUid,
    title,
    amount,
    group,
    category,
    propertyId: propertyId || null,
    propertyName: propertyName || null,
    expenseDate,
    billingMonth,
    paymentMethod,
    paidTo: paidTo || null,
    description: description || null,
    receiptUrl: receiptUrl || null,
    status: 'active',
    reversalReason: null,
    reversedAt: null,
    createdBy: userEmail || callerUid,
    auditHistory: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    expenseId: expenseRef.id,
    title,
    amount,
    group,
    category,
    billingMonth,
  };
}

export async function updateExpenseCallable(
  callerUid: string,
  payload: Record<string, unknown>,
  userEmail?: string
): Promise<Record<string, unknown>> {
  const expenseId = validateId(payload.expenseId, 'expenseId');
  const reason = validateOptionalString(payload.reason, 'reason', 500);
  if (!reason) {
    throw new ApiError('invalid-argument', 'A reason for editing is required to maintain financial audit history.');
  }

  const title = validateOptionalString(payload.title, 'title', 150);
  if (!title) {
    throw new ApiError('invalid-argument', 'Expense title is required.');
  }

  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const group = typeof payload.group === 'string' ? payload.group.toLowerCase().trim() : '';
  const category = typeof payload.category === 'string' ? payload.category.toLowerCase().trim() : '';
  validateExpenseCategory(group, category);

  const expenseDate = typeof payload.expenseDate === 'string' ? payload.expenseDate.trim() : '';
  if (!DATE_REGEX.test(expenseDate)) {
    throw new ApiError('invalid-argument', 'expenseDate must be in YYYY-MM-DD format.');
  }
  const billingMonth = expenseDate.slice(0, 7);

  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : 'cash';
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new ApiError('invalid-argument', `Invalid payment method "${paymentMethod}".`);
  }

  let propertyId: string | null = null;
  let propertyName: string | null = null;
  if (payload.propertyId) {
    propertyId = validateId(payload.propertyId, 'propertyId');
    const propSnap = await db.collection('properties').doc(propertyId).get();
    if (!propSnap.exists || propSnap.data()?.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Property does not exist or unauthorized.');
    }
    propertyName = propSnap.data()?.name || 'Property';
  }

  const paidTo = validateOptionalString(payload.paidTo, 'paidTo', 150);
  const description = validateOptionalString(payload.description, 'description', 1000);
  const receiptUrl = validateOptionalString(payload.receiptUrl, 'receiptUrl', 500);

  return await db.runTransaction(async (tx) => {
    const expenseRef = db.collection('expenses').doc(expenseId);
    const snap = await tx.get(expenseRef);

    if (!snap.exists) {
      throw new ApiError('not-found', 'Expense record not found.');
    }

    const oldData = snap.data()!;
    if (oldData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized: expense record does not belong to user.');
    }

    if (oldData.status === 'reversed') {
      throw new ApiError('failed-precondition', 'Cannot edit a reversed expense record.');
    }

    // Create immutable audit entry
    const auditEntry = {
      editedAt: new Date().toISOString(),
      editedBy: userEmail || callerUid,
      reason,
      previousAmount: oldData.amount,
      newAmount: amount,
      previousTitle: oldData.title,
      newTitle: title,
      previousCategory: oldData.category,
      newCategory: category,
    };

    const currentHistory = Array.isArray(oldData.auditHistory) ? oldData.auditHistory : [];
    const updatedHistory = [...currentHistory, auditEntry];

    tx.update(expenseRef, {
      title,
      amount,
      group,
      category,
      propertyId: propertyId || null,
      propertyName: propertyName || null,
      expenseDate,
      billingMonth,
      paymentMethod,
      paidTo: paidTo || null,
      description: description || null,
      receiptUrl: receiptUrl || null,
      auditHistory: updatedHistory,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      expenseId,
      newAmount: amount,
      auditEntriesCount: updatedHistory.length,
    };
  });
}

export async function reverseExpenseCallable(
  callerUid: string,
  payload: Record<string, unknown>,
  userEmail?: string
): Promise<Record<string, unknown>> {
  const expenseId = validateId(payload.expenseId, 'expenseId');
  const reason = validateOptionalString(payload.reason, 'reason', 500);
  if (!reason) {
    throw new ApiError('invalid-argument', 'A reason is required to reverse an expense record.');
  }

  return await db.runTransaction(async (tx) => {
    const expenseRef = db.collection('expenses').doc(expenseId);
    const snap = await tx.get(expenseRef);

    if (!snap.exists) {
      throw new ApiError('not-found', 'Expense record not found.');
    }

    const data = snap.data()!;
    if (data.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }

    if (data.status === 'reversed') {
      throw new ApiError('failed-precondition', 'This expense has already been reversed.');
    }

    const auditEntry = {
      editedAt: new Date().toISOString(),
      editedBy: userEmail || callerUid,
      reason: `[REVERSAL] ${reason}`,
      previousAmount: data.amount,
      newAmount: 0,
      previousTitle: data.title,
      newTitle: `[REVERSED] ${data.title}`,
      previousCategory: data.category,
      newCategory: data.category,
    };

    const currentHistory = Array.isArray(data.auditHistory) ? data.auditHistory : [];

    tx.update(expenseRef, {
      status: 'reversed',
      reversalReason: reason,
      auditHistory: [...currentHistory, auditEntry],
      reversedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      expenseId,
      status: 'reversed',
    };
  });
}
