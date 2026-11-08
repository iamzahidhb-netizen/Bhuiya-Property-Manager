import React, { useState } from 'react';
import {
  Tag,
  Plus,
  Check,
  Archive,
  RefreshCw,
  AlertCircle,
  Zap,
  Droplet,
  Flame,
  Wrench,
  UserCheck,
  Shield,
  Sparkles,
  Receipt,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { type ExpenseCategoryConfig, DEFAULT_SETTINGS } from '../../types/settings';

export const ExpenseCategorySettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [categories, setCategories] = useState<ExpenseCategoryConfig[]>(
    () => [...settings.expenseCategories].sort((a, b) => a.order - b.order)
  );

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newBn, setNewBn] = useState('');
  const [newEn, setNewEn] = useState('');

  function toggleCategoryActive(id: string) {
    setCategories(
      categories.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newBn.trim() || !newEn.trim()) return;

    const newCatId = `custom_${Date.now()}`;
    const newEntry: ExpenseCategoryConfig = {
      id: newCatId,
      labelBn: newBn.trim(),
      labelEn: newEn.trim(),
      active: true,
      isCustom: true,
      order: categories.length + 1,
    };

    setCategories([...categories, newEntry]);
    setNewBn('');
    setNewEn('');
    setIsAddingNew(false);
  }

  function handleSave() {
    updateSettings({
      expenseCategories: categories,
    });
  }

  function handleReset() {
    setCategories([...DEFAULT_SETTINGS.expenseCategories]);
  }

  const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    electricity: <Zap className="w-4 h-4 text-amber-500" />,
    water: <Droplet className="w-4 h-4 text-blue-500" />,
    gas: <Flame className="w-4 h-4 text-orange-500" />,
    maintenance_repair: <Wrench className="w-4 h-4 text-slate-500" />,
    caretaker_salary: <UserCheck className="w-4 h-4 text-emerald-500" />,
    security: <Shield className="w-4 h-4 text-indigo-500" />,
    cleaning: <Sparkles className="w-4 h-4 text-teal-500" />,
    other_building: <Receipt className="w-4 h-4 text-rose-500" />,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'খরচ ক্যাটাগরি ব্যবস্থাপনা' : 'Expense Categories'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'ভবন খরচের খাতসমূহ সক্রিয়, নিষ্ক্রিয় ও নতুন খাত যোগ' : 'Manage building expense categories & tags'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* Safety Notice: Non-destructive Archive */}
      <div className="p-3.5 rounded-[20px] bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--hyper-text-secondary)]">
          <span className="font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'ঐতিহাসিক খতিয়ান নিরাপত্তা: ' : 'Historical Ledger Integrity: '}
          </span>
          {isBn
            ? 'কোনো ক্যাটাগরি নিষ্ক্রিয় করলেও পূর্বে নথিভুক্ত খরচের হিসাব অপরিবর্তিত থাকবে। কোনো ডেটা মুছে ফেলা হয় না।'
            : 'Deactivating a category archives it safely without affecting past expenses or reports. No data is lost.'}
        </div>
      </div>

      {/* Categories List */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-red-bg)] flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-[#E94B4B]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'খরচের খাত তালিকা' : 'Expense Category Directory'}
              </h4>
              <p className="text-xs text-[var(--hyper-text-secondary)]">
                {isBn ? 'সক্রিয় খাতসমূহ নতুন খরচের ফর্মে দৃশ্যমান হবে' : 'Active categories appear in new expense form'}
              </p>
            </div>
          </div>

          <PillButton
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBn ? 'নতুন খাত' : 'Add Category'}</span>
          </PillButton>
        </div>

        {/* Add New Category Form */}
        {isAddingNew && (
          <form
            onSubmit={handleAddCategory}
            className="p-4 rounded-[22px] bg-black/5 dark:bg-white/5 border border-[var(--hyper-border-subtle)] space-y-3"
          >
            <h5 className="text-xs font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'নতুন খরচের খাত যোগ করুন' : 'Create New Expense Category'}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
                  {isBn ? 'বাংলা নাম' : 'Bangla Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ইন্টারকম সার্ভিস"
                  value={newBn}
                  onChange={(e) => setNewBn(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-[14px] border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)] text-xs text-[var(--hyper-text-primary)] outline-none focus:border-[#22B84A]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
                  {isBn ? 'ইংরেজি নাম' : 'English Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Intercom Service"
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-[14px] border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)] text-xs text-[var(--hyper-text-primary)] outline-none focus:border-[#22B84A]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <PillButton variant="ghost" size="sm" onClick={() => setIsAddingNew(false)}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </PillButton>
              <PillButton variant="primary" size="sm" type="submit">
                {isBn ? 'খাত সংরক্ষণ' : 'Add'}
              </PillButton>
            </div>
          </form>
        )}

        {/* List of categories */}
        <div className="space-y-2">
          {categories.map((cat) => {
            return (
              <div
                key={cat.id}
                className={`p-3 rounded-[18px] border transition-all flex items-center justify-between gap-3 ${
                  cat.active
                    ? 'bg-black/5 dark:bg-white/5 border-[var(--hyper-border-subtle)]'
                    : 'bg-black/2 dark:bg-white/2 border-transparent opacity-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[12px] bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                    {CATEGORY_ICONS[cat.id] || <Tag className="w-4 h-4 text-[var(--hyper-text-secondary)]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--hyper-text-primary)] truncate">
                        {isBn ? cat.labelBn : cat.labelEn}
                      </span>
                      {cat.isCustom && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {isBn ? 'কাস্টম' : 'Custom'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--hyper-text-secondary)]">
                      {isBn ? cat.labelEn : cat.labelBn}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleCategoryActive(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      cat.active
                        ? 'bg-[#22B84A]/10 text-[#22B84A] hover:bg-[#22B84A]/20'
                        : 'bg-black/10 dark:bg-white/10 text-[var(--hyper-text-secondary)] hover:bg-black/20'
                    }`}
                  >
                    {cat.active ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{isBn ? 'সক্রিয়' : 'Active'}</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5" />
                        <span>{isBn ? 'আর্কাইভ' : 'Archived'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </HyperCard>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <PillButton variant="secondary" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isBn ? 'ডিফল্ট খাত' : 'Reset Defaults'}</span>
        </PillButton>
        <PillButton variant="primary" size="md" onClick={handleSave}>
          {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};
