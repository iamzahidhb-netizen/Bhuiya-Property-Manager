import React, { useState } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle,
  FileJson,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { BackIconButton } from '../ui/hyperos/BackIconButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { exportToCSV } from '../../utils/exportUtils';
import type { AppSettings } from '../../types/settings';

export const DataBackupSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings, resetToDefaults } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [importStatus, setImportStatus] = useState<string | null>(null);

  const exportCards = [
    {
      id: 'rent',
      titleBn: 'ভাড়া আদায় খতিয়ান',
      titleEn: 'Rent Ledger CSV',
      descriptionBn: 'নভেম্বর ২০২৬ পর্যন্ত',
      descriptionEn: 'Current active records',
      onExport: handleExportRent,
    },
    {
      id: 'expenses',
      titleBn: 'ভবন খরচ খতিয়ান',
      titleEn: 'Expense Ledger CSV',
      descriptionBn: 'সকল ভাউচার বিবরণ',
      descriptionEn: 'All expense vouchers',
      onExport: handleExportExpenses,
    },
    {
      id: 'tenants',
      titleBn: 'ভাড়াটিয়া রেজিস্টার',
      titleEn: 'Tenants Directory CSV',
      descriptionBn: 'সকল ভাড়াটিয়ার তথ্য',
      descriptionEn: 'Active tenants registry',
      onExport: handleExportTenants,
    },
  ].filter((card, index, cards) => cards.findIndex((item) => item.id === card.id) === index);

  // 1. Export Rent Ledger
  function handleExportRent() {
    const filename = `anwar-bhuiyan-rent-ledger-${new Date().toISOString().slice(0, 10)}`;
    const headers = ['তারিখ / Date', 'ফ্ল্যাট / Unit', 'ভাড়াটিয়া / Tenant', 'পরিমাণ / Amount (BDT)', 'স্ট্যাটাস / Status'];
    const rows = [
      ['2026-11-01', 'Flat A-1', 'জনাব রফিকুল ইসলাম', 25000, 'পরিশোধিত (Paid)'],
      ['2026-11-02', 'Flat A-2', 'জনাব কামরুল হাসান', 28000, 'পরিশোধিত (Paid)'],
      ['2026-11-05', 'Flat B-1', 'ইঞ্জিঃ তানভীর আহমেদ', 26000, 'পরিশোধিত (Paid)'],
      ['2026-11-07', 'Flat B-2', 'ডাঃ মাহফুজুর রহমান', 30000, 'পরিশোধিত (Paid)'],
    ];
    exportToCSV(filename, headers, rows);
  }

  // 2. Export Expenses Ledger
  function handleExportExpenses() {
    const filename = `anwar-bhuiyan-expense-ledger-${new Date().toISOString().slice(0, 10)}`;
    const headers = ['তারিখ / Date', 'খাত / Category', 'বিবরণ / Description', 'পরিমাণ / Amount (BDT)', 'পেমেন্ট মেথড / Method'];
    const rows = [
      ['2026-11-03', 'বিদ্যুৎ বিল', 'ভবন সাধারণ বিদ্যুৎ মিটার', 8500, 'ব্যাংক ট্রান্সফার'],
      ['2026-11-04', 'পানি বিল', 'ওয়াসা নভেম্বর বিল', 3200, 'অনলাইন পেমেন্ট'],
      ['2026-11-05', 'কেয়ারটেকার বেতন', 'মাসিক বেতন - কাশেম ভাই', 12000, 'নগদ ক্যাশ'],
      ['2026-11-06', 'পরিচ্ছন্নতা', 'সিঁড়ি ও ছাদ পরিষ্কার উপকরণ', 1500, 'নগদ ক্যাশ'],
    ];
    exportToCSV(filename, headers, rows);
  }

  // 3. Export Tenants Register
  function handleExportTenants() {
    const filename = `anwar-bhuiyan-tenants-${new Date().toISOString().slice(0, 10)}`;
    const headers = ['ফ্ল্যাট / Unit', 'ভাড়াটিয়ার নাম / Name', 'মোবাইল / Phone', 'মাসিক ভাড়া / Rent', 'যোগদানের তারিখ / Joined'];
    const rows = [
      ['Flat A-1', 'জনাব রফিকুল ইসলাম', '01711-XXXXXX', 25000, '2024-01-01'],
      ['Flat A-2', 'জনাব কামরুল হাসান', '01819-XXXXXX', 28000, '2024-03-15'],
      ['Flat B-1', 'ইঞ্জিঃ তানভীর আহমেদ', '01912-XXXXXX', 26000, '2024-06-01'],
      ['Flat B-2', 'ডাঃ মাহফুজুর রহমান', '01610-XXXXXX', 30000, '2024-08-01'],
    ];
    exportToCSV(filename, headers, rows);
  }

  // 4. Export JSON App Preferences
  function handleExportJsonConfig() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `anwar-bhuiyan-settings-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // 5. Import JSON App Preferences
  function handleImportJsonConfig(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as Partial<AppSettings>;
        updateSettings(parsed);
        setImportStatus(isBn ? 'সেটিংস সফলভাবে পুনরুদ্ধার হয়েছে!' : 'Settings restored successfully!');
        setTimeout(() => setImportStatus(null), 3500);
      } catch {
        setImportStatus(isBn ? 'ত্রুটি: ফাইলের ফরম্যাট সঠিক নয়।' : 'Error: Invalid JSON configuration file.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'ডেটা ব্যাকআপ ও এক্সপোর্ট' : 'Data & Backup Center'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'এক্সেল সিএসভি খতিয়ান ও কনফিগারেশন ব্যাকআপ' : 'Export Excel CSV ledgers & preferences backup'}
          </p>
        </div>
        <BackIconButton onClick={onBack} aria-label={isBn ? 'ফিরে যান' : 'Back'} />
      </div>

      {importStatus && (
        <div className="p-3.5 rounded-[20px] bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs font-bold text-[#22B84A]">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* CSV Exports */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-green-bg)] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-[#22B84A]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'সিএসভি খতিয়ান ডাউনলোড (Excel CSV)' : 'Export Ledgers (Excel CSV)'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'মাইক্রোসফট এক্সেলের জন্য বাংলা UTF-8 BOM সমর্থিত' : 'UTF-8 BOM encoded for seamless Microsoft Excel rendering'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {exportCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={card.onExport}
              className="p-3.5 rounded-[20px] border border-[var(--hyper-border-subtle)] bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-all flex flex-col items-center gap-2 text-center cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-[var(--hyper-green-bg)] flex items-center justify-center text-[var(--hyper-green)] group-hover:scale-110 transition-transform">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? card.titleBn : card.titleEn}
                </div>
                <div className="text-xs text-[var(--hyper-text-secondary)] mt-0.5">
                  {isBn ? card.descriptionBn : card.descriptionEn}
                </div>
              </div>
            </button>
          ))}
        </div>
      </HyperCard>

      {/* JSON Preference Backup & Restore */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-blue-bg)] flex items-center justify-center shrink-0">
            <FileJson className="w-5 h-5 text-[#1685E8]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'অ্যাপ কনফিগারেশন ব্যাকআপ' : 'Settings Configuration File'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'আপনার সমস্ত ইন্টারফেস ও ড্যাশবোর্ড সেটিংস ফাইল হিসেবে সেভ রাখুন' : 'Export and import application preferences as JSON'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Download JSON */}
          <button
            type="button"
            onClick={handleExportJsonConfig}
            className="p-3.5 rounded-[20px] border border-[var(--hyper-border-subtle)] bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-[#1685E8]" />
              <div className="text-left">
                <div className="text-xs font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'কনফিগারেশন ব্যাকআপ ডাউনলোড' : 'Download Settings Backup'}
                </div>
                <div className="text-[10px] text-[var(--hyper-text-secondary)]">
                  JSON config format
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#1685E8]">↓</span>
          </button>

          {/* Upload JSON */}
          <label className="p-3.5 rounded-[20px] border border-[var(--hyper-border-subtle)] bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-all flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Upload className="w-4 h-4 text-[#22B84A]" />
              <div className="text-left">
                <div className="text-xs font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'ব্যাকআপ ফাইল রিস্টোর করুন' : 'Restore From Backup'}
                </div>
                <div className="text-[10px] text-[var(--hyper-text-secondary)]">
                  Choose JSON file
                </div>
              </div>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJsonConfig}
              className="hidden"
            />
            <span className="text-xs font-bold text-[#22B84A]">↑</span>
          </label>
        </div>
      </HyperCard>

      {/* Global Factory Reset */}
      <div className="p-4 rounded-[22px] bg-red-500/5 border border-red-500/20 flex items-center justify-between gap-3">
        <div>
          <h5 className="text-xs font-bold text-red-600">
            {isBn ? 'সকল সেটিংস ডিফল্টে রিসেট' : 'Reset All Settings to Factory Baseline'}
          </h5>
          <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
            {isBn ? 'কাস্টম বিন্যাস ও পছন্দসমূহ মুছে প্রাথমিক অবস্থায় ফেরত যাবে।' : 'Resets theme, card orders, categories to defaults.'}
          </p>
        </div>
        <PillButton
          variant="secondary"
          size="sm"
          onClick={() => {
            if (window.confirm(isBn ? 'আপনি কি নিশ্চিত যে সকল সেটিংস ডিফল্টে রিসেট করবেন?' : 'Are you sure you want to reset all settings to defaults?')) {
              resetToDefaults();
            }
          }}
          className="border-red-500/30 text-red-600 hover:bg-red-500/10 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          <span>{isBn ? 'রিসেট করুন' : 'Reset All'}</span>
        </PillButton>
      </div>
    </div>
  );
};
