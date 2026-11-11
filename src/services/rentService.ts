import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { createCallable, getActiveWorkspaceId } from '../lib/apiClient';
import { parseTimestampMillis } from '../utils/dhakaDate';
import {
  STORES,
  saveItem,
  saveItemsBatch,
  getAllItems,
  type SyncStatus,
} from '../lib/offlineDb';
import { syncEngine } from '../lib/syncEngine';
import type {
  RentBill,
  RentPayment,
  GenerateBillsInput,
  RecordPaymentInput,
  BillStatus,
} from '../types/finance';

const BILLS_COLL = 'rent_bills';
const PAYMENTS_COLL = 'rent_payments';

// =============================================================================
// REAL-TIME SUBSCRIPTIONS (OFFLINE-FIRST HYBRID)
// =============================================================================

export interface RentBillFilters {
  propertyId?: string | null;
  billingMonth?: string | null;
  status?: BillStatus | 'all';
}

/**
 * Real-time subscription to rent bills with immediate IndexedDB cache pre-population.
 */
export function subscribeRentBills(
  _ownerUid: string,
  filters: RentBillFilters,
  onUpdate: (bills: RentBill[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const effectiveWsId = workspaceId || 'workspace_bhuiya_family';

  // 1. Pre-load immediately from IndexedDB cache
  getAllItems<RentBill>(STORES.RENT_BILLS)
    .then((cachedBills) => {
      if (cachedBills.length > 0) {
        const filtered = cachedBills.filter((b) => {
          if (b.workspaceId && b.workspaceId !== effectiveWsId) return false;
          if (filters.propertyId && b.propertyId !== filters.propertyId) return false;
          if (filters.billingMonth && b.billingMonth !== filters.billingMonth) return false;
          if (filters.status && filters.status !== 'all' && b.status !== filters.status) return false;
          return true;
        });
        if (filtered.length > 0) {
          onUpdate(filtered);
        }
      }
    })
    .catch((err) => console.warn('[RentService] Failed to read cached bills:', err));

  const constraints = [where('workspaceId', '==', effectiveWsId)];

  if (filters.propertyId) {
    constraints.push(where('propertyId', '==', filters.propertyId));
  }
  if (filters.billingMonth) {
    constraints.push(where('billingMonth', '==', filters.billingMonth));
  }
  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status));
  }

  const q = query(collection(db, BILLS_COLL), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const bills: RentBill[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<RentBill, 'id'>),
      }));

      // Sort unpaid first, then partial, then paid, then by unitNumber
      const statusWeight: Record<BillStatus, number> = {
        unpaid: 0,
        partial: 1,
        paid: 2,
      };

      bills.sort((a, b) => {
        const weightDiff = (statusWeight[a.status] ?? 0) - (statusWeight[b.status] ?? 0);
        if (weightDiff !== 0) return weightDiff;
        return (a.unitNumber || '').localeCompare(b.unitNumber || '', undefined, { numeric: true });
      });

      // Persist latest bills into local IndexedDB
      saveItemsBatch(STORES.RENT_BILLS, bills).catch((err) =>
        console.warn('[RentService] Failed to cache bills:', err)
      );

      onUpdate(bills);
    },
    (err) => {
      console.warn('[RentService] subscribeRentBills offline/error:', err.message);
      if (onError) onError(err);
    }
  );
}

export interface RentPaymentFilters {
  billId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  billingMonth?: string | null;
}

/**
 * Real-time subscription to rent payments with immediate IndexedDB cache pre-population
 * and offline pending payments merger.
 */
