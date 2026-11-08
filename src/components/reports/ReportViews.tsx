import React from 'react';
import type {
  MonthlyFinancialStatement,
  YearlyFinancialSummary,
  PropertyIncomeReport,
  PropertyExpenseReport,
  TenantRentLedger,
  OutstandingRentReport,
  BuildingExpenseReport,
  FamilyExpenseReport,
  FamilyDistributionStatement,
  ReserveFundStatement,
  NetOperatingBalanceReport,
  BudgetVsActualReport,
} from '../../types/reports';
import { formatBDT } from '../../utils/exportUtils';

// =============================================================================
// 1. MONTHLY FINANCIAL STATEMENT VIEW
// =============================================================================
export const MonthlyStatementView: React.FC<{ data: MonthlyFinancialStatement }> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Top Banner KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-medium text-emerald-800">মোট আদায়কৃত পরিচালন আয় / Realized Income</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatBDT(data.totalOperatingIncome)}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">ভাড়া + গ্যাস + পানি আদায়</p>
        </div>

        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-800">মোট পরিচালন ব্যয় / Operating Expenses</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{formatBDT(data.totalOperatingExpenses)}</p>
          <p className="text-[11px] text-amber-600 mt-0.5">ভবন পরিচালন + পারিবারিক খরচ</p>
        </div>

        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-800">নিট পরিচালন উদ্বৃত্ত / Net Operating Surplus</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{formatBDT(data.netOperatingSurplus)}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">বণ্টনযোগ্য কার্যকরী নগদ তহবিল</p>
        </div>

        <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4">
          <p className="text-xs font-medium text-indigo-800">পারিবারিক বণ্টন সম্পন্ন / Disbursed</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{formatBDT(data.totalFamilyDistributionDisbursed)}</p>
          <p className="text-[11px] text-indigo-600 mt-0.5">লক্ষ্যমাত্রা: {formatBDT(data.totalFamilyDistributionTarget)}</p>
        </div>
      </div>

      {/* Financial Statement Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            মাসিক পূর্ণাঙ্গ আর্থিক বিবরণী ({data.month}) / Comprehensive Financial Statement
          </h3>
          <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 font-medium rounded-full">
            প্রকৃত প্রাপ্তি ও ব্যয়ভিত্তিক
          </span>
        </div>

        <table className="w-full text-xs text-left">
          <tbody className="divide-y divide-slate-100">
            {/* Section 1: Income */}
            <tr className="bg-slate-50/60 font-semibold text-slate-700">
              <td className="py-2.5 px-4" colSpan={2}>
                ১. পরিচালন আয় ও আদায় (Operating Income / Receipts)
              </td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">বাড়ি ভাড়া আদায় (Actual Rent Received)</td>
              <td className="py-2 px-6 text-right font-medium text-slate-800">{formatBDT(data.actualRentalIncome)}</td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">গ্যাস বিল আদায় (Gas Bill Collected)</td>
              <td className="py-2 px-6 text-right font-medium text-slate-800">{formatBDT(data.actualGasIncome)}</td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">পানি বিল আদায় (Water Bill Collected)</td>
              <td className="py-2 px-6 text-right font-medium text-slate-800">{formatBDT(data.actualWaterIncome)}</td>
            </tr>
            {data.actualOtherIncome !== 0 && (
              <tr>
                <td className="py-2 px-6 text-slate-600">সার্ভিস ও অন্যান্য আদায় (Other Receipts)</td>
                <td className="py-2 px-6 text-right font-medium text-slate-800">{formatBDT(data.actualOtherIncome)}</td>
              </tr>
            )}
            <tr className="bg-emerald-50/40 font-bold text-emerald-900">
              <td className="py-2.5 px-4">মোট পরিচালন আয় (Total Operating Income - Line A)</td>
              <td className="py-2.5 px-6 text-right text-emerald-700">{formatBDT(data.totalOperatingIncome)}</td>
            </tr>

            {/* Section 2: Expenses */}
            <tr className="bg-slate-50/60 font-semibold text-slate-700">
              <td className="py-2.5 px-4" colSpan={2}>
                ২. পরিচালন ব্যয় ও কর্তন (Operating Expenses Deductions)
              </td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">ভবন পরিচালন খরচ (Building Operating Expenses)</td>
              <td className="py-2 px-6 text-right font-medium text-amber-700">-{formatBDT(data.buildingOperatingExpenses)}</td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">পারিবারিক ও সামাজিক খরচ (Family & Social Expenses)</td>
              <td className="py-2 px-6 text-right font-medium text-amber-700">-{formatBDT(data.familySocialExpenses)}</td>
            </tr>
            <tr className="bg-amber-50/40 font-bold text-amber-900">
              <td className="py-2.5 px-4">মোট অনুমোদিত খরচ (Total Operating Expenses - Line B)</td>
              <td className="py-2.5 px-6 text-right text-amber-700">-{formatBDT(data.totalOperatingExpenses)}</td>
            </tr>

            {/* Net Operating Surplus */}
            <tr className="bg-blue-50/80 font-bold text-blue-900 border-t-2 border-blue-200">
              <td className="py-3 px-4 text-sm">নিট পরিচালন উদ্বৃত্ত / ঘাটতি (Net Operating Surplus - Line A - B)</td>
              <td className="py-3 px-6 text-right text-base text-blue-800">{formatBDT(data.netOperatingSurplus)}</td>
            </tr>

            {/* Section 3: Allocations & Reserve */}
            <tr className="bg-slate-50/60 font-semibold text-slate-700">
              <td className="py-2.5 px-4" colSpan={2}>
                ৩. পারিবারিক বণ্টন ও রিজার্ভ ফান্ড সমন্বয় (Family Distribution & Reserve)
              </td>
            </tr>
            {data.reserveInflow > 0 && (
              <tr>
                <td className="py-2 px-6 text-emerald-700">রিজার্ভ ফান্ড হতে ঘাটতি পূরণ (Reserve Inflow)</td>
                <td className="py-2 px-6 text-right font-medium text-emerald-700">+{formatBDT(data.reserveInflow)}</td>
              </tr>
            )}
            <tr>
              <td className="py-2 px-6 text-slate-600">পারিবারিক বণ্টন পরিশোধ (Family Distribution Disbursed)</td>
              <td className="py-2 px-6 text-right font-medium text-purple-700">-{formatBDT(data.totalFamilyDistributionDisbursed)}</td>
            </tr>
            {data.reserveOutflow > 0 && (
              <tr>
                <td className="py-2 px-6 text-slate-600">উদ্বৃত্ত অর্থ রিজার্ভ ফান্ডে জমা (Reserve Deposit)</td>
                <td className="py-2 px-6 text-right font-medium text-blue-700">-{formatBDT(data.reserveOutflow)}</td>
              </tr>
            )}
            <tr className="bg-slate-100 font-bold text-slate-800">
              <td className="py-2.5 px-4">মাস সমাপনী নগদ স্থিতি (Ending Operating Cash Balance)</td>
              <td className="py-2.5 px-6 text-right text-slate-800">{formatBDT(data.endingCashBalance)}</td>
            </tr>
          </tbody>
        </table>

        {/* Security deposit note */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-start gap-2">
          <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div>
            <span className="font-semibold text-slate-700">আর্থিক নীতিমালা নোটিশ:</span> ভাড়াটিয়াদের জামানত স্থিতি ({formatBDT(data.securityDepositsHeld)}) ব্যালেন্স শিটের দায় (Liability), যা কখনও মাসিক আয়ে অন্তর্ভুক্ত নয়। রিজার্ভ ফান্ডের উত্তোলন বা জমা ভাড়া আয়ের অংশ নয়।
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 2. YEARLY FINANCIAL SUMMARY VIEW
// =============================================================================
export const YearlySummaryView: React.FC<{ data: YearlyFinancialSummary }> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Yearly Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">বার্ষিক মোট আয় / Annual Income</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatBDT(data.totalOperatingIncome)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">গড় মাসিক: {formatBDT(data.averageMonthlyIncome)}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">বার্ষিক মোট খরচ / Annual Expenses</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatBDT(data.totalExpenses)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">গড় মাসিক: {formatBDT(data.averageMonthlyExpenses)}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">বার্ষিক নিট উদ্বৃত্ত / Net Surplus</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatBDT(data.totalNetOperatingSurplus)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">মোট পরিচালন উদ্বৃত্ত</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">বার্ষিক মোট বণ্টন / Family Payouts</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{formatBDT(data.totalDistributionDisbursed)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">পারিবারিক অংশীদারদের বিতরণ</p>
        </div>
      </div>

      {/* 12-Month Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">
            {data.year} সালের ১২ মাসের মাসিক আর্থিক সারসংক্ষেপ / 12-Month Annual Summary
          </h3>
          <span className="text-xs text-slate-500 font-medium">বছর: {data.year}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">মাস / Month</th>
                <th className="py-3 px-3 text-right">আদায় / Income</th>
                <th className="py-3 px-3 text-right">ভবন খরচ / Building</th>
                <th className="py-3 px-3 text-right">পারিবারিক খরচ / Family</th>
                <th className="py-3 px-3 text-right">মোট খরচ / Total Exp</th>
                <th className="py-3 px-3 text-right">নিট উদ্বৃত্ত / Surplus</th>
                <th className="py-3 px-3 text-right">বণ্টন / Disbursed</th>
                <th className="py-3 px-3 text-right">রিজার্ভ নিট / Reserve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.months.map((m) => (
                <tr key={m.month} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    {m.monthNameBn} <span className="text-slate-400">({m.monthNameEn})</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{formatBDT(m.operatingIncome)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{formatBDT(m.buildingExpenses)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{formatBDT(m.familyExpenses)}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-amber-700">{formatBDT(m.totalExpenses)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-blue-700">{formatBDT(m.netOperatingSurplus)}</td>
                  <td className="py-2.5 px-3 text-right text-purple-700 font-medium">{formatBDT(m.distributionDisbursed)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{formatBDT(m.reserveNetTransfer)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-3 px-3">সর্বমোট বার্ষিক যোগফল (Annual Total)</td>
                <td className="py-3 px-3 text-right text-emerald-800">{formatBDT(data.totalOperatingIncome)}</td>
                <td className="py-3 px-3 text-right text-slate-800">{formatBDT(data.totalBuildingExpenses)}</td>
                <td className="py-3 px-3 text-right text-slate-800">{formatBDT(data.totalFamilyExpenses)}</td>
                <td className="py-3 px-3 text-right text-amber-800">{formatBDT(data.totalExpenses)}</td>
                <td className="py-3 px-3 text-right text-blue-800">{formatBDT(data.totalNetOperatingSurplus)}</td>
                <td className="py-3 px-3 text-right text-purple-800">{formatBDT(data.totalDistributionDisbursed)}</td>
                <td className="py-3 px-3 text-right text-slate-800">{formatBDT(data.totalReserveNetTransfer)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 3. PROPERTY-WISE INCOME REPORT VIEW
// =============================================================================
export const PropertyIncomeView: React.FC<{ data: PropertyIncomeReport }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">মোট দাবি / Total Billed</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatBDT(data.totalBilled)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">মোট আদায়কৃত / Total Collected</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatBDT(data.totalCollected)}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">আদায় হার: {data.overallCollectionRate}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">অবশিষ্ট বকেয়া / Balance Due</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatBDT(data.totalDue)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">
            প্রপার্টি-ভিত্তিক আয় ও আদায় রিপোর্ট ({data.periodLabel}) / Property-wise Income
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">ভবন / Property</th>
                <th className="py-3 px-3 text-center">ইউনিট (দখল)</th>
                <th className="py-3 px-3 text-right">ভাড়া দাবি</th>
                <th className="py-3 px-3 text-right">ভাড়া আদায়</th>
                <th className="py-3 px-3 text-right">গ্যাস আদায়</th>
                <th className="py-3 px-3 text-right">পানি আদায়</th>
                <th className="py-3 px-3 text-right">মোট আদায়</th>
                <th className="py-3 px-3 text-right">বকেয়া</th>
                <th className="py-3 px-3 text-center">আদায় হার</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.properties.map((p) => (
                <tr key={p.propertyId} className="hover:bg-slate-50/60">
                  <td className="py-3 px-3 font-semibold text-slate-800">{p.propertyName}</td>
                  <td className="py-3 px-3 text-center text-slate-600">
                    {p.occupiedUnits} / {p.totalUnits}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700">{formatBDT(p.totalBilled)}</td>
                  <td className="py-3 px-3 text-right text-slate-700 font-medium">{formatBDT(p.rentCollected)}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{formatBDT(p.gasCollected)}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{formatBDT(p.waterCollected)}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">{formatBDT(p.totalCollected)}</td>
                  <td className="py-3 px-3 text-right font-semibold text-amber-700">{formatBDT(p.totalDue)}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.collectionRate >= 90
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.collectionRate >= 70
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.collectionRate}%
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-3 px-3" colSpan={2}>
                  মোট যোগফল (Total Aggregation)
                </td>
                <td className="py-3 px-3 text-right">{formatBDT(data.totalBilled)}</td>
                <td className="py-3 px-3 text-right" colSpan={3}></td>
                <td className="py-3 px-3 text-right text-emerald-800">{formatBDT(data.totalCollected)}</td>
                <td className="py-3 px-3 text-right text-amber-800">{formatBDT(data.totalDue)}</td>
                <td className="py-3 px-3 text-center">{data.overallCollectionRate}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 4. PROPERTY-WISE EXPENSE REPORT VIEW
// =============================================================================
export const PropertyExpenseView: React.FC<{ data: PropertyExpenseReport }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">
            প্রপার্টি-ভিত্তিক পরিচালন ব্যয় ({data.periodLabel}) / Property-wise Expense Breakdown
          </h3>
          <span className="text-xs font-semibold text-slate-700">
            মোট ভবন ব্যয়: {formatBDT(data.totalBuildingExpenses)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">ভবন / Property</th>
                <th className="py-3 px-2 text-right">বিদ্যুৎ</th>
                <th className="py-3 px-2 text-right">গ্যাস</th>
                <th className="py-3 px-2 text-right">পানি</th>
                <th className="py-3 px-2 text-right">কেয়ারটেকার</th>
                <th className="py-3 px-2 text-right">মেরামত</th>
                <th className="py-3 px-2 text-right">পরিচ্ছন্নতা</th>
                <th className="py-3 px-2 text-right">নিরাপত্তা</th>
                <th className="py-3 px-2 text-right">অন্যান্য</th>
                <th className="py-3 px-3 text-right">মোট খরচ</th>
                <th className="py-3 px-2 text-center">% অংশ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((r) => (
                <tr key={r.propertyId} className="hover:bg-slate-50/60">
                  <td className="py-3 px-3 font-semibold text-slate-800">{r.propertyName}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.electricity)}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.gas)}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.water)}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.caretaker)}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.maintenance)}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.cleaning)}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.security)}</td>
                  <td className="py-3 px-2 text-right text-slate-600">{formatBDT(r.otherBuilding)}</td>
                  <td className="py-3 px-3 text-right font-bold text-amber-700">{formatBDT(r.totalPropertyExpense)}</td>
                  <td className="py-3 px-2 text-center font-semibold text-slate-700">{r.percentageOfTotal}%</td>
                </tr>
              ))}
              <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-3 px-3">সর্বমোট ভবন পরিচালন ব্যয়</td>
                <td className="py-3 px-2 text-right" colSpan={8}></td>
                <td className="py-3 px-3 text-right text-amber-800">{formatBDT(data.totalBuildingExpenses)}</td>
                <td className="py-3 px-2 text-center">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 5. TENANT-WISE RENT LEDGER VIEW
// =============================================================================
export const TenantLedgerView: React.FC<{ data: TenantRentLedger | null }> = ({ data }) => {
  if (!data) {
    return (
      <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-500">
        লেজার দেখার জন্য দয়া করে একজন ভাড়াটিয়া নির্বাচন করুন (Select a tenant from the filter).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tenant Meta Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold mb-1 inline-block">
            ভাড়াটিয়া লেজার / Tenant Ledger
          </span>
          <h3 className="text-lg font-bold text-slate-800">{data.tenantName}</h3>
          <p className="text-xs text-slate-500">
            {data.propertyName} • ফ্ল্যাট: <span className="font-semibold text-slate-700">{data.unitNumber}</span> • ফোন: {data.tenantPhone}
          </p>
        </div>

        <div className="flex gap-4 text-right">
          <div className="border-l border-slate-200 pl-4">
            <p className="text-[11px] text-slate-500">মোট দাবি</p>
            <p className="text-base font-bold text-slate-800">{formatBDT(data.totalBilled)}</p>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <p className="text-[11px] text-slate-500">মোট পরিশোধ</p>
            <p className="text-base font-bold text-emerald-600">{formatBDT(data.totalPaid)}</p>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <p className="text-[11px] text-slate-500">বকেয়া স্থিতি</p>
            <p className="text-base font-bold text-amber-600">{formatBDT(data.totalOutstandingDue)}</p>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <p className="text-[11px] text-slate-500">জামানত (Liability)</p>
            <p className="text-base font-bold text-slate-600">{formatBDT(data.securityDepositHeld)}</p>
          </div>
        </div>
      </div>

      {/* Ledger Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200">
          <h4 className="font-bold text-slate-800 text-sm">কালানুক্রমিক লেনদেন ইতিহাস / Chronological Ledger</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">তারিখ / Date</th>
                <th className="py-3 px-3">বিবরণ / Description</th>
                <th className="py-3 px-3 text-center">ধরণ</th>
                <th className="py-3 px-3 text-right">দাবি (ভাড়া+ইউটিলিটি)</th>
                <th className="py-3 px-3 text-right">জমা / Paid</th>
                <th className="py-3 px-3 text-center">পেমেন্ট মেথড / রসিদ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    কোন লেনদেন পাওয়া যায়নি (No records found)
                  </td>
                </tr>
              ) : (
                data.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{e.date}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {e.description}
                      {e.notes && <span className="block text-[11px] text-slate-400 font-normal">{e.notes}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.type === 'bill' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {e.type === 'bill' ? 'বিল দাবি' : 'পরিশোধ'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-800 font-semibold">
                      {e.type === 'bill' ? formatBDT(e.totalBilled) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                      {e.type === 'payment' ? formatBDT(e.amountPaid) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500">
                      {e.paymentMethod ? (
                        <span className="font-mono text-[11px]">
                          {e.paymentMethod.toUpperCase()} {e.receiptNumber ? `• #${e.receiptNumber}` : ''}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 6. OUTSTANDING RENT REPORT VIEW
// =============================================================================
export const OutstandingRentView: React.FC<{ data: OutstandingRentReport }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-50/60 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-800">মোট বকেয়া ভাড়ার পরিমাণ / Total Overdue</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatBDT(data.totalOverdueAmount)}</p>
          <p className="text-[11px] text-red-600 mt-0.5">সব ভবনের সর্বমোট বকেয়া</p>
        </div>

        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-800">বকেয়া বিলের সংখ্যা / Overdue Bills</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{data.overdueBillsCount} টি বিল</p>
          <p className="text-[11px] text-amber-600 mt-0.5">অসম্পূর্ণ অথবা অপরিশোধিত</p>
        </div>

        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-800">বকেয়া ভাড়াটিয়ার সংখ্যা / Affected Tenants</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{data.affectedTenantsCount} জন</p>
          <p className="text-[11px] text-blue-600 mt-0.5">তাগাদাযোগ্য তালিকা</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">
            বকেয়া ভাড়ার পূর্ণাঙ্গ বিবরণী ({data.periodLabel}) / Outstanding Rent Statement
          </h3>
          <span className="text-xs text-red-600 font-semibold">সর্বোচ্চ বকেয়া ক্রমানুসারে</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">ভাড়াটিয়া / Tenant</th>
                <th className="py-3 px-3">ভবন ও ফ্ল্যাট</th>
                <th className="py-3 px-3">বিলিং মাস</th>
                <th className="py-3 px-3 text-right">মোট দাবি</th>
                <th className="py-3 px-3 text-right">পরিশোধিত</th>
                <th className="py-3 px-3 text-right">বকেয়া স্থিতি</th>
                <th className="py-3 px-3 text-center">বিল স্ট্যাটাস</th>
                <th className="py-3 px-3 text-center">বিলম্ব দিন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-emerald-600 font-medium">
                    ✓ কোনো বকেয়া বিল নেই! সকল ভাড়া পরিশোধিত।
                  </td>
                </tr>
              ) : (
                data.items.map((i) => (
                  <tr key={i.billId} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-800">{i.tenantName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{i.tenantPhone}</p>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {i.propertyName} • <span className="font-semibold">{i.unitNumber}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{i.billingMonth}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{formatBDT(i.totalDue)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{formatBDT(i.totalPaid)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-red-600">{formatBDT(i.balanceDue)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          i.status === 'unpaid' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {i.status === 'unpaid' ? 'অপরিশোধিত' : 'আংশিক পরিশোধ'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-mono text-slate-700 font-semibold">{i.daysOverdue} দিন</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 7. BUILDING OPERATING EXPENSE REPORT VIEW
// =============================================================================
export const BuildingExpenseView: React.FC<{ data: BuildingExpenseReport }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">মোট ভবন পরিচালন ব্যয়</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatBDT(data.totalBuildingExpenses)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{data.activeEntriesCount} টি সক্রিয় খরচ রেকর্ড</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">মাসিক বাজেট লক্ষ্যমাত্রা</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">{formatBDT(60000)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">বাজেট লক্ষ্যমাত্রা (নমনীয়)</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">বাতিলকৃত খরচের অডিট হিসেব</p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{formatBDT(data.reversedAmountExcluded)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {data.reversedEntriesCount} টি রেকর্ড অডিটে বাতিল (খরচে অন্তর্ভুক্ত নয়)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">
            ভবন পরিচালন খরচ খাতভিত্তিক রিপোর্ট ({data.periodLabel}) / Building Operating Expenses
          </h3>
        </div>

        <table className="w-full text-xs text-left divide-y divide-slate-100">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">খরচের খাত (Category)</th>
              <th className="py-3 px-4 text-center">লেনদেনের সংখ্যা</th>
              <th className="py-3 px-4 text-right">মোট খরচের পরিমাণ</th>
              <th className="py-3 px-4 text-center">% অংশ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.categories.map((c) => (
              <tr key={c.category} className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-semibold text-slate-800">
                  {c.categoryLabelBn} <span className="text-slate-400 font-normal">({c.categoryLabelEn})</span>
                </td>
                <td className="py-2.5 px-4 text-center font-mono text-slate-600">{c.entryCount} টি</td>
                <td className="py-2.5 px-4 text-right font-bold text-slate-800">{formatBDT(c.totalAmount)}</td>
                <td className="py-2.5 px-4 text-center font-semibold text-slate-600">{c.percentageOfTotal}%</td>
              </tr>
            ))}
            <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
              <td className="py-3 px-4">সর্বমোট ভবন পরিচালন খরচ</td>
              <td className="py-3 px-4 text-center font-mono">{data.activeEntriesCount} টি</td>
              <td className="py-3 px-4 text-right text-amber-800">{formatBDT(data.totalBuildingExpenses)}</td>
              <td className="py-3 px-4 text-center">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// 8. FAMILY & SOCIAL EXPENSE REPORT VIEW
// =============================================================================
export const FamilyExpenseView: React.FC<{ data: FamilyExpenseReport }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-purple-900">
            পারিবারিক ও সামাজিক খরচ মোট / Family & Social Expenses
          </p>
          <p className="text-2xl font-bold text-purple-800 mt-0.5">{formatBDT(data.totalFamilyExpenses)}</p>
          <p className="text-[11px] text-purple-700 mt-0.5">
            মোট {data.activeEntriesCount} টি সক্রিয় পারিবারিক ব্যয় রেকর্ড
          </p>
        </div>
        <div className="text-right text-xs text-purple-800 bg-white/70 px-3 py-2 rounded-lg border border-purple-200">
          ✓ পরিচালন উদ্বৃত্ত নির্ধারণে কর্তনযোগ্য
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">
            পারিবারিক খাতের খরচ বিবরণী ({data.periodLabel}) / Family Expense Categories
          </h3>
        </div>

        <table className="w-full text-xs text-left divide-y divide-slate-100">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">খাত (Family Category)</th>
              <th className="py-3 px-4 text-center">রেকর্ড সংখ্যা</th>
              <th className="py-3 px-4 text-right">মোট খরচের পরিমাণ</th>
              <th className="py-3 px-4 text-center">% অংশ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.categories.map((c) => (
              <tr key={c.category} className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-semibold text-slate-800">
                  {c.categoryLabelBn} <span className="text-slate-400 font-normal">({c.categoryLabelEn})</span>
                </td>
                <td className="py-2.5 px-4 text-center font-mono text-slate-600">{c.entryCount} টি</td>
                <td className="py-2.5 px-4 text-right font-bold text-purple-700">{formatBDT(c.totalAmount)}</td>
                <td className="py-2.5 px-4 text-center font-semibold text-slate-600">{c.percentageOfTotal}%</td>
              </tr>
            ))}
            <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
              <td className="py-3 px-4">সর্বমোট পারিবারিক খরচ</td>
              <td className="py-3 px-4 text-center font-mono">{data.activeEntriesCount} টি</td>
              <td className="py-3 px-4 text-right text-purple-900">{formatBDT(data.totalFamilyExpenses)}</td>
              <td className="py-3 px-4 text-center">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// 9. FAMILY DISTRIBUTION STATEMENT VIEW
// =============================================================================
export const DistributionStatementView: React.FC<{ data: FamilyDistributionStatement }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">অনুমোদিত মোট লক্ষ্যমাত্রা / Total Target</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatBDT(data.finalTargetTotal)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">মূল: {formatBDT(data.totalBaseTarget)} • সমন্বয়: {formatBDT(data.totalSpecialAdjustments)}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">প্রকৃত পরিশোধ সম্পন্ন / Total Disbursed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatBDT(data.actualTotalDisbursed)}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">{data.payoutRecords.length} টি পেমেন্ট সম্পন্ন</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">অবশিষ্ট বকেয়া / Remaining Due</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatBDT(data.remainingPendingTotal)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">
            পারিবারিক বণ্টন বিবরণী ({data.distributionMonth}) / Beneficiary Distribution Snapshot
          </h3>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">
            স্ট্যাটাস: {data.status}
          </span>
        </div>

        <table className="w-full text-xs text-left divide-y divide-slate-100">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-3">অংশীদার / Beneficiary</th>
              <th className="py-3 px-3">সম্পর্ক</th>
              <th className="py-3 px-3 text-right">মূল লক্ষ্য</th>
              <th className="py-3 px-3 text-right">সমন্বয়</th>
              <th className="py-3 px-3 text-right">চূড়ান্ত লক্ষ্য</th>
              <th className="py-3 px-3 text-right">পরিশোধিত</th>
              <th className="py-3 px-3 text-right">অবশিষ্ট</th>
              <th className="py-3 px-3 text-center">স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.beneficiaries.map((b) => (
              <tr key={b.beneficiaryId} className="hover:bg-slate-50/60">
                <td className="py-2.5 px-3 font-semibold text-slate-800">{b.name}</td>
                <td className="py-2.5 px-3 text-slate-600">{b.relationshipLabelBn}</td>
                <td className="py-2.5 px-3 text-right text-slate-600">{formatBDT(b.baseMonthlyTarget)}</td>
                <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                  {b.specialAdjustment !== 0 ? formatBDT(b.specialAdjustment) : '-'}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-800">{formatBDT(b.effectiveTarget)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatBDT(b.actualDisbursed)}</td>
                <td className="py-2.5 px-3 text-right font-semibold text-amber-700">{formatBDT(b.pendingAmount)}</td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.payoutStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.payoutStatus === 'partial'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {b.payoutStatus === 'paid' ? 'পরিশোধিত' : b.payoutStatus === 'partial' ? 'আংশিক' : 'বকেয়া'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// 10. RESERVE FUND STATEMENT VIEW
// =============================================================================
export const ReserveFundStatementView: React.FC<{ data: ReserveFundStatement }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm">
          <p className="text-xs text-slate-400">বর্তমান রিজার্ভ ফান্ড স্থিতি / Current Balance</p>
          <p className="text-3xl font-extrabold mt-1 text-emerald-400">{formatBDT(data.currentBalance)}</p>
          <p className="text-[11px] text-slate-400 mt-1">পারিবারিক সংরক্ষিত আপৎকালীন তহবিল</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">সর্বমোট জমা / Total Deposited</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatBDT(data.totalDeposited)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">উদ্বৃত্ত আয় হতে সংরক্ষিত তহবিলে জমা</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">সর্বমোট উত্তোলন / Total Withdrawn</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatBDT(data.totalWithdrawn)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">ঘাটতি পূরণ বা জরুরি প্রয়োজনে উত্তোলন</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">
            রিজার্ভ ফান্ড খতিয়ান লেজার / Reserve Fund Audit Ledger
          </h3>
          <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            isRentalIncome: false strictly enforced
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">তারিখ / Date</th>
                <th className="py-3 px-3">লেনদেনের ধরণ / Type</th>
                <th className="py-3 px-3">মাস</th>
                <th className="py-3 px-3 text-right">পরিমাণ</th>
                <th className="py-3 px-3 text-right">পূর্ববর্তী স্থিতি</th>
                <th className="py-3 px-3 text-right">পরবর্তী স্থিতি</th>
                <th className="py-3 px-3">কারণ ও অনুমোদন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.ledgerEntries.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-mono text-slate-600">{l.date}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        l.type.includes('deposit') || l.type.includes('opening')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {l.typeLabelBn}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{l.distributionMonth || '-'}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      l.type.includes('deposit') || l.type.includes('opening')
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {l.type.includes('withdrawal') ? `-${formatBDT(l.amount)}` : `+${formatBDT(l.amount)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500 font-mono">{formatBDT(l.balanceBefore)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-800 font-mono font-bold">{formatBDT(l.balanceAfter)}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 11. MONTHLY NET OPERATING BALANCE VIEW
// =============================================================================
export const NetOperatingStatementView: React.FC<{ data: NetOperatingBalanceReport }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            মাসিক নিট পরিচালন উদ্বৃত্ত ও নগদ প্রবাহ ({data.month}) / Operating Cash Flow
          </h3>
          <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 font-semibold rounded-full">
            ফর্মুলা ভিত্তিক অডিট
          </span>
        </div>

        <table className="w-full text-xs text-left divide-y divide-slate-100">
          <tbody>
            <tr className="bg-slate-50 font-semibold text-slate-700">
              <td className="py-2.5 px-4" colSpan={2}>
                (ক) পরিচালন নগদ প্রাপ্তি / Operating Inflows
              </td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">বাড়ি ভাড়া বাবদ নগদ প্রাপ্তি</td>
              <td className="py-2 px-6 text-right font-medium text-slate-800">{formatBDT(data.actualRentalIncome)}</td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">ইউটিলিটি (গ্যাস ও পানি) নগদ প্রাপ্তি</td>
              <td className="py-2 px-6 text-right font-medium text-slate-800">
                {formatBDT(data.actualGasIncome + data.actualWaterIncome)}
              </td>
            </tr>
            <tr className="font-bold bg-emerald-50 text-emerald-900">
              <td className="py-2.5 px-4">মোট পরিচালন আয় (Total Operating Receipts - A)</td>
              <td className="py-2.5 px-6 text-right text-emerald-700">{formatBDT(data.totalCollectedIncome)}</td>
            </tr>

            <tr className="bg-slate-50 font-semibold text-slate-700">
              <td className="py-2.5 px-4" colSpan={2}>
                (খ) পরিচালন ব্যয় ও পারিবারিক কর্তন / Operating Deductions
              </td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">ভবন পরিচালন খরচ (Building Operating Expenses)</td>
              <td className="py-2 px-6 text-right font-medium text-amber-700">-{formatBDT(data.buildingOperatingExpenses)}</td>
            </tr>
            <tr>
              <td className="py-2 px-6 text-slate-600">পারিবারিক ও সামাজিক খরচ (Family Expenses)</td>
              <td className="py-2 px-6 text-right font-medium text-amber-700">-{formatBDT(data.familySocialExpenses)}</td>
            </tr>
            <tr className="font-bold bg-amber-50 text-amber-900">
              <td className="py-2.5 px-4">মোট পরিচালন ব্যয় (Total Operating Deductions - B)</td>
              <td className="py-2.5 px-6 text-right text-amber-700">-{formatBDT(data.totalExpensesDeducted)}</td>
            </tr>

            <tr className="bg-blue-50/90 font-bold text-blue-900 border-t-2 border-blue-200">
              <td className="py-3 px-4 text-sm">নিট পরিচালন উদ্বৃত্ত / ঘাটতি (Net Operating Pool: C = A - B)</td>
              <td className="py-3 px-6 text-right text-base text-blue-800">{formatBDT(data.operatingSurplusOrDeficit)}</td>
            </tr>

            {data.reserveInflow > 0 && (
              <tr>
                <td className="py-2 px-6 text-emerald-700 font-medium">যোগ: রিজার্ভ ফান্ড হতে সহায়তা (Reserve Inflow - D)</td>
                <td className="py-2 px-6 text-right font-bold text-emerald-700">+{formatBDT(data.reserveInflow)}</td>
              </tr>
            )}
            <tr className="bg-slate-100 font-bold text-slate-800">
              <td className="py-2.5 px-4">মোট বণ্টনের জন্য উপলব্ধ নগদ তহবিল (Disbursable Pool: E = C + D)</td>
              <td className="py-2.5 px-6 text-right text-slate-800">{formatBDT(data.totalDisbursablePool)}</td>
            </tr>

            <tr>
              <td className="py-2 px-6 text-slate-600">বাদ: পারিবারিক বণ্টন পরিশোধ (Family Distribution - F)</td>
              <td className="py-2 px-6 text-right font-bold text-purple-700">-{formatBDT(data.actualDisbursedToFamily)}</td>
            </tr>
            {data.surplusTransferredToReserve > 0 && (
              <tr>
                <td className="py-2 px-6 text-slate-600">বাদ: উদ্বৃত্ত অর্থ রিজার্ভে জমা (Surplus to Reserve - G)</td>
                <td className="py-2 px-6 text-right font-bold text-blue-700">-{formatBDT(data.surplusTransferredToReserve)}</td>
              </tr>
            )}

            <tr className="bg-emerald-100 font-extrabold text-emerald-950 border-t-2 border-emerald-300">
              <td className="py-3 px-4 text-sm">অবণ্টনযোগ্য সমাপনী নগদ স্থিতি (Unallocated Closing Cash)</td>
              <td className="py-3 px-6 text-right text-base text-emerald-900">{formatBDT(data.unallocatedClosingCash)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// 12. BUDGET VS ACTUAL EXPENSE REPORT VIEW
// =============================================================================
export const BudgetVsActualView: React.FC<{ data: BudgetVsActualReport }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">বাজেট লক্ষ্যমাত্রা / Budget Target</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatBDT(data.budgetTarget)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">মাসিক ভবন পরিচালন বাজেট লক্ষ্য</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">প্রকৃত খরচ / Actual Incurred</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatBDT(data.actualBuildingExpense)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">সক্রিয় ভবন পরিচালন ব্যয়</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500">বাজেট ব্যবধান / Variance</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              data.status === 'under_budget' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatBDT(data.varianceAmount)}
          </p>
          <p className="text-[11px] font-semibold mt-0.5">
            {data.status === 'under_budget' ? (
              <span className="text-emerald-600">✓ বাজেটের মধ্যে ({data.variancePercentage}% সাশ্রয়)</span>
            ) : (
              <span className="text-red-600">⚠ বাজেট অতিক্রম ({Math.abs(data.variancePercentage)}% অতিরিক্ত)</span>
            )}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">
            খাতভিত্তিক প্রকৃত ব্যয় বিশ্লেষণ ({data.month}) / Category Utilization
          </h3>
        </div>

        <table className="w-full text-xs text-left divide-y divide-slate-100">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">খরচের খাত / Category</th>
              <th className="py-3 px-4 text-right">প্রকৃত খরচ (Actual)</th>
              <th className="py-3 px-4 text-center">মোট খরচের শতাংশ</th>
              <th className="py-3 px-4">খরচের প্রবাহ নির্দেশক</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.categoryBreakdown.map((c) => (
              <tr key={c.category} className="hover:bg-slate-50/60">
                <td className="py-2.5 px-4 font-semibold text-slate-800">
                  {c.categoryLabelBn} <span className="text-slate-400 font-normal">({c.categoryLabelEn})</span>
                </td>
                <td className="py-2.5 px-4 text-right font-bold text-slate-800">{formatBDT(c.actualAmount)}</td>
                <td className="py-2.5 px-4 text-center font-semibold text-slate-600">{c.percentageOfActual}%</td>
                <td className="py-2.5 px-4">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, c.percentageOfActual)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
