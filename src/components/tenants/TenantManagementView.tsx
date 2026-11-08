import { useState, useEffect } from 'react';
import type { Property, Unit } from '../../types/property';
import type { Tenant, TenantFormData, VacateTenantFormData } from '../../types/tenant';
import type { SecurityDeposit } from '../../types/finance';
import {
  subscribeTenants,
  subscribeSecurityDeposits,
  registerTenant,
  vacateTenant,
} from '../../services/tenantService';
import TenantModal from './TenantModal';
import VacateModal from './VacateModal';
import TenantDetailsModal from './TenantDetailsModal';

interface TenantManagementViewProps {
  ownerUid: string;
  properties: Property[];
  units: Unit[];
  workspaceId?: string | null;
}

export default function TenantManagementView({
  ownerUid,
  properties,
  units,
  workspaceId,
}: TenantManagementViewProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [deposits, setDeposits] = useState<SecurityDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'vacated'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [vacateModalOpen, setVacateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);

  // Subscriptions
  useEffect(() => {
    const unsubTenants = subscribeTenants(
      ownerUid,
      selectedPropertyId === 'all' ? null : selectedPropertyId,
      (fetchedTenants) => {
        setTenants(fetchedTenants);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      workspaceId
    );

    const unsubDeposits = subscribeSecurityDeposits(
      ownerUid,
      selectedPropertyId === 'all' ? null : selectedPropertyId,
      (fetchedDeposits) => {
        setDeposits(fetchedDeposits);
      },
      undefined,
      workspaceId
    );

    return () => {
      unsubTenants();
      unsubDeposits();
    };
  }, [ownerUid, selectedPropertyId, workspaceId]);

  // Handle Tenant Registration
  async function handleRegisterTenant(data: TenantFormData) {
    await registerTenant(data);
  }

  // Handle Vacating Tenant
  async function handleVacateTenant(data: VacateTenantFormData) {
    await vacateTenant(data);
  }

  // Helper maps for quick property and unit lookups
  const propertyMap = new Map(properties.map((p) => [p.id, p]));
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const depositByTenantMap = new Map(deposits.map((d) => [d.tenantId, d]));

  // Filtering
  const filteredTenants = tenants.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const unit = unitMap.get(t.unitId);
      const matchName = t.name.toLowerCase().includes(q);
      const matchMobile = t.mobile.includes(q);
      const matchUnit = unit ? unit.unitNumber.toLowerCase().includes(q) : false;
      if (!matchName && !matchMobile && !matchUnit) return false;
    }
    return true;
  });

  // Top Metrics
  const activeTenantsCount = tenants.filter((t) => t.status === 'active').length;
  const vacatedTenantsCount = tenants.filter((t) => t.status === 'vacated').length;
  const totalHeldDeposits = deposits
    .filter((d) => d.status === 'held')
    .reduce((sum, d) => sum + (d.depositAmount - (d.refundedAmount || 0) - (d.damageDeductionAmount || 0)), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              ধাপ ৩ • ভাড়াটিয়া ও চুক্তি ব্যবস্থাপনা
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              ভাড়াটিয়া ও জামানত ব্যবস্থাপনা
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ভাড়াটিয়া নিবন্ধন, রুম/ফ্ল্যাট বণ্টন এবং সিকিউরিটি ডিপোজিট (দায়) ট্র্যাকিং
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setRegisterModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              নতুন ভাড়াটিয়া নিবন্ধন
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              মোট নিবন্ধিত
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-800">{tenants.length}</span>
              <span className="text-xs text-slate-400">জন</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
              বর্তমান সক্রিয় ভাড়াটিয়া
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-700">{activeTenantsCount}</span>
              <span className="text-xs text-emerald-600 font-medium">ফ্ল্যাট দখলরত</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              প্রস্থানকৃত ভাড়াটিয়া
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-600">{vacatedTenantsCount}</span>
              <span className="text-xs text-slate-400">ইতিহাস সংরক্ষিত</span>
            </div>
          </div>

          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider block">
                মোট জামানত দায়
              </span>
              <span className="text-[9px] font-bold text-amber-800 px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300">
                দায় / Liability
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl sm:text-2xl font-black text-amber-800">
                ৳{totalHeldDeposits.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Property Dropdown */}
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden text-slate-700"
          >
            <option value="all">সকল প্রপার্টি / All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              সকল ({tenants.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              সক্রিয় ({activeTenantsCount})
            </button>
            <button
              onClick={() => setStatusFilter('vacated')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'vacated'
                  ? 'bg-white text-slate-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              প্রস্থানকৃত ({vacatedTenantsCount})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, মোবাইল বা ফ্ল্যাট নং..."
            className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white focus:border-blue-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          ডাটা লোড করতে সমস্যা হয়েছে: {error}
        </div>
      )}

      {/* Tenant List Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200">
          <svg className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          ভাড়াটিয়া তথ্য লোড হচ্ছে...
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <p className="text-base font-bold text-slate-800">কোনো ভাড়াটিয়া পাওয়া যায়নি</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            এই ফিল্টারে কোনো রেকর্ড নেই। নতুন ভাড়াটিয়া যুক্ত করতে উপরের "নতুন ভাড়াটিয়া নিবন্ধন" বোতামে ক্লিক করুন।
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">ভাড়াটিয়ার নাম ও মোবাইল</th>
                  <th className="py-3.5 px-4">প্রপার্টি ও ইউনিট</th>
                  <th className="py-3.5 px-4">মাসিক ভাড়া ও বিল</th>
                  <th className="py-3.5 px-4">সিকিউরিটি ডিপোজিট (দায়)</th>
                  <th className="py-3.5 px-4">যোগদানের তারিখ</th>
                  <th className="py-3.5 px-4">অবস্থা</th>
                  <th className="py-3.5 px-4 text-right">কার্যক্রম</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((tenant) => {
                  const property = propertyMap.get(tenant.propertyId);
                  const unit = unitMap.get(tenant.unitId);
                  const deposit = depositByTenantMap.get(tenant.id);

                  const totalMonthly =
                    (tenant.monthlyRent || 0) + (tenant.gasCharge || 0) + (tenant.waterCharge || 0);

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{tenant.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{tenant.mobile}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {property ? property.name : 'অজানা প্রপার্টি'}
                        </div>
                        <div className="text-[11px] text-blue-600 font-medium">
                          ইউনিট: {unit ? unit.unitNumber : 'অজানা'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">
                          ৳{tenant.monthlyRent.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          গ্যাস+পানি সহ: ৳{totalMonthly.toLocaleString('en-IN')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-amber-800">
                          ৳{(deposit?.depositAmount || tenant.advanceDeposit || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tenant.status === 'active' ? 'সংরক্ষিত দায়' : 'নিষ্পত্তিকৃত'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {tenant.moveInDate}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            tenant.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          {tenant.status === 'active' ? 'সক্রিয় / Active' : 'প্রস্থানকৃত / Vacated'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setActiveTenant(tenant);
                              setDetailsModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                          >
                            বিবরণ
                          </button>

                          {tenant.status === 'active' && (
                            <button
                              onClick={() => {
                                setActiveTenant(tenant);
                                setVacateModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                            >
                              বিদায় / নিষ্পত্তি
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {registerModalOpen && (
        <TenantModal
          isOpen={registerModalOpen}
          onClose={() => setRegisterModalOpen(false)}
          onSave={handleRegisterTenant}
          properties={properties}
          units={units}
          initialPropertyId={selectedPropertyId === 'all' ? undefined : selectedPropertyId}
        />
      )}

      {/* Vacate Modal */}
      {vacateModalOpen && activeTenant && (
        <VacateModal
          isOpen={vacateModalOpen}
          onClose={() => {
            setVacateModalOpen(false);
            setActiveTenant(null);
          }}
          onVacate={handleVacateTenant}
          tenant={activeTenant}
          propertyName={propertyMap.get(activeTenant.propertyId)?.name || 'প্রপার্টি'}
          unitNumber={unitMap.get(activeTenant.unitId)?.unitNumber || 'ইউনিট'}
          deposit={depositByTenantMap.get(activeTenant.id)}
        />
      )}

      {/* Details Modal */}
      {detailsModalOpen && activeTenant && (
        <TenantDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => {
            setDetailsModalOpen(false);
            setActiveTenant(null);
          }}
          tenant={activeTenant}
          propertyName={propertyMap.get(activeTenant.propertyId)?.name || 'প্রপার্টি'}
          unitNumber={unitMap.get(activeTenant.unitId)?.unitNumber || 'ইউনিট'}
          deposit={depositByTenantMap.get(activeTenant.id)}
        />
      )}
    </div>
  );
}
