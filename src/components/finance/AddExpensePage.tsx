import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Property } from '../../types/property';
import type { BuildingExpenseCategory } from '../../types/finance';
import { EXPENSE_CATEGORIES } from '../../types/appPreferences';
import { createExpense } from '../../services/expenseService';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAppNavigation } from '../../contexts/NavigationContext';
import { FrostedGlassSelect, type FrostedGlassOption } from '../ui/hyperos';
import {
  ReceiptText,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Droplet,
  Flame,
  Wrench,
  UserCheck,
  Shield,
  Sparkles,
  Tag,
  Building2,
} from 'lucide-react';

const CATEGORY_META: Record<
  BuildingExpenseCategory,
  { icon: React.FC<{ className?: string; strokeWidth?: number }>; bg: string; color: string }
> = {
  electricity: { icon: Zap, bg: 'bg-amber-500/15', color: 'text-amber-600 dark:text-amber-400' },
  water: { icon: Droplet, bg: 'bg-blue-500/15', color: 'text-blue-600 dark:text-blue-400' },
  gas: { icon: Flame, bg: 'bg-orange-500/15', color: 'text-orange-600 dark:text-orange-400' },
  maintenance_repair: { icon: Wrench, bg: 'bg-purple-500/15', color: 'text-purple-600 dark:text-purple-400' },
  caretaker_salary: { icon: UserCheck, bg: 'bg-emerald-500/15', color: 'text-emerald-600 dark:text-emerald-400' },
  security: { icon: Shield, bg: 'bg-indigo-500/15', color: 'text-indigo-600 dark:text-indigo-400' },
  cleaning: { icon: Sparkles, bg: 'bg-cyan-500/15', color: 'text-cyan-600 dark:text-cyan-400' },
  other_building: { icon: ReceiptText, bg: 'bg-slate-500/15', color: 'text-slate-600 dark:text-slate-400' },
};

export interface AddExpensePageProps {
  properties: Property[];
  onBack: () => void;
  onSuccess?: () => void;
  className?: string;
}

