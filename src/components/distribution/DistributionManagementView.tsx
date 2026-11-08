import { useState, useEffect, useMemo } from 'react';
import type {
  Beneficiary,
  BeneficiarySnapshot,
  FamilyDistribution,
  ReserveFundAccount,
  ReserveLedgerEntry,
  RentPayment,
  Expense,
} from '../../types/finance';
import { subscribeRentPayments } from '../../services/rentService';
import { subscribeExpenses } from '../../services/expenseService';
import {
  subscribeBeneficiaries,
  subscribeMonthlyDistribution,
  subscribeReserveFund,
  subscribeReserveLedger,
  seedDefaultBeneficiaries,
  getOrCreateMonthlyDistribution,
  archiveBeneficiary,
  RELATIONSHIP_LABELS,
} from '../../services/distributionService';
import BeneficiaryModal from './BeneficiaryModal';
import PayoutModal from './PayoutModal';
import SpecialAdjustmentModal from './SpecialAdjustmentModal';
import ReserveFundModal from './ReserveFundModal';

interface DistributionManagementViewProps {
  ownerUid: string;
}

export default function DistributionManagementView({
  ownerUid,
}: DistributionManagementViewProps) {
  // Current month in YYYY-MM
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [activeSubTab, setActiveSubTab] = useState<'distribution' | 'beneficiaries' | 'reserve'>('distribution');

  // Real-time data
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [distribution, setDistribution] = useState<FamilyDistribution | null>(null);
  const [reserveFund, setReserveFund] = useState<ReserveFundAccount | null>(null);
  const [reserveLedger, setReserveLedger] = useState<ReserveLedgerEntry[]>([]);
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modals state
  const [beneficiaryModalOpen, setBeneficiaryModalOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);

  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedSnapshotForPayout, setSelectedSnapshotForPayout] = useState<BeneficiarySnapshot | null>(null);

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedSnapshotForAdjustment, setSelectedSnapshotForAdjustment] = useState<BeneficiarySnapshot | null>(null);

  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [expandedPayoutsId, setExpandedPayoutsId] = useState<string | null>(null);

  // Real-time subscriptions
  useEffect(() => {
    if (!ownerUid) return;

    const unsubBeneficiaries = subscribeBeneficiaries(ownerUid, (data) => {
      setBeneficiaries(data);
      setLoading(false);
    });

    const unsubDistribution = subscribeMonthlyDistribution(ownerUid, selectedMonth, (data) => {
      setDistribution(data);
    });

    const unsubReserve = subscribeReserveFund(ownerUid, (data) => {
      setReserveFund(data);
    });

    const unsubLedger = subscribeReserveLedger(ownerUid, (data) => {
      setReserveLedger(data);
    });

    const unsubPayments = subscribeRentPayments(ownerUid, { billingMonth: selectedMonth }, (data) => {
      setRentPayments(data);
    });

    const unsubExpenses = subscribeExpenses(ownerUid, { billingMonth: selectedMonth }, (data) => {
      setExpenses(data);
    });

    return () => {
      unsubBeneficiaries();
      unsubDistribution();
      unsubReserve();
      unsubLedger();
      unsubPayments();
      unsubExpenses();
    };
  }, [ownerUid, selectedMonth]);

  // Financial Calculations for Selected Month
  const financialSummary = useMemo(() => {
    // Actual collections from tenant rent/utilities payments (liabilities like security deposits excluded)
    let actualCollections = 0;
    for (const p of rentPayments) {
      if (p.entryType === 'payment') {
        actualCollections += p.amount || 0;
      }
    }

    // Actual operating expenses (building + family)
    let buildingExpenses = 0;
    let familyExpenses = 0;
    for (const e of expenses) {
      if (e.status === 'active') {
        if (e.group === 'building') {
          buildingExpenses += e.amount || 0;
        } else if (e.group === 'family') {
          familyExpenses += e.amount || 0;
        }
      }
    }

    const totalOperatingExpenses = buildingExpenses + familyExpenses;
    const netOperatingBalance = actualCollections - totalOperatingExpenses;

    const totalTarget = distribution?.finalTargetTotal || 0;
    const totalDisbursed = distribution?.actualTotalDisbursed || 0;
    const remainingPending = distribution?.remainingPendingTotal ?? totalTarget;
    const reserveInflow = distribution?.reserveInflow || 0;
    const surplusTransferred = distribution?.surplusTransferredToReserve || 0;

    // Available cash pool for payouts = Net Operating Surplus + Reserve Inflow - Total Already Disbursed
    const availableCashPool = Math.max(0, netOperatingBalance + reserveInflow - totalDisbursed);

    // Distributable surplus remaining for reserve deposit
    const availableSurplusForReserve = Math.max(0, netOperatingBalance - totalDisbursed - surplusTransferred);

    // Monthly Surplus or Shortage
    const monthlyNetSurplusOrShortage = netOperatingBalance - totalTarget;

    return {
      actualCollections,
      buildingExpenses,
      familyExpenses,
      totalOperatingExpenses,
      netOperatingBalance,
      totalTarget,
      totalDisbursed,
      remainingPending,
      reserveInflow,
      surplusTransferred,
      availableCashPool,
      availableSurplusForReserve,
      monthlyNetSurplusOrShortage,
      reserveFundBalance: reserveFund?.currentBalance || 0,
    };
  }, [rentPayments, expenses, distribution, reserveFund]);

  // Initialize or fetch distribution snapshot
  async function handleInitializeDistribution() {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await getOrCreateMonthlyDistribution(selectedMonth);
      if (res.isNew) {
        setActionMessage(`✓ ${selectedMonth} মাসের বণ্টন স্ন্যাপশট সফলভাবে তৈরি হয়েছে।`);
      } else {
        setActionMessage(`✓ ${selectedMonth} মাসের সংরক্ষিত স্ন্যাপশট লোড হয়েছে।`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'স্ন্যাপশট লোড করা যায়নি।';
      setActionMessage(`⚠️ ${msg}`);
    } finally {
      setActionLoading(false);
    }
  }

  // Seed default 5 beneficiaries
  async function handleSeedDefaults() {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await seedDefaultBeneficiaries();
      if (res.seeded) {
        setActionMessage('✓ ডিফল্ট ৫ জন পারিবারিক অংশীদার সফলভাবে যুক্ত করা হয়েছে (মোট লক্ষ্য: ৳১,৮৫,০০০)।');
      } else {
        setActionMessage('ℹ️ অংশীদার তালিকা পূর্বে থেকেই বিদ্যমান রয়েছে।');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ডিফল্ট অংশীদার তৈরি করা যায়নি।';
      setActionMessage(`⚠️ ${msg}`);
    } finally {
      setActionLoading(false);
    }
  }

  // Archive beneficiary
  async function handleArchive(beneficiaryId: string, name: string) {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${name}" কে আর্কাইভ করতে চান?`)) return;
    try {
      await archiveBeneficiary(beneficiaryId);
      setActionMessage(`✓ "${name}" কে আর্কাইভ করা হয়েছে।`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'আর্কাইভ ব্যর্থ হয়েছে।';
      setActionMessage(`⚠️ ${msg}`);
    }
  }

  // Month navigation
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

  return (
    <div className="space-y-6">
      {/* Action Notification Message */}
      {actionMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl text-xs font-semibold flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-blue-500 hover:text-blue-800">
            ✕
          </button>
        </div>
      )}

      {/* TOP COMPREHENSIVE FINANCIAL SUMMARY & OPERATING BALANCE BAR */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full text-indigo-300 text-xs font-bold mb-3 border border-indigo-500/30">
              <span>Phase 6 • পারিবারিক মুনাফা বণ্টন ও রিজার্ভ ফান্ড</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1">
              পারিবারিক বণ্টন ও রিজার্ভ ফান্ড নিয়ন্ত্রণ কেন্দ্র
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              বাস্তব আদায় ও ব্যয়ের ভিত্তিতে স্বচ্ছ অপারেটিং উদ্বৃত্ত হিসাব, অপরিবর্তনযোগ্য মাসিক স্ন্যাপশট এবং সংরক্ষিত রিজার্ভ তহবিল।
            </p>
          </div>

          {/* Reserve Fund Quick Pill */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3.5 rounded-2xl shrink-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
              🏦
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-300 uppercase block">রিজার্ভ ফান্ড ব্যালেন্স</span>
              <span className="text-xl font-black text-white">
                ৳{financialSummary.reserveFundBalance.toLocaleString('en-IN')}
              </span>
            </div>
            <button
              onClick={() => setReserveModalOpen(true)}
              className="ml-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              লেনদেন
            </button>
          </div>
        </div>

        {/* 4 Primary Financial KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-emerald-400 uppercase block">আদায়কৃত প্রকৃত ভাড়া (+)</span>
            <span className="text-xl sm:text-2xl font-black text-white block mt-1">
              ৳{financialSummary.actualCollections.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">ভাড়া, গ্যাস ও পানি প্রাপ্তি</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-rose-400 uppercase block">প্রকৃত পরিচালন ব্যয় (-)</span>
            <span className="text-xl sm:text-2xl font-black text-rose-200 block mt-1">
              ৳{financialSummary.totalOperatingExpenses.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">ভবন (৳{financialSummary.buildingExpenses.toLocaleString('en-IN')}) + পরিবার (৳{financialSummary.familyExpenses.toLocaleString('en-IN')})</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-indigo-300 uppercase block">নিট অপারেটিং উদ্বৃত্ত (=)</span>
            <span className={`text-xl sm:text-2xl font-black block mt-1 ${financialSummary.netOperatingBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ৳{financialSummary.netOperatingBalance.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">আদায় - সকল পরিচালন খরচ</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-amber-300 uppercase block">মাসিক উদ্বৃত্ত / (ঘাটতি)</span>
            <span className={`text-xl sm:text-2xl font-black block mt-1 ${financialSummary.monthlyNetSurplusOrShortage >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {financialSummary.monthlyNetSurplusOrShortage >= 0 ? '+' : ''}৳{financialSummary.monthlyNetSurplusOrShortage.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">অপারেটিং ব্যালেন্স বনাম মোট লক্ষ্য</span>
          </div>
        </div>

        {/* Distribution Progress Strip */}
        <div className="mt-5 p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">অনুমোদিত মোট লক্ষ্য</span>
              <span className="text-base font-bold text-white">৳{financialSummary.totalTarget.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">পরিশোধিত অনুদান</span>
              <span className="text-base font-bold text-emerald-400">৳{financialSummary.totalDisbursed.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">অবশিষ্ট বকেয়া বিতরণ</span>
              <span className="text-base font-bold text-amber-300">৳{financialSummary.remainingPending.toLocaleString('en-IN')}</span>
            </div>
            {financialSummary.reserveInflow > 0 && (
              <div>
                <span className="text-[10px] text-indigo-300 block uppercase">রিজার্ভ হতে ইনপুট</span>
                <span className="text-base font-bold text-indigo-200">+৳{financialSummary.reserveInflow.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setReserveModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              উদ্বৃত্ত জমা / ঘাটতি পূরণ
            </button>
          </div>
        </div>
      </div>

      {/* MONTH SELECTOR & ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
            হিসাবের মাস:
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
              onClick={() => setSelectedMonth(currentMonthStr)}
              className="text-[11px] font-semibold text-blue-600 hover:underline px-2 py-1 cursor-pointer"
            >
              চলতি মাস
            </button>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {beneficiaries.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={actionLoading}
              className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all cursor-pointer"
            >
              🌱 ডিফল্ট অংশীদার লোড (৳১৮৫,০০০)
            </button>
          )}

          {!distribution && (
            <button
              onClick={handleInitializeDistribution}
              disabled={actionLoading}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              📑 {selectedMonth} মাসের স্ন্যাপশট সূচনা করুন
            </button>
          )}

          <button
            onClick={() => {
              setEditingBeneficiary(null);
              setBeneficiaryModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            + নতুন অংশীদার
          </button>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('distribution')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'distribution'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>মাসিক অনুদান বিতরণ ({selectedMonth})</span>
          {distribution && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {distribution.beneficiarySnapshots?.length || 0}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('beneficiaries')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'beneficiaries'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>পারিবারিক অংশীদার ডিরেক্টরি</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
            {beneficiaries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('reserve')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'reserve'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>রিজার্ভ ফান্ড লেজার ইতিহাস</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
            {reserveLedger.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MONTHLY DISTRIBUTION SNAPSHOTS & PAYOUTS */}
      {activeSubTab === 'distribution' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">তথ্য লোড হচ্ছে...</div>
          ) : !distribution ? (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 text-2xl">
                📑
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {selectedMonth} মাসের কোনো বণ্টন স্ন্যাপশট এখনও খোলা হয়নি
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
                ঐতিহাসিক ডাটা সুরক্ষা নিশ্চিত করতে প্রতি মাসের শুরুতে সক্রিয় অংশীদারদের লক্ষ্য নিয়ে একটি অপরিবর্তনীয় স্ন্যাপশট তৈরি হয়।
              </p>
              <button
                onClick={handleInitializeDistribution}
                disabled={actionLoading}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                {selectedMonth} মাসের মাসিক স্ন্যাপশট তৈরি করুন
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">মাসিক অবস্থা:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      distribution.status === 'finalized'
                        ? 'bg-emerald-100 text-emerald-800'
                        : distribution.actualTotalDisbursed > 0
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {distribution.status === 'finalized' ? '✓ সম্পূর্ণ পরিশোধিত' : distribution.actualTotalDisbursed > 0 ? 'চলমান বিতরণ' : 'খসড়া / অপেক্ষমাণ'}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  উপলব্ধ ক্যাশ পুল: <span className="font-bold text-slate-900">৳{financialSummary.availableCashPool.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">অংশীদার</th>
                    <th className="py-3 px-3">সম্পর্ক</th>
                    <th className="py-3 px-3 text-right">ভিত্তি লক্ষ্য</th>
                    <th className="py-3 px-3 text-right">বিশেষ সমন্বয়</th>
                    <th className="py-3 px-3 text-right">চূড়ান্ত লক্ষ্য</th>
                    <th className="py-3 px-3 text-right">পরিশোধিত</th>
                    <th className="py-3 px-3 text-right">অবশিষ্ট বকেয়া</th>
                    <th className="py-3 px-3 text-center">অবস্থা</th>
                    <th className="py-3 px-4 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {distribution.beneficiarySnapshots?.map((snap) => (
                    <tr key={snap.beneficiaryId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{snap.name}</span>
                          {snap.payouts?.length > 0 && (
                            <button
                              onClick={() => setExpandedPayoutsId(expandedPayoutsId === snap.beneficiaryId ? null : snap.beneficiaryId)}
                              className="text-[10px] text-blue-600 hover:underline"
                              title="পেমেন্ট রেকর্ড দেখুন"
                            >
                              ({snap.payouts.length} কিস্তি)
                            </button>
                          )}
                        </div>
                        {expandedPayoutsId === snap.beneficiaryId && snap.payouts?.length > 0 && (
                          <div className="mt-2 p-2.5 bg-slate-100/80 rounded-xl space-y-1 font-normal text-[11px]">
                            <span className="font-bold text-[10px] uppercase text-slate-600 block">পরিশোধ ইতিহাস:</span>
                            {snap.payouts.map((p) => (
                              <div key={p.id} className="flex justify-between items-center text-slate-700">
                                <span>{p.paymentDate} • {p.paymentMethod.toUpperCase()} {p.transactionId ? `(${p.transactionId})` : ''}</span>
                                <span className="font-bold text-emerald-700">৳{p.amount.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {RELATIONSHIP_LABELS[snap.relationship]?.bn || snap.relationship}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                        ৳{snap.baseMonthlyTarget.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {snap.specialAdjustment !== 0 ? (
                          <span
                            className={`font-semibold ${snap.specialAdjustment > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                            title={snap.adjustmentReason || ''}
                          >
                            {snap.specialAdjustment > 0 ? `+৳${snap.specialAdjustment.toLocaleString('en-IN')}` : `৳${snap.specialAdjustment.toLocaleString('en-IN')}`}
                          </span>
                        ) : (
                          <span className="text-slate-400">৳০</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right font-black text-slate-900">
                        ৳{snap.effectiveTarget.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-600">
                        ৳{snap.actualDisbursed.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-amber-600">
                        ৳{snap.pendingAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            snap.payoutStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : snap.payoutStatus === 'partial'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {snap.payoutStatus === 'paid' ? 'পরিশোধিত' : snap.payoutStatus === 'partial' ? 'আংশিক' : 'বকেয়া'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {snap.pendingAmount > 0 && (
                            <button
                              onClick={() => {
                                setSelectedSnapshotForPayout(snap);
                                setPayoutModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              পেমেন্ট দিন
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedSnapshotForAdjustment(snap);
                              setAdjustmentModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="বিশেষ সমন্বয় / বোনাস"
                          >
                            সমন্বয়
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BENEFICIARY DIRECTORY */}
      {activeSubTab === 'beneficiaries' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">পারিবারিক অংশীদারদের তালিকা ও লক্ষ্য কনফিগারেশন</h3>
              <p className="text-xs text-slate-500">পরিবর্তিত লক্ষ্য পরবর্তী নতুন মাসের স্ন্যাপশটে প্রযোজ্য হবে</p>
            </div>
            <button
              onClick={() => {
                setEditingBeneficiary(null);
                setBeneficiaryModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
            >
              + অংশীদার যোগ
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">অংশীদার</th>
                  <th className="py-3 px-3">সম্পর্ক</th>
                  <th className="py-3 px-3 text-right">মাসিক লক্ষ্য</th>
                  <th className="py-3 px-3">কার্যকর মাস</th>
                  <th className="py-3 px-3">পেমেন্ট মেথড</th>
                  <th className="py-3 px-3 text-center">স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {beneficiaries.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800">{b.name}</td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {RELATIONSHIP_LABELS[b.relationship]?.bn || b.relationship}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-black text-slate-900">
                      ৳{b.defaultMonthlyTarget.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 font-medium">
                      {b.effectiveFromMonth || '২০২৬-০১'}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 uppercase text-[11px] font-semibold">
                      {b.payoutMethod?.type || 'bank'}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingBeneficiary(b);
                            setBeneficiaryModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          সম্পাদনা
                        </button>
                        <button
                          onClick={() => handleArchive(b.id, b.name)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          আর্কাইভ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RESERVE FUND LEDGER HISTORY */}
      {activeSubTab === 'reserve' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">পারিবারিক রিজার্ভ ফান্ড হিসাব ও অপরিবর্তনযোগ্য লেজার</h3>
              <p className="text-xs text-slate-500">
                বর্তমান ব্যালেন্স: <span className="font-bold text-slate-900">৳{financialSummary.reserveFundBalance.toLocaleString('en-IN')}</span>
              </p>
            </div>
            <button
              onClick={() => setReserveModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors cursor-pointer"
            >
              + নতুন রিজার্ভ লেনদেন
            </button>
          </div>

          <div className="overflow-x-auto">
            {reserveLedger.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                রিজার্ভ ফান্ডের কোনো লেনদেন এখনো রেকর্ড করা হয়নি।
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">তারিখ</th>
                    <th className="py-3 px-3">লেনদেনের ধরন</th>
                    <th className="py-3 px-3 text-right">পরিমাণ</th>
                    <th className="py-3 px-3 text-right">পূর্ববর্তী ব্যালেন্স</th>
                    <th className="py-3 px-3 text-right">পরবর্তী ব্যালেন্স</th>
                    <th className="py-3 px-4">কারণ ও বিবরণ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reserveLedger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {entry.createdAt ? entry.createdAt.toDate().toLocaleDateString('bn-BD') : 'N/A'}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            entry.type === 'surplus_deposit'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.type === 'shortage_withdrawal'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {entry.type === 'surplus_deposit'
                            ? 'উদ্বৃত্ত জমা'
                            : entry.type === 'shortage_withdrawal'
                            ? 'ঘাটতি উত্তোলন'
                            : 'প্রারম্ভিক ব্যালেন্স'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-black">
                        <span className={entry.type === 'surplus_deposit' ? 'text-emerald-600' : 'text-amber-600'}>
                          {entry.type === 'surplus_deposit' ? '+' : '-'}৳{entry.amount.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-500">
                        ৳{entry.balanceBefore.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                        ৳{entry.balanceAfter.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {entry.reason}
                        {entry.distributionMonth && (
                          <span className="text-[10px] text-slate-400 block">মাস: {entry.distributionMonth}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {beneficiaryModalOpen && (
        <BeneficiaryModal
          key={editingBeneficiary ? editingBeneficiary.id : 'new'}
          isOpen={beneficiaryModalOpen}
          onClose={() => setBeneficiaryModalOpen(false)}
          beneficiary={editingBeneficiary}
          onSaved={() => {
            setActionMessage('✓ অংশীদারের তথ্য সফলভাবে সংরক্ষিত হয়েছে।');
          }}
        />
      )}

      {payoutModalOpen && selectedSnapshotForPayout && (
        <PayoutModal
          key={`${selectedSnapshotForPayout.beneficiaryId}_${selectedSnapshotForPayout.actualDisbursed}`}
          isOpen={payoutModalOpen}
          onClose={() => {
            setPayoutModalOpen(false);
            setSelectedSnapshotForPayout(null);
          }}
          distributionMonth={selectedMonth}
          snapshot={selectedSnapshotForPayout}
          availableCashPool={financialSummary.availableCashPool}
          onPaid={() => {
            setActionMessage('✓ অনুদান পেমেন্ট সফলভাবে রেকর্ড করা হয়েছে।');
          }}
        />
      )}

      {adjustmentModalOpen && selectedSnapshotForAdjustment && (
        <SpecialAdjustmentModal
          key={selectedSnapshotForAdjustment.beneficiaryId}
          isOpen={adjustmentModalOpen}
          onClose={() => {
            setAdjustmentModalOpen(false);
            setSelectedSnapshotForAdjustment(null);
          }}
          distributionMonth={selectedMonth}
          snapshot={selectedSnapshotForAdjustment}
          onAdjusted={() => {
            setActionMessage('✓ বিশেষ মাসিক সমন্বয় সফলভাবে প্রয়োগ করা হয়েছে।');
          }}
        />
      )}

      {reserveModalOpen && (
        <ReserveFundModal
          key={`${distribution?.id}_${reserveFund?.currentBalance}`}
          isOpen={reserveModalOpen}
          onClose={() => setReserveModalOpen(false)}
          distributionMonth={selectedMonth}
          reserveFund={reserveFund}
          availableMonthlySurplus={financialSummary.availableSurplusForReserve}
          onSuccess={() => {
            setActionMessage('✓ রিজার্ভ ফান্ড লেনদেন সফল হয়েছে।');
          }}
        />
      )}
    </div>
  );
}
