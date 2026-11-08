import { useState } from 'react';
import type { RentBill, PaymentMethod } from '../../types/finance';
import { recordRentPayment, type RecordPaymentResult } from '../../services/rentService';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: RentBill | null;
  onSuccess: (result: RecordPaymentResult) => void;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  bill,
  onSuccess,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<number | ''>(bill ? bill.balanceDue : '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !bill) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bill) return;
    setError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('অনুগ্রহ করে সঠিক জমার পরিমাণ লিখুন (টাকা ০ এর বেশি হতে হবে)।');
      return;
    }

    if (numAmount > bill.balanceDue) {
      setError(`প্রদত্ত অর্থ (৳${numAmount.toLocaleString('en-IN')}) অবশিষ্ট বকেয়া (৳${bill.balanceDue.toLocaleString('en-IN')}) অপেক্ষা বেশি হতে পারে না।`);
      return;
    }

    setLoading(true);
    try {
      const result = await recordRentPayment({
        billId: bill.id,
        amount: numAmount,
        paymentMethod,
        transactionId: transactionId.trim() || undefined,
        paymentDate,
        notes: notes.trim() || undefined,
      });

      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      console.error('[RecordPaymentModal] Submit error:', err);
      const msg = err instanceof Error ? err.message : 'পেমেন্ট জমা করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">ভাড়া আদায় ও পেমেন্ট রেকর্ড</h3>
            <p className="text-xs text-slate-500">Record Rent Collection &amp; Partial/Full Payment</p>
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
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto overscroll-contain">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {/* Bill Summary Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">{bill.tenantName}</span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  মাস: {bill.billingMonth}
                </span>
              </div>
              <div className="text-slate-500 flex items-center gap-2">
                <span>{bill.propertyName}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700">ইউনিট: {bill.unitNumber}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">মোট দাবি</span>
                  <span className="font-bold text-slate-800">৳{bill.totalDue.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">পরিশোধিত</span>
                  <span className="font-bold text-emerald-600">৳{bill.totalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">অবশিষ্ট বকেয়া</span>
                  <span className="font-bold text-amber-600">৳{bill.balanceDue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  জমার পরিমাণ (টাকা) / Amount <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(bill.balanceDue)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  সম্পূর্ণ বকেয়া (৳{bill.balanceDue.toLocaleString('en-IN')})
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  min="1"
                  max={bill.balanceDue}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={`সর্বোচ্চ ৳${bill.balanceDue}`}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 font-bold text-slate-800"
                  required
                />
              </div>
              {Number(amount) > 0 && Number(amount) < bill.balanceDue && (
                <p className="text-[11px] text-amber-600 mt-1">
                  আংশিক পেমেন্ট: এই পেমেন্টের পর অবশিষ্ট থাকবে ৳{(bill.balanceDue - Number(amount)).toLocaleString('en-IN')}
                </p>
              )}
              {Number(amount) === bill.balanceDue && (
                <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                  ✓ সম্পূর্ণ বিল পরিশোধিত হবে (Paid)
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                পরিশোধের মাধ্যম / Payment Method <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { id: 'cash', label: 'নগদ', sub: 'Cash' },
                  { id: 'bank', label: 'ব্যাংক', sub: 'Bank' },
                  { id: 'bkash', label: 'বিকাশ', sub: 'bKash' },
                  { id: 'nagad', label: 'নগদ', sub: 'Nagad' },
                  { id: 'other', label: 'অন্যান্য', sub: 'Other' },
                ].map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      paymentMethod === m.id
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="block leading-tight">{m.label}</span>
                    <span className="block text-[9px] text-slate-400 font-normal">{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Date & Transaction ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  পরিশোধের তারিখ / Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ট্রানজ্যাকশন আইডি / TxID
                  {paymentMethod !== 'cash' && <span className="text-slate-400 font-normal"> (ডিজিটাল পেমেন্ট)</span>}
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="যেমন: TR7X9B01..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 font-mono text-xs"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                মন্তব্য / Notes <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="পেমেন্ট সংক্রান্ত কোনো বিবরণ..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
              />
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
              {loading ? 'পেমেন্ট প্রসেস হচ্ছে...' : 'পেমেন্ট নিশ্চিত করুন / Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
