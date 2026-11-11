import { useState, useEffect } from 'react';
import type { Tenant } from '../../types/tenant';
import type { RentBill, RentPayment } from '../../types/finance';
import { subscribeRentBills, subscribeRentPayments } from '../../services/rentService';
import { calculateRentBillSummary } from '../../services/financialSummary';

interface TenantHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  ownerUid: string;
  onSelectReceipt: (payment: RentPayment, bill: RentBill | null) => void;
}

export default function TenantHistoryModal({
  isOpen,
  onClose,
  tenant,
  ownerUid,
  onSelectReceipt,
}: TenantHistoryModalProps) {
  const [bills, setBills] = useState<RentBill[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !tenant) return;

    const unsubBills = subscribeRentBills(
      ownerUid,
      {},
      (allBills) => {
        const tenantBills = allBills.filter((b) => b.tenantId === tenant.id);
        tenantBills.sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));
        setBills(tenantBills);
        setLoading(false);
      }
    );

    const unsubPayments = subscribeRentPayments(
      ownerUid,
      { tenantId: tenant.id },
      (tenantPayments) => {
        setPayments(tenantPayments);
      }
    );

    return () => {
      unsubBills();
      unsubPayments();
    };
  }, [isOpen, tenant, ownerUid]);

  if (!isOpen || !tenant) return null;

  const {
    totalDemand: totalBilled,
    totalCollected: totalPaid,
    totalDue: totalBalanceDue,
  } = calculateRentBillSummary(bills);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">{tenant.name} - ভাড়ার ইতিহাস</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              মোবাইল: {tenant.mobile} • অবস্থা: {tenant.status === 'active' ? 'সক্রিয় (Active)' : 'প্রাক্তন (Vacated)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Aggregate Summary - Fixed under Header */}
        <div className="shrink-0 grid grid-cols-3 gap-2 sm:gap-3 p-4 sm:p-6 pb-2 border-b border-slate-100 bg-slate-50/50">
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200/80 text-center">
            <span className="text-[10px] sm:text-[11px] text-slate-500 block">মোট দাবি (Billed)</span>
            <span className="text-sm sm:text-base font-bold text-slate-800">৳{totalBilled.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2.5 sm:p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-center">
            <span className="text-[10px] sm:text-[11px] text-emerald-700 block">মোট পরিশোধিত (Paid)</span>
            <span className="text-sm sm:text-base font-bold text-emerald-700">৳{totalPaid.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2.5 sm:p-3 bg-amber-50/70 rounded-2xl border border-amber-100 text-center">
            <span className="text-[10px] sm:text-[11px] text-amber-700 block">মোট বকেয়া (Due)</span>
            <span className="text-sm sm:text-base font-bold text-amber-700">৳{totalBalanceDue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4 sm:p-6 overscroll-contain">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">তথ্য লোড হচ্ছে...</div>
          ) : bills.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">এই ভাড়াটিয়ার কোনো বিল পাওয়া যায়নি।</div>
          ) : (
            bills.map((bill) => {
              const billPayments = payments.filter((p) => p.billId === bill.id);
              return (
                <div key={bill.id} className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                  {/* Bill Row Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                    <div>
                      <span className="font-bold text-slate-800 text-sm">{bill.billingMonth}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        {bill.propertyName} (ইউনিট: {bill.unitNumber})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          bill.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : bill.status === 'partial'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }`}
                      >
                        {bill.status === 'paid'
                          ? '✓ সম্পূর্ণ পরিশোধিত'
                          : bill.status === 'partial'
                          ? 'আংশিক পরিশোধ'
                          : 'অপরিশোধিত'}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        দাবি: ৳{bill.totalDue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Charge breakdown pills */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 py-2">
                    <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      ভাড়া: ৳{bill.rentAmount.toLocaleString('en-IN')}
                    </span>
                    {bill.gasCharge > 0 && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        গ্যাস: ৳{bill.gasCharge.toLocaleString('en-IN')}
                      </span>
                    )}
                    {bill.waterCharge > 0 && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        পানি: ৳{bill.waterCharge.toLocaleString('en-IN')}
                      </span>
                    )}
                    {bill.serviceCharge > 0 && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        সার্ভিস: ৳{bill.serviceCharge.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="ml-auto font-semibold text-amber-700">
                      বকেয়া: ৳{bill.balanceDue.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Payment history list */}
                  {billPayments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        পেমেন্ট ট্রানজ্যাকশন / Transactions ({billPayments.length} টি)
                      </span>
                      {billPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200/80 text-xs"
                        >
                          <div>
                            <span className="font-bold text-emerald-700 mr-2">
                              +৳{p.amount.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              মাধ্যম: {p.paymentMethod} • রসিদ: {p.receiptNumber}
                            </span>
                            {p.transactionId && (
                              <span className="text-[10px] text-slate-400 font-mono ml-2">
                                TxID: {p.transactionId}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectReceipt(p, bill)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            রসিদ দেখুন →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="shrink-0 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            বন্ধ করুন / Close
          </button>
        </div>
      </div>
    </div>
  );
}
