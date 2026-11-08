import type { Tenant } from '../../types/tenant';
import type { Property, Unit } from '../../types/property';
import type { RentBill, RentPayment } from '../../types/finance';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { UserRound, X, CreditCard, Clock } from 'lucide-react';

interface SimpleTenantDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  property: Property | null;
  unit: Unit | null;
  currentBill: RentBill | null;
  payments: RentPayment[];
  onOpenPaymentModal: (tenantId: string) => void;
  canManageRent: boolean;
}

export default function SimpleTenantDetailsModal({
  isOpen,
  onClose,
  tenant,
  property,
  unit,
  currentBill,
  payments,
  onOpenPaymentModal,
  canManageRent,
}: SimpleTenantDetailsModalProps) {
  const { currentLanguage, t } = useLanguage();
  if (!isOpen || !tenant) return null;

  const tenantPayments = payments.filter((p) => p.tenantId === tenant.id);
  const paidThisMonth = currentBill?.totalPaid || 0;
  const dueThisMonth = currentBill ? currentBill.balanceDue : tenant.monthlyRent || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-emerald-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-emerald-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl shrink-0">
              <UserRound className="w-6 h-6 text-emerald-800" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">{tenant.name}</h2>
              <p className="text-xs text-slate-500">
                {property?.name || (currentLanguage === 'bn' ? 'বিল্ডিং' : 'Building')} — {unit?.unitNumber || (currentLanguage === 'bn' ? 'ফ্ল্যাট' : 'Flat')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain text-xs sm:text-sm">
          {/* Rent Status Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-emerald-800">
                {currentLanguage === 'bn' ? 'চলতি মাসের হিসাব' : 'Current Month Overview'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  dueThisMonth === 0
                    ? 'bg-emerald-200 text-emerald-900'
                    : paidThisMonth > 0
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-red-100 text-red-900'
                }`}
              >
                {dueThisMonth === 0
                  ? t('dashboard.statusPaid')
                  : paidThisMonth > 0
                  ? t('dashboard.statusPartial')
                  : t('dashboard.statusDue')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-white p-2 rounded-xl">
                <div className="text-[11px] text-slate-500">{t('dashboard.monthlyRentLabel')}</div>
                <div className="font-bold text-slate-800 text-sm">
                  {formatLocalizedCurrency(tenant.monthlyRent, currentLanguage)}
                </div>
              </div>
              <div className="bg-white p-2 rounded-xl">
                <div className="text-[11px] text-slate-500">{t('dashboard.rentCollected')}</div>
                <div className="font-bold text-emerald-700 text-sm">
                  {formatLocalizedCurrency(paidThisMonth, currentLanguage)}
                </div>
              </div>
              <div className="bg-white p-2 rounded-xl">
                <div className="text-[11px] text-slate-500">{t('dashboard.rentRemaining')}</div>
                <div className="font-bold text-red-600 text-sm">
                  {formatLocalizedCurrency(dueThisMonth, currentLanguage)}
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">{t('dashboard.mobileLabel')}</span>
              <span className="font-semibold text-slate-800 font-mono">
                {tenant.mobile || t('dashboard.notProvided')}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">{currentLanguage === 'bn' ? 'জামানত (Advance Deposit):' : 'Advance Deposit:'}</span>
              <span className="font-semibold text-slate-800">
                {formatLocalizedCurrency(tenant.advanceDeposit, currentLanguage)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">{currentLanguage === 'bn' ? 'লিজ শুরুর তারিখ:' : 'Move-in Date:'}</span>
              <span className="font-semibold text-slate-800">
                {tenant.moveInDate || (currentLanguage === 'bn' ? 'উল্লেখ নেই' : 'N/A')}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">{t('common.status')}:</span>
              <span className="font-semibold text-emerald-700">
                {tenant.status === 'active'
                  ? (currentLanguage === 'bn' ? 'সক্রিয় ভাড়াটিয়া' : 'Active Tenant')
                  : (currentLanguage === 'bn' ? 'প্রাক্তন' : 'Former')}
              </span>
            </div>
          </div>

          {/* Payment History */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentLanguage === 'bn' ? 'সাম্প্রতিক জমার ইতিহাস (Payment History)' : 'Recent Payment History'}</span>
            </h4>
            {tenantPayments.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
                {currentLanguage === 'bn' ? 'কোনো জমার রেকর্ড পাওয়া যায়নি।' : 'No payment records found.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tenantPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {p.paymentDate?.toDate?.()?.toLocaleDateString() || String(p.billingMonth)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {t('dashboard.receipt')} {p.receiptNumber || p.id.slice(0, 8)} ({p.paymentMethod})
                      </div>
                    </div>
                    <div className="font-bold text-emerald-700 text-sm">
                      {formatLocalizedCurrency(p.amount, currentLanguage)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Fixed */}
        <div className="shrink-0 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-2xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition cursor-pointer"
          >
            {t('common.close')}
          </button>
          {canManageRent && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPaymentModal(tenant.id);
              }}
              className="w-2/3 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-white" />
              <span>{t('dashboard.collectRentAction')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