export function subscribeRentPayments(
  _ownerUid: string,
  filters: RentPaymentFilters,
  onUpdate: (payments: RentPayment[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const effectiveWsId = workspaceId || 'workspace_bhuiya_family';

  // 1. Pre-load immediately from IndexedDB cache
  getAllItems<RentPayment>(STORES.RENT_PAYMENTS)
    .then((cachedPayments) => {
      if (cachedPayments.length > 0) {
        const filtered = cachedPayments.filter((p) => {
          if (p.workspaceId && p.workspaceId !== effectiveWsId) return false;
          if (filters.billId && p.billId !== filters.billId) return false;
          if (filters.tenantId && p.tenantId !== filters.tenantId) return false;
          if (filters.propertyId && p.propertyId !== filters.propertyId) return false;
          if (filters.billingMonth && p.billingMonth !== filters.billingMonth) return false;
          return true;
        });

        filtered.sort((a, b) => {
          const timeA = parseTimestampMillis(a.createdAt);
          const timeB = parseTimestampMillis(b.createdAt);
          return timeB - timeA;
        });

        if (filtered.length > 0) {
          onUpdate(filtered);
        }
      }
    })
    .catch((err) => console.warn('[RentService] Failed to read cached payments:', err));

  const constraints = [where('workspaceId', '==', effectiveWsId)];

  if (filters.billId) {
    constraints.push(where('billId', '==', filters.billId));
  }
  if (filters.tenantId) {
    constraints.push(where('tenantId', '==', filters.tenantId));
  }
  if (filters.propertyId) {
    constraints.push(where('propertyId', '==', filters.propertyId));
  }
  if (filters.billingMonth) {
    constraints.push(where('billingMonth', '==', filters.billingMonth));
  }

  const q = query(collection(db, PAYMENTS_COLL), ...constraints);

  return onSnapshot(
    q,
    async (snapshot) => {
      const payments: RentPayment[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<RentPayment, 'id'>),
      }));

      // Cache server payments
      saveItemsBatch(STORES.RENT_PAYMENTS, payments).catch((err) =>
        console.warn('[RentService] Failed to cache payments:', err)
      );

      // Merge any pending local offline payments that haven't hit the server yet
      try {
        const cached = await getAllItems<RentPayment & { syncStatus?: SyncStatus }>(STORES.RENT_PAYMENTS);
        const pendingOffline = cached.filter((p) => p.syncStatus === 'pending');
        const existingIds = new Set(payments.map((p) => p.id));

        for (const offPay of pendingOffline) {
          if (!existingIds.has(offPay.id)) {
            payments.unshift(offPay);
          }
        }
      } catch (mergeErr) {
        console.warn('[RentService] Error merging pending payments:', mergeErr);
      }

      // Sort newest first
      payments.sort((a, b) => {
        const timeA = parseTimestampMillis(a.createdAt);
        const timeB = parseTimestampMillis(b.createdAt);
        return timeB - timeA;
      });

      onUpdate(payments);
    },
    (err) => {
      console.warn('[RentService] subscribeRentPayments offline/error:', err.message);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch payments for a specific bill (one-off query with local cache fallback).
 */
export async function getPaymentsForBill(
  ownerUid: string,
  billId: string
): Promise<RentPayment[]> {
  try {
    const q = query(
      collection(db, PAYMENTS_COLL),
      where('ownerUid', '==', ownerUid),
      where('billId', '==', billId)
    );

    const snap = await getDocs(q);
    const payments: RentPayment[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<RentPayment, 'id'>),
    }));

    payments.sort((a, b) => {
      const timeA = parseTimestampMillis(a.createdAt);
      const timeB = parseTimestampMillis(b.createdAt);
      return timeB - timeA;
    });

    return payments;
  } catch (err) {
    console.warn('[RentService] getPaymentsForBill falling back to local cache:', err);
    const cached = await getAllItems<RentPayment>(STORES.RENT_PAYMENTS);
    return cached.filter((p) => p.billId === billId);
  }
}

// =============================================================================
// CALLABLE CLOUD FUNCTION INVOCATIONS WITH OFFLINE QUEUE FALLBACK
// =============================================================================

export interface GenerateBillsResult {
  success: boolean;
  billingMonth: string;
  countCreated: number;
  countSkipped: number;
  totalAmountBilled: number;
  message?: string;
}

/**
 * Generate monthly bills for all active tenants.
 */
export async function generateMonthlyBills(
  input: GenerateBillsInput
): Promise<GenerateBillsResult> {
  const generateFn = createCallable<GenerateBillsInput, GenerateBillsResult>(
    'generateMonthlyBillsCallable'
  );

  const res = await generateFn(input);
  return res.data;
}

export interface RecordPaymentResult {
  success: boolean;
  paymentId: string;
  receiptNumber: string;
  amount: number;
  totalPaid: number;
  balanceDue: number;
  status: BillStatus;
  tenantName: string;
  unitNumber: string;
  propertyName: string;
  billingMonth: string;
  isOffline?: boolean;
}

/**
 * Record a full or partial rent payment against a bill.
 * Automatically saves locally and queues for sync if offline or server is unreachable.
 */
