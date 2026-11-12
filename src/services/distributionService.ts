import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createCallable } from '../lib/apiClient';
import { parseTimestampMillis } from '../utils/dhakaDate';
import type {
  Beneficiary,
  FamilyDistribution,
  ReserveFundAccount,
  ReserveLedgerEntry,
  PaymentMethod,
} from '../types/finance';

export const RELATIONSHIP_LABELS: Record<string, { bn: string; en: string }> = {
  brother: { bn: 'ভাই', en: 'Brother' },
  mother: { bn: 'মা', en: 'Mother' },
  sister: { bn: 'বোন', en: 'Sister' },
  other: { bn: 'অন্যান্য অংশীদার', en: 'Other' },
};

// =============================================================================
// REAL-TIME FIRESTORE SUBSCRIPTIONS
// =============================================================================

/**
 * Subscribe to active beneficiaries for an owner.
 */
export function subscribeBeneficiaries(
  ownerUid: string,
  onUpdate: (beneficiaries: Beneficiary[]) => void
): Unsubscribe {
  const collRef = collection(db, 'beneficiaries');
  const q = query(
    collRef,
    where('ownerUid', '==', ownerUid),
    where('isArchived', '==', false)
  );

  return onSnapshot(q, (snapshot) => {
    const beneficiaries: Beneficiary[] = [];
    snapshot.forEach((docSnap) => {
      beneficiaries.push({ id: docSnap.id, ...(docSnap.data() as Omit<Beneficiary, 'id'>) });
    });
    beneficiaries.sort((a, b) => (a.priorityOrder || 10) - (b.priorityOrder || 10));
    onUpdate(beneficiaries);
  });
}

/**
 * Subscribe to a specific monthly distribution document.
 */
export function subscribeMonthlyDistribution(
  ownerUid: string,
  distributionMonth: string,
  onUpdate: (distribution: FamilyDistribution | null) => void
): Unsubscribe {
  const docId = `${ownerUid}_${distributionMonth}`;
  const docRef = doc(db, 'family_distributions', docId);

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...(snapshot.data() as Omit<FamilyDistribution, 'id'>) });
    } else {
      onUpdate(null);
    }
  });
}

/**
 * Subscribe to the Family Reserve Fund account.
 */
export function subscribeReserveFund(
  ownerUid: string,
  onUpdate: (fund: ReserveFundAccount | null) => void,
  workspaceId?: string | null
): Unsubscribe {
  const targetId = workspaceId || ownerUid;
  const docRef = doc(db, 'reserve_funds', targetId);

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as ReserveFundAccount);
    } else {
      onUpdate(null);
    }
  });
}

/**
 * Subscribe to the Family Reserve Fund ledger history.
 */
export function subscribeReserveLedger(
  ownerUid: string,
  onUpdate: (entries: ReserveLedgerEntry[]) => void
): Unsubscribe {
  const collRef = collection(db, 'reserve_ledger');
  const q = query(
    collRef,
    where('ownerUid', '==', ownerUid)
  );

  return onSnapshot(q, (snapshot) => {
    const entries: ReserveLedgerEntry[] = [];
    snapshot.forEach((docSnap) => {
      entries.push({ id: docSnap.id, ...(docSnap.data() as Omit<ReserveLedgerEntry, 'id'>) });
    });
    // Sort descending by created timestamp or client-side
    entries.sort((a, b) => {
      const timeA = parseTimestampMillis(a.createdAt);
      const timeB = parseTimestampMillis(b.createdAt);
      return timeB - timeA;
    });
    onUpdate(entries);
  });
}

// =============================================================================
// CALLABLE FUNCTIONS WRAPPERS
// =============================================================================

export interface CreateBeneficiaryInput {
  name: string;
  relationship: 'brother' | 'mother' | 'sister' | 'other';
  defaultMonthlyTarget: number;
  effectiveFromMonth?: string;
  priorityOrder?: number;
  notes?: string;
  payoutMethod?: {
    type: 'bank' | 'bkash' | 'nagad' | 'cash';
    accountNo?: string;
    routingNo?: string;
    bankName?: string;
  };
}

export interface UpdateBeneficiaryInput {
  beneficiaryId: string;
  name?: string;
  relationship?: 'brother' | 'mother' | 'sister' | 'other';
  defaultMonthlyTarget?: number;
  effectiveFromMonth?: string;
  reason?: string;
  status?: 'active' | 'inactive';
  priorityOrder?: number;
  notes?: string;
  payoutMethod?: {
    type: 'bank' | 'bkash' | 'nagad' | 'cash';
    accountNo?: string;
    routingNo?: string;
    bankName?: string;
  };
}

export interface RecordPayoutInput {
  distributionMonth: string;
  beneficiaryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  transactionId?: string;
  notes?: string;
}

export interface ReserveWithdrawalInput {
  amount: number;
  reason: string;
  distributionMonth?: string;
}

