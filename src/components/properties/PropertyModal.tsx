import { useState, type FormEvent } from 'react';
import type { Property, PropertyInput, PropertyType } from '../../types/property';

interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PropertyInput) => Promise<void>;
  propertyToEdit: Property | null;
  ownerUid: string;
}

export default function PropertyModal({
  isOpen,
  onClose,
  onSave,
  propertyToEdit,
  ownerUid,
}: PropertyModalProps) {
  const [name, setName] = useState(propertyToEdit?.name || '');
  const [nameEn, setNameEn] = useState(propertyToEdit?.nameEn || '');
  const [code, setCode] = useState(propertyToEdit?.code || '');
  const [type, setType] = useState<PropertyType>(propertyToEdit?.type || 'residential');
  const [address, setAddress] = useState(propertyToEdit?.address || '');
  const [totalFloors, setTotalFloors] = useState<number>(propertyToEdit?.totalFloors || 1);
  const [description, setDescription] = useState(propertyToEdit?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('প্রপার্টির নাম (বাংলা) আবশ্যক। / Bangla property name is required.');
      return;
    }

    const generatedCode = code.trim() || nameEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'property-' + Date.now();

    setLoading(true);
    try {
      await onSave({
        ownerUid,
        name: name.trim(),
        nameEn: nameEn.trim() || name.trim(),
        code: generatedCode,
        type,
        address: address.trim(),
        totalFloors: Number(totalFloors) || 1,
        description: description.trim(),
        status: propertyToEdit ? propertyToEdit.status : 'active',
        isArchived: propertyToEdit ? propertyToEdit.isArchived : false,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Error saving property:', err);
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
              {propertyToEdit ? 'প্রপার্টি সম্পাদনা / Edit Property' : 'নতুন প্রপার্টি যোগ করুন / Add New Property'}
            </h3>
            <p className="text-xs text-slate-500">ভবন বা স্থাপনার মৌলিক বিবরণ পূরণ করুন</p>
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
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain text-xs">
            {error && (
              <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রপার্টির নাম (বাংলা) * <span className="font-normal text-slate-400">/ Property Name (Bangla)</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: ভূঁইয়া বাড়ি"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নাম (ইংরেজি) <span className="font-normal text-slate-400">/ Name (English)</span>
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Bhuiya Bari"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  কোড / স্লাগ <span className="font-normal text-slate-400">/ Code (Optional)</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="যেমন: bhuiya-bari"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রপার্টির ধরন <span className="font-normal text-slate-400">/ Type</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PropertyType)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden bg-white"
                >
                  <option value="residential">আবাসিক / Residential</option>
                  <option value="commercial">বাণিজ্যিক / Commercial</option>
                  <option value="mixed">মিশ্র / Mixed Use</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মোট তলা <span className="font-normal text-slate-400">/ Total Floors</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={totalFloors}
                  onChange={(e) => setTotalFloors(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ঠিকানা / অবস্থান <span className="font-normal text-slate-400">/ Address</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="যেমন: ওয়ার্ড নং ৪, প্রধান সড়ক"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                বিবরণ বা নোট <span className="font-normal text-slate-400">/ Description</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ভবন সংক্রান্ত অতিরিক্ত তথ্য..."
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
              {propertyToEdit ? 'আপডেট করুন / Update' : 'সংরক্ষণ করুন / Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
