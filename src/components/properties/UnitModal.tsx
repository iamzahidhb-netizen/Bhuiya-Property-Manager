import { useState, type FormEvent } from 'react';
import type { Unit, UnitInput, UnitType, UnitStatus } from '../../types/property';

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UnitInput) => Promise<void>;
  unitToEdit: Unit | null;
  propertyId: string;
  propertyName: string;
  ownerUid: string;
  existingUnits?: Unit[];
}

export default function UnitModal({
  isOpen,
  onClose,
  onSave,
  unitToEdit,
  propertyId,
  propertyName,
  ownerUid,
  existingUnits = [],
}: UnitModalProps) {
  const [unitNumber, setUnitNumber] = useState(unitToEdit?.unitNumber || '');
  const [type, setType] = useState<UnitType>(unitToEdit?.type || 'flat');
  const [floor, setFloor] = useState<string>(unitToEdit ? String(unitToEdit.floor) : '1');
  const [monthlyRent, setMonthlyRent] = useState<number>(unitToEdit?.monthlyRent || 0);
  const [serviceCharge, setServiceCharge] = useState<number>(unitToEdit?.serviceCharge || 0);
  const [status, setStatus] = useState<UnitStatus>(unitToEdit?.status || 'vacant');
  const [electricityMeterNumber, setElectricityMeterNumber] = useState(unitToEdit?.electricityMeterNumber || '');
  const [gasMeterNumber, setGasMeterNumber] = useState(unitToEdit?.gasMeterNumber || '');
  const [notes, setNotes] = useState(unitToEdit?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!unitNumber.trim()) {
      setError('ইউনিট / ফ্ল্যাট নম্বর আবশ্যক। / Unit number is required.');
      return;
    }

    // Client-side duplicate check against active units under this property
    const normalizedInput = unitNumber.trim().toLowerCase().replace(/[\s\-_/]+/g, '');
    const isDuplicate = existingUnits.some(
      (u) =>
        !u.isArchived &&
        u.id !== unitToEdit?.id &&
        u.unitNumber.trim().toLowerCase().replace(/[\s\-_/]+/g, '') === normalizedInput
    );
    if (isDuplicate) {
      setError(`এই প্রপার্টিতে "${unitNumber.trim()}" নম্বরের একটি ইউনিট ইতিমধ্যে সক্রিয় রয়েছে।`);
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ownerUid,
        propertyId,
        unitNumber: unitNumber.trim(),
        type,
        floor: floor.trim() || '1',
        monthlyRent: Number(monthlyRent) || 0,
        serviceCharge: Number(serviceCharge) || 0,
        status,
        currentTenantId: unitToEdit ? unitToEdit.currentTenantId : null,
        electricityMeterNumber: electricityMeterNumber.trim(),
        gasMeterNumber: gasMeterNumber.trim(),
        notes: notes.trim(),
        isArchived: unitToEdit ? unitToEdit.isArchived : false,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Error saving unit:', err);
      setError(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে। / Failed to save.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {unitToEdit ? 'ইউনিট সম্পাদনা / Edit Unit' : 'নতুন ইউনিট যোগ করুন / Add Unit'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">প্রপার্টি: {propertyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-5 sm:px-6 py-4 overflow-y-auto space-y-4 flex-1 overscroll-contain text-xs">
            {error && (
              <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ইউনিট / ফ্ল্যাট নম্বর * <span className="font-normal text-slate-400">/ Unit No.</span>
                </label>
                <input
                  type="text"
                  required
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="যেমন: ফ্ল্যাট ৩এ, দোকান ১২"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ইউনিটের ধরন <span className="font-normal text-slate-400">/ Type</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as UnitType)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden bg-white"
                >
                  <option value="flat">ফ্ল্যাট / Flat</option>
                  <option value="shop">দোকান / Shop</option>
                  <option value="room">রুম / Single Room</option>
                  <option value="office">অফিস / Office</option>
                  <option value="warehouse">গুদাম / Warehouse</option>
                  <option value="other">অন্যান্য / Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  তলা / ফ্লোর <span className="font-normal text-slate-400">/ Floor</span>
                </label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="যেমন: 1, 2, গ্রাউন্ড"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মাসিক ভাড়া (৳) <span className="font-normal text-slate-400">/ Rent</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সার্ভিস চার্জ (৳) <span className="font-normal text-slate-400">/ Service</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                স্ট্যাটাস <span className="font-normal text-slate-400">/ Status</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UnitStatus)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden bg-white"
              >
                <option value="vacant">খালি / Vacant</option>
                <option value="occupied">ভাড়া দেওয়া হয়েছে / Occupied</option>
                <option value="under_maintenance">মেরামত চলছে / Under Maintenance</option>
                <option value="archived">নিষ্ক্রিয় / Archived</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিদ্যুৎ মিটার নং <span className="font-normal text-slate-400">/ Electric Meter</span>
                </label>
                <input
                  type="text"
                  value={electricityMeterNumber}
                  onChange={(e) => setElectricityMeterNumber(e.target.value)}
                  placeholder="মিটার নম্বর"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  গ্যাস মিটার নং <span className="font-normal text-slate-400">/ Gas Meter</span>
                </label>
                <input
                  type="text"
                  value={gasMeterNumber}
                  onChange={(e) => setGasMeterNumber(e.target.value)}
                  placeholder="গ্যাস সংযোগ/মিটার"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                নোট বা বিবরণ <span className="font-normal text-slate-400">/ Notes</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="অতিরিক্ত কোনো তথ্য বা শর্ত..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden resize-none"
              />
            </div>
          </div>

          {/* Sticky/Fixed Footer */}
          <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              বাতিল / Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {unitToEdit ? 'আপডেট করুন / Update' : 'সংরক্ষণ করুন / Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
