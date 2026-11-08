import { useState } from 'react';
import type { Property } from '../../types/property';
import { generateMonthlyBills, type GenerateBillsResult } from '../../services/rentService';

interface GenerateBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  defaultMonth: string;
  onSuccess: (result: GenerateBillsResult) => void;
}

export default function GenerateBillsModal({
  isOpen,
  onClose,
  properties,
  defaultMonth,
  onSuccess,
}: GenerateBillsModalProps) {
  const [billingMonth, setBillingMonth] = useState(defaultMonth);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!billingMonth) {
      setError('অনুগ্রহ করে বিলিং মাস নির্ধারণ করুন।');
      return;
    }

    setLoading(true);
    try {
      const res = await generateMonthlyBills({
        billingMonth,
        propertyId: selectedPropertyId || undefined,
      });

      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      console.error('[GenerateBillsModal] Error:', err);
      const msg = err instanceof Error ? err.message : 'বিল তৈরি করতে সমস্যা হয়েছে।';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const activeProperties = properties.filter((p) => !p.isArchived);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">মাসিক বিল তৈরি করুন</h3>
              <p className="text-xs text-slate-500">Generate Monthly Rent Demand</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleGenerate} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto overscroll-contain">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {/* Billing Month */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                বিলিং মাস / Billing Month <span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 font-semibold text-slate-800"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                সকল সক্রিয় ভাড়াটিয়ার জন্য এই মাসের জন্য আলাদা বিল তৈরি হবে।
              </p>
            </div>

            {/* Property Filter */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                প্রপার্টি / Property <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
              >
                <option value="">সকল প্রপার্টি (All Properties)</option>
                {activeProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.nameEn})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                খালি রাখলে সকল ভবনের সক্রিয় ভাড়াটিয়াদের বিল তৈরি হবে।
              </p>
            </div>

            {/* Idempotency Notice */}
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <span>🛡️ ডুপ্লিকেট রোধ নীতি (Idempotent):</span>
              </p>
              <p className="text-blue-700">
                যেসব ভাড়াটিয়ার এই মাসের বিল ইতিমধ্যে তৈরি করা হয়েছে, সেগুলো স্বয়ংক্রিয়ভাবে স্কিপ হবে। কোনো ডুপ্লিকেট তৈরি হবে না।
              </p>
            </div>
          </div>

          {/* Sticky/Fixed Footer */}
          <div className="shrink-0 flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer disabled:opacity-50"
            >
              বাতিল / Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'বিল তৈরি হচ্ছে...' : 'বিল তৈরি করুন / Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
