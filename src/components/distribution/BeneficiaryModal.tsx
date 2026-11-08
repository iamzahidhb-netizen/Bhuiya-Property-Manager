import React, { useState } from 'react';
import type { Beneficiary } from '../../types/finance';
import {
  createBeneficiary,
  updateBeneficiary,
  RELATIONSHIP_LABELS,
} from '../../services/distributionService';

interface BeneficiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  beneficiary: Beneficiary | null; // null = Add, non-null = Edit
  onSaved: () => void;
}

export default function BeneficiaryModal({
  isOpen,
  onClose,
  beneficiary,
  onSaved,
}: BeneficiaryModalProps) {
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [name, setName] = useState(beneficiary?.name || '');
  const [relationship, setRelationship] = useState<'brother' | 'mother' | 'sister' | 'other'>(
    beneficiary?.relationship || 'brother'
  );
  const [defaultMonthlyTarget, setDefaultMonthlyTarget] = useState<number | ''>(
    beneficiary ? beneficiary.defaultMonthlyTarget : 45000
  );
  const [effectiveFromMonth, setEffectiveFromMonth] = useState(
    beneficiary?.effectiveFromMonth || currentMonthStr
  );
  const [targetChangeReason, setTargetChangeReason] = useState('');
  const [priorityOrder, setPriorityOrder] = useState<number | ''>(
    beneficiary ? (beneficiary.priorityOrder || 1) : 1
  );
  const [status, setStatus] = useState<'active' | 'inactive'>(
    beneficiary?.status === 'inactive' ? 'inactive' : 'active'
  );
  const [notes, setNotes] = useState(beneficiary?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('অংশীদারের নাম প্রদান আবশ্যক।');
      return;
    }
    if (typeof defaultMonthlyTarget !== 'number' || defaultMonthlyTarget <= 0) {
      setError('মাসিক অনুদানের লক্ষ্য (Target) ধনাত্মক সংখ্যা হতে হবে।');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (beneficiary) {
        // Edit mode - preserve existing payoutMethod if already stored
        await updateBeneficiary({
          beneficiaryId: beneficiary.id,
          name: name.trim(),
          relationship,
          defaultMonthlyTarget,
          effectiveFromMonth,
          reason: targetChangeReason.trim() || undefined,
          status,
          priorityOrder: typeof priorityOrder === 'number' ? priorityOrder : 10,
          notes: notes.trim() || undefined,
          payoutMethod: beneficiary.payoutMethod || { type: 'bank' },
        });
      } else {
        // Create mode
        await createBeneficiary({
          name: name.trim(),
          relationship,
          defaultMonthlyTarget,
          effectiveFromMonth,
          priorityOrder: typeof priorityOrder === 'number' ? priorityOrder : 10,
          notes: notes.trim() || undefined,
          payoutMethod: { type: 'bank' },
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'অপারেশন ব্যর্থ হয়েছে।';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed & Sticky */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              {beneficiary ? 'পারিবারিক অংশীদার সম্পাদনা' : 'নতুন পারিবারিক অংশীদার নিবন্ধন'}
            </h2>
            <p className="text-xs text-slate-500">
              {beneficiary ? 'মাসিক লক্ষ্য ও তথ্য পরিবর্তন করুন' : 'নতুন অংশীদার ও অনুদান লক্ষ্য যুক্ত করুন'}
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
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Name & Relationship */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  নাম / Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: Brother 1 বা ভাইয়ের নাম"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  সম্পর্ক / Relationship <span className="text-red-500">*</span>
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as 'brother' | 'mother' | 'sister' | 'other')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-medium"
                >
                  {Object.entries(RELATIONSHIP_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.bn} ({val.en})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Monthly Target & Effective Month */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  মাসিক অনুদান লক্ষ্য (BDT) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    min="1"
                    value={defaultMonthlyTarget}
                    onChange={(e) => setDefaultMonthlyTarget(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="45000"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  কার্যকর মাস / Effective Month
                </label>
                <input
                  type="month"
                  value={effectiveFromMonth}
                  onChange={(e) => setEffectiveFromMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            {beneficiary && beneficiary.defaultMonthlyTarget !== defaultMonthlyTarget && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="block font-bold text-amber-800 mb-1">
                  লক্ষ্য পরিবর্তনের কারণ / Change Reason
                </label>
                <input
                  type="text"
                  value={targetChangeReason}
                  onChange={(e) => setTargetChangeReason(e.target.value)}
                  placeholder="যেমন: পারিবারিক সমঝোতা বা বার্ষিক সমন্বয়"
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg outline-hidden text-slate-700"
                />
                <p className="text-[10px] text-amber-700 mt-1">
                  ⚠️ লক্ষ্য পরিবর্তন {effectiveFromMonth} মাস থেকে কার্যকর হবে। পূর্ববর্তী ঐতিহাসিক মাসের স্ন্যাপশট অপরিবর্তিত থাকবে।
                </p>
              </div>
            )}

            {/* Status & Priority Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">স্ট্যাটাস / Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-medium"
                >
                  <option value="active">সক্রিয় (Active)</option>
                  <option value="inactive">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">তালিকা ক্রম / Priority Order</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={priorityOrder}
                  onChange={(e) => setPriorityOrder(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-medium"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">মন্তব্য / Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="অতিরিক্ত কোনো নির্দেশনা..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden"
              />
            </div>
          </div>

          {/* Sticky/Fixed Footer */}
          <div className="shrink-0 flex items-center justify-end gap-2.5 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors"
            >
              বাতিল / Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {loading ? 'সংরক্ষণ হচ্ছে...' : beneficiary ? 'আপডেট করুন' : 'যোগ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
