import type {
  BillStatus,
  PaymentMethod,
  BuildingExpenseCategory,
  FamilyExpenseCategory,
  ExpenseCategory,
} from './finance';

export type ReportType =
  | 'monthly_statement'
  | 'yearly_summary'
  | 'property_income'
  | 'property_expenses'
  | 'tenant_ledger'
  | 'outstanding_rent'
  | 'building_expenses'
  | 'family_expenses'
  | 'family_distribution'
  | 'reserve_fund'
  | 'net_operating'
  | 'budget_vs_actual';

export type ReportPeriodMode = 'monthly' | 'yearly' | 'custom';

export interface ReportFilterState {
  reportType: ReportType;
  periodMode: ReportPeriodMode;
  month: string; // YYYY-MM
  year: number; // YYYY
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  propertyId: string; // 'all' or specific ID
  tenantId: string; // 'all' or specific ID
  category: string; // 'all' or specific category
}

// 1. Monthly Financial Statement
export interface MonthlyFinancialStatement {
  month: string;
  actualRentalIncome: number;
  actualGasIncome: number;
  actualWaterIncome: number;
  actualOtherIncome: number;
  totalOperatingIncome: number;
  buildingOperatingExpenses: number;
  familySocialExpenses: number;
  totalOperatingExpenses: number;
  netOperatingSurplus: number;
  totalFamilyDistributionDisbursed: number;
  totalFamilyDistributionTarget: number;
  distributionPending: number;
  reserveInflow: number; // Shortage coverage
  reserveOutflow: number; // Surplus deposited
  endingCashBalance: number;
  securityDepositsHeld: number; // Excluded liability for reference
}

// 2. Yearly Financial Summary
export interface MonthlySummaryRow {
  month: string;
  monthNameBn: string;
  monthNameEn: string;
  operatingIncome: number;
  buildingExpenses: number;
  familyExpenses: number;
  totalExpenses: number;
  netOperatingSurplus: number;
  distributionDisbursed: number;
  reserveNetTransfer: number;
}

export interface YearlyFinancialSummary {
  year: number;
  months: MonthlySummaryRow[];
  totalOperatingIncome: number;
  totalBuildingExpenses: number;
  totalFamilyExpenses: number;
  totalExpenses: number;
  totalNetOperatingSurplus: number;
  totalDistributionDisbursed: number;
  totalReserveNetTransfer: number;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
}

// 3. Property-wise Income Report
export interface PropertyIncomeRow {
  propertyId: string;
  propertyName: string;
  totalUnits: number;
  occupiedUnits: number;
  rentCollected: number;
  gasCollected: number;
  waterCollected: number;
  otherCollected: number;
  totalCollected: number;
  totalBilled: number;
  totalDue: number;
  collectionRate: number; // percentage
}

export interface PropertyIncomeReport {
  periodLabel: string;
  properties: PropertyIncomeRow[];
  totalBilled: number;
  totalCollected: number;
  totalDue: number;
  overallCollectionRate: number;
}

// 4. Property-wise Expense Report
export interface PropertyExpenseRow {
  propertyId: string | 'shared';
  propertyName: string;
  electricity: number;
  gas: number;
  water: number;
  caretaker: number;
  maintenance: number;
  cleaning: number;
  security: number;
  otherBuilding: number;
  totalPropertyExpense: number;
  percentageOfTotal: number;
}

export interface PropertyExpenseReport {
  periodLabel: string;
  rows: PropertyExpenseRow[];
  totalBuildingExpenses: number;
}

// 5. Tenant-wise Rent Ledger
export interface TenantLedgerEntry {
  id: string;
  date: string;
  type: 'bill' | 'payment';
  billingMonth: string;
  description: string;
  billedRent: number;
  billedGas: number;
  billedWater: number;
  totalBilled: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod?: PaymentMethod | string;
  receiptNumber?: string;
  transactionId?: string;
  notes?: string;
}

export interface TenantRentLedger {
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  unitNumber: string;
  entries: TenantLedgerEntry[];
  totalBilled: number;
  totalPaid: number;
  totalOutstandingDue: number;
  securityDepositHeld: number; // Liability reference
}