export async function recordRentPayment(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // 1. Try online submission if device reports connection
  if (isOnline) {
    try {
      const payFn = createCallable<RecordPaymentInput, RecordPaymentResult>(
        'recordRentPaymentCallable'
      );
      const res = await payFn(input);

      // Cache confirmed payment in IndexedDB
      const paymentDoc = {
        id: res.data.paymentId,
        billId: input.billId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentDate: input.paymentDate,
        notes: input.notes,
        receiptNumber: res.data.receiptNumber,
        tenantName: res.data.tenantName,
        unitNumber: res.data.unitNumber,
        propertyName: res.data.propertyName,
        billingMonth: res.data.billingMonth,
        workspaceId: getActiveWorkspaceId() || 'workspace_bhuiya_family',
        syncStatus: 'synced' as const,
        createdAt: new Date().toISOString(),
      };
      saveItem(STORES.RENT_PAYMENTS, paymentDoc).catch(() => {});

      return {
        ...res.data,
        isOffline: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isNetworkErr =
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('unavailable') ||
        errMsg.includes('NetworkError');

      if (!isNetworkErr) {
        // Business logic or validation error — rethrow directly
        throw err;
      }
      console.warn('[RentService] Cloud endpoint unreachable; falling back to offline save:', errMsg);
    }
  }

  // 2. OFFLINE EXECUTION PATH
  const currentWsId = getActiveWorkspaceId() || 'workspace_bhuiya_family';
  const offlineId = `pay_offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const offlineReceiptNumber = `RCP-OFFLINE-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  let tenantName = 'ভাড়াটিয়া';
  let unitNumber = 'N/A';
  let propertyName = 'ভূঁইয়া বাড়ি';
  let billingMonth = input.paymentDate ? input.paymentDate.slice(0, 7) : new Date().toISOString().slice(0, 7);

  // Look up cached bill for balance reconciliation
  const cachedBills = await getAllItems<RentBill>(STORES.RENT_BILLS);
  const matchedBill = cachedBills.find((b) => b.id === input.billId);

  let newTotalPaid = input.amount;
  let newBalanceDue = 0;
  let newStatus: BillStatus = 'paid';

  if (matchedBill) {
    tenantName = matchedBill.tenantName || tenantName;
    unitNumber = matchedBill.unitNumber || unitNumber;
    propertyName = matchedBill.propertyName || propertyName;
    billingMonth = matchedBill.billingMonth || billingMonth;

    newTotalPaid = (matchedBill.totalPaid || 0) + input.amount;
    newBalanceDue = Math.max(0, (matchedBill.totalDue || input.amount) - newTotalPaid);
    newStatus = newBalanceDue === 0 ? 'paid' : 'partial';

    matchedBill.totalPaid = newTotalPaid;
    matchedBill.balanceDue = newBalanceDue;
    matchedBill.status = newStatus;
    await saveItem(STORES.RENT_BILLS, matchedBill);
  }

  const offlinePaymentDoc = {
    id: offlineId,
    billId: input.billId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    paymentDate: input.paymentDate,
    notes: input.notes,
    receiptNumber: offlineReceiptNumber,
    tenantName,
    unitNumber,
    propertyName,
    billingMonth,
    workspaceId: currentWsId,
    syncStatus: 'pending' as const,
    isOfflineCreated: true,
    createdAt: new Date().toISOString(),
  };

  // Save offline payment to IndexedDB
  await saveItem(STORES.RENT_PAYMENTS, offlinePaymentDoc);

  // Queue mutation for automatic synchronization
  await syncEngine.enqueueAction({
    actionName: 'recordRentPaymentCallable',
    payload: {
      ...input,
      receiptNumber: offlineReceiptNumber,
      isOfflineGenerated: true,
    },
    category: 'payment',
    workspaceId: currentWsId,
    callerUid: auth.currentUser?.uid || 'offline_user',
    localEntityId: offlineId,
  });

  return {
    success: true,
    paymentId: offlineId,
    receiptNumber: offlineReceiptNumber,
    amount: input.amount,
    totalPaid: newTotalPaid,
    balanceDue: newBalanceDue,
    status: newStatus,
    tenantName,
    unitNumber,
    propertyName,
    billingMonth,
    isOffline: true,
  };
}
