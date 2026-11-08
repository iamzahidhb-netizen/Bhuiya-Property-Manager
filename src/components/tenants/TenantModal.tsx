import { useState } from 'react';
import type { Property, Unit } from '../../types/property';
import type { TenantFormData } from '../../types/tenant';

interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TenantFormData) => Promise<void>;
  properties: Property[];
  units: Unit[];
  initialPropertyId?: string;
  initialUnitId?: string;
}

export default function TenantModal({
  isOpen,
  onClose,
  onSave,
  properties,
  units,
  initialPropertyId,
  initialUnitId,
}: TenantModalProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    () => initialPropertyId || (properties.find((p) => !p.isArchived)?.id || '')
  );
  const [selectedUnitId, setSelectedUnitId] = useState(() => initialUnitId || '');

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [nid, setNid] = useState('');
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState<number | ''>(() => {
    if (initialUnitId) {
      const u = units.find((item) => item.id === initialUnitId);
      if (u && u.monthlyRent > 0) return u.monthlyRent;
    }
    return '';
  });
  const [gasCharge, setGasCharge] = useState<number | ''>('');
  const [waterCharge, setWaterCharge] = useState<number | ''>('');
  const [advanceDeposit, setAdvanceDeposit] = useState<number | ''>('');
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active non-archived properties
  const activeProperties = properties.filter((p) => !p.isArchived);

  // Filter vacant units under the selected property
  const vacantUnits = units.filter(
    (u) =>
      u.propertyId === selectedPropertyId &&
      !u.isArchived &&
      u.status === 'vacant' &&
      !u.currentTenantId
  );

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('ভাড়াটিয়ার নাম প্রদান করুন। / Please enter tenant name.');
      return;
    }
    if (!mobile.trim()) {
      setError('মোবাইল নম্বর প্রদান করুন। / Please enter mobile number.');
      return;
    }
    if (!selectedPropertyId) {
      setError('অনুগ্রহ করে প্রপার্টি নির্বাচন করুন। / Please select a property.');
      return;
    }
    if (!selectedUnitId) {
      setError('অনুগ্রহ করে একটি খালি ইউনিট নির্বাচন করুন। / Please select a vacant unit.');
      return;
    }
    if (monthlyRent === '' || monthlyRent < 0) {
      setError('সঠিক মাসিক ভাড়ার পরিমাণ লিখুন। / Please enter valid monthly rent.');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        propertyId: selectedPropertyId,
        unitId: selectedUnitId,
        name: name.trim(),
        mobile: mobile.trim(),
        nid: nid.trim() || undefined,
        address: address.trim() || undefined,
        monthlyRent: Number(monthlyRent),
        gasCharge: gasCharge !== '' ? Number(gasCharge) : 0,
        waterCharge: waterCharge !== '' ? Number(waterCharge) : 0,
        advanceDeposit: advanceDeposit !== '' ? Number(advanceDeposit) : 0,
        moveInDate,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed & Sticky, never scrolls */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              নতুন ভাড়াটিয়া নিবন্ধন
            </h3>
            <p className="text-xs text-slate-500">
              Register New Tenant & Assign Vacant Unit
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

            {/* Section 1: Property & Unit Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রপার্টি / Property <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => {
                    setSelectedPropertyId(e.target.value);
                    setSelectedUnitId('');
                  }}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  required
                >
                  <option value="">প্রপার্টি নির্বাচন করুন</option>
                  {activeProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  খালি ইউনিট / Vacant Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => {
                    const uId = e.target.value;
                    setSelectedUnitId(uId);
                    const found = units.find((item) => item.id === uId);
                    if (found && found.monthlyRent > 0) {
                      setMonthlyRent(found.monthlyRent);
                    }
                  }}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  required
                  disabled={!selectedPropertyId || vacantUnits.length === 0}
                >
                  <option value="">
                    {vacantUnits.length === 0
                      ? 'কোনো খালি ইউনিট নেই'
                      : 'ইউনিট নির্বাচন করুন'}
                  </option>
                  {vacantUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber} (ফ্লোর: {u.floor}, ভাড়া: ৳{u.monthlyRent.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
                {vacantUnits.length === 0 && selectedPropertyId && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    এই ভবনে কোনো খালি ফ্ল্যাট বা ইউনিট অবশিষ্ট নেই।
                  </p>
                )}
              </div>
            </div>

            {/* Section 2: Tenant Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ভাড়াটিয়ার পুরো নাম / Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: মো: রফিকুল ইসলাম"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মোবাইল নম্বর / Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="যেমন: 01712345678"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  জাতীয় পরিচয়পত্র / NID (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                  placeholder="NID নম্বর"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  উঠা / যোগদানের তারিখ (Move-in Date) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                বর্তমান বা স্থায়ী ঠিকানা / Address (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ঠিকানা লিখুন..."
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>

            {/* Section 3: Financial & Utility Terms */}
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
              <h4 className="text-xs font-bold text-blue-900">
                ভাড়া ও জামানত বিবরণ / Rent & Security Deposit
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মাসিক ভাড়া (টাকা) / Monthly Rent (৳) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    অগ্রিম / সিকিউরিটি ডিপোজিট (৳)
                    <span className="ml-1 text-[10px] text-amber-700 font-normal">
                      (দায় / Liability, আয় নয়)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={advanceDeposit}
                    onChange={(e) => setAdvanceDeposit(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    গ্যাস বিল / Gas Charge (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={gasCharge}
                    onChange={(e) => setGasCharge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    পানি বিল / Water Charge (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={waterCharge}
                    onChange={(e) => setWaterCharge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                বিশেষ মন্তব্য / Notes (ঐচ্ছিক)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="পেশা, পরিবার সদস্য সংখ্যা বা অন্যান্য তথ্য..."
                rows={2}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
              />
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
              disabled={loading || !selectedUnitId}
              className="px-6 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  সংরক্ষণ হচ্ছে...
                </>
              ) : (
                'নিবন্ধন সম্পন্ন করুন'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
