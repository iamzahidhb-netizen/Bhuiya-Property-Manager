import React, { useState } from 'react';
import type { ReserveFundAccount } from '../../types/finance';
import {
  withdrawFromReserve,
  transferSurplusToReserve,
} from '../../services/distributionService';

interface ReserveFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  distributionMonth: string;
  reserveFund: ReserveFundAccount | null;
  availableMonthlySurplus: number;
  onSuccess: () => void;
}

export default function ReserveFundModal({
  isOpen,
  onClose,
  distributionMonth,
  reserveFund,
  availableMonthlySurplus,
  onSuccess,
}: ReserveFundModalProps) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentReserveBalance = reserveFund?.currentBalance || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof amount !== 'number' || amount <= 0) {
      setError('টাকার পরিমাণ ১ বা তার বেশি হতে হবে।');
      return;
    }

    if (mode === 'withdraw' && amount > currentReserveBalance) {
      setError(`অপর্যাপ্ত রিজার্ভ ব্যালেন্স! বর্তমান তহবিল ৳${currentReserveBalance.toLocaleString('en-IN')}`);
      return;
    }

    if (mode === 'deposit' && amount > availableMonthlySurplus) {
      setError(`মাসিক নিট উদ্বৃত্তের চেয়ে বেশি জমা করা সম্ভব নয়। উপলভ্য উদ্বৃত্ত: ৳${availableMonthlySurplus.toLocaleString('en-IN')}`);
      return;
    }

    if (!reason.trim()) {
      setError('ট্রানজ্যাকশনের কারণ উল্লেখ করা বাধ্যতামূলক।');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'withdraw') {
        await withdrawFromReserve({
          amount,
          reason: reason.trim(),
          distributionMonth,
        });
      } else {
        await transferSurplusToReserve({
          amount,
          reason: reason.trim(),
          distributionMonth,
        });
      }

      onSuccess();
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
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-base font-bold text-slate-800">পারিবারিক রিজার্ভ ফান্ড লেনদেন</h2>
            <p className="text-xs text-slate-500">Emergency &amp; Family Reserve Fund Management</p>
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
            {/* Current Balance & Surplus Card */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <span className="text-[10px] font-bold text-indigo-700 uppercase block">রিজার্ভ ফান্ড ব্যালেন্স</span>
                <span className="text-lg font-black text-indigo-900">
                  ৳{currentReserveBalance.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">চলতি মাসের নিট উদ্বৃত্ত</span>
                <span className="text-lg font-black text-emerald-900">
                  ৳{availableMonthlySurplus.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMode('deposit');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                  mode === 'deposit'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                (+) উদ্বৃত্ত জমা / Deposit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('withdraw');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                  mode === 'withdraw'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                (-) ঘাটতি উত্তোলন / Withdraw
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                টাকার পরিমাণ (BDT) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-black text-slate-900 text-base"
                  required
                />
              </div>
              {mode === 'deposit' && availableMonthlySurplus > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(availableMonthlySurplus)}
                  className="mt-1 text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  সম্পূর্ণ উদ্বৃত্ত জমা করুন (৳{availableMonthlySurplus.toLocaleString('en-IN')})
                </button>
              )}
              {mode === 'withdraw' && currentReserveBalance > 0 && (
                <p className="mt-1 text-[10px] text-slate-400">
                  সর্বোচ্চ উত্তোলনযোগ্য: ৳{currentReserveBalance.toLocaleString('en-IN')} (নেগেটিভ ব্যালেন্স কঠোরভাবে নিষিদ্ধ)
                </p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                লেনদেনের কারণ / Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  mode === 'deposit'
                    ? `${distributionMonth} মাসের উদ্বৃত্ত তহবিল স্থানান্তর`
                    : `${distributionMonth} মাসের অনুদান ঘাটতি পূরণ বা জরুরি ব্যয়`
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
                required
              />
            </div>

            <p className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              ℹ️ আর্থিক সুরক্ষা বিধি: রিজার্ভ ফান্ড উত্তোলন কখনই বাড়ি ভাড়ার আয় হিসেবে গণ্য হবে না। সকল লেনদেন অপরিবর্তনযোগ্য লেজারে স্থায়ীভাবে সংরক্ষিত থাকবে।
            </p>
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
              className={`px-5 py-2 rounded-xl text-white font-bold shadow-md transition-all cursor-pointer ${
                mode === 'deposit'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
              }`}
            >
              {loading ? 'প্রসেসিং...' : mode === 'deposit' ? 'উদ্বৃত্ত জমা করুন' : 'তহবিল উত্তোলন করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
