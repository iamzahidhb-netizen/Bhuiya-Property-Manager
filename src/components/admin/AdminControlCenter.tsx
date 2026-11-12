import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  History,
  KeyRound,
  LayoutGrid,
  Pencil,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { Property, Unit } from '../../types/property';
import type { Tenant } from '../../types/tenant';
import type { Expense, RentBill, RentPayment, Beneficiary, ReserveLedgerEntry } from '../../types/finance';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAppNavigation } from '../../contexts/NavigationContext';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { archiveProperty, deleteProperty, deleteUnit, updateProperty, updateUnit, archiveUnit } from '../../services/propertyService';
import { updateTenant, vacateTenant } from '../../services/tenantService';
import { archiveBeneficiary, restoreBeneficiary, subscribeBeneficiaries, subscribeReserveLedger } from '../../services/distributionService';
import { subscribeAuditLogs, formatAuditTimestamp } from '../../services/auditService';
import type { AuditLogEntry } from '../../types/audit';
import { AUDIT_ENTITY_LABELS, AUDIT_OPERATION_LABELS } from '../../types/audit';
import { sumMoney } from '../../utils/money';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { StatusBadge } from '../ui/hyperos/StatusBadge';
import PropertyModal from '../properties/PropertyModal';
import UnitModal from '../properties/UnitModal';
import VacateModal from '../tenants/VacateModal';
import ExpenseModal from '../expenses/ExpenseModal';
import ExpenseDetailsModal from '../expenses/ExpenseDetailsModal';
import RecordPaymentModal from '../rent/RecordPaymentModal';
import RentReceiptModal from '../rent/RentReceiptModal';
import TenantHistoryModal from '../rent/TenantHistoryModal';
import { HisabPagination, HisabSearchInput } from '../accounts/HisabUI';
import { usePagination } from '../accounts/usePagination';
import { resolveActivityTimestamp } from '../accounts/dateHelpers';

export type ControlTab = 'data' | 'audit' | 'archive' | 'modules';

type EntityKind =
  | 'all'
  | 'property'
  | 'unit'
  | 'tenant'
  | 'rent_bill'
  | 'rent_payment'
  | 'expense'
  | 'beneficiary'
  | 'reserve_ledger';

interface ControlCenterProps {
  ownerUid: string;
  workspaceId: string;
  isMasterAdmin: boolean;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  bills: RentBill[];
  payments: RentPayment[];
  expenses: Expense[];
  onBack: () => void;
  onOpenPropertyManagement: () => void;
  onOpenTenantManagement: () => void;
  onOpenRentManagement: () => void;
  onOpenExpenseManagement: () => void;
  onOpenDistribution: () => void;
  onOpenReports: () => void;
  onOpenSettings: () => void;
  onOpenMembers: () => void;
  onOpenStorage: () => void;
  onCreateTenant: () => void;
}

interface DataRecord {
  key: string;
  entity: Exclude<EntityKind, 'all'>;
  id: string;
  title: string;
  subtitle: string;
  amount: number | null;
  status: string;
  date: string;
  propertyId: string | null;
  propertyName: string;
  raw: Property | Unit | Tenant | RentBill | RentPayment | Expense | Beneficiary | ReserveLedgerEntry;
}

const ENTITY_OPTIONS: { id: EntityKind; bn: string; en: string }[] = [
  { id: 'all', bn: 'সব রেকর্ড', en: 'All records' },
  { id: 'property', bn: 'প্রপার্টি', en: 'Properties' },
  { id: 'unit', bn: 'ইউনিট', en: 'Units' },
  { id: 'tenant', bn: 'ভাড়াটিয়া', en: 'Tenants' },
  { id: 'rent_bill', bn: 'ভাড়া বিল', en: 'Rent bills' },
  { id: 'rent_payment', bn: 'ভাড়া পেমেন্ট', en: 'Rent payments' },
  { id: 'expense', bn: 'খরচ', en: 'Expenses' },
  { id: 'beneficiary', bn: 'অংশীদার', en: 'Beneficiaries' },
  { id: 'reserve_ledger', bn: 'রিজার্ভ লেজার', en: 'Reserve ledger' },
];

const STATUS_LABELS: Record<string, { bn: string; en: string }> = {
  active: { bn: 'সক্রিয়', en: 'Active' },
  archived: { bn: 'আর্কাইভড', en: 'Archived' },
  vacated: { bn: 'প্রস্থানকৃত', en: 'Vacated' },
  vacant: { bn: 'খালি', en: 'Vacant' },
  occupied: { bn: 'ভাড়াকৃত', en: 'Occupied' },
  under_maintenance: { bn: 'মেরামতাধীন', en: 'Maintenance' },
  paid: { bn: 'পরিশোধিত', en: 'Paid' },
  partial: { bn: 'আংশিক', en: 'Partial' },
  unpaid: { bn: 'বকেয়া', en: 'Unpaid' },
  reversed: { bn: 'বাতিল', en: 'Reversed' },
  held: { bn: 'জমা', en: 'Held' },
  refunded: { bn: 'ফেরত', en: 'Refunded' },
  ledger: { bn: 'লেজার', en: 'Ledger' },
  success: { bn: 'সফল', en: 'Success' },
  failure: { bn: 'ব্যর্থ', en: 'Failed' },
};

function safeDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const millis = resolveActivityTimestamp(value);
  return millis ? new Date(millis).toISOString().slice(0, 10) : '';
}

