import type { Tenant } from '../../types/tenant';
import type { SecurityDeposit } from '../../types/finance';
import { DriveDocumentList } from '../storage/DriveDocumentList';

interface TenantDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  propertyName: string;
  unitNumber: string;
  deposit?: SecurityDeposit | null;
}

export default function TenantDetailsModal({
  isOpen,
  onClose,
  tenant,
  propertyName,
  unitNumber,
  deposit,
}: TenantDetailsModalProps) {
  if (!isOpen) return null;

  const totalMonthlyBilling =
    (tenant.monthlyRent || 0) + (tenant.gasCharge || 0) + (tenant.waterCharge || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed & Sticky, never scrolls */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">{tenant.name}</h3>
              <span
                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  tenant.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}
              >
                {tenant.status === 'active' ? 'সক্রিয় ভাড়াটিয়া / Active' : 'প্রস্থানকৃত / Vacated'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {propertyName} — ইউনিট: {unitNumber}
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

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs overscroll-contain">
          {/* Contact & Personal Info */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              ব্যক্তিগত ও যোগাযোগের তথ্য / Personal Details
            </h4>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-slate-400 block">মোবাইল:</span>
                <span className="font-mono font-medium text-slate-800">{tenant.mobile}</span>
              </div>
              <div>
                <span className="text-slate-400 block">জাতীয় পরিচয়পত্র (NID):</span>
                <span className="font-mono text-slate-800">{tenant.nid || 'প্রদান করা হয়নি'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">ঠিকানা:</span>
                <span className="text-slate-700">{tenant.address || 'উল্লেখ নেই'}</span>
              </div>
            </div>
          </div>

          {/* Lease & Financial Details */}
          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2">
            <h4 className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">
              ভাড়া ও বিল চুক্তি / Lease & Rent Terms
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <span className="text-slate-500 block">মাসিক ভাড়া:</span>
                <span className="font-bold text-slate-800">৳{tenant.monthlyRent.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">গ্যাস বিল:</span>
                <span className="font-medium text-slate-700">৳{(tenant.gasCharge || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">পানি বিল:</span>
                <span className="font-medium text-slate-700">৳{(tenant.waterCharge || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">মোট প্রদেয়:</span>
                <span className="font-bold text-blue-700">৳{totalMonthlyBilling.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Security Deposit Details (Liability) */}
          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">
                সিকিউরিটি ডিপোজিট ও নিষ্পত্তি / Security Deposit (Liability)
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                দায়বদ্ধতা / Liability
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <div>
                <span className="text-slate-500 block">গৃহীত জামানত:</span>
                <span className="font-bold text-slate-800">
                  ৳{(deposit?.depositAmount || tenant.advanceDeposit || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">কর্তন (ক্ষতি/বিল):</span>
                <span className="font-medium text-red-600">
                  ৳{(deposit?.damageDeductionAmount || tenant.finalDamageDeductions || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">ফেরত প্রদান:</span>
                <span className="font-bold text-emerald-700">
                  ৳{(deposit?.refundedAmount || tenant.finalRefundAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            {deposit && (
              <p className="text-[11px] text-amber-800 italic pt-1 border-t border-amber-200/60">
                ডিপোজিট স্থিতি: <strong>{deposit.status}</strong>
              </p>
            )}
          </div>

          {/* Google Drive Document Vault */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <DriveDocumentList
              tenantId={tenant.id}
              defaultUploadCategory="nid"
              title="ভাড়াটিয়ার ডকুমেন্টস ও চুক্তিপত্র (Google Drive)"
            />
          </div>

          {/* Move-in & Vacate Dates */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 block">উঠা / শুরুর তারিখ:</span>
              <span className="font-semibold text-slate-800">{tenant.moveInDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block">প্রস্থানের তারিখ:</span>
              <span className="font-semibold text-slate-800">
                {tenant.vacatingDate || 'বর্তমান ভাড়াটিয়া (সক্রিয়)'}
              </span>
            </div>
            {tenant.settlementNotes && (
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <span className="text-slate-400 block">নিষ্পত্তির নোট:</span>
                <span className="text-slate-700">{tenant.settlementNotes}</span>
              </div>
            )}
            {tenant.notes && (
              <div className="col-span-2 pt-1">
                <span className="text-slate-400 block">সাধারণ নোট:</span>
                <span className="text-slate-700">{tenant.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="shrink-0 flex items-center justify-end p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            বন্ধ করুন / Close
          </button>
        </div>
      </div>
    </div>
  );
}
