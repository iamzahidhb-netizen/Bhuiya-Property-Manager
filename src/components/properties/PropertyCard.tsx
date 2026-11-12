import React from 'react';
import { useMediaQuery } from 'react-responsive';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { StatusBadge } from '../ui/hyperos/StatusBadge';
import type { Property } from '../../types/property';

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
  onEdit: (property: Property) => void;
  onArchiveToggle: (property: Property) => void;
}

export function PropertyCard({ property, onSelect, onEdit, onArchiveToggle }: PropertyCardProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'residential':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'commercial':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const isMobile = useMediaQuery({ maxWidth: 768 });
const getStatusColor = (isArchived: boolean) => {
    return isArchived ? 'opacity-65 bg-slate-50/60' : 'border-slate-200';
  };

  const propertyUnits = property.units || [];
  const vacantUnits = propertyUnits.filter(u => u.status === 'vacant').length;
  const occupiedUnits = propertyUnits.filter(u => u.status === 'occupied').length;
  const totalUnits = propertyUnits.length;

  const cardClass = isMobile
        ? 'p-4 rounded-xl'
        : 'p-6 rounded-2xl';

    return (
    <HyperCard
      className={`property-card ${cardClass} border transition-all shadow-xs hover:shadow-md cursor-pointer ${getStatusColor(property.isArchived)}`}
      onClick={() => onSelect(property)}
    >
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-fill)] text-white flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V8.25l-9-6.75-9 6.75V21h4.5" />
                </svg>
              </div>
              <StatusBadge variant={property.isArchived ? 'archived' : 'active'} className="text-[10px] px-2.5 py-0.5">
                {property.isArchived ? 'আর্কাইভকৃত' : 'সক্রিয়'}
              </StatusBadge>
            </div>
            <h3 className="text-lg font-bold text-slate-800 truncate pr-2">{property.name}</h3>
            <p className="text-xs text-slate-500 mt-1 truncate">{property.nameEn || property.code}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${getTypeColor(property.type)}`}
              title={property.type === 'residential' ? 'আবাসিক' : property.type === 'commercial' ? 'বাণিজ্যিক' : 'মিশ্র'}
            >
              {property.type === 'residential' ? 'আবাসিক' : property.type === 'commercial' ? 'বাণিজ্যিক' : 'মিশ드'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(property);
              }}
              className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="সম্পাদনা"
            >
              সম্পাদনা
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchiveToggle(property);
              }}
              className={`px-2.5 py-1.5 rounded-lg transition-colors font-medium ${property.isArchived
                ? 'text-emerald-600 hover:bg-emerald-50'
                : 'text-red-500 hover:bg-red-50'
              }`}
              title={property.isArchived ? 'পুনরুদ্ধার' : 'আর্কাইভ'}
            >
              {property.isArchived ? 'পুনরুদ্ধার' : 'আর্কাইভ'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">মোট ফ্ল্যাট</span>
            <span className="font-bold text-slate-700">{totalUnits}</span>
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

        {/* Description */}
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {property.description || property.address || 'কোনো বিবরণ নেই'}
        </p>
      </div>
    </HyperCard>
  );
}

export default React.memo(PropertyCard);
