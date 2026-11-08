import { useState } from 'react';
import type { Property } from '../../types/property';
import {
  type AppPreferences,
  DEFAULT_PREFERENCES,
  EXPENSE_CATEGORIES,
} from '../../types/appPreferences';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Settings,
  X,
  CreditCard,
  ReceiptText,
  UserPlus,
  BarChart3,
  CheckCircle2,
  Check,
  Building2,
} from 'lucide-react';

interface SimpleAppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  preferences: AppPreferences;
  onUpdatePreferences: (newPrefs: AppPreferences) => void;
  onOpenPropertyModal: () => void;
  onOpenUnitModal: () => void;
}

export default function SimpleAppSettingsModal({
  isOpen,
  onClose,
  properties,
  preferences,
  onUpdatePreferences,
  onOpenPropertyModal,
  onOpenUnitModal,
}: SimpleAppSettingsModalProps) {
  const { currentLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'cards' | 'quick' | 'categories' | 'properties' | 'family'>('cards');
  const [prefs, setPrefs] = useState<AppPreferences>(preferences);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  function handleSave() {
    onUpdatePreferences(prefs);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1200);
  }

  function handleRestoreDefaults() {
    setPrefs(DEFAULT_PREFERENCES);
    onUpdatePreferences(DEFAULT_PREFERENCES);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-emerald-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-emerald-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
              <Settings className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                {currentLanguage === 'bn' ? 'অ্যাপ সেটিংস ও কাস্টমাইজেশন' : 'App Settings & Customization'}
              </h2>
              <p className="text-xs text-slate-500">
                {currentLanguage === 'bn' ? 'মাস্টার এডমিন নিয়ন্ত্রণ প্যানেল' : 'Master Admin Control Panel'}
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

        {/* Sub-tabs - Fixed */}
        <div className="shrink-0 flex border-b border-slate-100 overflow-x-auto px-4 sm:px-6 py-2 gap-1 text-xs font-semibold bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 'cards'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentLanguage === 'bn' ? 'হোম কার্ডসমূহ' : 'Home Cards'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quick')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 'quick'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentLanguage === 'bn' ? 'কুইক বাটন' : 'Quick Actions'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 'properties'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentLanguage === 'bn' ? 'বিল্ডিং ও ফ্ল্যাট' : 'Buildings & Units'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentLanguage === 'bn' ? 'খরচের ক্যাটাগরি' : 'Expense Categories'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('family')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              activeTab === 'family'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentLanguage === 'bn' ? 'পারিবারিক বণ্টন' : 'Family Payouts'}
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1 overscroll-contain">
          {savedNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-sm font-semibold text-emerald-800 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{currentLanguage === 'bn' ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে!' : 'Settings saved successfully!'}</span>
            </div>
          )}

          {/* Cards Tab */}
          {activeTab === 'cards' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {currentLanguage === 'bn' ? 'হোম স্ক্রিনের ৪টি আর্থিক কার্ড প্রদর্শন অথবা লুকান:' : 'Show or hide the 4 financial cards on the home screen:'}
              </p>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <span className="text-sm font-medium text-slate-800">
                  {currentLanguage === 'bn' ? '১. মোট ভাড়া আদায় কার্ড' : '1. Total Rent Collected Card'}
                </span>
                <input
                  type="checkbox"
                  checked={prefs.showTotalCollected}
                  onChange={(e) => setPrefs({ ...prefs, showTotalCollected: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <span className="text-sm font-medium text-slate-800">
                  {currentLanguage === 'bn' ? '২. মোট ভাড়া বাকি কার্ড' : '2. Outstanding Rent Card'}
                </span>
                <input
                  type="checkbox"
                  checked={prefs.showTotalDue}
                  onChange={(e) => setPrefs({ ...prefs, showTotalDue: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <span className="text-sm font-medium text-slate-800">
                  {currentLanguage === 'bn' ? '৩. মোট খরচ কার্ড' : '3. Total Expenses Card'}
                </span>
                <input
                  type="checkbox"
                  checked={prefs.showTotalExpenses}
                  onChange={(e) => setPrefs({ ...prefs, showTotalExpenses: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <span className="text-sm font-medium text-slate-800">
                  {currentLanguage === 'bn' ? '৪. হাতে আছে (উদ্বৃত্ত) কার্ড' : '4. Available Balance Card'}
                </span>
                <input
                  type="checkbox"
                  checked={prefs.showCashInHand}
                  onChange={(e) => setPrefs({ ...prefs, showCashInHand: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
            </div>
          )}

          {/* Quick Actions Tab */}
          {activeTab === 'quick' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {currentLanguage === 'bn' ? 'হোম পেজের ৪টি দ্রুত অ্যাকশন বাটন নিয়ন্ত্রণ করুন:' : 'Control the 4 quick action buttons on the home page:'}
              </p>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-slate-800">
                    {currentLanguage === 'bn' ? '১. ভাড়া জমা বাটন' : '1. Collect Rent Button'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.showQuickCollectRent}
                  onChange={(e) => setPrefs({ ...prefs, showQuickCollectRent: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <ReceiptText className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-slate-800">
                    {currentLanguage === 'bn' ? '২. নতুন খরচ বাটন' : '2. New Expense Button'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.showQuickNewExpense}
                  onChange={(e) => setPrefs({ ...prefs, showQuickNewExpense: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-800">
                    {currentLanguage === 'bn' ? '৩. ভাড়াটিয়া যোগ বাটন' : '3. Add Tenant Button'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.showQuickAddTenant}
                  onChange={(e) => setPrefs({ ...prefs, showQuickAddTenant: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-medium text-slate-800">
                    {currentLanguage === 'bn' ? '৪. সকল হিসাব বাটন' : '4. All Reports Button'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.showQuickAllAccounts}
                  onChange={(e) => setPrefs({ ...prefs, showQuickAllAccounts: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600 rounded"
                />
              </label>
            </div>
          )}

          {/* Properties & Units Tab */}
          {activeTab === 'properties' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {currentLanguage === 'bn' ? 'নতুন প্রপার্টি / বিল্ডিং যোগ' : 'Add New Property / Building'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {currentLanguage === 'bn' ? 'পারিবারিক নতুন ভবন বা জমি নথিভুক্ত করুন' : 'Register new family property'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPropertyModal();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer"
                >
                  {currentLanguage === 'bn' ? '+ প্রপার্টি যোগ' : '+ Add Property'}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {currentLanguage === 'bn' ? 'নতুন ইউনিট / ফ্ল্যাট যোগ' : 'Add New Unit / Flat'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {currentLanguage === 'bn' ? 'ভবনের অধীনে নতুন ফ্ল্যাট বা দোকান বরাদ্দ করুন' : 'Assign new flat or shop to building'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUnitModal();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer"
                >
                  {currentLanguage === 'bn' ? '+ ইউনিট যোগ' : '+ Add Unit'}
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  {currentLanguage === 'bn' ? 'বিদ্যমান প্রপার্টি তালিকা:' : 'Existing Properties:'}
                </span>
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex justify-between items-center text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-600" />
                      <span className="font-semibold text-slate-800">{p.name} ({p.nameEn})</span>
                    </div>
                    <span className="text-slate-500">{p.totalFloors} তলা</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expense Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {currentLanguage === 'bn' ? 'অনুমোদিত সাধারণ পরিচালন ব্যয়ের ক্যাটাগরিসমূহ:' : 'Approved operational expense categories:'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {EXPENSE_CATEGORIES.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>{c.label}</span>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Family Beneficiaries Tab */}
          {activeTab === 'family' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {currentLanguage === 'bn' ? 'পরিবারের সদস্য ও মাসিক বণ্টন লক্ষ্যমাত্রা (Target History):' : 'Family members and monthly distribution targets:'}
              </p>
              <div className="space-y-2 text-xs">
                {['Brother 1', 'Brother 2', 'Brother 3'].map((bName) => (
                  <div key={bName} className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{bName}</div>
                      <div className="text-slate-500">{currentLanguage === 'bn' ? 'পরিবারের অংশীদার সদস্য' : 'Family Shareholder Member'}</div>
                    </div>
                    <div className="font-bold text-emerald-800 text-sm">৳৪৫,০০০ / মাস</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="shrink-0 p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80 flex justify-between items-center">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            {currentLanguage === 'bn' ? 'ডিফল্ট পুনরুদ্ধার' : 'Restore Defaults'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
