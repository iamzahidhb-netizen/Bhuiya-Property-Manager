import { db, FieldValue } from '../firebaseAdmin.ts';
import {
  ApiError,
  validateId,
  validateNumber,
  validateOptionalString,
  MONTH_REGEX,
  DATE_REGEX,
} from '../validation.ts';

interface BeneficiaryRecord {
  id?: string;
  defaultMonthlyTarget?: number;
  targetHistory?: Array<{
    effectiveFromMonth?: string;
    monthlyTarget?: number;
    updatedAt?: string;
    reason?: string;
  }>;
  priorityOrder?: number;
  [key: string]: unknown;
}

interface BeneficiarySnapshot {
  beneficiaryId: string;
  name: string;
  relationship: string;
  baseMonthlyTarget: number;
  specialAdjustment: number;
  adjustmentReason: string | null;
  effectiveTarget: number;
  actualDisbursed: number;
  pendingAmount: number;
  payoutStatus: string;
  payouts: unknown[];
}

function getBeneficiaryTargetForMonth(beneficiary: BeneficiaryRecord, targetMonth: string): number {
  if (Array.isArray(beneficiary.targetHistory) && beneficiary.targetHistory.length > 0) {
    const applicable = beneficiary.targetHistory
      .filter((h) => typeof h.effectiveFromMonth === 'string' && h.effectiveFromMonth <= targetMonth)
      .sort((a, b) => ((a.effectiveFromMonth || '') < (b.effectiveFromMonth || '') ? -1 : 1));

    if (applicable.length > 0) {
      return applicable[applicable.length - 1].monthlyTarget || 0;
    }
  }
  return beneficiary.defaultMonthlyTarget || 0;
}

