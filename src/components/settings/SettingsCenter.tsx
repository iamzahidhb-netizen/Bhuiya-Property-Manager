import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SettingsHome, type SettingsCategoryId } from './SettingsHome';
import { ProfileAccountSettings } from './ProfileAccountSettings';
import { LanguageRegionSettings } from './LanguageRegionSettings';
import { DashboardCustomizationSettings } from './DashboardCustomizationSettings';
import { AppearanceThemeSettings } from './AppearanceThemeSettings';
import { BillingRentSettings } from './BillingRentSettings';
import { ExpenseCategorySettings } from './ExpenseCategorySettings';
import { NavigationManagerSettings } from './NavigationManagerSettings';
import { ModuleManagerSettings } from './ModuleManagerSettings';
import { NotificationSettings } from './NotificationSettings';
import { UserPermissionSettings } from './UserPermissionSettings';
import { SecurityPrivacySettings } from './SecurityPrivacySettings';
import { DataBackupSettings } from './DataBackupSettings';
import { AboutSupportSettings } from './AboutSupportSettings';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface SettingsCenterProps {
  initialCategory?: SettingsCategoryId | null;
  onOpenMemberManagement?: () => void;
  className?: string;
}

export const SettingsCenter: React.FC<SettingsCenterProps> = ({
  initialCategory = null,
  onOpenMemberManagement,
  className = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(initialCategory);
  const { isSavedNoticeVisible } = useSettings();
  const { currentLanguage } = useLanguage();
  const { isMasterAdmin } = useWorkspace();

  React.useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __setSettingsCategory?: (id: SettingsCategoryId | null) => void }).__setSettingsCategory = (id) => {
        setActiveCategory(id);
      };
    }
  }, []);

  const isBn = currentLanguage === 'bn';

  return (
    <div
      className={`relative max-w-2xl mx-auto space-y-4 ${className}`}
      data-testid="hyperos-settings-center"
    >
      {/* Saved Toast Notice */}
      {isSavedNoticeVisible && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#22B84A] text-white text-xs font-bold shadow-lg shadow-[#22B84A]/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{isBn ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে' : 'Settings saved successfully!'}</span>
        </div>
      )}

      {/* Main Settings Routing */}
      {activeCategory === null && (
        <SettingsHome
          onSelectCategory={(id) => setActiveCategory(id)}
          isMasterAdmin={Boolean(isMasterAdmin)}
        />
      )}

      {activeCategory === 'profile' && (
        <ProfileAccountSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'language' && (
        <LanguageRegionSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'dashboard' && (
        <DashboardCustomizationSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'appearance' && (
        <AppearanceThemeSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'billing' && (
        <BillingRentSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'expenses' && (
        <ExpenseCategorySettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'navigation' && (
        <NavigationManagerSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'modules' && (
        <ModuleManagerSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'notifications' && (
        <NotificationSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'users' && (
        <UserPermissionSettings
          onBack={() => setActiveCategory(null)}
          onOpenMemberManagement={onOpenMemberManagement}
        />
      )}

      {activeCategory === 'security' && (
        <SecurityPrivacySettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'backup' && (
        <DataBackupSettings onBack={() => setActiveCategory(null)} />
      )}

      {activeCategory === 'about' && (
        <AboutSupportSettings onBack={() => setActiveCategory(null)} />
      )}
    </div>
  );
};
