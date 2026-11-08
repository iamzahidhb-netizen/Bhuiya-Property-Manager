import { useState } from 'react';
import type { Tenant } from '../../types/tenant';
import type { RentBill, PaymentMethod } from '../../types/finance';
import { recordRentPayment } from '../../services/rentService';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { CreditCard, X, CheckCircle2, Loader2 } from 'lucide-react';

interface SimpleRentPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  bills: RentBill[];
  preSelectedTenantId?: string | null;
  onSuccess: () => void;
}

function makeTimestampId(prefix: string): string {
  const ts = new Date().getTime();
  return `${prefix}_${ts}`;
}

export default function SimpleRentPaymentModal({
  isOpen,
  onClose,
  tenants,
  bills,
  preSelectedTenantId,
  onSuccess,
}: SimpleRentPaymentModalProps) {
  const { currentLanguage, t } = useLanguage();
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<number | '' | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    receiptNumber: string;
    amount: number;
    tenantName: string;
  } | null>(null);

  if (!isOpen) return null;

  // Active tenant derived from selection or props
  const effectiveTenantId =
    selectedTenantId || preSelectedTenantId || (tenants.length > 0 ? tenants[0].id : '');
  const currentTenant = tenants.find((item) => item.id === effectiveTenantId) || null;

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

  const displayAmount = customAmount !== null ? customAmount : defaultAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = Number(displayAmount);
    if (!numAmount || numAmount <= 0) {
      setError(currentLanguage === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন (০ অপেক্ষা বেশি হতে হবে)।' : 'Please enter a valid amount greater than 0.');
      return;
    }

    if (!effectiveTenantId) {
      setError(currentLanguage === 'bn' ? 'অনুগ্রহ করে একজন ভাড়াটিয়া নির্বাচন করুন।' : 'Please select a tenant.');
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
        tenantName: currentTenant?.name || (currentLanguage === 'bn' ? 'ভাড়াটিয়া' : 'Tenant'),
      });
      onSuccess();
    } catch (err: unknown) {
      console.error('[SimpleRentPaymentModal] Submit error:', err);
      const msg = err instanceof Error ? err.message : (currentLanguage === 'bn' ? 'ভাড়া জমা করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Failed to record rent payment.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleModalClose() {
    setError(null);
    setSuccessInfo(null);
    setCustomAmount(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-emerald-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-emerald-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
              <CreditCard className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">{t('rentModal.title')}</h2>
              <p className="text-xs text-slate-500">{t('rentModal.subtitle')}</p>
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
          {successInfo ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">{t('rentModal.successTitle')}</h3>
              <div className="p-4 bg-emerald-50 rounded-2xl text-left space-y-2 text-sm text-emerald-950 border border-emerald-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('rentModal.tenantName')}</span>
                  <span className="font-semibold">{successInfo.tenantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('rentModal.paidAmount')}</span>
                  <span className="font-bold text-emerald-700 text-base">
                    {formatLocalizedCurrency(successInfo.amount, currentLanguage)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('rentModal.receiptNumber')}</span>
                  <span className="font-mono">{successInfo.receiptNumber}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition cursor-pointer"
              >
                {t('rentModal.ok')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Step 1: Select Tenant */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {t('rentModal.selectTenant')}
                </label>
                <select
                  value={effectiveTenantId}
                  onChange={(e) => {
                    setSelectedTenantId(e.target.value);
                    setCustomAmount(null);
                  }}
                  disabled={loading}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none"
                >
                  {tenants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({t('dashboard.monthlyRentLabel')}: {formatLocalizedCurrency(item.monthlyRent, currentLanguage)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tenant details banner */}
              {currentTenant && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
                  <div>
                    <span className="font-semibold">{currentTenant.name}</span>
                    <div className="text-slate-500">
                      {t('dashboard.mobileLabel')} {currentTenant.mobile || t('dashboard.notProvided')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500">{t('rentModal.currentRent')}</div>
                    <div className="font-bold text-sm text-emerald-800">
                      {formatLocalizedCurrency(currentTenant.monthlyRent, currentLanguage)}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Payment Amount */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {t('rentModal.paymentAmount')}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={displayAmount}
                    onChange={(e) =>
                      setCustomAmount(e.target.value ? Number(e.target.value) : '')
                    }
                    disabled={loading}
                    placeholder="20000"
                    className="w-full rounded-2xl border border-slate-300 bg-white pl-9 pr-4 py-2.5 text-base font-semibold text-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none"
                  />
                </div>
              </div>

              {/* Step 3: Date & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('rentModal.dateLabel')}
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('rentModal.methodLabel')}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 outline-none"
                  >
                    <option value="cash">{t('rentModal.methodCash')}</option>
                    <option value="bkash">{t('rentModal.methodBkash')}</option>
                    <option value="nagad">{t('rentModal.methodNagad')}</option>
                    <option value="bank">{t('rentModal.methodBank')}</option>
                    <option value="other">অন্যান্য (Other)</option>
                  </select>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('rentModal.notesLabel')}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  placeholder={t('rentModal.notesPlaceholder')}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Submit buttons */}
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
                  <span>{loading ? (currentLanguage === 'bn' ? 'জমা হচ্ছে...' : 'Processing...') : t('rentModal.submitBtn')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