export async function seedDefaultBeneficiariesCallable(
  callerUid: string
): Promise<Record<string, unknown>> {
  const existingSnap = await db.collection('beneficiaries')
    .where('ownerUid', '==', callerUid)
    .where('isArchived', '==', false)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return {
      success: true,
      seeded: false,
      message: 'Beneficiaries already initialized for this owner.',
    };
  }

  const initialDefaults = [
    { name: 'Brother 1', relationship: 'brother', defaultMonthlyTarget: 45000, priorityOrder: 1 },
    { name: 'Brother 2', relationship: 'brother', defaultMonthlyTarget: 45000, priorityOrder: 2 },
    { name: 'Brother 3', relationship: 'brother', defaultMonthlyTarget: 45000, priorityOrder: 3 },
    { name: 'Mother', relationship: 'mother', defaultMonthlyTarget: 25000, priorityOrder: 4 },
    { name: 'Sister', relationship: 'sister', defaultMonthlyTarget: 25000, priorityOrder: 5 },
  ];

  const batch = db.batch();
  const createdIds: string[] = [];

  for (const b of initialDefaults) {
    const docRef = db.collection('beneficiaries').doc();
    createdIds.push(docRef.id);
    batch.set(docRef, {
      ownerUid: callerUid,
      name: b.name,
      relationship: b.relationship,
      defaultMonthlyTarget: b.defaultMonthlyTarget,
      effectiveFromMonth: '2026-01',
      targetHistory: [
        {
          monthlyTarget: b.defaultMonthlyTarget,
          effectiveFromMonth: '2026-01',
          updatedAt: new Date().toISOString(),
          reason: 'Initial system default allocation',
        },
      ],
      payoutMethod: { type: 'bank' },
      status: 'active',
      isArchived: false,
      priorityOrder: b.priorityOrder,
      notes: 'Initial default family beneficiary',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return {
    success: true,
    seeded: true,
    count: createdIds.length,
    beneficiaryIds: createdIds,
    totalTarget: 185000,
  };
}

export async function createBeneficiaryCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const name = validateOptionalString(payload.name, 'name', 100);
  if (!name) {
    throw new ApiError('invalid-argument', 'Beneficiary name is required.');
  }

  const relationship = typeof payload.relationship === 'string' ? payload.relationship.toLowerCase().trim() : 'other';
  if (!['brother', 'mother', 'sister', 'other'].includes(relationship)) {
    throw new ApiError('invalid-argument', 'Invalid relationship type.');
  }

  const defaultMonthlyTarget = validateNumber(payload.defaultMonthlyTarget, 'defaultMonthlyTarget', { min: 1, max: 100000000 });
  const effectiveFromMonth = typeof payload.effectiveFromMonth === 'string' && MONTH_REGEX.test(payload.effectiveFromMonth.trim())
    ? payload.effectiveFromMonth.trim()
    : new Date().toISOString().slice(0, 7);

  const priorityOrder = typeof payload.priorityOrder === 'number' ? payload.priorityOrder : 10;
  const notes = validateOptionalString(payload.notes, 'notes', 500);

  const payoutMethodRaw = payload.payoutMethod as Record<string, unknown> | undefined;
  const payoutMethod = payoutMethodRaw && typeof payoutMethodRaw === 'object'
    ? {
        type: typeof payoutMethodRaw.type === 'string' ? payoutMethodRaw.type.toLowerCase().trim() : 'bank',
        accountNo: validateOptionalString(payoutMethodRaw.accountNo, 'accountNo', 50),
        routingNo: validateOptionalString(payoutMethodRaw.routingNo, 'routingNo', 50),
        bankName: validateOptionalString(payoutMethodRaw.bankName, 'bankName', 100),
      }
    : { type: 'bank' };

  const docRef = db.collection('beneficiaries').doc();
  await docRef.set({
    ownerUid: callerUid,
    name,
    relationship,
    defaultMonthlyTarget,
    effectiveFromMonth,
    targetHistory: [
      {
        monthlyTarget: defaultMonthlyTarget,
        effectiveFromMonth,
        updatedAt: new Date().toISOString(),
        reason: 'Beneficiary registered',
      },
    ],
    payoutMethod,
    status: 'active',
    isArchived: false,
    priorityOrder,
    notes: notes || '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    beneficiaryId: docRef.id,
    name,
    defaultMonthlyTarget,
    effectiveFromMonth,
  };
}

export async function updateBeneficiaryCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const docRef = db.collection('beneficiaries').doc(beneficiaryId);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new ApiError('not-found', 'Beneficiary record not found.');
  }
  const current = snap.data()!;
  if (current.ownerUid !== callerUid) {
    throw new ApiError('permission-denied', 'Unauthorized.');
  }
  if (current.isArchived) {
    throw new ApiError('failed-precondition', 'Cannot edit an archived beneficiary.');
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (payload.name !== undefined) {
    const name = validateOptionalString(payload.name, 'name', 100);
    if (!name) throw new ApiError('invalid-argument', 'Beneficiary name cannot be empty.');
    updates.name = name;
  }

  if (payload.relationship !== undefined) {
    const relationship = typeof payload.relationship === 'string' ? payload.relationship.toLowerCase().trim() : 'other';
    if (!['brother', 'mother', 'sister', 'other'].includes(relationship)) {
      throw new ApiError('invalid-argument', 'Invalid relationship.');
    }
    updates.relationship = relationship;
  }

  if (payload.status !== undefined) {
    const status = typeof payload.status === 'string' ? payload.status.toLowerCase().trim() : 'active';
    if (!['active', 'inactive'].includes(status)) {
      throw new ApiError('invalid-argument', 'Status must be active or inactive.');
    }
    updates.status = status;
  }

  if (payload.priorityOrder !== undefined) {
    updates.priorityOrder = validateNumber(payload.priorityOrder, 'priorityOrder', { min: 1, max: 999, integerOnly: true });
  }

  if (payload.notes !== undefined) {
    updates.notes = validateOptionalString(payload.notes, 'notes', 500);
  }

  if (payload.payoutMethod !== undefined && typeof payload.payoutMethod === 'object') {
    const payoutMethodRaw = payload.payoutMethod as Record<string, unknown>;
    updates.payoutMethod = {
      type: typeof payoutMethodRaw.type === 'string' ? payoutMethodRaw.type.toLowerCase().trim() : 'bank',
      accountNo: validateOptionalString(payoutMethodRaw.accountNo, 'accountNo', 50),
      routingNo: validateOptionalString(payoutMethodRaw.routingNo, 'routingNo', 50),
      bankName: validateOptionalString(payoutMethodRaw.bankName, 'bankName', 100),
    };
  }

  if (payload.defaultMonthlyTarget !== undefined) {
    const newTarget = validateNumber(payload.defaultMonthlyTarget, 'defaultMonthlyTarget', { min: 1, max: 100000000 });
    const effectiveFromMonth = typeof payload.effectiveFromMonth === 'string' && MONTH_REGEX.test(payload.effectiveFromMonth.trim())
      ? payload.effectiveFromMonth.trim()
      : new Date().toISOString().slice(0, 7);
    const reason = validateOptionalString(payload.reason, 'reason', 300);

    updates.defaultMonthlyTarget = newTarget;
    updates.effectiveFromMonth = effectiveFromMonth;

    const currentHistory = Array.isArray(current.targetHistory) ? current.targetHistory : [];
    updates.targetHistory = [
      ...currentHistory,
      {
        monthlyTarget: newTarget,
        effectiveFromMonth,
        updatedAt: new Date().toISOString(),
        reason: reason || 'Target updated',
      },
    ];
  }

  await docRef.update(updates);

  return {
    success: true,
    beneficiaryId,
  };
}

export async function archiveBeneficiaryCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; beneficiaryId: string }> {
  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const docRef = db.collection('beneficiaries').doc(beneficiaryId);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new ApiError('not-found', 'Beneficiary record not found.');
  }
  if (snap.data()?.ownerUid !== callerUid) {
    throw new ApiError('permission-denied', 'Unauthorized.');
  }

  await docRef.update({
    status: 'archived',
    isArchived: true,
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, beneficiaryId };
}

export async function getOrCreateMonthlyDistributionCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!MONTH_REGEX.test(distributionMonth)) {
    throw new ApiError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const distributionDocId = `${callerUid}_${distributionMonth}`;
  const distRef = db.collection('family_distributions').doc(distributionDocId);

  return await db.runTransaction(async (tx) => {
    const existingSnap = await tx.get(distRef);

    // If historical snapshot exists, return it unchanged!
    if (existingSnap.exists) {
      const data = existingSnap.data()!;
      return {
        success: true,
        isNew: false,
        distributionId: distributionDocId,
        distributionMonth,
        calculatedTargetTotal: data.calculatedTargetTotal,
        finalTargetTotal: data.finalTargetTotal,
        actualTotalDisbursed: data.actualTotalDisbursed,
        remainingPendingTotal: data.remainingPendingTotal,
        beneficiarySnapshots: data.beneficiarySnapshots,
      };
    }

    // Retrieve active beneficiaries to build fresh monthly snapshot
    const beneficiariesSnap = await tx.get(
      db.collection('beneficiaries')
        .where('ownerUid', '==', callerUid)
        .where('status', '==', 'active')
        .where('isArchived', '==', false)
    );

    const beneficiaryDocs: BeneficiaryRecord[] = [];
    beneficiariesSnap.forEach((doc) => {
      beneficiaryDocs.push({ id: doc.id, ...doc.data() });
    });

    beneficiaryDocs.sort((a, b) => (Number(a.priorityOrder) || 10) - (Number(b.priorityOrder) || 10));

    let calculatedTargetTotal = 0;
    const snapshots: BeneficiarySnapshot[] = [];

    for (const b of beneficiaryDocs) {
      const target = getBeneficiaryTargetForMonth(b, distributionMonth);
      calculatedTargetTotal += target;

      snapshots.push({
        beneficiaryId: b.id!,
        name: (b.name as string) || 'Beneficiary',
        relationship: (b.relationship as string) || 'other',
        baseMonthlyTarget: target,
        specialAdjustment: 0,
        adjustmentReason: null,
        effectiveTarget: target,
        actualDisbursed: 0,
        pendingAmount: target,
        payoutStatus: 'unpaid',
        payouts: [],
      });
    }

    const newDist = {
      ownerUid: callerUid,
      distributionMonth,
      calculatedTargetTotal,
      specialAdjustmentTotal: 0,
      finalTargetTotal: calculatedTargetTotal,
      netRentCollected: 0,
      totalExpensesDeducted: 0,
      distributableSurplus: 0,
      actualTotalDisbursed: 0,
      remainingPendingTotal: calculatedTargetTotal,
      reserveInflow: 0,
      surplusTransferredToReserve: 0,
      status: 'draft',
      isFinalized: false,
      finalizedAt: null,
      beneficiarySnapshots: snapshots,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.set(distRef, newDist);

    return {
      success: true,
      isNew: true,
      distributionId: distributionDocId,
      distributionMonth,
      calculatedTargetTotal,
      finalTargetTotal: calculatedTargetTotal,
      actualTotalDisbursed: 0,
      remainingPendingTotal: calculatedTargetTotal,
      beneficiarySnapshots: snapshots,
    };
  });
}

export async function applySpecialAdjustmentCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!MONTH_REGEX.test(distributionMonth)) {
    throw new ApiError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const adjustmentAmount = validateNumber(payload.adjustmentAmount, 'adjustmentAmount', { min: -10000000, max: 10000000 });
  const reason = validateOptionalString(payload.reason, 'reason', 300);

  const distributionDocId = `${callerUid}_${distributionMonth}`;
  const distRef = db.collection('family_distributions').doc(distributionDocId);

  return await db.runTransaction(async (tx) => {
    const distSnap = await tx.get(distRef);
    if (!distSnap.exists) {
      throw new ApiError('not-found', 'Monthly distribution not initialized.');
    }
    const distData = distSnap.data()!;
    if (distData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }

    const snapshots = Array.isArray(distData.beneficiarySnapshots) ? (distData.beneficiarySnapshots as BeneficiarySnapshot[]) : [];
    const idx = snapshots.findIndex((s) => s.beneficiaryId === beneficiaryId);
    if (idx === -1) {
      throw new ApiError('not-found', 'Beneficiary not in monthly distribution snapshot.');
    }

    const b = { ...snapshots[idx] };
    b.specialAdjustment = adjustmentAmount;
    b.adjustmentReason = reason || null;
    b.effectiveTarget = Math.max(0, b.baseMonthlyTarget + adjustmentAmount);
    b.pendingAmount = Math.max(0, b.effectiveTarget - (b.actualDisbursed || 0));
    b.payoutStatus = b.pendingAmount <= 0 ? 'paid' : (b.actualDisbursed > 0 ? 'partial' : 'unpaid');

    const updatedSnapshots = [...snapshots];
    updatedSnapshots[idx] = b;

    let specialAdjustmentTotal = 0;
    let finalTargetTotal = 0;
    for (const item of updatedSnapshots) {
      specialAdjustmentTotal += (item.specialAdjustment || 0);
      finalTargetTotal += item.effectiveTarget;
    }

    const remainingPendingTotal = Math.max(0, finalTargetTotal - (Number(distData.actualTotalDisbursed) || 0));

    tx.update(distRef, {
      specialAdjustmentTotal,
      finalTargetTotal,
      remainingPendingTotal,
      beneficiarySnapshots: updatedSnapshots,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      beneficiaryId,
      newEffectiveTarget: b.effectiveTarget,
      specialAdjustmentTotal,
      finalTargetTotal,
      remainingPendingTotal,
    };
  });
}

export async function recordBeneficiaryPayoutCallable(
  callerUid: string,
  payload: Record<string, unknown>,
  userEmail?: string
): Promise<Record<string, unknown>> {
  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!MONTH_REGEX.test(distributionMonth)) {
    throw new ApiError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : 'cash';
  const paymentDate = typeof payload.paymentDate === 'string' && DATE_REGEX.test(payload.paymentDate.trim())
    ? payload.paymentDate.trim()
    : new Date().toISOString().slice(0, 10);
  const transactionId = validateOptionalString(payload.transactionId, 'transactionId', 100);
  const notes = validateOptionalString(payload.notes, 'notes', 500);

  const distributionDocId = `${callerUid}_${distributionMonth}`;
  const distRef = db.collection('family_distributions').doc(distributionDocId);

  return await db.runTransaction(async (tx) => {
    // 1. ALL READS FIRST:
    const distSnap = await tx.get(distRef);
    if (!distSnap.exists) {
      throw new ApiError('not-found', `Distribution snapshot for month ${distributionMonth} does not exist. Please initialize the distribution first.`);
    }

    const distData = distSnap.data()!;
    if (distData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }

    const paymentsSnap = await tx.get(
      db.collection('rent_payments')
        .where('ownerUid', '==', callerUid)
        .where('billingMonth', '==', distributionMonth)
        .where('entryType', '==', 'payment')
    );

    const expensesSnap = await tx.get(
      db.collection('expenses')
        .where('ownerUid', '==', callerUid)
        .where('billingMonth', '==', distributionMonth)
        .where('status', '==', 'active')
    );

    // Actual rent & utility collections (strictly excluding security deposits and liabilities)
    let totalCollected = 0;
    paymentsSnap.forEach((doc) => {
      totalCollected += (Number(doc.data().amount) || 0);
    });

    // Actual building + family operating expenses
    let totalExpenses = 0;
    expensesSnap.forEach((doc) => {
      totalExpenses += (Number(doc.data().amount) || 0);
    });

    const netOperatingBalance = totalCollected - totalExpenses;
    const reserveInflow = Number(distData.reserveInflow) || 0;
    const totalApprovedPool = netOperatingBalance + reserveInflow;
    const alreadyDisbursed = Number(distData.actualTotalDisbursed) || 0;
    const availableFunds = totalApprovedPool - alreadyDisbursed;

    if (amount > availableFunds) {
      throw new ApiError(
        'failed-precondition',
        `Cannot disburse beyond approved available funds. Available: ৳${availableFunds}, requested: ৳${amount}.`
      );
    }

    const snapshots = Array.isArray(distData.beneficiarySnapshots) ? (distData.beneficiarySnapshots as BeneficiarySnapshot[]) : [];
    const bIndex = snapshots.findIndex((s) => s.beneficiaryId === beneficiaryId);
    if (bIndex === -1) {
      throw new ApiError('not-found', 'Beneficiary not found in this monthly distribution snapshot.');
    }

    const bSnapshot = { ...snapshots[bIndex] };
    const remainingTarget = bSnapshot.effectiveTarget - (bSnapshot.actualDisbursed || 0);
    if (amount > remainingTarget) {
      throw new ApiError(
        'invalid-argument',
        `Payout amount (৳${amount}) exceeds remaining target for ${bSnapshot.name} (৳${remainingTarget}).`
      );
    }

    // 2. NOW WRITES:
    const payoutRecord = {
      id: `payout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount,
      paymentDate,
      paymentMethod,
      transactionId: transactionId || null,
      notes: notes || null,
      paidAt: new Date().toISOString(),
      paidBy: userEmail || callerUid,
    };

    bSnapshot.actualDisbursed = (bSnapshot.actualDisbursed || 0) + amount;
    bSnapshot.pendingAmount = Math.max(0, bSnapshot.effectiveTarget - bSnapshot.actualDisbursed);
    bSnapshot.payoutStatus = bSnapshot.pendingAmount <= 0 ? 'paid' : 'partial';
    bSnapshot.payouts = [...(bSnapshot.payouts || []), payoutRecord];

    const updatedSnapshots = [...snapshots];
    updatedSnapshots[bIndex] = bSnapshot;

    const newTotalDisbursed = alreadyDisbursed + amount;
    const newRemainingPending = Math.max(0, (Number(distData.finalTargetTotal) || 0) - newTotalDisbursed);
    const newStatus = newRemainingPending <= 0 ? 'finalized' : 'in_progress';

    tx.update(distRef, {
      netRentCollected: totalCollected,
      totalExpensesDeducted: totalExpenses,
      distributableSurplus: netOperatingBalance,
      actualTotalDisbursed: newTotalDisbursed,
      remainingPendingTotal: newRemainingPending,
      status: newStatus,
      isFinalized: newStatus === 'finalized',
      beneficiarySnapshots: updatedSnapshots,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      payoutId: payoutRecord.id,
      beneficiaryId,
      amount,
      beneficiaryName: bSnapshot.name,
      newActualDisbursed: bSnapshot.actualDisbursed,
      remainingTarget: bSnapshot.pendingAmount,
      totalDisbursed: newTotalDisbursed,
      payoutStatus: bSnapshot.payoutStatus,
    };
  });
}
