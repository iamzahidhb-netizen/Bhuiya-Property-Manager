import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Tenant } from '../../types/tenant';
import type { RentBill, PaymentMethod } from '../../types/finance';
import { recordRentPayment } from '../../services/rentService';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAppNavigation } from '../../contexts/NavigationContext';
import { SyncStatusBar } from '../ui/SyncStatusBar';
import { getAllItems, STORES } from '../../lib/offlineDb';
import { FrostedGlassSelect, type FrostedGlassOption } from '../ui/hyperos';
import { StorageFileUpload } from '../storage/StorageFileUpload';
import {
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
  User,
  Phone,
  Banknote,
  Wallet,
} from 'lucide-react';

const PAYMENT_METHOD_OPTIONS: FrostedGlassOption<PaymentMethod>[] = [
  {
    value: 'cash',
    labelBn: 'নগদ',
    labelEn: 'Cash',
    descriptionBn: 'সরাসরি নগদ অর্থ গ্রহণ',
    descriptionEn: 'Direct physical cash payment',
    icon: Banknote,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-[#22B84A]',
  },
  {
    value: 'bkash',
    labelBn: 'বিকাশ (bKash)',
    labelEn: 'bKash',
    descriptionBn: 'মোবাইল ফিন্যান্সিয়াল সার্ভিস',
    descriptionEn: 'bKash digital wallet transfer',
    icon: Wallet,
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-600',
  },
  {
    value: 'nagad',
    labelBn: 'নগদ (Nagad)',
    labelEn: 'Nagad',
    descriptionBn: 'ডাক বিভাগীয় ডিজিটাল ওয়ালেট',
    descriptionEn: 'Nagad digital wallet transfer',
    icon: Wallet,
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-600',
  },
  {
    value: 'bank',
    labelBn: 'ব্যাংক ট্রান্সফার',
    labelEn: 'Bank Transfer',
    descriptionBn: 'ব্যাংক একাউন্ট অথবা চেক ডিপোজিট',
    descriptionEn: 'Bank wire or deposited check',
    icon: CreditCard,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-[#1685E8]',
  },
  {
    value: 'other',
    labelBn: 'অন্যান্য মাধ্যম',
    labelEn: 'Other Method',
    descriptionBn: 'অন্য যেকোনো পরিশোধ পদ্ধতি',
    descriptionEn: 'Any other payment method',
    icon: CreditCard,
    iconBg: 'bg-slate-500/15',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
];

export interface RentDepositPageProps {
  tenants: Tenant[];
  bills: RentBill[];
  preSelectedTenantId?: string | null;
  onBack: () => void;
  onSuccess?: () => void;
  className?: string;
}

function makeTimestampId(prefix: string): string {
  const ts = new Date().getTime();
  return `${prefix}_${ts}`;
}

export const RentDepositPage: React.FC<RentDepositPageProps> = ({
  tenants,
  bills,
  preSelectedTenantId,
  onBack,
  onSuccess,
  className = '',
}) => {
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const { goBack, forceBack, registerBackGuard } = useAppNavigation();
  const useBanglaNumerals = settings.languageRegion.useBanglaNumerals;
  const isBn = currentLanguage === 'bn';

  const [cachedTenants, setCachedTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    if (tenants.length > 0) return;

    let isMounted = true;
    const loadCachedTenants = async () => {
      await Promise.resolve();
      try {
        const cached = await getAllItems<Tenant>(STORES.TENANTS);
        if (isMounted && cached.length > 0) setCachedTenants(cached);
      } catch (err) {
        console.error('Error loading cached tenants:', err);
      }
    };

    void loadCachedTenants();
    return () => {
      isMounted = false;
    };
  }, [tenants.length]);

  const localTenants = tenants.length > 0 ? tenants : cachedTenants;

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<number | '' | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    receiptNumber: string;
    amount: number;
    tenantName: string;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    isOffline?: boolean;
  } | null>(null);

  // Active tenant derived from selection or props
  const effectiveTenantId =
    selectedTenantId || preSelectedTenantId || (localTenants.length > 0 ? localTenants[0].id : '');
  const currentTenant = localTenants.find((item) => item.id === effectiveTenantId) || null;

  // Active bill for the tenant
  const currentBill = currentTenant
    ? bills.find((b) => b.tenantId === currentTenant.id && b.status !== 'paid') ||
      bills.find((b) => b.tenantId === currentTenant.id) ||
      null
    : null;

  // Amount defaults to bill balance or monthly rent
  const defaultAmount = currentBill
    ? currentBill.balanceDue > 0
      ? currentBill.balanceDue
      : currentBill.totalDue
    : currentTenant?.monthlyRent || 0;

  const tenantOptions: FrostedGlassOption<string>[] = useMemo(() => {
    return tenants.map((item) => ({
      value: item.id,
      labelBn: item.name,
      labelEn: item.name,
      descriptionBn: `মাসিক ভাড়া: ${formatLocalizedCurrency(item.monthlyRent, currentLanguage, useBanglaNumerals)}`,
      descriptionEn: `Monthly Rent: ${formatLocalizedCurrency(item.monthlyRent, currentLanguage, useBanglaNumerals)}`,
      icon: User,
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-[#22B84A]',
    }));
  }, [tenants, currentLanguage, useBanglaNumerals]);

  const displayAmount = customAmount !== null ? customAmount : defaultAmount;

  // Unsaved changes detection
  const isDirty =
    !successInfo &&
    (customAmount !== null ||
      notes.trim().length > 0 ||
      (selectedTenantId !== '' &&
        selectedTenantId !== (preSelectedTenantId || (tenants[0]?.id ?? ''))));

  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Register unified browser back guard (protects Android hardware back & swipe gestures)
  useEffect(() => {
    return registerBackGuard({
      id: 'rent-deposit-guard',
      isDirty: () => isDirtyRef.current,
      onBlocked: () => {
        setShowDiscardConfirm(true);
      },
    });
  }, [registerBackGuard]);

  const handleBackRequest = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      goBack();
    }
  };

  const handleResetForm = () => {
    setSelectedTenantId('');
    setCustomAmount(null);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('cash');
    setNotes('');
    setError(null);
    setSuccessInfo(null);
    setShowDiscardConfirm(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = Number(displayAmount);
    if (!numAmount || numAmount <= 0) {
      setError(
        isBn
          ? 'সঠিক টাকার পরিমাণ লিখুন (০ অপেক্ষা বেশি হতে হবে)।'
          : 'Please enter a valid amount greater than 0.'
      );
      return;
    }

    if (!effectiveTenantId) {
      setError(
        isBn
          ? 'অনুগ্রহ করে একজন ভাড়াটিয়া নির্বাচন করুন।'
          : 'Please select a tenant.'
      );
      return;
    }

    const targetBillId = currentBill?.id || makeTimestampId(`bill_auto_${effectiveTenantId}`);

    setLoading(true);
    try {
      const res = await recordRentPayment({
        billId: targetBillId,
        amount: numAmount,
        paymentMethod,
        paymentDate,
        notes: notes.trim() || undefined,
      });

      setSuccessInfo({
        receiptNumber: res.receiptNumber || `RCP-${makeTimestampId('').slice(-6)}`,
        amount: numAmount,
        tenantName: currentTenant?.name || (isBn ? 'ভাড়াটিয়া' : 'Tenant'),
        paymentMethod,
        paymentDate,
      });
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[RentDepositPage] Submit error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : isBn
          ? 'ভাড়া জমা করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
          : 'Failed to record rent payment.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return isBn ? 'নগদ (Cash)' : 'Cash';
      case 'bkash':
        return isBn ? 'বিকাশ (bKash)' : 'bKash';
      case 'nagad':
        return isBn ? 'নগদ (Nagad)' : 'Nagad';
      case 'bank':
        return isBn ? 'ব্যাংক (Bank Transfer)' : 'Bank Transfer';
      case 'other':
      default:
        return isBn ? 'অন্যান্য (Other)' : 'Other';
    }
  };

  return (
    <div
      className={`operations-view min-h-screen bg-[var(--hyper-bg-base)] text-[var(--hyper-text-primary)] antialiased transition-colors duration-200 flex flex-col pb-32 pb-[calc(env(safe-area-inset-bottom)+7rem)] ${className}`}
      data-testid="rent-deposit-fullpage"
    >
      {/* ===================================================================== */}
      {/* Top Header: HyperOS Glass Bar with Back Navigation                    */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-30 hyper-glass-nav border-b border-[var(--hyper-border-subtle)] px-3.5 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.6rem)] pb-2.5">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleBackRequest}
              aria-label={t('common.back') || 'Back'}
              className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[var(--hyper-text-primary)] transition-colors cursor-pointer select-none shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-[var(--hyper-text-primary)] leading-tight">
                {isBn ? 'ভাড়া জমা (Payment Receipt)' : 'Rent Deposit (Payment Receipt)'}
              </h1>
              <p className="text-[10px] text-[var(--hyper-text-secondary)] leading-tight">
                {isBn ? 'সহজ পারিবারিক ভাড়া আদায় খাতা' : 'Simple Family Rent Collection Register'}
              </p>
            </div>
          </div>

        </div>
      </header>

      {/* ===================================================================== */}
      {/* Main Content Area: Responsive Form Container (Centered Max-W-XL)     */}
      {/* ===================================================================== */}
      <main className="max-w-xl w-full mx-auto px-3 sm:px-5 py-3 sm:py-4 flex-1">
        <SyncStatusBar className="mb-3" />
        {successInfo ? (
          /* ================================================================= */
          /* Full-Page Success & Receipt Card View                             */
          /* ================================================================= */
          <div className="bg-[var(--hyper-surface)] rounded-3xl p-6 sm:p-8 border border-[var(--hyper-border-subtle)] shadow-xs text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'ভাড়া সফলভাবে জমা হয়েছে!' : 'Rent Payment Recorded!'}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--hyper-text-secondary)] mt-1">
                {isBn
                  ? 'পারিবারিক ভাড়া খাতায় রসিদ সংরক্ষিত হয়েছে'
                  : 'Receipt saved to family rent ledger'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-left space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-emerald-500/15 pb-2.5">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'ভাড়াটিয়ার নাম' : 'Tenant Name'}
                </span>
                <span className="font-bold text-[var(--hyper-text-primary)]">
                  {successInfo.tenantName}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-emerald-500/15 pb-2.5">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'জমা টাকার পরিমাণ' : 'Paid Amount'}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                  {formatLocalizedCurrency(successInfo.amount, currentLanguage, useBanglaNumerals)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-emerald-500/15 pb-2.5">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'পরিশোধের মাধ্যম' : 'Payment Method'}
                </span>
                <span className="font-semibold text-[var(--hyper-text-primary)]">
                  {getMethodLabel(successInfo.paymentMethod)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-emerald-500/15 pb-2.5">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'পরিশোধের তারিখ' : 'Payment Date'}
                </span>
                <span className="font-medium text-[var(--hyper-text-primary)]">
                  {successInfo.paymentDate}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm pt-0.5">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'মানি রসিদ নম্বর' : 'Receipt Number'}
                </span>
                <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">
                  {successInfo.receiptNumber}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-1/2 py-3 rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--hyper-text-primary)] font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isBn ? 'অন্য ভাড়া জমা দিন' : 'Record Another'}</span>
              </button>
              <button
                type="button"
                onClick={onBack || goBack}
                aria-label={isBn ? 'ড্যাশবোর্ডে ফিরুন' : 'Back to Dashboard'}
                className="h-12 w-12 rounded-full border border-[var(--hyper-green)]/40 bg-transparent text-[var(--hyper-green)] hover:bg-[var(--hyper-green-bg)] transition cursor-pointer flex items-center justify-center"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* Main Form Card (Compact HyperOS Styling)                          */
          /* ================================================================= */
          <div className="bg-[var(--hyper-surface)] rounded-2xl p-3.5 sm:p-5 border border-[var(--hyper-border-subtle)] shadow-xs space-y-3">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            <form id="rent-deposit-form" onSubmit={handleSubmit} className="space-y-3">
              {/* Field 1: Tenant Selection */}
              <div className="space-y-1">
                <label
                  htmlFor="rent-tenant-select"
                  className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                >
                  {isBn ? '১. ভাড়াটিয়া নির্বাচন করুন *' : '1. Select Tenant *'}
                </label>
                <FrostedGlassSelect<string>
                  id="rent-tenant-select"
                  value={effectiveTenantId}
                  onChange={(newTenantId) => {
                    setSelectedTenantId(newTenantId);
                    setCustomAmount(null);
                  }}
                  options={tenantOptions}
                  titleBn="ভাড়াটিয়া নির্বাচন করুন"
                  titleEn="Select Tenant"
                  subtitleBn="ভাড়া জমার জন্য ভাড়াটিয়া বাছাই করুন"
                  subtitleEn="Choose tenant to deposit rent for"
                  headerIcon={User}
                  headerIconBg="bg-emerald-500/15"
                  headerIconColor="text-[#22B84A]"
                  triggerTestId="rent-tenant-trigger"
                  modalTestId="rent-tenant-modal"
                  disabled={loading}
                  compact={true}
                />
              </div>

              {/* Tenant Details Preview Banner (Compact Inline Pill) */}
              {currentTenant && (
                <div className="py-2 px-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-[var(--hyper-text-primary)] truncate leading-tight">
                        {currentTenant.name}
                      </div>
                      <div className="text-[10px] text-[var(--hyper-text-secondary)] flex items-center gap-1 leading-tight mt-0.5">
                        <Phone className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{currentTenant.mobile || (isBn ? 'মোবাইল নেই' : 'No mobile')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <div className="text-[10px] text-[var(--hyper-text-secondary)] leading-tight">
                      {isBn ? 'মাসিক ভাড়া' : 'Monthly Rent'}
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 leading-tight">
                      {formatLocalizedCurrency(currentTenant.monthlyRent, currentLanguage, useBanglaNumerals)}
                    </div>
                  </div>
                </div>
              )}

              {/* Field 2 & 3: Payment Amount & Payment Method in 2-Column Responsive Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="rent-amount-input"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn ? '২. জমা টাকা (৳) *' : '2. Amount (৳) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--hyper-text-tertiary)] font-bold text-sm select-none">
                      ৳
                    </span>
                    <input
                      id="rent-amount-input"
                      type="number"
                      min="1"
                      value={displayAmount}
                      onChange={(e) =>
                        setCustomAmount(e.target.value ? Number(e.target.value) : '')
                      }
                      disabled={loading}
                      placeholder="20000"
                      className="w-full h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] pl-7 pr-2.5 text-sm sm:text-base font-bold text-[var(--hyper-text-primary)] focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition"
                    />
                  </div>
                  {currentBill && currentBill.balanceDue > 0 && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                      {isBn ? 'বকেয়া বিল অনুযায়ী:' : 'Due:'}{' '}
                      <span className="font-bold">
                        {formatLocalizedCurrency(currentBill.balanceDue, currentLanguage, useBanglaNumerals)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="rent-method-select"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn ? '৩. মাধ্যম *' : '3. Method *'}
                  </label>
                  <FrostedGlassSelect<PaymentMethod>
                    id="rent-method-select"
                    value={paymentMethod}
                    onChange={(newMethod) => setPaymentMethod(newMethod)}
                    options={PAYMENT_METHOD_OPTIONS}
                    titleBn="পরিশোধের মাধ্যম"
                    titleEn="Payment Method"
                    subtitleBn="টাকা পরিশোধের পদ্ধতি বাছাই করুন"
                    subtitleEn="Select payment method channel"
                    headerIcon={CreditCard}
                    headerIconBg="bg-emerald-500/15"
                    headerIconColor="text-[#22B84A]"
                    triggerTestId="rent-method-trigger"
                    modalTestId="rent-method-modal"
                    disabled={loading}
                    compact={true}
                  />
                </div>
              </div>

              {/* Field 4 & 5: Date and Notes in 2-Column Responsive Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="rent-date-input"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn ? '৪. পরিশোধের তারিখ *' : '4. Payment Date *'}
                  </label>
                  <div className="relative">
                    <input
                      id="rent-date-input"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      disabled={loading}
                      className="w-full h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] px-2.5 text-xs sm:text-sm font-medium text-[var(--hyper-text-primary)] focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="rent-notes-input"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn
                      ? '৫. নোট / রসিদ (ঐচ্ছিক)'
                      : '5. Notes / Ref (Opt)'}
                  </label>
                  <div className="relative">
                    <input
                      id="rent-notes-input"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={loading}
                      placeholder={
                        isBn
                          ? 'যেমন: ক্যাশ বা মেমো নম্বর'
                          : 'e.g. Cash or memo #'
                      }
                      className="w-full h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] px-3 text-xs sm:text-sm font-medium text-[var(--hyper-text-primary)] placeholder:text-[var(--hyper-text-tertiary)] focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Field 6: Payment Proof / Receipt Attachment */}
              <div className="pt-1">
                <StorageFileUpload
                  category="payment_proof"
                  tenantId={effectiveTenantId || undefined}
                  label={isBn ? '৬. রসিদ / পেমেন্ট প্রুফ (ঐচ্ছিক)' : '6. Payment Proof / Receipt (Optional)'}
                  description={isBn ? 'ব্যক্তিগত Cloudflare R2 স্টোরেজ' : 'Private Cloudflare R2 storage'}
                />
              </div>

              {/* Form Action Buttons: Cancel & Confirm (integrated inside card) */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-[var(--hyper-border-subtle)]">
                <button
                  type="button"
                  onClick={handleBackRequest}
                  disabled={loading}
                  className="w-1/3 h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs sm:text-sm transition cursor-pointer select-none"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                  <span>
                    {loading
                      ? isBn
                        ? 'জমা হচ্ছে...'
                        : 'Processing...'
                      : isBn
                      ? 'ভাড়া জমা নিশ্চিত করুন'
                      : 'Confirm Rent Deposit'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* Unsaved Changes Confirmation Dialog (Destructive Nav Guard Only)      */}
      {/* ===================================================================== */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--hyper-surface)] p-6 border border-[var(--hyper-border-subtle)] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-[var(--hyper-text-primary)]">
                {isBn ? 'অসংরক্ষিত পরিবর্তন রয়েছে' : 'Unsaved Changes'}
              </h3>
            </div>
            <p className="text-xs text-[var(--hyper-text-secondary)] leading-relaxed">
              {isBn
                ? 'আপনি তথ্য পূরণ করা শুরু করেছেন। ফিরে গেলে আপনার ইনপুট মুছে যাবে। আপনি কি নিশ্চিত?'
                : 'You have entered changes that will not be saved if you leave. Are you sure you want to discard them?'}
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl border border-[var(--hyper-border-subtle)] bg-black/5 dark:bg-white/5 text-[var(--hyper-text-primary)] font-semibold text-xs hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
              >
                {isBn ? 'এখানে থাকুন' : 'Stay'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  forceBack();
                }}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition cursor-pointer"
              >
                {isBn ? 'বাতিল ও প্রস্থান' : 'Discard & Exit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RentDepositPage;
