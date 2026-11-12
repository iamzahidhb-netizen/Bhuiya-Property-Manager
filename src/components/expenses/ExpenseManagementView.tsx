import { useState, useEffect, useMemo } from 'react';
import type { Property } from '../../types/property';
import type {
  Expense,
  ExpenseGroup,
  ExpenseCategory,
  RentPayment,
} from '../../types/finance';
import { subscribeRentPayments } from '../../services/rentService';
import {
  subscribeExpenses,
  calculateOperatingSummary,
  EXPENSE_CATEGORY_LABELS,
} from '../../services/expenseService';
import { getExpenseBillingMonth } from '../../services/financialSummary';
import { sumMoney } from '../../utils/money';
import ExpenseModal from './ExpenseModal';
import ExpenseDetailsModal from './ExpenseDetailsModal';

interface ExpenseManagementViewProps {
  ownerUid: string;
  properties: Property[];
}

export default function ExpenseManagementView({
  ownerUid,
  properties,
}: ExpenseManagementViewProps) {
  // Current month default in YYYY-MM format
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedGroup, setSelectedGroup] = useState<ExpenseGroup | 'all'>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [detailsExpense, setDetailsExpense] = useState<Expense | null>(null);

  // Real-time subscription to expenses and payments
  useEffect(() => {
    if (!ownerUid) return;

    const unsubExpenses = subscribeExpenses(
      ownerUid,
      {
        propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : null,
      },
      (fetchedExpenses) => {
        setExpenses(fetchedExpenses);
        setLoading(false);
      }
    );

    const unsubPayments = subscribeRentPayments(
      ownerUid,
      {},
      (fetchedPayments) => {
        setRentPayments(fetchedPayments);
      }
    );

    return () => {
      unsubExpenses();
      unsubPayments();
    };
  }, [ownerUid, selectedPropertyId]);

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

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (getExpenseBillingMonth(e) !== selectedMonth) {
        return false;
      }
      // Group filter
      if (selectedGroup !== 'all' && e.group !== selectedGroup) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && e.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesPaidTo = e.paidTo?.toLowerCase().includes(q) ?? false;
        const matchesDesc = e.description?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesPaidTo && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, selectedMonth, selectedGroup, selectedCategory, searchQuery]);

  // Financial calculations
  const operatingSummary = useMemo(() => {
    return calculateOperatingSummary(selectedMonth, rentPayments, expenses);
  }, [selectedMonth, rentPayments, expenses]);

  // Property-wise building expense summaries
  const propertyExpenseSummaries = useMemo(() => {
    const map = new Map<string, { propertyName: string; totalAmount: number; count: number }>();

    properties.forEach((p) => {
      map.set(p.id, { propertyName: p.name, totalAmount: 0, count: 0 });
    });

    expenses
      .filter(
        (e) =>
          getExpenseBillingMonth(e) === selectedMonth &&
          e.group === 'building' &&
          e.status === 'active' &&
          e.propertyId
      )
      .forEach((e) => {
        const entry = map.get(e.propertyId!) || {
          propertyName: e.propertyName || 'Property',
          totalAmount: 0,
          count: 0,
        };
        entry.totalAmount = sumMoney([entry.totalAmount, e.amount]);
        entry.count += 1;
        map.set(e.propertyId!, entry);
      });

    return Array.from(map.entries())
      .map(([propertyId, data]) => ({
        propertyId,
        ...data,
      }))
      .filter((item) => item.count > 0 || selectedPropertyId === 'all');
  }, [properties, expenses, selectedMonth, selectedPropertyId]);

  return (
    <div className="operations-view space-y-6">
      {/* Top Banner: Financial Operating Balance (Actual Income vs Expenses) */}
      <div className="bg-slate-950 rounded-[var(--radius-section)] p-6 sm:p-8 text-white shadow-[var(--shadow-md)] relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-medium mb-3 border border-white/15">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Phase 5 • পরিচালন খরচ ও নিট আর্থিক হিসাব
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
              ভবন ও পারিবারিক খরচ ব্যবস্থাপনা
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              ৩টি ভবনের প্রকৃত পরিচালন খরচ ও পারিবারিক ব্যয় হিসাব। ৳৬০,০০০ মাসিক পরিচালন বাজেট লক্ষ্যের সাথে প্রতিনিয়ত মিলকরণ।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setEditingExpense(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-2xl shadow-lg transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>নতুন খরচ যোগ করুন</span>
            </button>
          </div>
        </div>

        {/* Operating Balance Breakdown Formula Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-emerald-400 font-semibold block uppercase">আদায়কৃত প্রকৃত ভাড়া (+)</span>
            <span className="text-lg font-black text-white">
              ৳{operatingSummary.actualRentCollected.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-blue-300 font-semibold block uppercase">ভবন পরিচালন খরচ (-)</span>
            <span className="text-lg font-black text-blue-200">
              ৳{operatingSummary.buildingExpenses.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] text-purple-300 font-semibold block uppercase">পারিবারিক খরচ (-)</span>
            <span className="text-lg font-black text-purple-200">
              ৳{operatingSummary.familyExpenses.toLocaleString('en-IN')}
            </span>
          </div>

          <div className={`p-3 rounded-2xl border ${operatingSummary.netOperatingSurplus >= 0 ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-red-500/20 border-red-500/40 text-red-300'}`}>
            <span className="text-[10px] font-bold block uppercase">নিট পরিচালন উদ্বৃত্ত (=)</span>
            <span className="text-lg font-black block">
              ৳{operatingSummary.netOperatingSurplus.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Month Navigation & Filter Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
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
              onClick={handleResetCurrentMonth}
              className="text-[11px] font-semibold text-blue-600 hover:underline px-2 py-1 cursor-pointer"
            >
              চলতি মাস
            </button>
          )}
        </div>

        {/* Filters */}
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

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ExpenseCategory | 'all')}
            className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 max-w-[160px]"
          >
            <option value="all">সকল খাত / All Categories</option>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([catKey, label]) => (
              <option key={catKey} value={catKey}>
                {label.bn}
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
              placeholder="শিরোনাম, প্রাপক বা বিবরণ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Monthly Expenses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">মোট মাসিক খরচ / Total Actual</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v8.25m0-8.25a60.07 60.07 0 0 1 15.797-2.101c.727-.198 1.453.342 1.453 1.096V6m-17.25 0h17.25" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            ৳{operatingSummary.totalActualExpenses.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            মোট এন্ট্রি: <span className="font-bold text-slate-800">{expenses.filter((e) => e.status === 'active').length}</span> টি
          </p>
        </div>

        {/* Building Expenses Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">ভবন পরিচালন খরচ / Building</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="text-sm">🏢</span>
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700 mb-1">
            ৳{operatingSummary.buildingExpenses.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            বিদ্যুৎ, গ্যাস, পানি, কেয়ারটেকার ও মেরামত
          </p>
        </div>

        {/* Budget vs Actual Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">বাজেট লক্ষ্য বনাম প্রকৃত</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              টার্গেট: ৳৬০,০০০
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            {operatingSummary.budgetUtilizationPercent}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                operatingSummary.budgetUtilizationPercent > 100 ? 'bg-red-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, operatingSummary.budgetUtilizationPercent)}%` }}
            />
          </div>
          <p className="text-[11px] font-medium">
            {operatingSummary.buildingBudgetVariance > 0 ? (
              <span className="text-red-600">
                ⚠️ বাজেটের অতিরিক্ত: ৳{operatingSummary.buildingBudgetVariance.toLocaleString('en-IN')}
              </span>
            ) : (
              <span className="text-emerald-600">
                ✓ বাজেটের ভেতরে: ৳{Math.abs(operatingSummary.buildingBudgetVariance).toLocaleString('en-IN')} অবশিষ্ট
              </span>
            )}
          </p>
        </div>

        {/* Family & Social Expenses Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">পারিবারিক ও সামাজিক / Family</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="text-sm">👨‍👩‍👧‍👦</span>
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mb-1">
            ৳{operatingSummary.familyExpenses.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            বাজার-সদাই, চিকিৎসা, যাতায়াত ও জরুরি খরচ
          </p>
        </div>
      </div>

      {/* Group Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'all', label: 'সকল খরচ', count: expenses.length },
          {
            id: 'building',
            label: 'ভবন পরিচালন খরচ (Building)',
            count: expenses.filter((e) => e.group === 'building').length,
          },
          {
            id: 'family',
            label: 'পারিবারিক ও সামাজিক খরচ (Family)',
            count: expenses.filter((e) => e.group === 'family').length,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedGroup(tab.id as ExpenseGroup | 'all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
              selectedGroup === tab.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedGroup === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Expense Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            খরচের তথ্য লোড হচ্ছে...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v8.25m0-8.25a60.07 60.07 0 0 1 15.797-2.101c.727-.198 1.453.342 1.453 1.096V6m-17.25 0h17.25" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">
              {expenses.length === 0 ? `${selectedMonth} মাসে কোনো খরচ এন্ট্রি করা হয়নি` : 'কোনো খরচের রেকর্ড মেলেনি'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              {expenses.length === 0
                ? 'বিদ্যুৎ, পানি, কেয়ারটেকার বেতন বা পারিবারিক বাজারের খরচ যুক্ত করতে নিচের বাটনে চাপ দিন।'
                : 'অন্য সার্চ ফিল্টার ব্যবহার করুন।'}
            </p>
            {expenses.length === 0 && (
              <button
                onClick={() => {
                  setEditingExpense(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>প্রথম খরচ যুক্ত করুন</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">তারিখ</th>
                  <th className="py-3.5 px-4">খরচের শিরোনাম ও বিবরণ</th>
                  <th className="py-3.5 px-4">ধরন ও ক্যাটাগরি</th>
                  <th className="py-3.5 px-4">প্রপার্টি / প্রাপক</th>
                  <th className="py-3.5 px-4">পরিশোধ মাধ্যম</th>
                  <th className="py-3.5 px-4 text-right">পরিমাণ (টাকা)</th>
                  <th className="py-3.5 px-4 text-center">অবস্থা</th>
                  <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExpenses.map((exp) => {
                  const catLabel = EXPENSE_CATEGORY_LABELS[exp.category] || { bn: exp.category, en: exp.category };
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-4 px-4 font-mono font-semibold text-slate-800">
                        {exp.expenseDate}
                      </td>

                      {/* Title & Description */}
                      <td className="py-4 px-4">
                        <div>
                          <p className={`font-bold text-sm ${exp.status === 'reversed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {exp.title}
                          </p>
                          {exp.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{exp.description}</p>
                          )}
                          {exp.auditHistory && exp.auditHistory.length > 0 && (
                            <span className="inline-block text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md font-medium mt-1">
                              ✏️ {exp.auditHistory.length} বার সংশোধিত
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Group & Category */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              exp.group === 'building' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {exp.group === 'building' ? 'ভবন পরিচালন' : 'পারিবারিক'}
                          </span>
                          <span className="block text-[11px] text-slate-600 font-medium">
                            {catLabel.bn}
                          </span>
                        </div>
                      </td>

                      {/* Property & Vendor */}
                      <td className="py-4 px-4 text-slate-600">
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {exp.propertyName || (exp.group === 'family' ? 'পারিবারিক' : 'সার্বজনীন')}
                          </span>
                          {exp.paidTo && (
                            <span className="text-[11px] text-slate-500">প্রাপক: {exp.paidTo}</span>
                          )}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-4 px-4 text-slate-600 capitalize">
                        {exp.paymentMethod}
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right font-bold text-slate-900 text-sm">
                        <span className={exp.status === 'reversed' ? 'line-through text-slate-400' : ''}>
                          ৳{exp.amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            exp.status === 'reversed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {exp.status === 'reversed' ? 'বাতিল' : 'সক্রিয়'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailsExpense(exp)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                            title="বিস্তারিত বিবরণ ও অডিট ট্রেইল"
                          >
                            অডিট ও বিবরণ
                          </button>
                          {exp.status === 'active' && (
                            <button
                              onClick={() => {
                                setEditingExpense(exp);
                                setModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] transition-colors cursor-pointer"
                              title="সংশোধন করুন"
                            >
                              সংশোধন
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
        )}
      </div>

      {/* Property-Wise Building Expense Summary */}
      {propertyExpenseSummaries.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">প্রপার্টি-ভিত্তিক ভবন পরিচালন খরচ</h3>
              <p className="text-xs text-slate-500">Property-Wise Building Operating Expenses • {selectedMonth}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">প্রপার্টি / ভবন</th>
                  <th className="py-3 px-4 text-center">এন্ট্রি সংখ্যা</th>
                  <th className="py-3 px-4 text-right">মোট পরিচালন খরচ</th>
                  <th className="py-3 px-4 text-center">মোট খরচের অনুপাত</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {propertyExpenseSummaries.map((p) => {
                  const percentOfBuilding =
                    operatingSummary.buildingExpenses > 0
                      ? Math.round((p.totalAmount / operatingSummary.buildingExpenses) * 100)
                      : 0;
                  return (
                    <tr key={p.propertyId} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-800">{p.propertyName}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{p.count} টি</td>
                      <td className="py-3 px-4 text-right font-bold text-blue-900">
                        ৳{p.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-700">{percentOfBuilding}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <ExpenseModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingExpense(null);
        }}
        properties={properties}
        initialExpense={editingExpense}
        defaultMonth={selectedMonth}
        onSuccess={() => {
          // Handled via real-time subscription
        }}
      />

      <ExpenseDetailsModal
        isOpen={detailsExpense !== null}
        onClose={() => setDetailsExpense(null)}
        expense={detailsExpense}
        onEdit={(exp) => {
          setEditingExpense(exp);
          setModalOpen(true);
        }}
        onReversed={() => {
          // Handled via real-time subscription
        }}
      />
    </div>
  );
}