export default function AdminControlCenter({
  ownerUid,
  workspaceId,
  isMasterAdmin,
  properties,
  units,
  tenants,
  bills,
  payments,
  expenses,
  onBack,
  onOpenPropertyManagement,
  onOpenTenantManagement,
  onOpenRentManagement,
  onOpenExpenseManagement,
  onOpenDistribution,
  onOpenReports,
  onOpenSettings,
  onOpenMembers,
  onOpenStorage,
  onCreateTenant,
}: ControlCenterProps) {
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const { registerBackGuard } = useAppNavigation();
  const isBn = currentLanguage === 'bn';
  const useBanglaNumerals = settings.languageRegion.useBanglaNumerals;

  const [tab, setTab] = useState<ControlTab>('data');
  const [entity, setEntity] = useState<EntityKind>('all');
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [reserveLedger, setReserveLedger] = useState<ReserveLedgerEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState('');

  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [unitToEdit, setUnitToEdit] = useState<Unit | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [expenseDetails, setExpenseDetails] = useState<Expense | null>(null);
  const [billForPayment, setBillForPayment] = useState<RentBill | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<RentPayment | null>(null);
  const [receiptBill, setReceiptBill] = useState<RentBill | null>(null);
  const [historyTenant, setHistoryTenant] = useState<Tenant | null>(null);
  const [tenantToVacate, setTenantToVacate] = useState<Tenant | null>(null);
  const [tenantToEdit, setTenantToEdit] = useState<Tenant | null>(null);
  const [tenantEditForm, setTenantEditForm] = useState({ name: '', mobile: '', nid: '', address: '', notes: '', moveInDate: '' });

  const anyModalOpen =
    propertyToEdit !== null ||
    unitToEdit !== null ||
    expenseToEdit !== null ||
    expenseDetails !== null ||
    billForPayment !== null ||
    receiptPayment !== null ||
    historyTenant !== null ||
    tenantToVacate !== null ||
    tenantToEdit !== null;

  useEffect(() => {
    if (!anyModalOpen) return;
    return registerBackGuard({
      id: 'admin-control-center-modals',
      isDirty: () => anyModalOpen,
      onBlocked: () => {
        setPropertyToEdit(null);
        setUnitToEdit(null);
        setExpenseToEdit(null);
        setExpenseDetails(null);
        setBillForPayment(null);
        setReceiptPayment(null);
        setReceiptBill(null);
        setHistoryTenant(null);
        setTenantToVacate(null);
        setTenantToEdit(null);
      },
    });
  }, [anyModalOpen, registerBackGuard]);

  useEffect(() => {
    if (!ownerUid) return;
    const unsubBeneficiaries = subscribeBeneficiaries(ownerUid, setBeneficiaries);
    const unsubLedger = subscribeReserveLedger(ownerUid, setReserveLedger);
    return () => {
      unsubBeneficiaries();
      unsubLedger();
    };
  }, [ownerUid]);

  useEffect(() => {
    if (!isMasterAdmin || !workspaceId) return;
    const unsubscribe = subscribeAuditLogs(
      workspaceId,
      (entries) => {
        setAuditLogs(entries);
        setAuditError(null);
      },
      (error) => setAuditError(error.message)
    );
    return unsubscribe;
  }, [isMasterAdmin, workspaceId]);

  const propertyById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const tenantById = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant])), [tenants]);
  const activeProperties = useMemo(() => properties.filter((property) => !property.isArchived), [properties]);

  const formatCount = (value: number) =>
    useBanglaNumerals && isBn ? value.toLocaleString('bn-BD') : value.toLocaleString('en-US');
  const statusLabel = (status: string) =>
    STATUS_LABELS[status] ? (isBn ? STATUS_LABELS[status].bn : STATUS_LABELS[status].en) : status;
  const formatDate = (value: string) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(isBn ? 'bn-BD' : 'en-GB', {
        dateStyle: 'medium',
        timeZone: 'Asia/Dhaka',
      }).format(new Date(`${value}T00:00:00+06:00`));
    } catch {
      return value;
    }
  };

  const allRecords = useMemo<DataRecord[]>(() => {
    const rows: DataRecord[] = [];
    properties.forEach((property) => {
      rows.push({
        key: `property:${property.id}`,
        entity: 'property',
        id: property.id,
        title: property.name,
        subtitle: property.address || (isBn ? 'প্রপার্টি' : 'Property'),
        amount: null,
        status: property.isArchived ? 'archived' : 'active',
        date: safeDate(property.createdAt),
        propertyId: property.id,
        propertyName: property.name,
        raw: property,
      });
    });
    units.forEach((unit) => {
      const property = propertyById.get(unit.propertyId);
      rows.push({
        key: `unit:${unit.id}`,
        entity: 'unit',
        id: unit.id,
        title: `${isBn ? 'ইউনিট' : 'Unit'} ${unit.unitNumber}`,
        subtitle: property?.name || '—',
        amount: unit.monthlyRent,
        status: unit.isArchived ? 'archived' : unit.status,
        date: safeDate(unit.createdAt),
        propertyId: unit.propertyId,
        propertyName: property?.name || '',
        raw: unit,
      });
    });
    tenants.forEach((tenant) => {
      const property = propertyById.get(tenant.propertyId);
      const unit = unitById.get(tenant.unitId);
      rows.push({
        key: `tenant:${tenant.id}`,
        entity: 'tenant',
        id: tenant.id,
        title: tenant.name,
        subtitle: `${property?.name || '—'} • ${unit?.unitNumber || '—'}`,
        amount: tenant.monthlyRent,
        status: tenant.status,
        date: safeDate(tenant.moveInDate),
        propertyId: tenant.propertyId,
        propertyName: property?.name || '',
        raw: tenant,
      });
    });
    bills.forEach((bill) => {
      rows.push({
        key: `rent_bill:${bill.id}`,
        entity: 'rent_bill',
        id: bill.id,
        title: bill.tenantName || tenantById.get(bill.tenantId)?.name || '—',
        subtitle: `${bill.propertyName || propertyById.get(bill.propertyId)?.name || '—'} • ${bill.unitNumber || '—'} • ${bill.billingMonth}`,
        amount: bill.balanceDue,
        status: bill.status,
        date: bill.dueDate || safeDate(bill.createdAt),
        propertyId: bill.propertyId,
        propertyName: bill.propertyName,
        raw: bill,
      });
    });
    payments.forEach((payment) => {
      rows.push({
        key: `rent_payment:${payment.id}`,
        entity: 'rent_payment',
        id: payment.id,
        title: payment.tenantName || tenantById.get(payment.tenantId)?.name || '—',
        subtitle: `${payment.receiptNumber || '—'} • ${payment.billingMonth}`,
        amount: payment.amount,
        status: payment.entryType,
        date: safeDate(payment.paymentDate || payment.createdAt),
        propertyId: payment.propertyId,
        propertyName: payment.propertyName,
        raw: payment,
      });
    });
    expenses.forEach((expense) => {
      rows.push({
        key: `expense:${expense.id}`,
        entity: 'expense',
        id: expense.id,
        title: expense.title,
        subtitle: `${expense.category} • ${expense.paymentMethod}`,
        amount: expense.amount,
        status: expense.status,
        date: expense.expenseDate,
        propertyId: expense.propertyId || null,
        propertyName: expense.propertyName || '',
        raw: expense,
      });
    });
    beneficiaries.forEach((beneficiary) => {
      rows.push({
        key: `beneficiary:${beneficiary.id}`,
        entity: 'beneficiary',
        id: beneficiary.id,
        title: beneficiary.name,
        subtitle: beneficiary.relationship,
        amount: beneficiary.defaultMonthlyTarget,
        status: beneficiary.isArchived ? 'archived' : 'active',
        date: safeDate(beneficiary.createdAt),
        propertyId: null,
        propertyName: '',
        raw: beneficiary,
      });
    });
    reserveLedger.forEach((entry) => {
      rows.push({
        key: `reserve_ledger:${entry.id}`,
        entity: 'reserve_ledger',
        id: entry.id,
        title: entry.type,
        subtitle: entry.reason || '—',
        amount: entry.amount,
        status: 'ledger',
        date: safeDate(entry.createdAt),
        propertyId: null,
        propertyName: '',
        raw: entry,
      });
    });
    return rows;
  }, [properties, units, tenants, bills, payments, expenses, beneficiaries, reserveLedger, propertyById, unitById, tenantById, isBn]);

  const entityRecords = useMemo(
    () => (entity === 'all' ? allRecords : allRecords.filter((record) => record.entity === entity)),
    [allRecords, entity]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(entityRecords.map((record) => record.status))).sort(),
    [entityRecords]
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entityRecords.filter((record) => {
      if (propertyFilter !== 'all' && record.propertyId !== propertyFilter) return false;
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (dateFrom && record.date && record.date < dateFrom) return false;
      if (dateTo && record.date && record.date > dateTo) return false;
      if (!query) return true;
      return (
        record.title.toLowerCase().includes(query) ||
        record.subtitle.toLowerCase().includes(query) ||
        record.id.toLowerCase().includes(query)
      );
    });
  }, [entityRecords, search, propertyFilter, statusFilter, dateFrom, dateTo]);

  const pagination = usePagination(
    filteredRecords,
    12,
    `${entity}|${search}|${propertyFilter}|${statusFilter}|${dateFrom}|${dateTo}`
  );

  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return auditLogs;
    return auditLogs.filter(
      (entry) =>
        entry.action.toLowerCase().includes(query) ||
        entry.entityType.toLowerCase().includes(query) ||
        entry.documentId.toLowerCase().includes(query) ||
        (entry.actorEmail || '').toLowerCase().includes(query)
    );
  }, [auditLogs, auditSearch]);

  const archivedRecords = useMemo(
    () =>
      allRecords.filter((record) => record.status === 'archived' || record.status === 'vacated'),
    [allRecords]
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 4500);
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setActionBusy(true);
    try {
      await action();
      showToast(successMessage);
      setSelectedRecord(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast((isBn ? 'ব্যর্থ: ' : 'Failed: ') + message);
    } finally {
      setActionBusy(false);
    }
  }

  function openTenantEdit(tenant: Tenant) {
    setTenantToEdit(tenant);
    setTenantEditForm({
      name: tenant.name,
      mobile: tenant.mobile,
      nid: tenant.nid || '',
      address: tenant.address || '',
      notes: tenant.notes || '',
      moveInDate: tenant.moveInDate || '',
    });
  }

  function handleRecordAction(record: DataRecord) {
    switch (record.entity) {
      case 'property': {
        const property = record.raw as Property;
        setPropertyToEdit(property);
        break;
      }
      case 'unit': {
        setUnitToEdit(record.raw as Unit);
        break;
      }
      case 'tenant': {
        const tenant = record.raw as Tenant;
        if (tenant.status === 'active') openTenantEdit(tenant);
        break;
      }
      case 'rent_bill': {
        const bill = record.raw as RentBill;
        if (bill.balanceDue > 0) setBillForPayment(bill);
        break;
      }
      case 'rent_payment': {
        const payment = record.raw as RentPayment;
        setReceiptPayment(payment);
        setReceiptBill(bills.find((bill) => bill.id === payment.billId) || null);
        break;
      }
      case 'expense': {
        const expense = record.raw as Expense;
        if (expense.status === 'active') setExpenseToEdit(expense);
        else setExpenseDetails(expense);
        break;
      }
      default:
        break;
    }
  }

  function detailFields(record: DataRecord): { label: string; value: string }[] {
    const raw = record.raw as unknown as Record<string, unknown>;
    const fields: { label: string; value: string }[] = [];
    const push = (label: string, value: unknown) => {
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'object') return;
      fields.push({ label, value: String(value) });
    };
    push(isBn ? 'আইডি' : 'ID', record.id);
    push(isBn ? 'ধরন' : 'Entity', record.entity);
    push(isBn ? 'অবস্থা' : 'Status', record.status);
    push(isBn ? 'প্রপার্টি' : 'Property', record.propertyName);
    push(isBn ? 'তারিখ' : 'Date', record.date);
    if (record.amount !== null) {
      fields.push({
        label: isBn ? 'পরিমাণ' : 'Amount',
        value: formatLocalizedCurrency(record.amount, currentLanguage, useBanglaNumerals),
      });
    }
    const extraKeys: Record<string, string[]> = {
      property: ['nameEn', 'code', 'type', 'totalFloors'],
      unit: ['unitNumber', 'type', 'floor', 'status'],
      tenant: ['mobile', 'nid', 'moveInDate', 'vacatingDate'],
      rent_bill: ['billingMonth', 'totalDue', 'totalPaid', 'balanceDue'],
      rent_payment: ['receiptNumber', 'paymentMethod', 'billingMonth'],
      expense: ['category', 'group', 'expenseDate', 'paidTo', 'reversalReason'],
      beneficiary: ['relationship', 'defaultMonthlyTarget', 'priorityOrder'],
      reserve_ledger: ['type', 'balanceBefore', 'balanceAfter', 'distributionMonth'],
    };
    (extraKeys[record.entity] || []).forEach((key) => push(key, raw[key]));
    return fields;
  }

  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen bg-[var(--hyper-bg-base)] px-4 py-10">
        <HyperCard className="mx-auto max-w-lg space-y-2 p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-[var(--hyper-red)]" />
          <h1 className="text-base font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'শুধুমাত্র মাস্টার এডমিনের জন্য' : 'Master Admin only'}
          </h1>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'এই নিয়ন্ত্রণ কেন্দ্রে প্রবেশের অনুমতি নেই।' : 'You do not have access to this control center.'}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mx-auto mt-2 min-h-10 rounded-xl bg-[var(--hyper-green)] px-4 py-2 text-xs font-bold text-white cursor-pointer"
          >
            {isBn ? 'ফিরে যান' : 'Go back'}
          </button>
        </HyperCard>
      </div>
    );
  }

  const totalRecords = allRecords.length;
  const activeTenantCount = tenants.filter((tenant) => tenant.status === 'active').length;
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const monthCollected = sumMoney(
    payments.filter(
      (payment) => payment.entryType === 'payment' && (payment.billingMonth || '').startsWith(monthPrefix)
    ),
    (payment) => payment.amount
  );
  const monthExpenses = sumMoney(
    expenses.filter(
      (expense) => expense.status === 'active' && (expense.billingMonth || expense.expenseDate || '').startsWith(monthPrefix)
    ),
    (expense) => expense.amount
  );

  return (
    <div className="min-h-screen bg-[var(--hyper-bg-base)] pb-[calc(env(safe-area-inset-bottom)+2rem)] text-[var(--hyper-text-primary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            aria-label={isBn ? 'ফিরে যান' : 'Back'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold sm:text-base">
              {isBn ? 'মাস্টার কন্ট্রোল সেন্টার' : 'Master Control Center'}
            </h1>
            <p className="truncate text-[11px] text-[var(--hyper-text-secondary)]">
              {isBn ? 'ডেটা, অডিট, আর্কাইভ ও মডিউল নিয়ন্ত্রণ' : 'Data, audit, archive and module control'}
            </p>
          </div>
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[var(--hyper-green-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--hyper-green)] sm:flex">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {isBn ? 'মাস্টার এডমিন' : 'Master Admin'}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-3 px-3 py-3 sm:px-6 sm:py-5">
        {toast && (
          <div className="rounded-2xl border border-[var(--hyper-green)]/25 bg-[var(--hyper-green-bg)] p-3 text-xs font-semibold" role="status">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <HyperCard className="p-3">
            <span className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
              {isBn ? 'মোট রেকর্ড' : 'Total records'}
            </span>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums">{formatCount(totalRecords)}</p>
          </HyperCard>
          <HyperCard className="p-3">
            <span className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
              {isBn ? 'সক্রিয় ভাড়াটিয়া' : 'Active tenants'}
            </span>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#1E9E42] dark:text-[#4ADE80]">{formatCount(activeTenantCount)}</p>
          </HyperCard>
          <HyperCard className="p-3">
            <span className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
              {isBn ? 'এ মাসে আদায়' : 'Collected this month'}
            </span>
            <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#1E9E42] dark:text-[#4ADE80]">
              {formatLocalizedCurrency(monthCollected, currentLanguage, useBanglaNumerals)}
            </p>
          </HyperCard>
          <HyperCard className="p-3">
            <span className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
              {isBn ? 'এ মাসে খরচ' : 'Expenses this month'}
            </span>
            <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#C26A0E] dark:text-[#FBBF24]">
              {formatLocalizedCurrency(monthExpenses, currentLanguage, useBanglaNumerals)}
            </p>
          </HyperCard>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[var(--hyper-border)] bg-[var(--hyper-bg-card)] p-1 shadow-sm" role="tablist" aria-label={isBn ? 'কন্ট্রোল সেন্টার ট্যাব' : 'Control center tabs'}>
          {[
            { id: 'data' as ControlTab, label: isBn ? 'ডেটা' : 'Data', icon: Database },
            { id: 'audit' as ControlTab, label: isBn ? 'অডিট' : 'Audit', icon: History },
            { id: 'archive' as ControlTab, label: isBn ? 'আর্কাইভ' : 'Archive', icon: Archive },
            { id: 'modules' as ControlTab, label: isBn ? 'মডিউল' : 'Modules', icon: LayoutGrid },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-1.5 text-[11px] font-bold transition-colors cursor-pointer sm:gap-1.5 sm:text-xs ${
                  active ? 'bg-[var(--hyper-green)] text-white shadow-sm' : 'text-[var(--hyper-text-secondary)] hover:bg-[var(--hyper-bg-card-hover)]'
                }`}
              >
                <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'data' && (
          <div className="space-y-3">
            <HyperCard className="space-y-2.5 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={entity}
                  onChange={(event) => {
                    setEntity(event.target.value as EntityKind);
                    setStatusFilter('all');
                  }}
                  aria-label={isBn ? 'রেকর্ডের ধরন' : 'Entity type'}
                  className="hyper-input-field min-h-10 w-full py-2 pl-3 pr-8 text-xs font-semibold"
                >
                  {ENTITY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {isBn ? option.bn : option.en}
                    </option>
                  ))}
                </select>
                <select
                  value={propertyFilter}
                  onChange={(event) => setPropertyFilter(event.target.value)}
                  aria-label={isBn ? 'প্রপার্টি ফিল্টার' : 'Property filter'}
                  className="hyper-input-field min-h-10 w-full py-2 pl-3 pr-8 text-xs font-semibold"
                >
                  <option value="all">{isBn ? 'সকল প্রপার্টি' : 'All properties'}</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label={isBn ? 'স্ট্যাটাস ফিল্টার' : 'Status filter'}
                  className="hyper-input-field min-h-10 w-full py-2 pl-3 pr-8 text-xs font-semibold"
                >
                  <option value="all">{isBn ? 'সকল স্ট্যাটাস' : 'All statuses'}</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="sr-only" htmlFor="control-date-from">{isBn ? 'শুরুর তারিখ' : 'From date'}</label>
                  <input
                    id="control-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="hyper-input-field min-h-10 w-full px-2 text-[11px] font-semibold"
                  />
                  <label className="sr-only" htmlFor="control-date-to">{isBn ? 'শেষ তারিখ' : 'To date'}</label>
                  <input
                    id="control-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="hyper-input-field min-h-10 w-full px-2 text-[11px] font-semibold"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <HisabSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={isBn ? 'নাম, আইডি বা বিবরণ খুঁজুন' : 'Search name, ID or details'}
                  label={isBn ? 'রেকর্ড খুঁজুন' : 'Search records'}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPropertyFilter('all');
                    setStatusFilter('all');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-3 text-[11px] font-bold cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {isBn ? 'রিসেট' : 'Reset'}
                </button>
              </div>
            </HyperCard>

            <HyperCard className="p-0">
              <div className="flex items-center justify-between border-b border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
                <span className="text-xs font-bold">
                  {isBn ? 'রেকর্ড তালিকা' : 'Records'} • {formatCount(filteredRecords.length)}
                </span>
                <span className="text-[11px] text-[var(--hyper-text-secondary)]">
                  {isBn ? 'মোট' : 'Total'} {formatCount(entityRecords.length)}
                </span>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Search className="mx-auto h-6 w-6 text-[var(--hyper-text-tertiary)]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-bold">{isBn ? 'কোনো রেকর্ড মেলেনি' : 'No records found'}</p>
                  <p className="text-xs text-[var(--hyper-text-secondary)]">
                    {isBn ? 'ফিল্টার বা সার্চ পরিবর্তন করুন।' : 'Change the filters or search.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--hyper-border-subtle)]">
                  {pagination.pageItems.map((record) => (
                    <li key={record.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--hyper-green-bg)] text-[var(--hyper-green)]">
                          {record.entity === 'expense' ? (
                            <ReceiptText className="h-4 w-4" aria-hidden="true" />
                          ) : record.entity === 'tenant' ? (
                            <Users className="h-4 w-4" aria-hidden="true" />
                          ) : record.entity === 'unit' || record.entity === 'property' ? (
                            <Building2 className="h-4 w-4" aria-hidden="true" />
                          ) : record.entity === 'rent_payment' ? (
                            <Wallet className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{record.title}</span>
                          <span className="block truncate text-[11px] text-[var(--hyper-text-secondary)]">
                            {record.subtitle} • {formatDate(record.date)}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          {record.amount !== null && (
                            <span className="font-mono text-[11px] font-bold tabular-nums">
                              {formatLocalizedCurrency(record.amount, currentLanguage, useBanglaNumerals)}
                            </span>
                          )}
                          <StatusBadge
                            tone={
                              record.status === 'archived' || record.status === 'reversed' || record.status === 'vacated'
                                ? 'neutral'
                                : record.status === 'unpaid'
                                ? 'danger'
                                : record.status === 'partial'
                                ? 'warning'
                                : 'success'
                            }
                          >
                            {statusLabel(record.status)}
                          </StatusBadge>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hyper-text-tertiary)]" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
                <HisabPagination
                  page={pagination.page}
                  pageCount={pagination.pageCount}
                  total={pagination.total}
                  rangeStart={pagination.rangeStart}
                  rangeEnd={pagination.rangeEnd}
                  canPrev={pagination.canPrev}
                  canNext={pagination.canNext}
                  onPrev={pagination.goPrev}
                  onNext={pagination.goNext}
                  labels={{
                    page: t('hisab.module.page'),
                    of: t('hisab.module.of'),
                    prev: t('hisab.module.prevPage'),
                    next: t('hisab.module.nextPage'),
                    showing: t('hisab.module.showing'),
                    items: t('hisab.module.items'),
                    total: t('hisab.module.total'),
                  }}
                />
              </div>
            </HyperCard>
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-3">
            <HyperCard className="space-y-2.5 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--hyper-green)]" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-[11px] text-[var(--hyper-text-secondary)]">
                  {isBn
                    ? 'প্রতিটি প্রশাসনিক পরিবর্তন অপরিবর্তনীয় অডিট ট্রেইলে স্বয়ংক্রিয়ভাবে রেকর্ড হয়।'
                    : 'Every administrative mutation is recorded in the immutable audit trail.'}
                </p>
              </div>
              <HisabSearchInput
                value={auditSearch}
                onChange={setAuditSearch}
                placeholder={isBn ? 'অ্যাকশন, এন্টিটি বা ডকুমেন্ট খুঁজুন' : 'Search action, entity or document'}
                label={isBn ? 'অডিট খুঁজুন' : 'Search audit'}
              />
              {auditError && (
                <p className="rounded-xl bg-[var(--hyper-red-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--hyper-red)]">
                  {isBn ? 'অডিট লগ পড়া যায়নি: ' : 'Could not read audit logs: '}
                  {auditError}
                </p>
              )}
            </HyperCard>

            <HyperCard className="p-0">
              <div className="flex items-center justify-between border-b border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
                <span className="text-xs font-bold">{isBn ? 'অডিট এন্ট্রি' : 'Audit entries'}</span>
                <span className="text-[11px] text-[var(--hyper-text-secondary)]">{formatCount(filteredAudit.length)}</span>
              </div>
              {filteredAudit.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-[var(--hyper-text-secondary)]">
                  {isBn ? 'এখনো কোনো অডিট এন্ট্রি নেই।' : 'No audit entries yet.'}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--hyper-border-subtle)]">
                  {filteredAudit.slice(0, 100).map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          entry.status === 'success'
                            ? 'bg-[var(--hyper-green-bg)] text-[var(--hyper-green)]'
                            : 'bg-[var(--hyper-red-bg)] text-[var(--hyper-red)]'
                        }`}
                      >
                        {entry.status === 'success' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">
                          {isBn
                            ? AUDIT_OPERATION_LABELS[entry.operation]?.bn || entry.operation
                            : AUDIT_OPERATION_LABELS[entry.operation]?.en || entry.operation}
                          {' • '}
                          {isBn
                            ? AUDIT_ENTITY_LABELS[entry.entityType]?.bn || entry.entityType
                            : AUDIT_ENTITY_LABELS[entry.entityType]?.en || entry.entityType}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--hyper-text-secondary)]">
                          {entry.documentId || '—'} • {entry.actorEmail || entry.actorUid}
                        </span>
                        <span className="block text-[10px] text-[var(--hyper-text-tertiary)]">
                          {formatAuditTimestamp(entry.createdAt, isBn ? 'bn' : 'en')}
                          {entry.errorCode ? ` • ${entry.errorCode}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </HyperCard>
          </div>
        )}

        {tab === 'archive' && (
          <div className="space-y-3">
            <HyperCard className="p-3">
              <p className="text-[11px] text-[var(--hyper-text-secondary)]">
                {isBn
                  ? 'আর্কাইভড ও প্রস্থানকৃত রেকর্ড কখনো হারিয়ে যায় না। নিচ থেকে পুনরুদ্ধার করা যায়।'
                  : 'Archived and vacated records are never destroyed. Restore them below.'}
              </p>
            </HyperCard>
            <HyperCard className="p-0">
              <div className="border-b border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
                <span className="text-xs font-bold">
                  {isBn ? 'আর্কাইভড / প্রস্থানকৃত' : 'Archived / vacated'} • {formatCount(archivedRecords.length)}
                </span>
              </div>
              {archivedRecords.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-[var(--hyper-text-secondary)]">
                  {isBn ? 'কোনো আর্কাইভড রেকর্ড নেই।' : 'No archived records.'}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--hyper-border-subtle)]">
                  {archivedRecords.map((record) => (
                    <li key={record.key} className="flex items-center gap-2 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{record.title}</span>
                        <span className="block truncate text-[11px] text-[var(--hyper-text-secondary)]">
                          {record.subtitle} • {statusLabel(record.status)}
                        </span>
                      </span>
                {(record.entity === 'property' || record.entity === 'unit' || record.entity === 'beneficiary') && (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            runAction(async () => {
                    if (record.entity === 'beneficiary') {
                      await restoreBeneficiary(record.id);
                    } else if (record.entity === 'property') {
                                await archiveProperty(record.id, false);
                              } else {
                                await archiveUnit(record.id, false, record.propertyId || undefined);
                              }
                            }, isBn ? 'রেকর্ড পুনরুদ্ধার হয়েছে।' : 'Record restored.')
                          }
                          className="flex min-h-9 items-center gap-1 rounded-lg bg-[var(--hyper-green)] px-2.5 text-[11px] font-bold text-white disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          {isBn ? 'পুনরুদ্ধার' : 'Restore'}
                        </button>
                      )}
                      {record.entity === 'tenant' && (
                        <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold text-[var(--hyper-text-secondary)] dark:bg-white/10">
                          {isBn ? 'ইতিহাস সংরক্ষিত' : 'History kept'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </HyperCard>
          </div>
        )}

        {tab === 'modules' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { icon: Building2, label: isBn ? 'প্রপার্টি ও ইউনিট' : 'Properties & units', onClick: onOpenPropertyManagement },
              { icon: Users, label: isBn ? 'ভাড়াটিয়া' : 'Tenants', onClick: onOpenTenantManagement },
              { icon: UserPlus, label: isBn ? 'নতুন ভাড়াটিয়া' : 'New tenant', onClick: onCreateTenant },
              { icon: ReceiptText, label: isBn ? 'ভাড়া ও বিল' : 'Rent & bills', onClick: onOpenRentManagement },
              { icon: Wallet, label: isBn ? 'খরচ' : 'Expenses', onClick: onOpenExpenseManagement },
              { icon: BarChart3, label: isBn ? 'বণ্টন ও রিজার্ভ' : 'Distribution & reserve', onClick: onOpenDistribution },
              { icon: FileText, label: isBn ? 'রিপোর্ট' : 'Reports', onClick: onOpenReports },
              { icon: KeyRound, label: isBn ? 'সদস্য ও অ্যাক্সেস' : 'Members & access', onClick: onOpenMembers },
              { icon: Settings2, label: isBn ? 'অ্যাপ সেটিংস' : 'App settings', onClick: onOpenSettings },
              { icon: Database, label: isBn ? 'ফাইল ও স্টোরেজ' : 'Files & storage', onClick: onOpenStorage },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex min-h-20 flex-col items-start justify-between gap-2 rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)] p-3 text-left shadow-sm transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hyper-green-bg)] text-[var(--hyper-green)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className="px-1 text-[10px] text-[var(--hyper-text-tertiary)]">
          {isBn
            ? 'নিরাপত্তা: সব পরিবর্তন সার্ভার-সাইড অনুমোদনের মধ্য দিয়ে যায় এবং অডিট লগে সংরক্ষিত হয়।'
            : 'Security: every mutation is server-authorized and written to the audit log.'}
        </p>
      </main>

      {/* Record detail sheet */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-[var(--hyper-border)] bg-[var(--hyper-bg-modal)] p-4 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--hyper-green)]">
                  {ENTITY_OPTIONS.find((option) => option.id === selectedRecord.entity)?.[isBn ? 'bn' : 'en']}
                </p>
                <h2 className="truncate text-sm font-bold">{selectedRecord.title}</h2>
                <p className="truncate text-[11px] text-[var(--hyper-text-secondary)]">{selectedRecord.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 cursor-pointer dark:bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {detailFields(selectedRecord).map((field) => (
                <div key={field.label} className="min-w-0 rounded-xl bg-[var(--hyper-bg-card-subtle)] p-2.5">
                  <span className="block truncate text-[10px] text-[var(--hyper-text-secondary)]">{field.label}</span>
                  <span className="block break-words text-[11px] font-semibold">{field.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedRecord.entity === 'tenant' && (selectedRecord.raw as Tenant).status === 'active' && (
                <button
                  type="button"
                  onClick={() => {
                    setTenantToVacate(selectedRecord.raw as Tenant);
                    setSelectedRecord(null);
                  }}
                  className="min-h-10 rounded-xl bg-[var(--hyper-orange-bg)] px-3 text-[11px] font-bold text-[var(--hyper-text-primary)] cursor-pointer"
                >
                  {isBn ? 'প্রস্থান করান' : 'Vacate tenant'}
                </button>
              )}
              {selectedRecord.entity === 'tenant' && (
                <button
                  type="button"
                  onClick={() => setHistoryTenant(selectedRecord.raw as Tenant)}
                  className="min-h-10 rounded-xl border border-[var(--hyper-border-subtle)] px-3 text-[11px] font-bold cursor-pointer"
                >
                  {isBn ? 'রশিদ ও ইতিহাস' : 'Receipts & history'}
                </button>
              )}
              {selectedRecord.entity === 'expense' && (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseDetails(selectedRecord.raw as Expense);
                    setSelectedRecord(null);
                  }}
                  className="min-h-10 rounded-xl border border-[var(--hyper-border-subtle)] px-3 text-[11px] font-bold cursor-pointer"
                >
                  {isBn ? 'অডিট ও বিবরণ' : 'Audit & details'}
                </button>
              )}
              {['property', 'unit', 'tenant', 'expense'].includes(selectedRecord.entity) &&
                !(
                  selectedRecord.entity === 'tenant' &&
                  (selectedRecord.raw as Tenant).status !== 'active'
                ) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleRecordAction(selectedRecord);
                      setSelectedRecord(null);
                    }}
                    className="flex min-h-10 items-center gap-1 rounded-xl bg-[var(--hyper-green)] px-3 text-[11px] font-bold text-white cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    {isBn ? 'সংশোধন' : 'Edit'}
                  </button>
                )}
                {(selectedRecord.entity === 'property' || selectedRecord.entity === 'unit' || selectedRecord.entity === 'beneficiary') && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    runAction(async () => {
                    if (selectedRecord.entity === 'beneficiary') {
                      await archiveBeneficiary(selectedRecord.id);
                    } else if (selectedRecord.entity === 'property') {
                        await archiveProperty(selectedRecord.id, true);
                      } else {
                        await archiveUnit(selectedRecord.id, true, selectedRecord.propertyId || undefined);
                      }
                    }, isBn ? 'আর্কাইভ করা হয়েছে।' : 'Archived.')
                  }
                  className="min-h-10 rounded-xl border border-[var(--hyper-border-subtle)] px-3 text-[11px] font-bold cursor-pointer"
                >
                  {isBn ? 'আর্কাইভ' : 'Archive'}
                </button>
              )}
              {selectedRecord.entity === 'property' && (selectedRecord.raw as Property).isArchived && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    runAction(async () => {
                      if (!window.confirm(isBn ? 'এই প্রপার্টি স্থায়ীভাবে মুছে ফেলবেন? এটি শুধু খালি প্রপার্টির জন্য প্রযোজ্য।' : 'Permanently delete this empty property?')) return;
                      await deleteProperty(selectedRecord.id);
                    }, isBn ? 'প্রপার্টি মুছে ফেলা হয়েছে।' : 'Property deleted.')
                  }
                  className="flex min-h-10 items-center gap-1 rounded-xl bg-[var(--hyper-red-bg)] px-3 text-[11px] font-bold text-[var(--hyper-red)] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {isBn ? 'মুছুন' : 'Delete'}
                </button>
              )}
              {selectedRecord.entity === 'unit' && (selectedRecord.raw as Unit).isArchived && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    runAction(async () => {
                      if (!window.confirm(isBn ? 'এই ইউনিট স্থায়ীভাবে মুছে ফেলবেন?' : 'Permanently delete this unit?')) return;
                      await deleteUnit(selectedRecord.id, selectedRecord.propertyId || undefined);
                    }, isBn ? 'ইউনিট মুছে ফেলা হয়েছে।' : 'Unit deleted.')
                  }
                  className="flex min-h-10 items-center gap-1 rounded-xl bg-[var(--hyper-red-bg)] px-3 text-[11px] font-bold text-[var(--hyper-red)] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {isBn ? 'মুছুন' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tenant profile edit sheet */}
      {tenantToEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runAction(async () => {
                await updateTenant({
                  tenantId: tenantToEdit.id,
                  name: tenantEditForm.name,
                  mobile: tenantEditForm.mobile,
                  nid: tenantEditForm.nid,
                  address: tenantEditForm.address,
                  notes: tenantEditForm.notes,
                  moveInDate: tenantEditForm.moveInDate,
                });
                setTenantToEdit(null);
              }, isBn ? 'ভাড়াটিয়ার তথ্য সংরক্ষণ হয়েছে।' : 'Tenant updated.');
            }}
            className="max-h-[90dvh] w-full max-w-lg space-y-2.5 overflow-y-auto rounded-t-[28px] border border-[var(--hyper-border)] bg-[var(--hyper-bg-modal)] p-4 shadow-2xl sm:rounded-[28px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{isBn ? 'ভাড়াটিয়ার তথ্য সংশোধন' : 'Edit tenant profile'}</h2>
              <button type="button" onClick={() => setTenantToEdit(null)} aria-label={isBn ? 'বন্ধ' : 'Close'} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 cursor-pointer dark:bg-white/10">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {[
              { key: 'name' as const, label: isBn ? 'নাম' : 'Name' },
              { key: 'mobile' as const, label: isBn ? 'মোবাইল' : 'Mobile' },
              { key: 'nid' as const, label: isBn ? 'এনআইডি' : 'NID' },
              { key: 'address' as const, label: isBn ? 'ঠিকানা' : 'Address' },
              { key: 'moveInDate' as const, label: isBn ? 'প্রবেশের তারিখ' : 'Move-in date' },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--hyper-text-secondary)]">{field.label}</span>
                <input
                  type={field.key === 'moveInDate' ? 'date' : 'text'}
                  value={tenantEditForm[field.key]}
                  onChange={(event) => setTenantEditForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  required={field.key === 'name' || field.key === 'mobile'}
                  className="hyper-input-field min-h-10 w-full px-3 text-xs font-semibold"
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-[var(--hyper-text-secondary)]">{isBn ? 'নোট' : 'Notes'}</span>
              <textarea
                value={tenantEditForm.notes}
                onChange={(event) => setTenantEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={2}
                className="hyper-input-field w-full px-3 py-2 text-xs font-semibold"
              />
            </label>
            <button
              type="submit"
              disabled={actionBusy}
              className="min-h-11 w-full rounded-xl bg-[var(--hyper-green)] text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
            >
              {isBn ? 'সংরক্ষণ করুন' : 'Save changes'}
            </button>
          </form>
        </div>
      )}

      {/* Existing module forms */}
      <PropertyModal
        isOpen={propertyToEdit !== null}
        onClose={() => setPropertyToEdit(null)}
        onSave={async (data) => {
          if (!propertyToEdit) return;
          await updateProperty(propertyToEdit.id, data);
          setPropertyToEdit(null);
          showToast(isBn ? 'প্রপার্টি সংরক্ষণ হয়েছে।' : 'Property updated.');
        }}
        propertyToEdit={propertyToEdit}
        ownerUid={ownerUid}
      />

      <UnitModal
        isOpen={unitToEdit !== null}
        onClose={() => setUnitToEdit(null)}
        onSave={async (data) => {
          if (!unitToEdit) return;
          await updateUnit(unitToEdit.id, data);
          setUnitToEdit(null);
          showToast(isBn ? 'ইউনিট সংরক্ষণ হয়েছে।' : 'Unit updated.');
        }}
        unitToEdit={unitToEdit}
        propertyId={unitToEdit?.propertyId || activeProperties[0]?.id || ''}
        propertyName={propertyById.get(unitToEdit?.propertyId || '')?.name || ''}
        ownerUid={ownerUid}
        existingUnits={units.filter((unit) => unit.propertyId === unitToEdit?.propertyId)}
      />

      <ExpenseModal
        key={expenseToEdit?.id || 'control-expense'}
        isOpen={expenseToEdit !== null}
        onClose={() => setExpenseToEdit(null)}
        properties={activeProperties}
        initialExpense={expenseToEdit}
        defaultMonth={expenseToEdit?.billingMonth || monthPrefix}
        onSuccess={() => {
          setExpenseToEdit(null);
          showToast(isBn ? 'খরচ সংরক্ষণ হয়েছে।' : 'Expense saved.');
        }}
      />

      <ExpenseDetailsModal
        isOpen={expenseDetails !== null}
        onClose={() => setExpenseDetails(null)}
        expense={expenseDetails}
        onEdit={(expense) => {
          setExpenseDetails(null);
          setExpenseToEdit(expense);
        }}
        onReversed={() => showToast(isBn ? 'খরচ বাতিল (reversed) হয়েছে।' : 'Expense reversed.')}
      />

      <RecordPaymentModal
        isOpen={billForPayment !== null}
        onClose={() => setBillForPayment(null)}
        bill={billForPayment}
        onSuccess={() => {
          setBillForPayment(null);
          showToast(isBn ? 'পেমেন্ট রেকর্ড হয়েছে।' : 'Payment recorded.');
        }}
      />

      <RentReceiptModal
        isOpen={receiptPayment !== null}
        onClose={() => {
          setReceiptPayment(null);
          setReceiptBill(null);
        }}
        payment={receiptPayment}
        bill={receiptBill}
      />

      <TenantHistoryModal
        isOpen={historyTenant !== null}
        onClose={() => setHistoryTenant(null)}
        tenant={historyTenant}
        ownerUid={ownerUid}
        onSelectReceipt={(payment, bill) => {
          setReceiptPayment(payment);
          setReceiptBill(bill);
        }}
      />

      {tenantToVacate && (
        <VacateModal
          isOpen
          onClose={() => setTenantToVacate(null)}
          tenant={tenantToVacate}
          propertyName={propertyById.get(tenantToVacate.propertyId)?.name || ''}
          unitNumber={unitById.get(tenantToVacate.unitId)?.unitNumber || ''}
          onVacate={async (data) => {
            await vacateTenant(data);
            setTenantToVacate(null);
            showToast(isBn ? 'ভাড়াটিয়া প্রস্থান সম্পন্ন হয়েছে।' : 'Tenant vacated.');
          }}
        />
      )}
    </div>
  );
}


