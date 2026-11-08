import { useState } from 'react';
import type { Property } from '../../types/property';
import type {
  Expense,
  ExpenseGroup,
  ExpenseCategory,
  BuildingExpenseCategory,
  FamilyExpenseCategory,
  PaymentMethod,
} from '../../types/finance';
import {
  createExpense,
  updateExpense,
  BUILDING_CATEGORY_LABELS,
  FAMILY_CATEGORY_LABELS,
} from '../../services/expenseService';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  initialExpense?: Expense | null;
  defaultMonth?: string;
  onSuccess: () => void;
}

export default function ExpenseModal({
  isOpen,
  onClose,
  properties,
  initialExpense,
  defaultMonth,
  onSuccess,
}: ExpenseModalProps) {
  const isEditing = Boolean(initialExpense);

  const [group, setGroup] = useState<ExpenseGroup>(initialExpense?.group || 'building');
  const [category, setCategory] = useState<ExpenseCategory>(
    initialExpense?.category || (group === 'building' ? 'maintenance_repair' : 'bazaar')
  );
  const [title, setTitle] = useState(initialExpense?.title || '');
  const [amount, setAmount] = useState<number | ''>(initialExpense?.amount || '');
  const [propertyId, setPropertyId] = useState(initialExpense?.propertyId || '');
  const [expenseDate, setExpenseDate] = useState(
    initialExpense?.expenseDate ||
      (defaultMonth ? `${defaultMonth}-01` : new Date().toISOString().split('T')[0])
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialExpense?.paymentMethod || 'cash'
  );
  const [paidTo, setPaidTo] = useState(initialExpense?.paidTo || '');
  const [description, setDescription] = useState(initialExpense?.description || '');
  const [reason, setReason] = useState(''); // Required for editing audit log

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleGroupChange(newGroup: ExpenseGroup) {
    setGroup(newGroup);
    if (newGroup === 'building') {
      setCategory('maintenance_repair');
    } else {
      setCategory('bazaar');
      setPropertyId(''); // Reset property for family unless user selects one
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('সঠিক খরচের পরিমাণ লিখুন (০ অপেক্ষা বেশি হতে হবে)।');
      return;
    }

    if (isEditing && !reason.trim()) {
      setError('আর্থিক অডিট ট্রেইল সংরক্ষণের জন্য পরিবর্তনের কারণ লেখা বাধ্যতামূলক।');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && initialExpense) {
        await updateExpense({
          expenseId: initialExpense.id,
          title: title.trim(),
          amount: numAmount,
          group,
          category,
          propertyId: propertyId || undefined,
          expenseDate,
          paymentMethod,
          paidTo: paidTo.trim() || undefined,
          description: description.trim() || undefined,
          reason: reason.trim(),
        });
      } else {
        await createExpense({
          title: title.trim(),
          amount: numAmount,
          group,
          category,
          propertyId: propertyId || undefined,
          expenseDate,
          paymentMethod,
          paidTo: paidTo.trim() || undefined,
          description: description.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[ExpenseModal] Submit error:', err);
      const msg = err instanceof Error ? err.message : 'খরচ সংরক্ষণ করতে সমস্যা হয়েছে।';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const activeProperties = properties.filter((p) => !p.isArchived);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${group === 'building' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v8.25m0-8.25a60.07 60.07 0 0 1 15.797-2.101c.727-.198 1.453.342 1.453 1.096V6m-17.25 0h17.25" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isEditing ? 'খরচ সংশোধন (অডিট ট্রেইল সহ)' : 'নতুন খরচ যোগ করুন'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Edit Expense Record & Maintain Audit History' : 'Record Actual Building or Family Expense'}
              </p>
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
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto overscroll-contain">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {/* Group Toggle: Building vs Family */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                খরচের ধরন / Expense Group <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleGroupChange('building')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    group === 'building'
                      ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${group === 'building' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    🏢
                  </div>
                  <div>
                    <span className="block text-xs leading-snug">ভবন পরিচালন খরচ</span>
                    <span className="block text-[10px] text-slate-400 font-normal">Building Operating</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGroupChange('family')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    group === 'family'
                      ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${group === 'family' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    👨‍👩‍👧‍👦
                  </div>
                  <div>
                    <span className="block text-xs leading-snug">পারিবারিক ও সামাজিক</span>
                    <span className="block text-[10px] text-slate-400 font-normal">Family &amp; Social</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Title & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  খরচের বিবরণ/শিরোনাম / Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: ৩য় তলার পানির পাম্প মেরামত"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  পরিমাণ (টাকা) / Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">৳</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 font-bold text-slate-800"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Category & Property */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ক্যাটাগরি / Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  required
                >
                  {group === 'building'
                    ? (Object.keys(BUILDING_CATEGORY_LABELS) as BuildingExpenseCategory[]).map((cat) => (
                        <option key={cat} value={cat}>
                          {BUILDING_CATEGORY_LABELS[cat].bn} ({BUILDING_CATEGORY_LABELS[cat].en})
                        </option>
                      ))
                    : (Object.keys(FAMILY_CATEGORY_LABELS) as FamilyExpenseCategory[]).map((cat) => (
                        <option key={cat} value={cat}>
                          {FAMILY_CATEGORY_LABELS[cat].bn} ({FAMILY_CATEGORY_LABELS[cat].en})
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  প্রপার্টি / Property
                  {group === 'building' && <span className="text-red-500"> *</span>}
                  {group === 'family' && <span className="text-slate-400 font-normal"> (ঐচ্ছিক)</span>}
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  required={group === 'building'}
                >
                  <option value="">
                    {group === 'building' ? 'প্রপার্টি নির্বাচন করুন' : 'সকল / সাধারণ পারিবারিক'}
                  </option>
                  {activeProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.nameEn})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  তারিখ / Expense Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  পরিশোধ মাধ্যম / Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  required
                >
                  <option value="cash">নগদ (Cash)</option>
                  <option value="bank">ব্যাংক (Bank Transfer)</option>
                  <option value="bkash">বিকাশ (bKash)</option>
                  <option value="nagad">নগদ (Nagad)</option>
                  <option value="other">অন্যান্য (Other)</option>
                </select>
              </div>
            </div>

            {/* Paid To & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  প্রাপক / Paid to / Vendor <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                </label>
                <input
                  type="text"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="যেমন: মোঃ রফিকুল ইসলাম (মিস্ত্রি)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  মন্তব্য / Description <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="খরচ সংক্রান্ত অতিরিক্ত তথ্য..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* Mandatory Audit Reason when editing */}
            {isEditing && (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl">
                <label className="block font-bold text-amber-900 mb-1">
                  সংশোধনের কারণ / Reason for Editing <span className="text-red-600">* (অডিট ট্রেইল)</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="যেমন: ভাউচার যাচাই করে টাকার পরিমাণ সংশোধন..."
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl outline-hidden focus:border-amber-500 text-xs"
                  required
                />
                <p className="text-[10px] text-amber-700 mt-1">
                  আর্থিক জবাবদিহিতা নিশ্চিত করার জন্য এই সংশোধনের কারণ স্থায়ীভাবে অডিট লগে সংরক্ষিত থাকবে।
                </p>
              </div>
            )}
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
              className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                group === 'building'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {loading ? 'সংরক্ষণ হচ্ছে...' : isEditing ? 'সংশোধন নিশ্চিত করুন' : 'খরচ সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
