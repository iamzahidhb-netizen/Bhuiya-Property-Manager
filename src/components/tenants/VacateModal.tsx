import { useState } from 'react';
import type { Tenant, VacateTenantFormData } from '../../types/tenant';
import type { SecurityDeposit } from '../../types/finance';

interface VacateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVacate: (data: VacateTenantFormData) => Promise<void>;
  tenant: Tenant;
  propertyName: string;
  unitNumber: string;
  deposit?: SecurityDeposit | null;
}

export default function VacateModal({
  isOpen,
  onClose,
  onVacate,
  tenant,
  propertyName,
  unitNumber,
  deposit,
}: VacateModalProps) {
  const [vacatingDate, setVacatingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [damageDeductions, setDamageDeductions] = useState<number | ''>(0);

  const initialHeldDeposit = deposit ? deposit.depositAmount : tenant.advanceDeposit || 0;

  // Calculate default refund amount: max(0, initialHeldDeposit - damageDeductions)
  const currentDeductions = Number(damageDeductions) || 0;
  const calculatedRefundable = Math.max(0, initialHeldDeposit - currentDeductions);

  const [refundAmount, setRefundAmount] = useState<number | ''>(calculatedRefundable);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!vacatingDate) {
      setError('প্রস্থানের তারিখ প্রদান করুন। / Please enter vacating date.');
      return;
    }

    const deductions = Number(damageDeductions) || 0;
    const refund = Number(refundAmount) || 0;

    if (deductions < 0) {
      setError('কর্তনের পরিমাণ ঋণাত্মক হতে পারে না। / Deductions cannot be negative.');
      return;
    }
    if (refund < 0) {
      setError('ফেরতের পরিমাণ ঋণাত্মক হতে পারে না। / Refund cannot be negative.');
      return;
    }
    if (deductions + refund > initialHeldDeposit) {
      setError(
        `কর্তন এবং ফেরতের মোট পরিমাণ (৳${(deductions + refund).toLocaleString(
          'en-IN'
        )}) জমা রাখা জামানত (৳${initialHeldDeposit.toLocaleString(
          'en-IN'
        )}) এর চেয়ে বেশি হতে পারে না।`
      );
      return;
    }

    const confirmMessage = `আপনি কি নিশ্চিত যে "${tenant.name}" কে প্রস্থান (Vacate) হিসেবে চিহ্নিত করতে চান?\n\nফ্ল্যাট/ইউনিট "${unitNumber}" পুনরায় খালি (Vacant) হবে।`;
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      await onVacate({
        tenantId: tenant.id,
        vacatingDate,
        damageDeductions: deductions,
        refundAmount: refund,
        settlementNotes: settlementNotes.trim() || undefined,
        depositId: deposit?.id,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'নিষ্পত্তি সম্পন্ন করতে সমস্যা হয়েছে।';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed & Sticky, never scrolls */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              ভাড়াটিয়া প্রস্থান ও জামানত নিষ্পত্তি
            </h3>
            <p className="text-xs text-slate-500">
              Vacate Tenant & Security Deposit Settlement
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overscroll-contain">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {/* Summary Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">ভাড়াটিয়ার নাম:</span>
                <span className="font-bold text-slate-800">{tenant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">মোবাইল:</span>
                <span className="font-mono text-slate-700">{tenant.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ভবন ও ইউনিট:</span>
                <span className="font-semibold text-slate-800">
                  {propertyName} — {unitNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">যোগদানের তারিখ:</span>
                <span className="text-slate-700">{tenant.moveInDate}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold">
                <span className="text-amber-800">জমা থাকা সিকিউরিটি ডিপোজিট (দায়):</span>
                <span className="text-emerald-700 text-sm">
                  ৳{initialHeldDeposit.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রস্থানের তারিখ / Vacating Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={vacatingDate}
                onChange={(e) => setVacatingDate(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80">
              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">
                  মেরামত বা বকেয়া কর্তন (৳) / Deductions
                </label>
                <input
                  type="number"
                  min="0"
                  max={initialHeldDeposit}
                  value={damageDeductions}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setDamageDeductions(val);
                    const newDeductions = Number(val) || 0;
                    setRefundAmount(Math.max(0, initialHeldDeposit - newDeductions));
                  }}
                  placeholder="0"
                  className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-xl outline-hidden focus:border-amber-500"
                />
                <span className="text-[10px] text-amber-700">রং, ক্ষতি বা বিল বকেয়া</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-900 mb-1">
                  ফেরতযোগ্য / পরিশোধিত অর্থ (৳) / Refund
                </label>
                <input
                  type="number"
                  min="0"
                  max={initialHeldDeposit}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full text-xs px-3 py-2 bg-white border border-emerald-300 rounded-xl outline-hidden focus:border-emerald-500 font-bold text-emerald-700"
                />
                <span className="text-[10px] text-emerald-700">ভাড়াটিয়াকে ফেরত প্রদান</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                নিষ্পত্তির বিবরণ / Settlement Notes (ঐচ্ছিক)
              </label>
              <textarea
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="কর্তনের কারণ বা চাবি হস্তান্তরের বিবরণ..."
                rows={2}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
              ℹ️ প্রস্থান সম্পন্ন হলে ইউনিটটি <strong>খালি (Vacant)</strong> অবস্থায় ফিরে যাবে এবং নতুন ভাড়াটিয়ার জন্য উন্মুক্ত হবে। ভাড়াটিয়ার পূর্ব ইতিহাস সংরক্ষিত থাকবে।
            </div>
          </div>

          {/* Sticky/Fixed Footer */}
          <div className="shrink-0 flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              বাতিল / Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  নিষ্পত্তি হচ্ছে...
                </>
              ) : (
                'ভাড়াটিয়া প্রস্থান ও নিষ্পত্তি নিশ্চিত করুন'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
