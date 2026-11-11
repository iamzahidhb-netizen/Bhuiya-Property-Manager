import type { Timestamp } from 'firebase/firestore';

export interface TargetHistoryEntry {
  monthlyTarget: number;
  effectiveFromMonth: string; // YYYY-MM
  updatedAt: string;
  reason?: string;
}

export interface Beneficiary {
  id: string;
  ownerUid: string;
  name: string;
  nameEn?: string;
  relationship: 'brother' | 'mother' | 'sister' | 'other';
  defaultMonthlyTarget: number;
  effectiveFromMonth?: string; // YYYY-MM
  effectiveFrom?: Timestamp | null;
  targetHistory?: TargetHistoryEntry[];
  payoutMethod: {
    type: 'bank' | 'bkash' | 'nagad' | 'cash';
    accountNo?: string;
    routingNo?: string;
    bankName?: string;
  };
  status: 'active' | 'inactive' | 'archived';
  isArchived: boolean;
  priorityOrder: number;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface BeneficiaryPayoutRecord {
  id: string;
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  transactionId?: string | null;
  notes?: string | null;
  paidAt: string;
  paidBy: string;
}

export interface BeneficiarySnapshot {
  beneficiaryId: string;
  name: string;
  relationship: string;
  baseMonthlyTarget: number;
  specialAdjustment: number;
  adjustmentReason: string | null;
  effectiveTarget: number;
  actualDisbursed: number;
  pendingAmount: number;
  payoutStatus: 'unpaid' | 'partial' | 'paid';
  payouts: BeneficiaryPayoutRecord[];
}

export interface FamilyDistribution {
  id: string;
  ownerUid: string;
  distributionMonth: string; // YYYY-MM
  calculatedTargetTotal: number;
  specialAdjustmentTotal: number;
  finalTargetTotal: number;
  netRentCollected: number;
  totalExpensesDeducted: number;
  distributableSurplus: number;
  actualTotalDisbursed: number;
  remainingPendingTotal: number;
  reserveInflow: number; // Approved reserve withdrawal to cover shortage
  surplusTransferredToReserve: number; // Surplus deposited into reserve
  surplusToReserve?: number;
  deficitFromReserve?: number;
  status: 'draft' | 'in_progress' | 'finalized';
  isFinalized: boolean;
  finalizedAt: Timestamp | null;
  beneficiarySnapshots: BeneficiarySnapshot[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ReserveFundAccount {
  ownerUid: string;
  currentBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  lastTransactionAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type ReserveLedgerType =
  | 'opening_balance'
  | 'surplus_deposit'
  | 'shortage_withdrawal'
  | 'emergency_withdrawal';

export interface ReserveLedgerEntry {
  id: string;
  ownerUid: string;
  type: ReserveLedgerType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  distributionMonth?: string | null; // YYYY-MM if associated with monthly distribution
  referenceId?: string | null;
  isRentalIncome: false; // Must strictly be false (never rental income)
  createdBy: string;
  createdAt: Timestamp | null;
}

export type PaymentMethod = 'cash' | 'bank' | 'bkash' | 'nagad' | 'other';

export type BillStatus = 'unpaid' | 'partial' | 'paid';

export interface RentBill {
  id: string;
  workspaceId?: string;
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed';
  ownerUid: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  tenantId: string;
  tenantName: string;
  tenantMobile: string;
  billingMonth: string; // YYYY-MM
  rentAmount: number;
  gasCharge: number;
  waterCharge: number;
  serviceCharge: number;
  otherCharges: number;
  totalDue: number;
  totalPaid: number;
  balanceDue: number;
  status: BillStatus;
  dueDate: string; // YYYY-MM-DD
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface RentPayment {
  id: string;
  workspaceId?: string;
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed';
  ownerUid: string;
  billId: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  tenantId: string;
  tenantName: string;
  billingMonth: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string | null;
  receiptNumber: string;
  notes: string;
  entryType: 'payment' | 'reversal' | 'adjustment';
  referencePaymentId?: string;
  paymentDate: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface RentPaymentRecord {
  id: string;
  ownerUid: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  billingMonth: string;
  entryType: 'payment' | 'reversal' | 'adjustment';
  referencePaymentId?: string;
  rentAmount: number;
  utilityAmount: number;
  lateFee: number;
  totalCollected: number;
  paymentDate: Timestamp | null;
  paymentMethod: 'cash' | 'bank_transfer' | 'bkash' | 'nagad' | 'check';
  receiptNumber: string;
  correctionReason?: string;
  createdAt: Timestamp | null;
}

export interface GenerateBillsInput {
  billingMonth: string; // YYYY-MM
  propertyId?: string;
}

export interface RecordPaymentInput {
  billId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  paymentDate?: string; // YYYY-MM-DD
  notes?: string;
}

export interface SecurityDeposit {
  id: string;
  ownerUid: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  depositAmount: number;
  receivedDate: Timestamp | null;
  status: 'held' | 'partially_refunded' | 'fully_refunded' | 'deducted_for_damages';
  refundedAmount: number;
  damageDeductionAmount: number;
  settlementDate: Timestamp | null;
  classification: 'liability';
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// =============================================================================
// PHASE 5: EXPENSE MANAGEMENT
// =============================================================================

export const MONTHLY_BUILDING_EXPENSE_BUDGET = 60000; // ৳60,000 budget target (NOT fixed expense)

export type ExpenseGroup = 'building' | 'family';

export type BuildingExpenseCategory =
  | 'electricity'
  | 'gas'
  | 'water'
  | 'caretaker_salary'
  | 'maintenance_repair'
  | 'cleaning'
  | 'security'
  | 'other_building';

export type FamilyExpenseCategory =
  | 'bazaar'
  | 'invitation_event'
  | 'gift'
  | 'medical'
  | 'transport'
  | 'emergency'
  | 'other_family';

export type ExpenseCategory = BuildingExpenseCategory | FamilyExpenseCategory;

export interface ExpenseAuditEntry {
  editedAt: Timestamp | null;
  editedBy: string;
  reason: string;
  previousAmount: number;
  newAmount: number;
  previousTitle: string;
  newTitle: string;
  previousCategory: ExpenseCategory;
  newCategory: ExpenseCategory;
}

export interface Expense {
  id: string;
  ownerUid: string;
  title: string;
  amount: number;
  group: ExpenseGroup;
  category: ExpenseCategory;
  propertyId?: string | null;
  propertyName?: string | null;
  expenseDate: string; // YYYY-MM-DD
  billingMonth: string; // YYYY-MM
  paymentMethod: PaymentMethod;
  paidTo?: string;
  description?: string;
  receiptUrl?: string;
  status: 'active' | 'reversed';
  reversalReason?: string;
  reversedAt?: Timestamp | null;
  createdBy: string;
  auditHistory: ExpenseAuditEntry[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ExpenseFormData {
  title: string;
  amount: number;
  group: ExpenseGroup;
  category: ExpenseCategory;
  propertyId?: string;
  expenseDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  paidTo?: string;
  description?: string;
  receiptUrl?: string;
}

export interface EditExpenseFormData extends ExpenseFormData {
  expenseId: string;
  reason: string; // Required explanation for financial audit log
}

export interface ReverseExpenseInput {
  expenseId: string;
  reason: string;
}
