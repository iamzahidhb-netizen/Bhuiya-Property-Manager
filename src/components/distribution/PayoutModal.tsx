import React, { useState } from 'react';
import type { BeneficiarySnapshot, PaymentMethod } from '../../types/finance';
import { recordBeneficiaryPayout } from '../../services/distributionService';

interface PayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  distributionMonth: string;
  snapshot: BeneficiarySnapshot | null;
  availableCashPool: number; // Max cash currently payable from operating + reserve inflow
  onPaid: () => void;
}

export default function PayoutModal({
  isOpen,
  onClose,
  distributionMonth,
  snapshot,
  availableCashPool,
  onPaid,
}: PayoutModalProps) {
  const initialMax = snapshot ? Math.max(0, Math.min(snapshot.pendingAmount, availableCashPool)) : 0;
  const [amount, setAmount] = useState<number | ''>(snapshot ? (initialMax > 0 ? initialMax : snapshot.pendingAmount) : '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !snapshot) return null;

  const maxAllowedDisbursement = Math.min(snapshot.pendingAmount, availableCashPool);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof amount !== 'number' || amount <= 0) {
      setError('পেমেন্টের পরিমাণ ১ টাকা বা তার বেশি হতে হবে।');
      return;
    }
    if (amount > snapshot!.pendingAmount) {
      setError(`পেমেন্টের পরিমাণ অবশিষ্ট লক্ষ্য (৳${snapshot!.pendingAmount.toLocaleString('en-IN')}) এর চেয়ে বেশি হতে পারবে না।`);
      return;
    }
    if (amount > availableCashPool) {
      setError(`অপর্যাপ্ত ফান্ড! বর্তমান অনুমোদিত নগদ তহবিল (৳${availableCashPool.toLocaleString('en-IN')}) এর বেশি প্রদান করা যাবে না।`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await recordBeneficiaryPayout({
        distributionMonth,
        beneficiaryId: snapshot!.beneficiaryId,
        amount,
        paymentMethod,
        paymentDate,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onPaid();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'পেমেন্ট সম্পন্ন করা যায়নি।';
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
            <h2 className="text-base font-bold text-slate-800">পারিবারিক অনুদান বিতরণ / Payout</h2>
            <p className="text-xs text-slate-500">{distributionMonth} মাসের অনুমোদিত তহবিল হতে প্রদান</p>
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
          <div className="p-4 sm:p-6 space-y-3.5 text-xs flex-1 overflow-y-auto overscroll-contain">
            {/* Beneficiary Target Summary Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">প্রাপক অংশীদার:</span>
                <span className="font-bold text-slate-900">{snapshot.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">অনুমোদিত মোট লক্ষ্য:</span>
                <span className="font-bold text-blue-700">৳{snapshot.effectiveTarget.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">পূর্বে পরিশোধিত:</span>
                <span className="font-bold text-emerald-600">৳{snapshot.actualDisbursed.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">অবশিষ্ট বকেয়া লক্ষ্য:</span>
                <span className="font-extrabold text-amber-600">৳{snapshot.pendingAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Cash pool restriction alert */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs">
              <div className="flex items-center justify-between font-bold text-blue-900 mb-0.5">
                <span>উপলব্ধ অপারেটিং ও রিজার্ভ তহবিল:</span>
                <span>৳{availableCashPool.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-blue-700">
                {availableCashPool <= 0
                  ? '⚠️ বর্তমানে কোনো উদ্বৃত্ত তহবিল অবশিষ্ট নেই। রিজার্ভ ফান্ড হতে উইথড্র করে ঘাটতি পূরণ করুন।'
                  : `সর্বোচ্চ প্রদানযোগ্য: ৳${maxAllowedDisbursement.toLocaleString('en-IN')}`}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Payout Amount */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                প্রদানের পরিমাণ (BDT) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                <input
                  type="number"
                  min="1"
                  max={maxAllowedDisbursement}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-black text-slate-900 text-base"
                  required
                />
              </div>
              {snapshot.pendingAmount > 0 && maxAllowedDisbursement > 0 && (
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(maxAllowedDisbursement)}
                    className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md hover:bg-blue-100 cursor-pointer"
                  >
                    সর্বোচ্চ অনুমোদিত (৳{maxAllowedDisbursement.toLocaleString('en-IN')})
                  </button>
                  {maxAllowedDisbursement > snapshot.pendingAmount / 2 && (
                    <button
                      type="button"
                      onClick={() => setAmount(Math.round(snapshot.pendingAmount / 2))}
                      className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md hover:bg-slate-200 cursor-pointer"
                    >
                      ৫০% কিস্তি
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">পেমেন্ট মেথড</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['bank', 'bkash', 'nagad', 'cash'] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border uppercase transition-all cursor-pointer ${
                      paymentMethod === m
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Transaction ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">প্রদানের তারিখ</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ট্রানজ্যাকশন / রেফারেন্স আইডি</label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="TXN-98432"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="পেমেন্ট রসিদ বা পারিবারিক বিবরণ..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Action buttons - Fixed Footer */}
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
              disabled={loading || availableCashPool <= 0}
              className="px-5 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'প্রসেসিং হচ্ছে...' : 'পেমেন্ট নিশ্চিত করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
