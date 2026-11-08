import { useState } from 'react';
import type { Expense } from '../../types/finance';
import { reverseExpense, EXPENSE_CATEGORY_LABELS } from '../../services/expenseService';

interface ExpenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onEdit: (expense: Expense) => void;
  onReversed: () => void;
}

export default function ExpenseDetailsModal({
  isOpen,
  onClose,
  expense,
  onEdit,
  onReversed,
}: ExpenseDetailsModalProps) {
  const [reversing, setReversing] = useState(false);
  const [showReversalPrompt, setShowReversalPrompt] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  async function handleReverse() {
    if (!expense) return;
    if (!reversalReason.trim()) {
      setError('খরচ বাতিলের কারণ লেখা বাধ্যতামূলক।');
      return;
    }

    setReversing(true);
    setError(null);
    try {
      await reverseExpense({
        expenseId: expense.id,
        reason: reversalReason.trim(),
      });
      onReversed();
      onClose();
    } catch (err: unknown) {
      console.error('[ExpenseDetailsModal] Reversal error:', err);
      const msg = err instanceof Error ? err.message : 'খরচ বাতিল করতে সমস্যা হয়েছে।';
      setError(msg);
    } finally {
      setReversing(false);
    }
  }

  const catLabel = EXPENSE_CATEGORY_LABELS[expense.category] || { bn: expense.category, en: expense.category };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${expense.group === 'building' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <span className="text-base">{expense.group === 'building' ? '🏢' : '👨‍👩‍👧‍👦'}</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">খরচের বিস্তারিত বিবরণ</h3>
              <p className="text-xs text-slate-500">Expense Details &amp; Historical Audit Trail</p>
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

        {error && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium shrink-0">
            {error}
          </div>
        )}

        {/* Content body - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4 sm:p-6 text-xs overscroll-contain">
          {/* Main Card */}
          <div className={`p-4 rounded-2xl border ${expense.status === 'reversed' ? 'bg-red-50/60 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1.5 ${expense.group === 'building' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {expense.group === 'building' ? 'ভবন পরিচালন খরচ' : 'পারিবারিক ও সামাজিক খরচ'}
                </span>
                <h2 className="text-base font-black text-slate-900">{expense.title}</h2>
                <p className="text-slate-500 mt-0.5 font-medium">
                  {catLabel.bn} ({catLabel.en})
                </p>
              </div>

              <div className="text-right">
                <span className={`text-2xl font-black block ${expense.status === 'reversed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  ৳{expense.amount.toLocaleString('en-IN')}
                </span>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 ${expense.status === 'reversed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {expense.status === 'reversed' ? 'বাতিলকৃত (Reversed)' : 'সক্রিয় (Active)'}
                </span>
              </div>
            </div>

            {expense.status === 'reversed' && expense.reversalReason && (
              <div className="mt-3 p-2.5 bg-red-100/70 border border-red-200 rounded-xl text-red-800 text-[11px]">
                <span className="font-bold">বাতিলের কারণ: </span>
                <span>{expense.reversalReason}</span>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-slate-600">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">তারিখ / Date</span>
              <span className="font-bold text-slate-800">{expense.expenseDate}</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">পরিশোধ মাধ্যম</span>
              <span className="font-bold text-slate-800 capitalize">{expense.paymentMethod}</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">প্রপার্টি / ভবন</span>
              <span className="font-bold text-slate-800">{expense.propertyName || 'সাধারণ / প্রযোজ্য নয়'}</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">প্রাপক / Vendor</span>
              <span className="font-bold text-slate-800">{expense.paidTo || 'অনুল্লিখিত'}</span>
            </div>
          </div>

          {expense.description && (
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase mb-0.5">মন্তব্য / বিবরণ</span>
              <p className="text-slate-700 leading-relaxed">{expense.description}</p>
            </div>
          )}

          {/* Complete Audit History Trail */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>📜 আর্থিক অডিট ইতিহাস / Audit Trail</span>
              <span className="text-[10px] font-normal text-slate-400">
                ({expense.auditHistory?.length || 0} টি পরিবর্তন)
              </span>
            </h4>

            {(!expense.auditHistory || expense.auditHistory.length === 0) ? (
              <p className="text-[11px] text-slate-400 p-3 bg-slate-50 rounded-xl border border-slate-200">
                এই খরচ তৈরীর পর কোনো প্রকার পরিবর্তন বা সংশোধন করা হয়নি। মূল রেকর্ড অবিকৃত রয়েছে।
              </p>
            ) : (
              <div className="space-y-2">
                {expense.auditHistory.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-bold text-amber-900">
                      <span>সংশোধন #{idx + 1}</span>
                      <span className="font-mono text-[10px] text-slate-500 font-normal">
                        {entry.editedAt ? String(entry.editedAt).slice(0, 19).replace('T', ' ') : 'তারিখ সংরক্ষিত'}
                      </span>
                    </div>
                    <p className="text-amber-800">
                      <span className="font-semibold">কারণ:</span> {entry.reason}
                    </p>
                    <div className="flex flex-wrap gap-x-4 text-[10px] text-slate-600 pt-0.5">
                      <span>
                        টাকার পরিবর্তন: ৳{entry.previousAmount?.toLocaleString('en-IN')} → <span className="font-bold text-slate-900">৳{entry.newAmount?.toLocaleString('en-IN')}</span>
                      </span>
                      {entry.previousTitle !== entry.newTitle && (
                        <span>
                          শিরোনাম: {entry.previousTitle} → <span className="font-bold text-slate-900">{entry.newTitle}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">সম্পাদনাকারী: {entry.editedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reversal Confirmation Prompt */}
          {showReversalPrompt && expense.status === 'active' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3 mt-3 animate-in fade-in">
              <div>
                <h5 className="font-bold text-red-900 text-xs">খরচ বাতিল নিশ্চিতকরণ (Financial Reversal)</h5>
                <p className="text-[11px] text-red-700 mt-0.5">
                  আর্থিক নীতিমালা অনুযায়ী রেকর্ড মুছে ফেলা হবে না, তবে নিট পরিচালন হিসাব থেকে বাদ দিতে এটি 'বাতিল' হিসেবে চিহ্নিত হবে।
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-red-800 mb-1">
                  বাতিলের কারণ / Reason <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="যেমন: ভুল এন্ট্রি / ভাউচার ডুপ্লিকেট..."
                  className="w-full px-3 py-2 bg-white border border-red-300 rounded-xl outline-hidden text-xs text-slate-800"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReversalPrompt(false)}
                  disabled={reversing}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleReverse}
                  disabled={reversing}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {reversing ? 'বাতিল হচ্ছে...' : 'বাতিল নিশ্চিত করুন'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions - Fixed */}
        <div className="shrink-0 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            {expense.status === 'active' && !showReversalPrompt && (
              <button
                type="button"
                onClick={() => setShowReversalPrompt(true)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
              >
                খরচ বাতিল করুন (Reversal)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {expense.status === 'active' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(expense);
                }}
                className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors cursor-pointer"
              >
                সংশোধন করুন (Edit)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              বন্ধ করুন / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