export interface ReserveTransferInput {
  distributionMonth: string;
  amount: number;
  reason?: string;
}

/**
 * Idempotently seed default family beneficiaries (Brother 1-3, Mother, Sister).
 */
export async function seedDefaultBeneficiaries(): Promise<{ success: boolean; seeded: boolean }> {
  const fn = createCallable<unknown, { success: boolean; seeded: boolean }>('seedDefaultBeneficiariesCallable');
  const res = await fn({});
  return res.data;
}

/**
 * Create a new dynamic beneficiary.
 */
export async function createBeneficiary(input: CreateBeneficiaryInput): Promise<{ success: boolean; beneficiaryId: string }> {
  const fn = createCallable<CreateBeneficiaryInput, { success: boolean; beneficiaryId: string }>('createBeneficiaryCallable');
  const res = await fn(input);
  return res.data;
}

/**
 * Update an existing beneficiary.
 */
export async function updateBeneficiary(input: UpdateBeneficiaryInput): Promise<{ success: boolean }> {
  const fn = createCallable<UpdateBeneficiaryInput, { success: boolean }>('updateBeneficiaryCallable');
  const res = await fn(input);
  return res.data;
}

/**
 * Archive a beneficiary.
 */
export async function archiveBeneficiary(beneficiaryId: string): Promise<{ success: boolean }> {
  const fn = createCallable<{ beneficiaryId: string }, { success: boolean }>('archiveBeneficiaryCallable');
  const res = await fn({ beneficiaryId });
  return res.data;
}

export async function restoreBeneficiary(beneficiaryId: string): Promise<{ success: boolean }> {
  const fn = createCallable<{ beneficiaryId: string }, { success: boolean }>('restoreBeneficiaryCallable');
  const res = await fn({ beneficiaryId });
  return res.data;
}

export async function getBeneficiaryHistory(beneficiaryId: string): Promise<{ success: boolean; history: unknown[] }> {
  const fn = createCallable<{ beneficiaryId: string }, { success: boolean; history: unknown[] }>('getBeneficiaryHistoryCallable');
  const res = await fn({ beneficiaryId });
  return res.data;
}

/**
 * Get or create an immutable monthly distribution snapshot.
 */
export async function getOrCreateMonthlyDistribution(distributionMonth: string): Promise<{ success: boolean; isNew: boolean }> {
  const fn = createCallable<{ distributionMonth: string }, { success: boolean; isNew: boolean }>('getOrCreateMonthlyDistributionCallable');
  const res = await fn({ distributionMonth });
  return res.data;
}

/**
 * Apply special monthly adjustment (e.g. Eid bonus).
 */
export async function applySpecialAdjustment(
  distributionMonth: string,
  beneficiaryId: string,
  adjustmentAmount: number,
  reason: string
): Promise<{ success: boolean }> {
  const fn = createCallable<{ distributionMonth: string; beneficiaryId: string; adjustmentAmount: number; reason: string }, { success: boolean }>(
    'applySpecialAdjustmentCallable'
  );
  const res = await fn({ distributionMonth, beneficiaryId, adjustmentAmount, reason });
  return res.data;
}

/**
 * Record a beneficiary payout.
 */
export async function recordBeneficiaryPayout(input: RecordPayoutInput): Promise<{ success: boolean; payoutId: string }> {
  const fn = createCallable<RecordPayoutInput, { success: boolean; payoutId: string }>('recordBeneficiaryPayoutCallable');
  const res = await fn(input);
  return res.data;
}

/**
 * Initialize or seed Reserve Fund opening balance.
 */
export async function initializeReserveFund(initialBalance: number = 0): Promise<{ success: boolean }> {
  const fn = createCallable<{ initialBalance: number }, { success: boolean }>('initializeReserveFundCallable');
  const res = await fn({ initialBalance });
  return res.data;
}

/**
 * Withdraw funds from Reserve Fund to cover operating shortage or emergency.
 */
export async function withdrawFromReserve(input: ReserveWithdrawalInput): Promise<{ success: boolean; newBalance: number }> {
  const fn = createCallable<ReserveWithdrawalInput, { success: boolean; newBalance: number }>('withdrawFromReserveCallable');
  const res = await fn(input);
  return res.data;
}

/**
 * Transfer monthly distributable surplus to the Family Reserve Fund.
 */
export async function transferSurplusToReserve(input: ReserveTransferInput): Promise<{ success: boolean; newBalance: number }> {
  const fn = createCallable<ReserveTransferInput, { success: boolean; newBalance: number }>('transferSurplusToReserveCallable');
  const res = await fn(input);
  return res.data;
}

export async function reconcileReserveBalance(): Promise<Record<string, unknown>> {
  const fn = createCallable<unknown, Record<string, unknown>>('reconcileReserveBalanceCallable');
  const res = await fn({});
  return res.data;
}
