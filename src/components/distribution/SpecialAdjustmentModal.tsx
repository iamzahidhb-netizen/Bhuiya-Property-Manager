import React, { useState } from 'react';
import type { BeneficiarySnapshot } from '../../types/finance';
import { applySpecialAdjustment } from '../../services/distributionService';

interface SpecialAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  distributionMonth: string;
  snapshot: BeneficiarySnapshot | null;
  onAdjusted: () => void;
}

export default function SpecialAdjustmentModal({
  isOpen,
  onClose,
  distributionMonth,
  snapshot,
  onAdjusted,
}: SpecialAdjustmentModalProps) {
  const [adjustmentAmount, setAdjustmentAmount] = useState<number | ''>(snapshot?.specialAdjustment || 0);
  const [reason, setReason] = useState(snapshot?.adjustmentReason || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !snapshot) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof adjustmentAmount !== 'number') {
      setError('সমন্বয়ের পরিমাণ নির্ধারণ করুন।');
      return;
    }
    if (adjustmentAmount !== 0 && !reason.trim()) {
      setError('বিশেষ সমন্বয়ের জন্য যথাযথ কারণ উল্লেখ করা আবশ্যক।');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await applySpecialAdjustment(
        distributionMonth,
        snapshot!.beneficiaryId,
        adjustmentAmount,
        reason.trim()
      );

      onAdjusted();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'সমন্বয় ব্যর্থ হয়েছে।';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const newTarget = Math.max(0, snapshot.baseMonthlyTarget + (typeof adjustmentAmount === 'number' ? adjustmentAmount : 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-base font-bold text-slate-800">বিশেষ মাসিক সমন্বয় / Special Adjustment</h2>
            <p className="text-xs text-slate-500">{snapshot.name} ({distributionMonth} মাস)</p>
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
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto overscroll-contain">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">ভিত্তি মাসিক লক্ষ্য (Base Target):</span>
                <span className="font-bold text-slate-800">৳{snapshot.baseMonthlyTarget.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">সমন্বয় (Adjustment):</span>
                <span className={`font-bold ${typeof adjustmentAmount === 'number' && adjustmentAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {typeof adjustmentAmount === 'number' && adjustmentAmount > 0 ? `+৳${adjustmentAmount.toLocaleString('en-IN')}` : `৳${(adjustmentAmount || 0).toLocaleString('en-IN')}`}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">চূড়ান্ত মাসিক লক্ষ্য:</span>
                <span className="font-black text-blue-700 text-sm">৳{newTarget.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                সমন্বয়ের পরিমাণ (+/- BDT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-400">৳</span>
                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="যেমন: 5000 বা -2000"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-bold text-slate-800 text-sm"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                * ধনাত্মক সংখ্যা লক্ষ্য বৃদ্ধি করবে (যেমন: ঈদ বোনাস) এবং ঋণাত্মক সংখ্যা লক্ষ্য হ্রাস করবে।
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                সমন্বয়ের কারণ / Adjustment Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="যেমন: পবিত্র ঈদুল ফিতর উপলক্ষ্যে বিশেষ অনুদান"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
                required={adjustmentAmount !== 0}
              />
            </div>
          </div>

          {/* Sticky/Fixed Footer */}
          <div className="shrink-0 flex items-center justify-end gap-2.5 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-bold shadow-md shadow-blue-600/20 cursor-pointer"
            >
              {loading ? 'সংরক্ষণ হচ্ছে...' : 'সমন্বয় প্রয়োগ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
