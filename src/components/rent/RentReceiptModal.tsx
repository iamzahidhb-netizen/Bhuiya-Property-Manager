import type { RentBill, RentPayment } from '../../types/finance';

interface RentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: RentPayment | null;
  bill: RentBill | null;
}

export default function RentReceiptModal({
  isOpen,
  onClose,
  payment,
  bill,
}: RentReceiptModalProps) {
  if (!isOpen || !payment) return null;

  function handlePrint() {
    window.print();
  }

  const paymentMethodLabels: Record<string, string> = {
    cash: 'নগদ (Cash)',
    bank: 'ব্যাংক ট্রান্সফার (Bank Transfer)',
    bkash: 'বিকাশ (bKash)',
    nagad: 'নগদ (Nagad)',
    other: 'অন্যান্য (Other)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      {/* Container with print-specific style */}
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden print:m-0 print:p-8 print:shadow-none print:border-none print:max-w-none print:w-full animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls (Hidden in print) - Fixed Header */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h3 className="text-sm font-bold text-slate-800">অফিসিয়াল ভাড়ার রসিদ / Official Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.056-.37-2.16-.37-3.294 0-4.636 3.447-8.405 7.828-8.528.093 0 .185.002.278.006A8.524 8.524 0 0 1 22.37 9.87c.084.72.13 1.455.13 2.199 0 2.457-.696 4.747-1.9 6.685M4.5 19.5h15m-15 0a2.25 2.25 0 0 1-2.25-2.25V9a2.25 2.25 0 0 1 2.25-2.25h15A2.25 2.25 0 0 1 21.75 9v8.25a2.25 2.25 0 0 1-2.25 2.25m-15 0a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25" />
              </svg>
              <span>প্রিন্ট করুন / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Printable Receipt Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          <div className="border-2 border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden bg-white">
            {/* Watermark in background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-4 select-none">
              <span className="text-5xl sm:text-7xl font-black text-slate-900 tracking-widest rotate-[-25deg]">
                ANWAR BHUIYAN
              </span>
            </div>

            {/* Receipt Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-slate-800">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">আনোয়ার ভূঁইয়া প্রপার্টি</h2>
                <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                  Anwar Bhuiyan Property &amp; Estates
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">মিরপুর, ঢাকা-১২১৬, বাংলাদেশ</p>
              </div>
              <div className="sm:text-right">
                <span className="inline-block bg-slate-900 text-white font-mono text-xs font-bold px-3 py-1 rounded-md mb-1.5">
                  রসিদ নং: {payment.receiptNumber}
                </span>
                <p className="text-xs text-slate-600">
                  তারিখ / Date:{' '}
                  <span className="font-semibold text-slate-900">
                    {typeof payment.paymentDate === 'string'
                      ? payment.paymentDate
                      : payment.createdAt
                      ? new Date(payment.createdAt.toMillis()).toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0]}
                  </span>
                </p>
                <p className="text-xs text-slate-600">
                  ভাড়ার মাস: <span className="font-bold text-blue-700">{payment.billingMonth}</span>
                </p>
              </div>
            </div>

            {/* Tenant & Property Details */}
            <div className="grid grid-cols-2 gap-4 py-4 text-xs border-b border-slate-200">
              <div>
                <p className="text-slate-500 font-medium">ভাড়াটিয়ার নাম / Tenant Name:</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{payment.tenantName}</p>
                {bill?.tenantMobile && (
                  <p className="text-[11px] text-slate-600 mt-0.5">মোবাইল: {bill.tenantMobile}</p>
                )}
              </div>
              <div>
                <p className="text-slate-500 font-medium">ভবন ও ফ্ল্যাট / Property &amp; Unit:</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{payment.propertyName}</p>
                <p className="text-[11px] text-slate-700 font-semibold mt-0.5">
                  ইউনিট নং: <span className="text-blue-700 font-bold">{payment.unitNumber}</span>
                </p>
              </div>
            </div>

            {/* Charge Breakdown Table */}
            {bill && (
              <div className="py-4 border-b border-slate-200">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  মাসিক ভাড়ার বিবরণ / Billing Demand Breakdown
                </p>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>মাসিক বাড়ি ভাড়া (Monthly Rent):</span>
                    <span className="font-semibold text-slate-800">৳{bill.rentAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {bill.gasCharge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>গ্যাস বিল (Gas Charge):</span>
                      <span className="font-semibold text-slate-800">৳{bill.gasCharge.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {bill.waterCharge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>পানি বিল (Water Charge):</span>
                      <span className="font-semibold text-slate-800">৳{bill.waterCharge.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {bill.serviceCharge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>সার্ভিস চার্জ (Service Charge):</span>
                      <span className="font-semibold text-slate-800">৳{bill.serviceCharge.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-slate-200">
                    <span>মোট নির্ধারিত দাবি (Total Billed Demand):</span>
                    <span>৳{bill.totalDue.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Transaction Details */}
            <div className="py-4 border-b-2 border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                <div>
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                    প্রদত্ত অর্থ / Amount Paid Now
                  </p>
                  <p className="text-2xl font-black text-emerald-700 mt-0.5">
                    ৳{payment.amount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="sm:text-right text-xs">
                  <p className="text-slate-600">
                    পরিশোধ মাধ্যম: <span className="font-bold text-slate-900">{paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}</span>
                  </p>
                  {payment.transactionId && (
                    <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                      TxID: <span className="font-bold text-slate-800">{payment.transactionId}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Reconciliation Balance */}
              {bill && (
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">সর্বমোট পরিশোধ (Total Paid):</span>
                    <span className="font-bold text-slate-800 text-sm">৳{bill.totalPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${bill.balanceDue === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <span className="text-slate-500 block">অবশিষ্ট বকেয়া (Remaining Balance):</span>
                    <span className={`font-bold text-sm ${bill.balanceDue === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      ৳{bill.balanceDue.toLocaleString('en-IN')} {bill.balanceDue === 0 ? '(পরিশোধিত)' : ''}
                    </span>
                  </div>
                </div>
              )}

              {payment.notes && (
                <p className="text-[11px] text-slate-500 italic">
                  মন্তব্য / Note: {payment.notes}
                </p>
              )}
            </div>

            {/* Signatures & Stamp */}
            <div className="pt-8 grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1 font-mono text-[10px] text-slate-400">
                  স্বাক্ষরিত
                </div>
                <p className="font-semibold text-slate-700">ভাড়াটিয়ার স্বাক্ষর</p>
                <p className="text-[10px] text-slate-400">Tenant's Signature</p>
              </div>
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1 font-mono text-[10px] text-slate-400">
                  স্বাক্ষরিত
                </div>
                <p className="font-semibold text-slate-700">আদায়কারীর স্বাক্ষর</p>
                <p className="text-[10px] text-slate-400">Collected By</p>
              </div>
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1 font-mono text-[10px] text-blue-600 font-bold">
                  [ সিলমোহর ]
                </div>
                <p className="font-bold text-slate-900">কর্তৃপক্ষের স্বাক্ষর ও সিল</p>
                <p className="text-[10px] text-slate-400">Authorized Signature &amp; Seal</p>
              </div>
            </div>
          </div>

          {/* Footer info (Hidden in print) */}
          <p className="text-center text-[11px] text-slate-400 mt-4 print:hidden">
            এই রসিদটি আনোয়ার ভূঁইয়া প্রপার্টির রিয়েল-টাইম হিসাবরক্ষণ সিস্টেম দ্বারা স্বয়ংক্রিয়ভাবে তৈরি ও যাচাইকৃত।
          </p>
        </div>
      </div>
    </div>
  );
}