export const AddExpensePage: React.FC<AddExpensePageProps> = ({
  properties,
  onBack,
  onSuccess,
  className = '',
}) => {
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const { goBack, forceBack, registerBackGuard } = useAppNavigation();
  const useBanglaNumerals = settings.languageRegion.useBanglaNumerals;
  const isBn = currentLanguage === 'bn';

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<BuildingExpenseCategory>('electricity');
  const [expenseDate, setExpenseDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [propertyId, setPropertyId] = useState<string>(
    properties.length > 0 ? properties[0].id : ''
  );
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    amount: number;
    category: BuildingExpenseCategory;
    expenseDate: string;
  } | null>(null);

  const categoryOptions: FrostedGlassOption<BuildingExpenseCategory>[] = useMemo(() => {
    return EXPENSE_CATEGORIES.map((c) => {
      const meta = CATEGORY_META[c.id];
      return {
        value: c.id,
        labelBn: c.label,
        labelEn: c.id.replace(/_/g, ' '),
        icon: meta.icon,
        iconBg: meta.bg,
        iconColor: meta.color,
      };
    });
  }, []);

  const propertyOptions: FrostedGlassOption<string>[] = useMemo(() => {
    const allPropsOption: FrostedGlassOption<string> = {
      value: '',
      labelBn: isBn ? 'সকল সম্পত্তি' : 'All Properties',
      labelEn: 'All Properties',
      descriptionBn: isBn ? 'কোন নির্দিষ্ট প্রপার্টি সীমাবদ্ধ নয়' : 'Not restricted to a specific property',
      descriptionEn: 'Not restricted to a specific property',
      icon: Building2,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-[#1685E8]',
    };
    const propList = properties.map((p) => ({
      value: p.id,
      labelBn: p.name,
      labelEn: p.name,
      icon: Building2,
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-[#22B84A]',
    }));
    return [allPropsOption, ...propList];
  }, [properties, isBn]);

  // Unsaved changes detection
  const isDirty =
    !successInfo &&
    (title.trim().length > 0 ||
      amount !== '' ||
      description.trim().length > 0);

  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Register unified browser back guard (protects Android hardware back & swipe gestures)
  useEffect(() => {
    return registerBackGuard({
      id: 'add-expense-guard',
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
    setTitle('');
    setAmount('');
    setCategory('electricity');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setPropertyId(properties.length > 0 ? properties[0].id : '');
    setDescription('');
    setError(null);
    setSuccessInfo(null);
    setShowDiscardConfirm(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError(
        isBn
          ? 'অনুগ্রহ করে খরচের নাম লিখুন।'
          : 'Please enter an expense title.'
      );
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError(
        isBn
          ? 'সঠিক টাকার পরিমাণ লিখুন (০ অপেক্ষা বেশি হতে হবে)।'
          : 'Please enter a valid amount greater than 0.'
      );
      return;
    }

    setLoading(true);
    try {
      await createExpense({
        title: cleanTitle,
        amount: numAmount,
        group: 'building',
        category,
        expenseDate,
        propertyId: propertyId || undefined,
        description: description.trim() || undefined,
        paymentMethod: 'cash',
      });

      setSuccessInfo({
        title: cleanTitle,
        amount: numAmount,
        category,
        expenseDate,
      });
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[AddExpensePage] Submit error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : isBn
          ? 'খরচ রেকর্ড করতে সমস্যা হয়েছে।'
          : 'Failed to record expense.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const getCategoryLabel = (catId: BuildingExpenseCategory) => {
    const match = EXPENSE_CATEGORIES.find((c) => c.id === catId);
    return match ? match.label : catId;
  };

  return (
    <div
      className={`min-h-screen bg-[var(--hyper-bg-base)] text-[var(--hyper-text-primary)] antialiased transition-colors duration-200 flex flex-col pb-32 pb-[calc(env(safe-area-inset-bottom)+7rem)] ${className}`}
      data-testid="add-expense-fullpage"
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
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#F28A24] flex items-center justify-center font-bold text-base shrink-0">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-[var(--hyper-text-primary)] leading-tight">
                {isBn ? 'নতুন খরচ যোগ করুন' : 'Add New Expense'}
              </h1>
              <p className="text-[10px] text-[var(--hyper-text-secondary)] leading-tight">
                {isBn ? 'পারিবারিক খরচের হিসাব খাতা' : 'Family Expense Register'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBackRequest}
            className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[var(--hyper-text-primary)] transition-colors cursor-pointer select-none"
          >
            {isBn ? 'ড্যাশবোর্ডে ফিরুন' : 'Back to Dashboard'}
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* Main Content Area: Responsive Form Container (Centered Max-W-XL)     */}
      {/* ===================================================================== */}
      <main className="max-w-xl w-full mx-auto px-3 sm:px-5 py-3 sm:py-4 flex-1">
        {successInfo ? (
          /* ================================================================= */
          /* Full-Page Success & Summary Card View                             */
          /* ================================================================= */
          <div className="bg-[var(--hyper-surface)] rounded-2xl p-5 sm:p-7 border border-[var(--hyper-border-subtle)] shadow-xs text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'খরচ সফলভাবে সংরক্ষিত হয়েছে!' : 'Expense Recorded Successfully!'}
              </h2>
              <p className="text-xs text-[var(--hyper-text-secondary)] mt-1">
                {isBn
                  ? 'পারিবারিক হিসাব খাতায় খরচ সফলভাবে যুক্ত হয়েছে'
                  : 'Expense added to family accounts ledger'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left space-y-2">
              <div className="flex justify-between items-center text-xs border-b border-amber-500/15 pb-2">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'খরচের বিবরণ' : 'Expense Title'}
                </span>
                <span className="font-bold text-[var(--hyper-text-primary)]">
                  {successInfo.title}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-amber-500/15 pb-2">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'টাকার পরিমাণ' : 'Amount'}
                </span>
                <span className="font-bold text-[#F28A24] text-base">
                  {formatLocalizedCurrency(successInfo.amount, currentLanguage, useBanglaNumerals)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-amber-500/15 pb-2">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'ক্যাটাগরি' : 'Category'}
                </span>
                <span className="font-semibold text-[var(--hyper-text-primary)]">
                  {getCategoryLabel(successInfo.category)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs pt-0.5">
                <span className="text-[var(--hyper-text-secondary)]">
                  {isBn ? 'খরচের তারিখ' : 'Expense Date'}
                </span>
                <span className="font-medium text-[var(--hyper-text-primary)]">
                  {successInfo.expenseDate}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-1/2 py-2.5 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--hyper-text-primary)] font-semibold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isBn ? 'আরেকটি খরচ যোগ করুন' : 'Add Another'}</span>
              </button>
              <button
                type="button"
                onClick={onBack || goBack}
                className="w-full sm:w-1/2 py-2.5 rounded-xl bg-[#F28A24] hover:bg-[#E07913] active:bg-[#C9690D] text-white font-semibold text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                {isBn ? 'ড্যাশবোর্ডে ফিরুন' : 'Back to Dashboard'}
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

            <form id="add-expense-form" onSubmit={handleSubmit} className="space-y-3">
              {/* Field 1: Expense Title */}
              <div className="space-y-1">
                <label
                  htmlFor="expense-title-input"
                  className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                >
                  {isBn ? '১. খরচের নাম *' : '1. Expense Title *'}
                </label>
                <div className="relative">
                  <input
                    id="expense-title-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                    placeholder={
                      isBn
                        ? 'যেমন: পানির মোটর মেরামত, ঝাড়ুদার বিল, কারেন্ট বিল'
                        : 'e.g. Water pump repair, cleaning fee, electric bill'
                    }
                    className="w-full h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] px-3 text-xs sm:text-sm font-medium text-[var(--hyper-text-primary)] placeholder:text-[var(--hyper-text-tertiary)] focus:border-[#F28A24] focus:ring-1 focus:ring-[#F28A24]/30 outline-none transition"
                  />
                </div>
              </div>

              {/* Field 2 & 3: Amount and Category in 2-Column Responsive Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="expense-amount-input"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn ? '২. পরিমাণ (৳) *' : '2. Amount (৳) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--hyper-text-tertiary)] font-bold text-sm select-none">
                      ৳
                    </span>
                    <input
                      id="expense-amount-input"
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value ? Number(e.target.value) : '')
                      }
                      disabled={loading}
                      placeholder="1500"
                      className="w-full h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] pl-7 pr-2.5 text-sm sm:text-base font-bold text-[var(--hyper-text-primary)] focus:border-[#F28A24] focus:ring-1 focus:ring-[#F28A24]/30 outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="expense-category-select"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn ? '৩. ক্যাটাগরি *' : '3. Category *'}
                  </label>
                  <FrostedGlassSelect<BuildingExpenseCategory>
                    id="expense-category-select"
                    value={category}
                    onChange={(newCat) => setCategory(newCat)}
                    options={categoryOptions}
                    titleBn="খরচের ক্যাটাগরি"
                    titleEn="Expense Category"
                    subtitleBn="তালিকা থেকে উপযুক্ত খরচের ধরন বাছাই করুন"
                    subtitleEn="Select an expense category from the list"
                    headerIcon={Tag}
                    headerIconBg="bg-[#F28A24]/15"
                    headerIconColor="text-[#F28A24]"
                    triggerTestId="open-category-modal"
                    modalTestId="expense-category-modal"
                    confirmTestId="confirm-category-selection"
                    triggerClassName="hover:border-[#F28A24] focus:ring-[#F28A24]/20"
                    disabled={loading}
                    compact={true}
                  />
                </div>
              </div>

              {/* Field 4 & 5: Date and Property in 2-Column Responsive Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="expense-date-input"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn ? '৪. খরচের তারিখ *' : '4. Expense Date *'}
                  </label>
                  <div className="relative">
                    <input
                      id="expense-date-input"
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      disabled={loading}
                      className="w-full h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] px-2.5 text-xs sm:text-sm font-medium text-[var(--hyper-text-primary)] focus:border-[#F28A24] focus:ring-1 focus:ring-[#F28A24]/30 outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="expense-property-select"
                    className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                  >
                    {isBn ? '৫. সম্পত্তি (ঐচ্ছিক)' : '5. Property (Opt)'}
                  </label>
                  <FrostedGlassSelect<string>
                    id="expense-property-select"
                    value={propertyId}
                    onChange={(newPropId) => setPropertyId(newPropId)}
                    options={propertyOptions}
                    titleBn="সম্পত্তি নির্বাচন"
                    titleEn="Select Property"
                    subtitleBn="খরচের জন্য প্রযোজ্য সম্পত্তি বাছাই করুন"
                    subtitleEn="Choose the property applicable to this expense"
                    headerIcon={Building2}
                    headerIconBg="bg-blue-500/15"
                    headerIconColor="text-[#1685E8]"
                    triggerTestId="expense-property-trigger"
                    modalTestId="expense-property-modal"
                    disabled={loading}
                    compact={true}
                  />
                </div>
              </div>

              {/* Field 6: Description / Note */}
              <div className="space-y-1">
                <label
                  htmlFor="expense-notes-input"
                  className="block text-xs font-bold text-[var(--hyper-text-primary)]"
                >
                  {isBn
                    ? '৬. বিবরণ / নোট (ঐচ্ছিক)'
                    : '6. Description / Note (Optional)'}
                </label>
                <div className="relative">
                  <input
                    id="expense-notes-input"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                    placeholder={
                      isBn
                        ? 'খরচের বিস্তারিত বিবরণ বা দোকানদারের মেমো নম্বর'
                        : 'Expense details or vendor invoice memo number'
                    }
                    className="w-full h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] px-3 text-xs sm:text-sm font-medium text-[var(--hyper-text-primary)] placeholder:text-[var(--hyper-text-tertiary)] focus:border-[#F28A24] focus:ring-1 focus:ring-[#F28A24]/30 outline-none transition"
                  />
                </div>
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
                  className="w-2/3 h-10 rounded-xl bg-[#F28A24] hover:bg-[#E07913] active:bg-[#C9690D] text-white font-semibold text-xs sm:text-sm shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                  <span>
                    {loading
                      ? isBn
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : isBn
                      ? 'নতুন খরচ নিশ্চিত করুন'
                      : 'Confirm New Expense'}
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

      {/* ===================================================================== */}
      {/* Category selection is managed globally by FrostedGlassSelect         */}
      {/* ===================================================================== */}
    </div>
  );
};

export default AddExpensePage;

