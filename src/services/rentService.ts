import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createCallable } from '../lib/apiClient';
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
// REAL-TIME SUBSCRIPTIONS
// =============================================================================

export interface RentBillFilters {
  propertyId?: string | null;
  billingMonth?: string | null;
  status?: BillStatus | 'all';
}

/**
 * Real-time subscription to rent bills.
 */
export function subscribeRentBills(
  ownerUid: string,
  filters: RentBillFilters,
  onUpdate: (bills: RentBill[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const constraints = [where('ownerUid', '==', ownerUid)];

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
        return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
      });

      onUpdate(bills);
    },
    (err) => {
      console.error('[RentService] subscribeRentBills error:', err);
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
 * Real-time subscription to rent payments.
 */
export function subscribeRentPayments(
  ownerUid: string,
  filters: RentPaymentFilters,
  onUpdate: (payments: RentPayment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const constraints = [where('ownerUid', '==', ownerUid)];

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
    (snapshot) => {
      const payments: RentPayment[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<RentPayment, 'id'>),
      }));

      // Sort newest first
      payments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      onUpdate(payments);
    },
    (err) => {
      console.error('[RentService] subscribeRentPayments error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch payments for a specific bill (one-off query).
 */
export async function getPaymentsForBill(
  ownerUid: string,
  billId: string
): Promise<RentPayment[]> {
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
    const timeA = a.createdAt?.toMillis() || 0;
    const timeB = b.createdAt?.toMillis() || 0;
    return timeB - timeA;
  });

  return payments;
}

// =============================================================================
// CALLABLE CLOUD FUNCTION INVOCATIONS
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
}

/**
 * Record a full or partial rent payment against a bill.
 */
export async function recordRentPayment(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const payFn = createCallable<RecordPaymentInput, RecordPaymentResult>(
    'recordRentPaymentCallable'
  );

  const res = await payFn(input);
  return res.data;
}
