import { useState, useEffect } from 'react';
import type { Property, PropertyInput, Unit } from '../../types/property';
import {
  subscribeProperties,
  subscribeUnits,
  createProperty,
  updateProperty,
  archiveProperty,
  seedInitialProperties,
} from '../../services/propertyService';
import PropertyModal from './PropertyModal';
import UnitList from './UnitList';

interface PropertyManagementViewProps {
  ownerUid: string;
  workspaceId?: string | null;
}

export default function PropertyManagementView({ ownerUid, workspaceId }: PropertyManagementViewProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Actions
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to properties
    const unsubProps = subscribeProperties(
      ownerUid,
      (fetchedProps) => {
        setProperties(fetchedProps);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      workspaceId
    );

    // Subscribe to all units for real-time unit counts on property cards
    const unsubUnits = subscribeUnits(
      ownerUid,
      null,
      (fetchedUnits) => {
        setAllUnits(fetchedUnits);
      },
      (err) => {
        console.error('Error fetching unit counts:', err);
      },
      workspaceId
    );

    return () => {
      unsubProps();
      unsubUnits();
    };
  }, [ownerUid, workspaceId]);

  async function handleSaveProperty(data: PropertyInput) {
    if (propertyToEdit) {
      await updateProperty(propertyToEdit.id, data);
    } else {
      await createProperty(data);
    }
  }

  async function handleArchiveToggle(prop: Property) {
    const confirmMsg = prop.isArchived
      ? `আপনি কি "${prop.name}" প্রপার্টিটি পুনরায় সক্রিয় করতে চান?`
      : `আপনি কি "${prop.name}" প্রপার্টিটি আর্কাইভ করতে চান? (ঐতিহাসিক রেকর্ড অক্ষত থাকবে)`;
    if (window.confirm(confirmMsg)) {
      await archiveProperty(prop.id, !prop.isArchived);
    }
  }

  async function handleSeedProperties() {
    setSeeding(true);
    setSeedNotice(null);
    try {
      const res = await seedInitialProperties(ownerUid);
      if (res.created > 0) {
        setSeedNotice(`সফলভাবে ${res.created}টি প্রারম্ভিক প্রপার্টি যুক্ত করা হয়েছে (ভূঁইয়া বাড়ি, মিতালী মার্কেট, এন.এম. ভূঁইয়া টাওয়ার)।`);
      } else {
        setSeedNotice('প্রারম্ভিক প্রপার্টিগুলো ইতিমধ্যে ডাটাবেজে বিদ্যমান রয়েছে।');
      }
    } catch (err: unknown) {
      console.error('Seeding error:', err);
      setSeedNotice(err instanceof Error ? err.message : 'সিডিং প্রক্রিয়ায় ত্রুটি দেখা দিয়েছে।');
    } finally {
      setSeeding(false);
    }
  }

  // If a property is selected for unit drill-down, render the UnitList component
  if (selectedProperty) {
    // Keep selected property data reactive
    const reactiveProperty = properties.find((p) => p.id === selectedProperty.id) || selectedProperty;
    return (
      <UnitList
        property={reactiveProperty}
        ownerUid={ownerUid}
        workspaceId={workspaceId}
        onBack={() => setSelectedProperty(null)}
      />
    );
  }

  // Filter properties
  const displayedProperties = properties.filter((p) => {
    if (showArchived ? !p.isArchived : p.isArchived) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBn = p.name.toLowerCase().includes(q);
      const matchEn = p.nameEn?.toLowerCase().includes(q);
      const matchAddr = p.address?.toLowerCase().includes(q);
      if (!matchBn && !matchEn && !matchAddr) return false;
    }
    return true;
  });

  const activeCount = properties.filter((p) => !p.isArchived).length;
  const archivedCount = properties.filter((p) => p.isArchived).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Primary Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h2 className="text-xl font-bold text-slate-800">প্রপার্টি ও ফ্ল্যাট ব্যবস্থাপনা</h2>
          </div>
          <p className="text-xs text-slate-500">
            ভবনসমূহ, ফ্ল্যাট, দোকান এবং ইউনিটের তালিকা পরিচালনা করুন • Property &amp; Unit Foundation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seeding Button */}
          {properties.length === 0 && !loading && (
            <button
              onClick={handleSeedProperties}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {seeding ? 'সিডিং হচ্ছে...' : '৩টি প্রারম্ভিক প্রপার্টি সিড করুন'}
            </button>
          )}

          {/* Add Property Button */}
          <button
            onClick={() => {
              setPropertyToEdit(null);
              setPropertyModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            নতুন প্রপার্টি যোগ করুন / Add Property
          </button>
        </div>
      </div>

      {/* Seed Notice */}
      {seedNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span>{seedNotice}</span>
          </div>
          <button
            onClick={() => setSeedNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              !showArchived
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            সক্রিয় প্রপার্টি ({activeCount})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showArchived
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            আর্কাইভকৃত ({archivedCount})
          </button>
        </div>

        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="প্রপার্টি বা এলাকা খুঁজুন..."
            className="w-full sm:w-64 px-3.5 py-1.5 border border-slate-300 rounded-lg outline-hidden text-slate-700"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          ডাটা লোড ত্রুটি: {error}
        </div>
      )}

      {/* Properties Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          <svg className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          প্রপার্টি লোড হচ্ছে...
        </div>
      ) : displayedProperties.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V8.25l-9-6.75-9 6.75V21h4.5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">কোনো প্রপার্টি পাওয়া যায়নি</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {showArchived
              ? 'বর্তমানে কোনো আর্কাইভকৃত প্রপার্টি নেই।'
              : 'আপনার অ্যাকাউন্টে এখনও কোনো প্রপার্টি নিবন্ধিত হয়নি। উপরে "৩টি প্রারম্ভিক প্রপার্টি সিড করুন" বাটনে ক্লিক করে প্রাথমিক প্রপার্টিগুলো শুরু করতে পারেন।'}
          </p>
          {!showArchived && properties.length === 0 && (
            <button
              onClick={handleSeedProperties}
              disabled={seeding}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs"
            >
              {seeding ? 'সিডিং হচ্ছে...' : 'প্রারম্ভিক প্রপার্টি সিড করুন (ভূঁইয়া বাড়ি, মিতালী মার্কেট, এন.এম. ভূঁইয়া টাওয়ার)'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedProperties.map((prop) => {
            const propUnits = allUnits.filter((u) => u.propertyId === prop.id && !u.isArchived);
            const vacantUnits = propUnits.filter((u) => u.status === 'vacant').length;
            const occupiedUnits = propUnits.filter((u) => u.status === 'occupied').length;

            return (
              <div
                key={prop.id}
                className={`bg-white rounded-2xl p-6 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                  prop.isArchived ? 'opacity-65 bg-slate-50/60 border-slate-200' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V8.25l-9-6.75-9 6.75V21h4.5" />
                      </svg>
                    </div>

                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                        prop.type === 'residential'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : prop.type === 'commercial'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}
                    >
                      {prop.type === 'residential'
                        ? 'আবাসিক / Residential'
                        : prop.type === 'commercial'
                        ? 'বাণিজ্যিক / Commercial'
                        : 'মিশ্র / Mixed'}
                    </span>
                  </div>

                  {/* Title & English Subtitle */}
                  <h3 className="text-lg font-bold text-slate-800 leading-snug">{prop.name}</h3>
                  <p className="text-xs text-slate-400 font-medium mb-3">{prop.nameEn || prop.code}</p>

                  {/* Description & Address */}
                  <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                    {prop.description || prop.address || 'কোনো বিবরণ দেওয়া নেই।'}
                  </p>

                  {/* Meta stats */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">মোট তলা</span>
                      <span className="font-bold text-slate-700">{prop.totalFloors}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 block">খালি ইউনিট</span>
                      <span className="font-bold text-emerald-700">{vacantUnits}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-600 block">ভাড়া দেওয়া</span>
                      <span className="font-bold text-blue-700">{occupiedUnits}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 mt-3 flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedProperty(prop)}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>ফ্ল্যাট ও ইউনিট পরিচালনা ({propUnits.length})</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => {
                        setPropertyToEdit(prop);
                        setPropertyModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                    >
                      সম্পাদনা / Edit
                    </button>
                    <button
                      onClick={() => handleArchiveToggle(prop)}
                      className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                        prop.isArchived
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-red-500 hover:bg-red-50'
                      }`}
                    >
                      {prop.isArchived ? 'পুনরুদ্ধার / Restore' : 'আর্কাইভ / Archive'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Property Modal */}
      {propertyModalOpen && (
        <PropertyModal
          key={propertyToEdit?.id || 'new'}
          isOpen={propertyModalOpen}
          onClose={() => setPropertyModalOpen(false)}
          onSave={handleSaveProperty}
          propertyToEdit={propertyToEdit}
          ownerUid={ownerUid}
        />
      )}
    </div>
  );
}
