import { useState, useEffect, useMemo } from 'react';
import type { Property, Unit } from '../../types/property';
import type { Tenant } from '../../types/tenant';
import type { RentBill, RentPayment, BillStatus } from '../../types/finance';
import {
  subscribeRentBills,
  subscribeRentPayments,
  type GenerateBillsResult,
  type RecordPaymentResult,
} from '../../services/rentService';
import GenerateBillsModal from './GenerateBillsModal';
import RecordPaymentModal from './RecordPaymentModal';
import RentReceiptModal from './RentReceiptModal';
import TenantHistoryModal from './TenantHistoryModal';

interface RentManagementViewProps {
  ownerUid: string;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
}

export default function RentManagementView({
  ownerUid,
  properties,
  tenants,
}: RentManagementViewProps) {
  // Current month default in YYYY-MM format
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<BillStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time data
  const [bills, setBills] = useState<RentBill[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [paymentModalBill, setPaymentModalBill] = useState<RentBill | null>(null);
  const [historyModalTenant, setHistoryModalTenant] = useState<Tenant | null>(null);
  const [receiptModalPayment, setReceiptModalPayment] = useState<RentPayment | null>(null);
  const [receiptModalBill, setReceiptModalBill] = useState<RentBill | null>(null);

  // Alert notification banner
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Real-time subscriptions
  useEffect(() => {
    if (!ownerUid) return;

    const unsubBills = subscribeRentBills(
      ownerUid,
      {
        billingMonth: selectedMonth || null,
        propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : null,
      },
      (fetchedBills) => {
        setBills(fetchedBills);
        setLoading(false);
      }
    );

    const unsubPayments = subscribeRentPayments(
      ownerUid,
      {
        billingMonth: selectedMonth || null,
        propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : null,
      },
      (fetchedPayments) => {
        setPayments(fetchedPayments);
      }
    );

    return () => {
      unsubBills();
      unsubPayments();
    };
  }, [ownerUid, selectedMonth, selectedPropertyId]);

  // Navigate months
  function handlePrevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
  }

  function handleNextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
  }

  function handleResetCurrentMonth() {
    setSelectedMonth(currentMonthStr);
  }

  // Filtered bills by search and status tab
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Status filter
      if (selectedStatus !== 'all' && b.status !== selectedStatus) {
        return false;
      }
      // Search query (tenant name, unit number, mobile)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = b.tenantName.toLowerCase().includes(q);
        const matchesUnit = b.unitNumber.toLowerCase().includes(q);
        const matchesMobile = b.tenantMobile.includes(q);
        if (!matchesName && !matchesUnit && !matchesMobile) {
          return false;
        }
      }
      return true;
    });
  }, [bills, selectedStatus, searchQuery]);

  // Summary Metrics for the current month / view
  const totalDemand = useMemo(() => bills.reduce((acc, b) => acc + b.totalDue, 0), [bills]);
  const totalCollected = useMemo(() => bills.reduce((acc, b) => acc + b.totalPaid, 0), [bills]);
  const totalDue = useMemo(() => bills.reduce((acc, b) => acc + b.balanceDue, 0), [bills]);
  const collectionRate = totalDemand > 0 ? Math.round((totalCollected / totalDemand) * 100) : 0;

  const countPaid = useMemo(() => bills.filter((b) => b.status === 'paid').length, [bills]);
  const countPartial = useMemo(() => bills.filter((b) => b.status === 'partial').length, [bills]);
  const countUnpaid = useMemo(() => bills.filter((b) => b.status === 'unpaid').length, [bills]);

  // Property-wise collection summary
  const propertySummaries = useMemo(() => {
    const map = new Map<string, {
      propertyName: string;
      demand: number;
      collected: number;
      due: number;
      billsCount: number;
    }>();

    properties.forEach((p) => {
      map.set(p.id, {
        propertyName: p.name,
        demand: 0,
        collected: 0,
        due: 0,
        billsCount: 0,
      });
    });

    bills.forEach((b) => {
      const entry = map.get(b.propertyId) || {
        propertyName: b.propertyName,
        demand: 0,
        collected: 0,
        due: 0,
        billsCount: 0,
      };
      entry.demand += b.totalDue;
      entry.collected += b.totalPaid;
      entry.due += b.balanceDue;
      entry.billsCount += 1;
      map.set(b.propertyId, entry);
    });

    return Array.from(map.entries())
      .map(([propertyId, data]) => ({
        propertyId,
        ...data,
        rate: data.demand > 0 ? Math.round((data.collected / data.demand) * 100) : 0,
      }))
      .filter((item) => item.billsCount > 0 || selectedPropertyId === 'all');
  }, [properties, bills, selectedPropertyId]);

  function handleBillGenerated(res: GenerateBillsResult) {
    setToastMessage({
      type: 'success',
      text: `মাসিক বিল সফলভাবে তৈরি হয়েছে! নতুন তৈরি: ${res.countCreated} টি, ইতিমধ্যে বিদ্যমান (স্কিপ): ${res.countSkipped} টি, মোট দাবি: ৳${res.totalAmountBilled.toLocaleString('en-IN')}`,
    });
    setTimeout(() => setToastMessage(null), 8000);
  }

  function handlePaymentRecorded(res: RecordPaymentResult) {
    // Look up the created payment to display receipt
    const newPayment: RentPayment = {
      id: res.paymentId,
      ownerUid,
      billId: paymentModalBill?.id || '',
      propertyId: res.propertyName,
      propertyName: res.propertyName,
      unitId: '',
      unitNumber: res.unitNumber,
      tenantId: '',
      tenantName: res.tenantName,
      billingMonth: res.billingMonth,
      amount: res.amount,
      paymentMethod: 'cash',
      receiptNumber: res.receiptNumber,
      notes: '',
      entryType: 'payment',
      paymentDate: null,
      createdAt: null,
    };

    setToastMessage({
      type: 'success',
      text: `পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে! রসিদ নং: ${res.receiptNumber}, পরিমাণ: ৳${res.amount.toLocaleString('en-IN')}, অবশিষ্ট বকেয়া: ৳${res.balanceDue.toLocaleString('en-IN')}`,
    });
    setTimeout(() => setToastMessage(null), 8000);

    // Open receipt modal automatically
    setReceiptModalPayment(newPayment);
    setReceiptModalBill(paymentModalBill);
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-medium mb-3 border border-white/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Phase 4 • ভাড়া আদায়, রসিদ ও বকেয়া হিসাব
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
              ভাড়া আদায় ও পেমেন্ট ব্যবস্থাপনা
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              সক্রিয় ভাড়াটিয়াদের মাসিক বিল তৈরি, আংশিক ও সম্পূর্ণ পেমেন্ট গ্রহণ, পৃথক গ্যাস ও পানি বিল এবং স্বয়ংক্রিয় প্রিন্টযোগ্য রসিদ।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setGenerateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-blue-900 bg-white hover:bg-blue-50 rounded-2xl shadow-lg transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>মাসিক বিল তৈরি করুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Month Navigation & Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
            বিলিং মাস:
          </span>
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              title="পূর্ববর্তী মাস"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 outline-hidden"
            />
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
              title="পরবর্তী মাস"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
          {selectedMonth !== currentMonthStr && (
            <button
              onClick={handleResetCurrentMonth}
              className="text-[11px] font-semibold text-blue-600 hover:underline px-2 py-1"
            >
              চলতি মাস
            </button>
          )}
        </div>

        {/* Property & Search Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Property Dropdown */}
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
          >
            <option value="all">সকল প্রপার্টি / All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative">
            <svg
              className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="ভাড়াটিয়া, ইউনিট বা মোবাইল..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Demand Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">মোট নির্ধারিত দাবি / Demand</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            ৳{totalDemand.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            মোট বিল: <span className="font-bold text-slate-700">{bills.length}</span> টি
          </p>
        </div>

        {/* Collected Income Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">চলতি মাসের আদায় / Collected</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mb-1">
            ৳{totalCollected.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            ✓ সংগৃহীত নগদ আয় ({payments.length} টি পেমেন্ট)
          </p>
        </div>

        {/* Outstanding Due Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">অবশিষ্ট বকেয়া / Outstanding</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mb-1">
            ৳{totalDue.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-amber-700 font-medium">
            বকেয়া বিল: {countUnpaid + countPartial} টি
          </p>
        </div>

        {/* Collection Rate Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">আদায়ের হার / Collection Rate</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            {collectionRate}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, collectionRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'all', label: 'সকল বিল', count: bills.length },
          { id: 'unpaid', label: 'অপরিশোধিত (Unpaid)', count: countUnpaid, color: 'text-red-700 bg-red-50 border-red-200' },
          { id: 'partial', label: 'আংশিক পরিশোধ (Partial)', count: countPartial, color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { id: 'paid', label: 'সম্পূর্ণ পরিশোধিত (Paid)', count: countPaid, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedStatus(tab.id as BillStatus | 'all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
              selectedStatus === tab.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Rent Bills List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            ভাড়া বিলের তথ্য লোড হচ্ছে...
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">
              {bills.length === 0 ? `${selectedMonth} মাসের কোনো বিল তৈরি করা হয়নি` : 'কোনো বিলের তথ্য মেলেনি'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              {bills.length === 0
                ? 'সক্রিয় ভাড়াটিয়াদের জন্য এক ক্লিকে স্বয়ংক্রিয়ভাবে মাসিক দাবি তৈরি করতে নিচের বাটনে চাপ দিন।'
                : 'অন্য সার্চ ফিল্টার ব্যবহার করুন।'}
            </p>
            {bills.length === 0 && (
              <button
                onClick={() => setGenerateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>{selectedMonth} মাসের বিল তৈরি করুন</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">ভাড়াটিয়া ও ইউনিট</th>
                  <th className="py-3.5 px-4">চার্জের বিবরণ (ভাড়া, গ্যাস, পানি)</th>
                  <th className="py-3.5 px-4 text-right">মোট দাবি</th>
                  <th className="py-3.5 px-4 text-right">পরিশোধিত</th>
                  <th className="py-3.5 px-4 text-right">অবশিষ্ট বকেয়া</th>
                  <th className="py-3.5 px-4 text-center">অবস্থা / Status</th>
                  <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredBills.map((bill) => {
                  const associatedTenant = tenants.find((t) => t.id === bill.tenantId) || null;
                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Tenant & Unit */}
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{bill.tenantName}</p>
                          <p className="text-[11px] text-slate-500">
                            {bill.propertyName} • <span className="font-semibold text-blue-700">ইউনিট {bill.unitNumber}</span>
                          </p>
                          {bill.tenantMobile && (
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{bill.tenantMobile}</p>
                          )}
                        </div>
                      </td>

                      {/* Charge Breakdown */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          <span className="block text-slate-600">
                            ভাড়া: <span className="font-semibold text-slate-800">৳{bill.rentAmount.toLocaleString('en-IN')}</span>
                          </span>
                          {(bill.gasCharge > 0 || bill.waterCharge > 0) && (
                            <span className="block text-slate-500 text-[10px]">
                              {bill.gasCharge > 0 && `গ্যাস: ৳${bill.gasCharge.toLocaleString('en-IN')} `}
                              {bill.waterCharge > 0 && `পানি: ৳${bill.waterCharge.toLocaleString('en-IN')}`}
                              {bill.serviceCharge > 0 && ` সার্ভিস: ৳${bill.serviceCharge.toLocaleString('en-IN')}`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Demand */}
                      <td className="py-4 px-4 text-right font-bold text-slate-900">
                        ৳{bill.totalDue.toLocaleString('en-IN')}
                      </td>

                      {/* Total Paid */}
                      <td className="py-4 px-4 text-right font-semibold text-emerald-600">
                        ৳{bill.totalPaid.toLocaleString('en-IN')}
                      </td>

                      {/* Balance Due */}
                      <td className="py-4 px-4 text-right font-bold text-amber-600">
                        ৳{bill.balanceDue.toLocaleString('en-IN')}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            bill.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : bill.status === 'partial'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {bill.status === 'paid'
                            ? '✓ পরিশোধিত'
                            : bill.status === 'partial'
                            ? 'আংশিক জমা'
                            : 'বকেয়া'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {bill.balanceDue > 0 && (
                            <button
                              onClick={() => setPaymentModalBill(bill)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs transition-colors cursor-pointer"
                            >
                              পেমেন্ট গ্রহণ
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (associatedTenant) {
                                setHistoryModalTenant(associatedTenant);
                              } else {
                                // Fallback mock tenant object for history viewer
                                setHistoryModalTenant({
                                  id: bill.tenantId,
                                  ownerUid,
                                  propertyId: bill.propertyId,
                                  unitId: bill.unitId,
                                  name: bill.tenantName,
                                  mobile: bill.tenantMobile,
                                  monthlyRent: bill.rentAmount,
                                  gasCharge: bill.gasCharge,
                                  waterCharge: bill.waterCharge,
                                  advanceDeposit: 0,
                                  moveInDate: '',
                                  status: 'active',
                                  createdAt: null,
                                  updatedAt: null,
                                });
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                            title="ভাড়াটিয়ার সম্পূর্ণ পেমেন্ট ইতিহাস ও রসিদ"
                          >
                            রসিদ ও ইতিহাস
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Property-Wise Collection Summary Table */}
      {propertySummaries.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">প্রপার্টি-ভিত্তিক আদায় সারসংক্ষেপ</h3>
              <p className="text-xs text-slate-500">Property-Wise Rent Collection Summary • {selectedMonth}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">প্রপার্টি / ভবন</th>
                  <th className="py-3 px-4 text-center">বিল সংখ্যা</th>
                  <th className="py-3 px-4 text-right">মোট দাবি</th>
                  <th className="py-3 px-4 text-right">আদায়কৃত অর্থ</th>
                  <th className="py-3 px-4 text-right">বকেয়া</th>
                  <th className="py-3 px-4 text-center">আদায়ের হার</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {propertySummaries.map((p) => (
                  <tr key={p.propertyId} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-800">{p.propertyName}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{p.billsCount} টি</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">৳{p.demand.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">৳{p.collected.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600">৳{p.due.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-blue-700">{p.rate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <GenerateBillsModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        properties={properties}
        defaultMonth={selectedMonth}
        onSuccess={handleBillGenerated}
      />

      <RecordPaymentModal
        isOpen={paymentModalBill !== null}
        onClose={() => setPaymentModalBill(null)}
        bill={paymentModalBill}
        onSuccess={handlePaymentRecorded}
      />

      <RentReceiptModal
        isOpen={receiptModalPayment !== null}
        onClose={() => {
          setReceiptModalPayment(null);
          setReceiptModalBill(null);
        }}
        payment={receiptModalPayment}
        bill={receiptModalBill}
      />

      <TenantHistoryModal
        isOpen={historyModalTenant !== null}
        onClose={() => setHistoryModalTenant(null)}
        tenant={historyModalTenant}
        ownerUid={ownerUid}
        onSelectReceipt={(payment, bill) => {
          setReceiptModalPayment(payment);
          setReceiptModalBill(bill);
        }}
      />
    </div>
  );
}
