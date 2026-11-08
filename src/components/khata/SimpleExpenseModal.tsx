import { useState } from 'react';
import type { Property } from '../../types/property';
import type { BuildingExpenseCategory } from '../../types/finance';
import { EXPENSE_CATEGORIES } from '../../types/appPreferences';
import { createExpense } from '../../services/expenseService';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { ReceiptText, X, CheckCircle2, Loader2 } from 'lucide-react';

interface SimpleExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onSuccess: () => void;
}

export default function SimpleExpenseModal({
  isOpen,
  onClose,
  properties,
  onSuccess,
}: SimpleExpenseModalProps) {
  const { currentLanguage, t } = useLanguage();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<BuildingExpenseCategory>('electricity');
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [propertyId, setPropertyId] = useState<string>(
    properties.length > 0 ? properties[0].id : ''
  );
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError(currentLanguage === 'bn' ? 'অনুগ্রহ করে খরচের নাম লিখুন।' : 'Please enter an expense title.');
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError(currentLanguage === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন (০ অপেক্ষা বেশি হতে হবে)।' : 'Please enter a valid amount greater than 0.');
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

      setSuccess(true);
      onSuccess();
    } catch (err: unknown) {
      console.error('[SimpleExpenseModal] Submit error:', err);
      const msg = err instanceof Error ? err.message : (currentLanguage === 'bn' ? 'খরচ রেকর্ড করতে সমস্যা হয়েছে।' : 'Failed to record expense.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleModalClose() {
    setTitle('');
    setAmount('');
    setError(null);
    setSuccess(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-emerald-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-emerald-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
              <ReceiptText className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">{t('expenseModal.title')}</h2>
              <p className="text-xs text-slate-500">{t('expenseModal.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          {success ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">{t('expenseModal.successTitle')}</h3>
              <p className="text-sm text-slate-600">
                {title} —{' '}
                <span className="font-bold text-emerald-700">
                  {formatLocalizedCurrency(Number(amount), currentLanguage)}
                </span>
              </p>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition cursor-pointer"
              >
                {t('expenseModal.done')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* 1. Expense Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {t('expenseModal.nameLabel')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  placeholder={t('expenseModal.namePlaceholder')}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none"
                />
              </div>

              {/* 2. Amount & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t('expenseModal.amountLabel')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      ৳
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                      disabled={loading}
                      placeholder={t('expenseModal.amountPlaceholder')}
                      className="w-full rounded-2xl border border-slate-300 bg-white pl-9 pr-4 py-2.5 text-base font-semibold text-slate-800 focus:border-emerald-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {t('expenseModal.categoryLabel')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BuildingExpenseCategory)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-600 outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Date & Property */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('expenseModal.dateLabel')}
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('expenseModal.propertyLabel')}
                  </label>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 outline-none"
                  >
                    <option value="">{t('expenseModal.allProperties')}</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('expenseModal.notesLabel')}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  placeholder={t('expenseModal.notesPlaceholder')}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleModalClose}
                  disabled={loading}
                  className="w-1/3 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold shadow-md shadow-emerald-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>{loading ? t('expenseModal.saving') : t('expenseModal.submitBtn')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