// 6. Outstanding Rent Report
export interface OutstandingRentItem {
  billId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  billingMonth: string;
  dueDate: string;
  totalDue: number;
  totalPaid: number;
  balanceDue: number;
  status: BillStatus;
  daysOverdue: number;
}

export interface OutstandingRentReport {
  periodLabel: string;
  items: OutstandingRentItem[];
  totalOverdueAmount: number;
  overdueBillsCount: number;
  affectedTenantsCount: number;
}

// 7. Building Operating Expense Report
export interface BuildingExpenseCategorySummary {
  category: BuildingExpenseCategory;
  categoryLabelBn: string;
  categoryLabelEn: string;
  totalAmount: number;
  entryCount: number;
  percentageOfTotal: number;
}

export interface BuildingExpenseReport {
  periodLabel: string;
  categories: BuildingExpenseCategorySummary[];
  totalBuildingExpenses: number;
  activeEntriesCount: number;
  reversedEntriesCount: number;
  reversedAmountExcluded: number;
}

// 8. Family & Social Expense Report
export interface FamilyExpenseCategorySummary {
  category: FamilyExpenseCategory;
  categoryLabelBn: string;
  categoryLabelEn: string;
  totalAmount: number;
  entryCount: number;
  percentageOfTotal: number;
}

export interface FamilyExpenseReport {
  periodLabel: string;
  categories: FamilyExpenseCategorySummary[];
  totalFamilyExpenses: number;
  activeEntriesCount: number;
}

// 9. Family Distribution Statement
export interface DistributionBeneficiaryRow {
  beneficiaryId: string;
  name: string;
  relationship: string;
  relationshipLabelBn: string;
  baseMonthlyTarget: number;
  specialAdjustment: number;
  adjustmentReason?: string;
  effectiveTarget: number;
  actualDisbursed: number;
  pendingAmount: number;
  payoutStatus: 'unpaid' | 'partial' | 'paid';
  payoutCount: number;
}

export interface FamilyDistributionStatement {
  distributionMonth: string;
  status: string;
  beneficiaries: DistributionBeneficiaryRow[];
  totalBaseTarget: number;
  totalSpecialAdjustments: number;
  finalTargetTotal: number;
  actualTotalDisbursed: number;
  remainingPendingTotal: number;
  payoutRecords: {
    id: string;
    beneficiaryName: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    transactionId?: string;
    notes?: string;
  }[];
}

// 10. Reserve Fund Statement
export interface ReserveFundStatement {
  currentBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  openingBalanceForPeriod: number;
  depositsInPeriod: number;
  withdrawalsInPeriod: number;
  closingBalanceForPeriod: number;
  ledgerEntries: {
    id: string;
    date: string;
    type: string;
    typeLabelBn: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reason: string;
    distributionMonth?: string;
    isRentalIncome: false;
  }[];
}

// 11. Monthly Net Operating Balance
export interface NetOperatingBalanceReport {
  month: string;
  actualRentalIncome: number;
  actualGasIncome: number;
  actualWaterIncome: number;
  totalCollectedIncome: number;
  buildingOperatingExpenses: number;
  familySocialExpenses: number;
  totalExpensesDeducted: number;
  operatingSurplusOrDeficit: number;
  reserveInflow: number;
  totalDisbursablePool: number;
  actualDisbursedToFamily: number;
  surplusTransferredToReserve: number;
  unallocatedClosingCash: number;
}

// 12. Budget vs Actual Expense Report
export interface BudgetVsActualReport {
  month: string;
  budgetTarget: number; // ৳60,000
  actualBuildingExpense: number;
  varianceAmount: number; // Budget - Actual
  variancePercentage: number;
  status: 'under_budget' | 'on_budget' | 'over_budget';
  categoryBreakdown: {
    category: ExpenseCategory;
    categoryLabelBn: string;
    categoryLabelEn: string;
    actualAmount: number;
    percentageOfActual: number;
  }[];
}
