import { useState, useEffect } from 'react';
import type { Property, Unit, UnitInput } from '../../types/property';
import {
  subscribeUnits,
  createUnit,
  updateUnit,
  archiveUnit,
} from '../../services/propertyService';
import UnitModal from './UnitModal';

interface UnitListProps {
  property: Property;
  ownerUid: string;
  workspaceId?: string | null;
  onBack: () => void;
}

export default function UnitList({ property, ownerUid, workspaceId, onBack }: UnitListProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<Unit | null>(null);

  useEffect(() => {
    const effectiveWorkspaceId = workspaceId || property.workspaceId;
    const unsubscribe = subscribeUnits(
      ownerUid,
      property.id,
      (fetchedUnits) => {
        setUnits(fetchedUnits);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      effectiveWorkspaceId
    );

    return () => unsubscribe();
  }, [ownerUid, property.id, workspaceId, property.workspaceId]);

  async function handleSaveUnit(data: UnitInput) {
    if (unitToEdit) {
      await updateUnit(unitToEdit.id, data);
    } else {
      await createUnit(data);
    }
  }

  async function handleArchiveToggle(unit: Unit) {
    const confirmMsg = unit.isArchived
      ? `আপনি কি "${unit.unitNumber}" ইউনিটটি পুনরায় সক্রিয় করতে চান?`
      : `আপনি কি "${unit.unitNumber}" ইউনিটটি আর্কাইভ করতে চান? (এটি স্থায়ীভাবে মুছে যাবে না)`;
    if (window.confirm(confirmMsg)) {
      await archiveUnit(unit.id, !unit.isArchived);
    }
  }

  // Filtered units
  const filteredUnits = units.filter((u) => {
    if (statusFilter === 'active' && u.isArchived) return false;
    if (statusFilter === 'archived' && !u.isArchived) return false;
    if (statusFilter === 'vacant' && (u.status !== 'vacant' || u.isArchived)) return false;
    if (statusFilter === 'occupied' && (u.status !== 'occupied' || u.isArchived)) return false;
    if (typeFilter !== 'all' && u.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = u.unitNumber.toLowerCase().includes(q);
      const matchNotes = u.notes?.toLowerCase().includes(q);
      if (!matchNum && !matchNotes) return false;
    }
    return true;
  });

  const totalCount = units.filter((u) => !u.isArchived).length;
  const vacantCount = units.filter((u) => !u.isArchived && u.status === 'vacant').length;
  const occupiedCount = units.filter((u) => !u.isArchived && u.status === 'occupied').length;
  const archivedCount = units.filter((u) => u.isArchived).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Breadcrumb & Navigation */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline mb-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              প্রপার্টি তালিকায় ফিরে যান / Back to Properties
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">{property.name}</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {property.type === 'residential'
                  ? 'আবাসিক'
                  : property.type === 'commercial'
                  ? 'বাণিজ্যিক'
                  : 'মিশ্র'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {property.address || 'ঠিকানা নির্ধারিত নেই'} • মোট তলা: {property.totalFloors}
            </p>
          </div>

          {property.isArchived ? (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span>প্রপার্টিটি আর্কাইভকৃত (নতুন ইউনিট যোগ বন্ধ)</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setUnitToEdit(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              নতুন ইউনিট যোগ করুন / Add Unit
            </button>
          )}
        </div>

        {/* Quick Stat Counter Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-slate-500 block text-[11px]">মোট সক্রিয় ইউনিট</span>
            <span className="text-lg font-bold text-slate-800">{totalCount} টি</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-800">
            <span className="text-emerald-600 block text-[11px]">খালি ইউনিট / Vacant</span>
            <span className="text-lg font-bold text-emerald-700">{vacantCount} টি</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-800">
            <span className="text-blue-600 block text-[11px]">ভাড়া দেওয়া / Occupied</span>
            <span className="text-lg font-bold text-blue-700">{occupiedCount} টি</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-slate-600">
            <span className="text-slate-500 block text-[11px]">আর্কাইভ / Archived</span>
            <span className="text-lg font-bold text-slate-700">{archivedCount} টি</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 font-medium mr-1">ফিল্টার:</span>
          {[
            { id: 'all', label: 'সকল ইউনিট' },
            { id: 'vacant', label: 'খালি (Vacant)' },
            { id: 'occupied', label: 'ভাড়া দেওয়া (Occupied)' },
            { id: 'archived', label: 'আর্কাইভকৃত' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg outline-hidden bg-white text-slate-700"
          >
            <option value="all">সব ধরনের ইউনিট / All Types</option>
            <option value="flat">ফ্ল্যাট / Flat</option>
            <option value="shop">দোকান / Shop</option>
            <option value="room">রুম / Room</option>
            <option value="office">অফিস / Office</option>
            <option value="warehouse">গুদাম / Warehouse</option>
            <option value="other">অন্যান্য / Other</option>
          </select>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নম্বর খুঁজুন..."
            className="px-3 py-1.5 border border-slate-300 rounded-lg outline-hidden text-slate-700 w-36 sm:w-44"
          />
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          ডাটা লোড করতে সমস্যা হয়েছে: {error}
        </div>
      )}

      {/* Units Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          <svg className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          ইউনিট লোড হচ্ছে...
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">কোনো ইউনিট পাওয়া যায়নি</p>
          <p className="text-xs text-slate-400 mt-1">
            এই ফিল্টারে কোনো ইউনিট নেই। নতুন ইউনিট যোগ করতে উপরের বোতাম ব্যবহার করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className={`bg-white rounded-2xl p-5 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                unit.isArchived
                  ? 'border-slate-200 opacity-60 bg-slate-50/50'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Unit Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-800">{unit.unitNumber}</h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      তলা / ফ্লোর: {unit.floor}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                      unit.isArchived
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : unit.status === 'vacant'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : unit.status === 'occupied'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {unit.isArchived
                      ? 'আর্কাইভকৃত'
                      : unit.status === 'vacant'
                      ? 'খালি (Vacant)'
                      : unit.status === 'occupied'
                      ? 'ভাড়া দেওয়া'
                      : 'মেরামত চলছে'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-slate-600 py-3 border-y border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ধরন / Type:</span>
                    <span className="font-medium text-slate-700 uppercase text-[11px]">
                      {unit.type === 'flat'
                        ? 'ফ্ল্যাট'
                        : unit.type === 'shop'
                        ? 'দোকান'
                        : unit.type === 'office'
                        ? 'অফিস'
                        : unit.type === 'room'
                        ? 'রুম'
                        : unit.type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">নির্ধারিত ভাড়া:</span>
                    <span className="font-bold text-blue-600">
                      ৳ {(unit.monthlyRent || 0).toLocaleString('en-IN')} / মাস
                    </span>
                  </div>
                  {unit.serviceCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">সার্ভিস চার্জ:</span>
                      <span className="text-slate-700 font-medium">
                        ৳ {(unit.serviceCharge || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {unit.electricityMeterNumber && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">বিদ্যুৎ মিটার:</span>
                      <span className="font-mono text-slate-700">{unit.electricityMeterNumber}</span>
                    </div>
                  )}
                  {unit.gasMeterNumber && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">গ্যাস মিটার:</span>
                      <span className="font-mono text-slate-700">{unit.gasMeterNumber}</span>
                    </div>
                  )}
                  {unit.notes && (
                    <p className="text-[11px] text-slate-500 italic pt-1 truncate" title={unit.notes}>
                      নোট: {unit.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 mt-2 flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => {
                    setUnitToEdit(unit);
                    setModalOpen(true);
                  }}
                  className="px-3 py-1.5 font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  সম্পাদনা / Edit
                </button>
                <button
                  onClick={() => handleArchiveToggle(unit)}
                  className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                    unit.isArchived
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  {unit.isArchived ? 'পুনরুদ্ধার / Restore' : 'আর্কাইভ / Archive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <UnitModal
          key={unitToEdit?.id || 'new'}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveUnit}
          unitToEdit={unitToEdit}
          propertyId={property.id}
          propertyName={property.name}
          ownerUid={ownerUid}
          existingUnits={units}
        />
      )}
    </div>
  );
}
