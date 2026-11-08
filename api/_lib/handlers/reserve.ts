import { db, FieldValue } from '../firebaseAdmin.ts';
import {
  ApiError,
  validateNumber,
  validateOptionalString,
  MONTH_REGEX,
} from '../validation.ts';

export async function initializeReserveFundCallable(
  callerUid: string,
  payload: Record<string, unknown>,
  userEmail?: string
): Promise<Record<string, unknown>> {
  const initialBalance = typeof payload.initialBalance === 'number' && payload.initialBalance >= 0
    ? payload.initialBalance
    : 0;

  const fundRef = db.collection('reserve_funds').doc(callerUid);

  return await db.runTransaction(async (tx) => {
    const fundSnap = await tx.get(fundRef);

    if (fundSnap.exists) {
      return {
        success: true,
        alreadyInitialized: true,
        currentBalance: fundSnap.data()?.currentBalance || 0,
      };
    }

    tx.set(fundRef, {
      ownerUid: callerUid,
      currentBalance: initialBalance,
      totalDeposited: initialBalance,
      totalWithdrawn: 0,
      lastTransactionAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (initialBalance > 0) {
      const ledgerRef = db.collection('reserve_ledger').doc();
      tx.set(ledgerRef, {
        ownerUid: callerUid,
        type: 'opening_balance',
        amount: initialBalance,
        balanceBefore: 0,
        balanceAfter: initialBalance,
        reason: 'Initial Reserve Fund opening balance',
        distributionMonth: null,
        isRentalIncome: false,
        createdBy: userEmail || callerUid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      alreadyInitialized: false,
      currentBalance: initialBalance,
    };
  });
}

export async function withdrawFromReserveCallable(
  callerUid: string,
  payload: Record<string, unknown>,
  userEmail?: string
): Promise<Record<string, unknown>> {
  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const reason = validateOptionalString(payload.reason, 'reason', 500);
  if (!reason) {
    throw new ApiError('invalid-argument', 'A reason for reserve withdrawal is required.');
  }

  const distributionMonth = typeof payload.distributionMonth === 'string' && MONTH_REGEX.test(payload.distributionMonth.trim())
    ? payload.distributionMonth.trim()
    : null;

  const fundRef = db.collection('reserve_funds').doc(callerUid);
  const distRef = distributionMonth
    ? db.collection('family_distributions').doc(`${callerUid}_${distributionMonth}`)
    : null;

  return await db.runTransaction(async (tx) => {
    // 1. ALL READS:
    const fundSnap = await tx.get(fundRef);
    if (!fundSnap.exists) {
      throw new ApiError('failed-precondition', 'Reserve fund account has not been initialized.');
    }
    const fundData = fundSnap.data()!;
    if (fundData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }

    const currentBalance = Number(fundData.currentBalance) || 0;
    if (currentBalance < amount) {
      throw new ApiError(
        'failed-precondition',
        `Insufficient reserve fund balance. Available: ৳${currentBalance}, requested: ৳${amount}. Negative reserve balance is strictly prohibited.`
      );
    }

    let distSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    if (distRef) {
      distSnap = await tx.get(distRef);
      if (!distSnap.exists) {
        throw new ApiError('not-found', `Distribution snapshot for month ${distributionMonth} not found.`);
      }
    }

    // 2. ALL WRITES:
    const newBalance = currentBalance - amount;
    tx.update(fundRef, {
      currentBalance: newBalance,
      totalWithdrawn: (Number(fundData.totalWithdrawn) || 0) + amount,
      lastTransactionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (distRef && distSnap && distSnap.exists) {
      const distData = distSnap.data()!;
      const currentInflow = Number(distData.reserveInflow) || 0;
      tx.update(distRef, {
        reserveInflow: currentInflow + amount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const ledgerRef = db.collection('reserve_ledger').doc();
    tx.set(ledgerRef, {
      ownerUid: callerUid,
      type: 'shortage_withdrawal',
      amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      reason,
      distributionMonth: distributionMonth || null,
      isRentalIncome: false, // Critical rule: never rental income
      createdBy: userEmail || callerUid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      amount,
      previousBalance: currentBalance,
      newBalance,
      distributionMonth,
      reason,
    };
  });
}

export async function transferSurplusToReserveCallable(
  callerUid: string,
  payload: Record<string, unknown>,
  userEmail?: string
): Promise<Record<string, unknown>> {
  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!MONTH_REGEX.test(distributionMonth)) {
    throw new ApiError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const reason = validateOptionalString(payload.reason, 'reason', 500) || `Monthly surplus transfer for ${distributionMonth}`;

  const fundRef = db.collection('reserve_funds').doc(callerUid);
  const distRef = db.collection('family_distributions').doc(`${callerUid}_${distributionMonth}`);

  return await db.runTransaction(async (tx) => {
    // 1. ALL READS:
    const distSnap = await tx.get(distRef);
    if (!distSnap.exists) {
      throw new ApiError('not-found', `Distribution snapshot for month ${distributionMonth} not found.`);
    }
    const distData = distSnap.data()!;
    if (distData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }

    const fundSnap = await tx.get(fundRef);

    // Calculate actual collections and expenses
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

    let totalCollected = 0;
    paymentsSnap.forEach((doc) => {
      totalCollected += (Number(doc.data().amount) || 0);
    });

    let totalExpenses = 0;
    expensesSnap.forEach((doc) => {
      totalExpenses += (Number(doc.data().amount) || 0);
    });

    const netOperatingBalance = totalCollected - totalExpenses;
    const totalDisbursed = Number(distData.actualTotalDisbursed) || 0;
    const alreadyTransferred = Number(distData.surplusTransferredToReserve) || 0;
    const availableSurplus = Math.max(0, netOperatingBalance - totalDisbursed - alreadyTransferred);

    if (amount > availableSurplus) {
      throw new ApiError(
        'failed-precondition',
        `Requested surplus transfer (৳${amount}) exceeds available monthly surplus (৳${availableSurplus}).`
      );
    }

    // 2. ALL WRITES:
    let balanceBefore = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;

    if (fundSnap.exists) {
      const fundData = fundSnap.data()!;
      balanceBefore = Number(fundData.currentBalance) || 0;
      totalDeposited = Number(fundData.totalDeposited) || 0;
      totalWithdrawn = Number(fundData.totalWithdrawn) || 0;
    }

    const newBalance = balanceBefore + amount;

    tx.set(fundRef, {
      ownerUid: callerUid,
      currentBalance: newBalance,
      totalDeposited: totalDeposited + amount,
      totalWithdrawn,
      lastTransactionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.update(distRef, {
      surplusTransferredToReserve: alreadyTransferred + amount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = db.collection('reserve_ledger').doc();
    tx.set(ledgerRef, {
      ownerUid: callerUid,
      type: 'surplus_deposit',
      amount,
      balanceBefore,
      balanceAfter: newBalance,
      reason,
      distributionMonth,
      isRentalIncome: false,
      createdBy: userEmail || callerUid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      amount,
      previousBalance: balanceBefore,
      newBalance,
      distributionMonth,
    };
  });
}
