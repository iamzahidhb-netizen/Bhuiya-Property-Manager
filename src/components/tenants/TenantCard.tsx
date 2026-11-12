import React from 'react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { StatusBadge } from '../ui/hyperos/StatusBadge';
import type { Tenant } from '../../types/tenant';
import type { Unit } from '../../types/property';

interface TenantCardProps {
  tenant: Tenant;
  unit: Unit | null;
  propertyName: string;
  onSelect: (tenant: Tenant) => void;
  onVacate: (tenant: Tenant) => void;
  onDetails: (tenant: Tenant) => void;
}

export default function TenantCard({ tenant, unit, propertyName, onSelect, onVacate, onDetails }: TenantCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'vacated':
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const totalMonthly = (
    (tenant.monthlyRent || 0) +
    (tenant.gasCharge || 0) +
    (tenant.waterCharge || 0)
  ).toLocaleString('en-IN');

  return (
    <HyperCard
      className={`tenant-card p-5 rounded-2xl border transition-all shadow-xs hover:shadow-md cursor-pointer ${getStatusColor(tenant.status)}`}
      onClick={() => onSelect(tenant)}
    >
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-800 truncate">{tenant.name}</h3>
            <p className="text-xs text-slate-500 mt-1 font-mono truncate">{tenant.mobile}</p>
          </div>
          <StatusBadge
            variant={tenant.status === 'active' ? 'active' : 'archived'}
            className="text-[10px] px-2 py-0.5"
          >
            {tenant.status === 'active' ? 'চুক্তিতে' : 'প্রস্থানকৃত'}
          </StatusBadge>
        </div>

        {/* Unit & Property Info */}
        <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">{propertyName}</span>
            {unit && (
              <span className="text-slate-800 font-medium">ইউনিট {unit.unitNumber} ({unit.type})</span>
            )}
          </div>
          {unit && (
            <div className="flex justify-between mt-1 text-[10px] text-slate-500">
              <span>ফ্লোর: {unit.floor}</span>
              <span>ভাড়া: ৳{unit.monthlyRent?.toLocaleString('en-IN') || 0}</span>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-100 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">মাসিক ভাড়া</span>
            <span className="font-bold text-slate-800">৳{tenant.monthlyRent?.toLocaleString('en-IN') || 0}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">মোট বিল (গ্যাস+পানি)</span>
            <span className="font-bold text-slate-800">৳{totalMonthly}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDetails(tenant);
            }}
            className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs"
            title="বিস্তারিত তথ্য"
          >
            বিস্তারিত
          </button>
          {tenant.status === 'active' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVacate(tenant);
              }}
              className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs"
              title="চুক্তি সমাপ্ত"
            >
              চুক্তি সমাপ্ত
            </button>
          )}
        </div>
      </div>
    </HyperCard>
  );
}

export default TenantCard;
