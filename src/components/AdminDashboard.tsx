import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useLanguage } from '../contexts/LanguageContext';
import { subscribeProperties, subscribeUnits } from '../services/propertyService';
import { subscribeTenants } from '../services/tenantService';
import { subscribeRentBills, subscribeRentPayments } from '../services/rentService';
import { subscribeExpenses } from '../services/expenseService';
import type { Property, Unit } from '../types/property';
import type { Tenant } from '../types/tenant';
import type { RentBill, RentPayment, Expense } from '../types/finance';
import { formatLocalizedCurrency, formatLocalizedMonth } from '../utils/banglaFormat';
import { getDhakaDateInfo, getUserDisplayName } from '../utils/dhakaDate';
import { processProfileImage } from '../utils/imageUtils';

// Full-Page Financial Workflows & Modals
import RentDepositPage from './finance/RentDepositPage';
import AddExpensePage from './finance/AddExpensePage';
import SimpleTenantDetailsModal from './khata/SimpleTenantDetailsModal';
import { useSettings } from '../contexts/SettingsContext';
import { useAppNavigation } from '../contexts/NavigationContext';
import { SettingsCenter } from './settings/SettingsCenter';
import { DEFAULT_ANIMATION_SETTINGS } from '../types/settings';
import { ProfilePhotoModal } from './profile/ProfilePhotoModal';

// Lucide Icons
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  House,
  BookOpen,
  UserRound,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  TrendingDown,
  Coins,
  CreditCard,
  ReceiptText,
  BarChart3,
  Users,
  Scale,
  Hourglass,
  SlidersHorizontal,
  KeyRound,
  LogOut,
  DoorClosed,
  UserPlus,
  Camera,
  Check,
  Plus,
} from 'lucide-react';

// Modals for Property, Unit, Tenant creation
import PropertyModal from './properties/PropertyModal';
import UnitModal from './properties/UnitModal';
import TenantModal from './tenants/TenantModal';
import { MemberManagementModal } from './members/MemberManagementModal';
import { StatusBadge } from './ui/hyperos/StatusBadge';
import { HyperCard, StatTile, FloatingPillNav, PageTransitionContainer } from './ui/hyperos';
import { SyncStatusBar } from './ui/SyncStatusBar';
import { StorageLibraryPage } from './storage/StorageLibraryPage';

// Existing Sub-Views (Lazy Loaded for drill-downs & full view access)
const PropertyManagementView = lazy(() => import('./properties/PropertyManagementView'));
const TenantManagementView = lazy(() => import('./tenants/TenantManagementView'));
const RentManagementView = lazy(() => import('./rent/RentManagementView'));
const ExpenseManagementView = lazy(() => import('./expenses/ExpenseManagementView'));
const DistributionManagementView = lazy(() => import('./distribution/DistributionManagementView'));
const ReportsAnalyticsView = lazy(() =>
  import('./reports/ReportsAnalyticsView').then((m) => ({ default: m.ReportsAnalyticsView }))
);

function TabLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs text-slate-500 font-medium">লোড হচ্ছে / Loading...</p>
    </div>
  );
}

export type ActiveDashboardSection =
  | 'home'
  | 'accounts'
  | 'profile'
  | 'settings'
  | 'rent-deposit'
  | 'add-expense';

export default function AdminDashboard() {
  const { user, logout, photoURL, updatePhotoURL } = useAuth();
  const { workspaceId, role, isMasterAdmin, canAccessTab } = useWorkspace();
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const [loggingOut, setLoggingOut] = useState(false);

  // Profile Photo Management
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoToast, setPhotoToast] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processProfileImage(file, 320, 0.88);
      setPreviewPhoto(dataUrl);
      setIsPhotoModalOpen(true);
    } catch (err) {
      console.error('Failed to process image:', err);
      alert(currentLanguage === 'bn' ? 'ছবি প্রক্রিয়া করতে সমস্যা হয়েছে।' : 'Failed to process image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSavePhoto = async (photoDataUrl: string) => {
    await updatePhotoURL(photoDataUrl);
    setPhotoToast(currentLanguage === 'bn' ? 'প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে!' : 'Profile photo updated successfully!');
    setTimeout(() => setPhotoToast(null), 3000);
  };

  const handleRemovePhoto = async () => {
    await updatePhotoURL(null);
    setPhotoToast(currentLanguage === 'bn' ? 'প্রোফাইল ছবি সরানো হয়েছে!' : 'Profile photo removed!');
    setTimeout(() => setPhotoToast(null), 3000);
  };

  // Central App Navigation (handles browser back, Android system back, pushState & popstate)
  const {
    activeSection,
    drillDownView,
    preSelectedTenantId,
    navigateTo,
    setDrillDownView,
    goBack,
    registerBackGuard,
    direction,
  } = useAppNavigation();

  const animSettings = settings?.appearance?.navigationAnimation || DEFAULT_ANIMATION_SETTINGS;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
      setLoggingOut(false);
    }
  }

  // Month state (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Centralized App Settings
  const useBanglaNumerals = settings.languageRegion.useBanglaNumerals;
  const isBn = currentLanguage === 'bn';

  // Modals state
  const [paymentPreselectedTenantId, setPaymentPreselectedTenantId] = useState<string | null>(null);
  const [tenantDetailsModalOpen, setTenantDetailsModalOpen] = useState(false);
  const [selectedTenantForDetails, setSelectedTenantForDetails] = useState<Tenant | null>(null);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [memberManagementModalOpen, setMemberManagementModalOpen] = useState(false);

  // Close modals on browser/system back button
  useEffect(() => {
    const isAnyModalOpen =
      tenantDetailsModalOpen ||
      propertyModalOpen ||
      unitModalOpen ||
      tenantModalOpen ||
      memberManagementModalOpen;

    if (!isAnyModalOpen) return;

    return registerBackGuard({
      id: 'admin-dashboard-modals',
      isDirty: () => isAnyModalOpen,
      onBlocked: () => {
        setTenantDetailsModalOpen(false);
        setPropertyModalOpen(false);
        setUnitModalOpen(false);
        setTenantModalOpen(false);
        setMemberManagementModalOpen(false);
      },
    });
  }, [
    tenantDetailsModalOpen,
    propertyModalOpen,
    unitModalOpen,
    tenantModalOpen,
    memberManagementModalOpen,
    registerBackGuard,
  ]);

  // Real-time data state
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bills, setBills] = useState<RentBill[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubProps = subscribeProperties(
      user.uid,
      (fetchedProps) => setProperties(fetchedProps),
      undefined,
      workspaceId
    );

    const unsubUnits = subscribeUnits(
      user.uid,
      null,
      (fetchedUnits) => setUnits(fetchedUnits),
      undefined,
      workspaceId
    );

    const unsubTenants = subscribeTenants(
      user.uid,
      null,
      (fetchedTenants) => setTenants(fetchedTenants),
      undefined,
      workspaceId
    );

    const unsubBills = subscribeRentBills(
      user.uid,
      {},
      (fetchedBills) => setBills(fetchedBills),
      (err) => console.error('[AdminDashboard] subscribeRentBills error:', err),
      workspaceId
    );
    const unsubPayments = subscribeRentPayments(
      user.uid,
      {},
      (fetchedPayments) => setPayments(fetchedPayments),
      (err) => console.error('[AdminDashboard] subscribeRentPayments error:', err),
      workspaceId
    );
    const unsubExpenses = subscribeExpenses(
      user.uid,
      {},
      (fetchedExpenses) => setExpenses(fetchedExpenses),
      (err) => console.error('[AdminDashboard] subscribeExpenses error:', err),
      workspaceId
    );

    return () => {
      unsubProps();
      unsubUnits();
      unsubTenants();
      unsubBills();
      unsubPayments();
      unsubExpenses();
    };
  }, [user, workspaceId]);

  // Month navigation helpers
  function handlePrevMonth() {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  }

  function handleNextMonth() {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  }

  function handleCurrentMonth() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${y}-${m}`);
  }

  // Filtered calculations for selectedMonth
  const activeProperties = properties.filter((p) => !p.isArchived);
  const activeUnits = units.filter((u) => !u.isArchived);
  const activeTenants = tenants.filter((t) => t.status === 'active');

    const resolveDateMonth = (dateVal: unknown): string => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') return dateVal.slice(0, 7);
    if (typeof (dateVal as { toDate?: () => Date }).toDate === 'function') {
      try {
        return (dateVal as { toDate: () => Date }).toDate().toISOString().slice(0, 7);
      } catch {
        return '';
      }
    }
    return '';
  };

  const selectedMonthPayments = payments.filter(
    (p) => (p.billingMonth || resolveDateMonth(p.paymentDate)) === selectedMonth
  );
  const totalRentCollected = selectedMonthPayments.reduce((sum, p) => sum + p.amount, 0);

  const selectedMonthBills = bills.filter((b) => (b.billingMonth || resolveDateMonth(b.createdAt)) === selectedMonth);
  const totalRentDue = selectedMonthBills.reduce((sum, b) => sum + b.balanceDue, 0);

  const selectedMonthExpenses = expenses.filter(
    (e) => (e.billingMonth || resolveDateMonth(e.expenseDate)) === selectedMonth && e.status === 'active'
  );
  const totalExpenses = selectedMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Payouts for family members (Brother 1, 2, 3 target 45k each)
  const familyPayoutsTotal = 0; // Staging write lock guarantees 0 live mutations
  const cashInHand = totalRentCollected - totalExpenses - familyPayoutsTotal;

  // Active tenant card helper
  function getTenantMonthStatus(tItem: Tenant) {
    const bill = selectedMonthBills.find((b) => b.tenantId === tItem.id);
    const paid = bill ? bill.totalPaid : 0;
    const due = bill ? bill.balanceDue : tItem.monthlyRent || 0;
    const isPaid = bill?.status === 'paid' || (due === 0 && paid > 0);
    const isPartial = paid > 0 && due > 0;
    return { paid, due, isPaid, isPartial };
  }

  // Navigation helpers for full-page financial workflows
  function handleOpenRentDeposit(tenantId?: string | null) {
    setPaymentPreselectedTenantId(tenantId || null);
    navigateTo('rent-deposit', { preSelectedTenantId: tenantId || null });
  }

  function handleOpenAddExpense() {
    navigateTo('add-expense');
  }

  // Open rent payment page for specific tenant
  function handleOpenPaymentForTenant(tenantId: string) {
    handleOpenRentDeposit(tenantId);
  }

  // Open tenant detail modal
  function handleOpenTenantDetails(tItem: Tenant) {
    setSelectedTenantForDetails(tItem);
    setTenantDetailsModalOpen(true);
  }

  const currentOwnerUid = user?.uid || '';
  const dhakaDate = getDhakaDateInfo(currentLanguage);
  const userName = getUserDisplayName(user?.displayName, user?.email);
  const quickCreationItems = [
    { id: 'property', label: t('profile.addPropertyBtn'), icon: Building2, onClick: () => setPropertyModalOpen(true) },
    { id: 'unit', label: t('profile.addUnitBtn'), icon: DoorClosed, onClick: () => setUnitModalOpen(true) },
    { id: 'tenant', label: t('profile.registerTenantBtn'), icon: UserPlus, onClick: () => setTenantModalOpen(true) },
  ].filter((item, index, items) => items.findIndex((entry) => entry.id === item.id) === index);

  // Dedicated Full-Page Rent Deposit View with Floating Pill Navigation Dock
  if (activeSection === 'rent-deposit') {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--hyper-bg-base)] text-[var(--hyper-text-primary)] antialiased transition-colors duration-200">
        <PageTransitionContainer
          transitionKey="rent-deposit"
          direction={direction}
          style={animSettings.pageTransition}
          speed={animSettings.speed}
          reducedMotion={animSettings.reducedMotion}
          className="flex-1"
        >
          <RentDepositPage
            tenants={activeTenants}
            bills={bills}
            preSelectedTenantId={preSelectedTenantId || paymentPreselectedTenantId}
            onBack={goBack}
            onSuccess={() => {
              // Handled via real-time listeners
            }}
          />
        </PageTransitionContainer>

        <FloatingPillNav
          activeSection={activeSection}
          drillDownView={null}
          onSelectSection={(section) => {
            navigateTo(section);
          }}
          onOpenNewExpense={() => {
            if (!canAccessTab('expenses')) {
              alert('আপনার খরচ যুক্ত করার অনুমতি নেই।');
              return;
            }
            handleOpenAddExpense();
          }}
          onOpenRentPayment={() => {
            if (!canAccessTab('rent')) {
              alert('আপনার ভাড়া আদায় করার অনুমতি নেই।');
              return;
            }
            handleOpenRentDeposit(null);
          }}
          canCreateExpense={canAccessTab('expenses')}
          canCollectRent={canAccessTab('rent')}
        />
      </div>
    );
  }

  // Dedicated Full-Page Add Expense View with Floating Pill Navigation Dock
  if (activeSection === 'add-expense') {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--hyper-bg-base)] text-[var(--hyper-text-primary)] antialiased transition-colors duration-200">
        <PageTransitionContainer
          transitionKey="add-expense"
          direction={direction}
          style={animSettings.pageTransition}
          speed={animSettings.speed}
          reducedMotion={animSettings.reducedMotion}
          className="flex-1"
        >
          <AddExpensePage
            properties={activeProperties}
            onBack={goBack}
            onSuccess={() => {
              // Handled via real-time listeners
            }}
          />
        </PageTransitionContainer>

        <FloatingPillNav
          activeSection={activeSection}
          drillDownView={null}
          onSelectSection={(section) => {
            navigateTo(section);
          }}
          onOpenNewExpense={() => {
            if (!canAccessTab('expenses')) {
              alert('আপনার খরচ যুক্ত করার অনুমতি নেই।');
              return;
            }
            handleOpenAddExpense();
          }}
          onOpenRentPayment={() => {
            if (!canAccessTab('rent')) {
              alert('আপনার ভাড়া আদায় করার অনুমতি নেই।');
              return;
            }
            handleOpenRentDeposit(null);
          }}
          canCreateExpense={canAccessTab('expenses')}
          canCollectRent={canAccessTab('rent')}
        />
      </div>
    );
  }

  // Dedicated Full-Page Settings Center View (Zero Popup, Full Viewport)
  if (activeSection === 'documents') {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--hyper-bg-base)] text-[var(--hyper-text-primary)] antialiased transition-colors duration-200">
        <PageTransitionContainer
          transitionKey="documents"
          direction={direction}
          style={animSettings.pageTransition}
          speed={animSettings.speed}
          reducedMotion={animSettings.reducedMotion}
          className="flex-1"
        >
          <StorageLibraryPage onBack={goBack} />
        </PageTransitionContainer>
        <FloatingPillNav
          activeSection={activeSection}
          drillDownView={null}
          onSelectSection={(section) => navigateTo(section)}
          onOpenNewExpense={() => {
            if (!canAccessTab('expenses')) {
              alert('আপনার খরচ যুক্ত করার অনুমতি নেই।');
              return;
            }
            handleOpenAddExpense();
          }}
          onOpenRentPayment={() => {
            if (!canAccessTab('rent')) {
              alert('আপনার ভাড়া আদায় করার অনুমতি নেই।');
              return;
            }
            handleOpenRentDeposit(null);
          }}
          canCreateExpense={canAccessTab('expenses')}
          canCollectRent={canAccessTab('rent')}
        />
      </div>
    );
  }

  if (activeSection === 'settings') {
    return (
      <PageTransitionContainer
        transitionKey="settings"
        direction={direction}
        style={animSettings.pageTransition}
        speed={animSettings.speed}
        reducedMotion={animSettings.reducedMotion}
        className="min-h-screen bg-[var(--hyper-bg-base)] text-[var(--hyper-text-primary)] antialiased transition-colors duration-200"
      >
        <SettingsCenter
          onBack={goBack}
          onOpenMemberManagement={() => {
            navigateTo('profile');
            setMemberManagementModalOpen(true);
          }}
        />
        {isMasterAdmin && (
          <MemberManagementModal
            isOpen={memberManagementModalOpen}
            onClose={() => setMemberManagementModalOpen(false)}
            currentAdminUid={user?.uid || ''}
          />
        )}
      </PageTransitionContainer>
    );
  }

  return (
    <div className="min-h-screen hyper-ambient-bg flex flex-col text-[var(--hyper-text-primary)] antialiased relative overflow-x-hidden">
      {/* Dynamic Ambient Background Highlights */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true" style={{ contain: 'strict' }}>
        <div className="absolute top-10 right-10 w-[500px] h-[500px] bg-[#22B84A]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-[450px] h-[450px] bg-[#1685E8]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-[600px] h-[600px] bg-[#22B84A]/5 rounded-full blur-3xl" />
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP HEADER                                                             */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[var(--hyper-bg-card)]/80 backdrop-blur-xl border-b border-[var(--hyper-border-subtle)] shadow-xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Official Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[16px] bg-white dark:bg-[#252528] p-1.5 shadow-sm border border-[var(--hyper-border-subtle)] flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/brand/anwar-bhuiyan-property.svg"
                alt="Anwar Bhuiyan Property Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[var(--hyper-text-primary)] leading-tight">
                {t('app.title')}
              </h1>
              <p className="text-xs text-[var(--hyper-text-secondary)] font-medium">
                {t('app.subtitle')}
              </p>
            </div>
          </div>

          {/* Right Controls: Desktop Nav Pills & Compact Language Selector */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop 3-Section Floating Navigation Dock */}
            <div className="hidden md:flex items-center gap-1.5 p-1 rounded-full border border-[var(--hyper-border)] shadow-xs bg-[var(--hyper-bg-card)]">
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className={`px-4 py-2 rounded-full transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                  activeSection === 'home' && !drillDownView
                    ? 'bg-[#22B84A] text-white shadow-sm shadow-[#22B84A]/30'
                    : 'text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <House className="w-3.5 h-3.5" />
                <span>{t('navigation.home')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('accounts')}
                className={`px-4 py-2 rounded-full transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                  activeSection === 'accounts' && !drillDownView
                    ? 'bg-[var(--hyper-green)] text-white shadow-sm shadow-[#22B84A]/25'
                    : 'text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t('navigation.accounts')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('profile')}
                className={`px-4 py-2 rounded-full transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                  activeSection === 'profile' && !drillDownView
                    ? 'bg-[var(--hyper-green)] text-white shadow-sm shadow-[#22B84A]/25'
                    : 'text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <UserRound className="w-3.5 h-3.5" />
                <span>{t('navigation.profile')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTAINER & SUB-VIEWS / SECTIONS                                 */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-32 pb-[calc(env(safe-area-inset-bottom)+7rem)] flex-1 w-full">
        <PageTransitionContainer
          transitionKey={drillDownView ? `accounts-${drillDownView}` : activeSection}
          direction={direction}
          style={animSettings.pageTransition}
          speed={animSettings.speed}
          reducedMotion={animSettings.reducedMotion}
          className="space-y-6"
        >
        {/* Drill-down Back Button if inside a detailed view */}
        {drillDownView && (
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
            >
              <span>{t('common.backToKhata')}</span>
            </button>
            <span className="text-xs text-slate-400 font-medium">বিস্তারিত মডিউল ভিউ</span>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* DRILL DOWN VIEWS (When user clicks drill down or test triggers tab)    */}
        {/* --------------------------------------------------------------------- */}
        {drillDownView === 'properties' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <PropertyManagementView ownerUid={currentOwnerUid} workspaceId={workspaceId} />
          </Suspense>
        )}

        {drillDownView === 'tenants' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <TenantManagementView
              ownerUid={currentOwnerUid}
              properties={properties}
              units={units}
              workspaceId={workspaceId}
            />
          </Suspense>
        )}

        {drillDownView === 'rent' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <RentManagementView
              ownerUid={currentOwnerUid}
              properties={properties}
              units={units}
              tenants={tenants}
            />
          </Suspense>
        )}

        {drillDownView === 'expenses' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <ExpenseManagementView ownerUid={currentOwnerUid} properties={properties} />
          </Suspense>
        )}

        {drillDownView === 'distribution' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <DistributionManagementView ownerUid={currentOwnerUid} />
          </Suspense>
        )}

        {drillDownView === 'reports' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <ReportsAnalyticsView ownerUid={currentOwnerUid} />
          </Suspense>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* SECTION 1: হোম (HOME DASHBOARD)                                       */}
        {/* --------------------------------------------------------------------- */}
        {!drillDownView && activeSection === 'home' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Top Row: Date Card & Authenticated User Name Card */}
            {settings.dashboard.sections.find((s) => s.id === 'banner')?.visible !== false && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Date Card */}
                <HyperCard className="p-3.5 sm:p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[14px] bg-[var(--hyper-green-bg)] text-[#22B84A] flex items-center justify-center shrink-0 border border-[#22B84A]/20">
                    <Calendar className="w-5 h-5 text-[#22B84A]" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[var(--hyper-text-primary)] truncate">
                      {dhakaDate.weekdayLine}
                    </div>
                    <div className="text-xs sm:text-sm text-[var(--hyper-text-secondary)] font-medium truncate mt-0.5">
                      {dhakaDate.fullDate}
                    </div>
                  </div>
                </HyperCard>

                {/* Authenticated User Name Card */}
                <HyperCard className="p-3.5 sm:p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[14px] overflow-hidden bg-[var(--hyper-green-bg)] text-[var(--hyper-green)] flex items-center justify-center shrink-0 border border-[#22B84A]/20">
                    {photoURL ? (
                      <img src={photoURL} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <UserRound className="w-5 h-5 text-[var(--hyper-green)]" strokeWidth={2.2} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-[var(--hyper-text-secondary)] truncate">
                      {isMasterAdmin ? t('common.roles.master_admin') : (role === 'manager' ? t('common.roles.manager') : t('common.roles.viewer'))}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-[var(--hyper-text-primary)] truncate mt-0.5">
                      {userName}
                    </div>
                  </div>
                </HyperCard>
              </div>
            )}

            {/* Dynamic Financial Summary Cards (Ordered & Configured via Admin Settings) */}
            {settings.dashboard.sections.find((s) => s.id === 'financialSummary')?.visible !== false && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
                {[...settings.dashboard.financialCards]
                  .filter((c) => c.visible)
                  .sort((a, b) => a.order - b.order)
                  .map((card) => {
                    switch (card.id) {
                      case 'totalCollected':
                        return (
                          <StatTile
                            key={card.id}
                            label={isBn ? card.labelBn : card.labelEn}
                            subtitle={formatLocalizedMonth(selectedMonth, currentLanguage)}
                            amount={formatLocalizedCurrency(totalRentCollected, currentLanguage, useBanglaNumerals)}
                            icon={ArrowDownLeft}
                            color={card.color}
                            trend="up"
                            trendText={t('dashboard.statusPaid')}
                          />
                        );
                      case 'totalDue':
                        return (
                          <StatTile
                            key={card.id}
                            label={isBn ? card.labelBn : card.labelEn}
                            subtitle={t('dashboard.remainingDue')}
                            amount={formatLocalizedCurrency(totalRentDue, currentLanguage, useBanglaNumerals)}
                            icon={Hourglass}
                            color={card.color}
                            trend="down"
                            trendText={t('dashboard.statusDue')}
                          />
                        );
                      case 'totalExpenses':
                        return (
                          <StatTile
                            key={card.id}
                            label={isBn ? card.labelBn : card.labelEn}
                            subtitle={t('dashboard.maintenanceAndBills')}
                            amount={formatLocalizedCurrency(totalExpenses, currentLanguage, useBanglaNumerals)}
                            icon={TrendingDown}
                            color={card.color}
                          />
                        );
                      case 'cashInHand':
                        return (
                          <StatTile
                            key={card.id}
                            label={isBn ? card.labelBn : card.labelEn}
                            subtitle={t('dashboard.surplusAfterExpenses')}
                            amount={formatLocalizedCurrency(cashInHand, currentLanguage, useBanglaNumerals)}
                            icon={Coins}
                            color={card.color}
                          />
                        );
                      default:
                        return null;
                    }
                  })}
              </div>
            )}

            {settings.dashboard.quickExpenseEnabled && canAccessTab('expenses') && (
              <button
                type="button"
                onClick={() => {
                  if (!canAccessTab('expenses')) return;
                  handleOpenAddExpense();
                }}
                className="group flex w-full items-center justify-between gap-4 rounded-[24px] border border-[var(--hyper-green)]/25 bg-gradient-to-r from-[var(--hyper-green)]/[0.10] via-[var(--hyper-green)]/[0.06] to-transparent p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--hyper-green)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hyper-green)] focus-visible:ring-offset-2"
                aria-label={isBn ? 'দ্রুত খরচ যোগ করুন' : 'Add a quick expense'}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--hyper-green)] text-white shadow-sm shadow-[var(--hyper-green)]/20 transition-transform duration-200 group-hover:scale-105">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--hyper-text-primary)]">
                      {isBn ? 'দ্রুত খরচ' : 'Quick Expense'}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--hyper-text-secondary)]">
                      {isBn ? 'এক ট্যাপে নতুন খরচ যোগ করুন' : 'Add an expense in one tap'}
                    </span>
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--hyper-green)]/10 text-[var(--hyper-green)] transition-transform duration-200 group-hover:translate-x-0.5">
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            )}

            {/* Optional Quick Actions Bar from Settings */}
            {settings.dashboard.sections.find((s) => s.id === 'quickActions')?.visible && (
              <HyperCard className="space-y-3 p-3.5 sm:p-4">
                <div className="text-xs font-bold text-[var(--hyper-text-secondary)] uppercase tracking-wider">
                  {isBn ? 'দ্রুত কাজ (Quick Actions)' : 'Quick Actions'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {settings.dashboard.quickActions
                    .filter((qa) => qa.visible)
                    .filter((action, index, actions) => actions.findIndex((item) => item.id === action.id) === index)
                    .sort((a, b) => a.order - b.order)
                    .map((qa) => (
                      <button
                        key={qa.id}
                        type="button"
                        onClick={() => {
                          if (qa.id === 'rentDeposit') handleOpenRentDeposit();
                          if (qa.id === 'newExpense') handleOpenAddExpense();
                          if (qa.id === 'addTenant') setTenantModalOpen(true);
                          if (qa.id === 'allAccounts') navigateTo('accounts');
                        }}
                        disabled={
                          (qa.id === 'newExpense' && !canAccessTab('expenses')) ||
                          (qa.id === 'rentDeposit' && !canAccessTab('rent'))
                        }
                        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[18px] border border-transparent bg-black/5 p-3 text-xs font-bold text-[var(--hyper-text-primary)] transition-all hover:border-[var(--hyper-border-subtle)] hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hyper-green)] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white/5"
                      >
                        <span>{isBn ? qa.labelBn : qa.labelEn}</span>
                      </button>
                    ))}
                </div>
              </HyperCard>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* SECTION 2: হিসাব (ACCOUNTS / KHATA)                                   */}
        {/* --------------------------------------------------------------------- */}
        {!drillDownView && activeSection === 'accounts' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Monthly Accounting Header Cards */}
            <div className="space-y-4 rounded-[26px] bg-gradient-to-br from-emerald-800 to-teal-900 p-4 text-white shadow-lg shadow-emerald-950/15 sm:space-y-5 sm:rounded-3xl sm:p-6">
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
                    {t('accounts.monthlyKhata')}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePrevMonth}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <h2 className="min-w-0 text-lg font-black sm:text-2xl">{formatLocalizedMonth(selectedMonth, currentLanguage)}</h2>
                    <button
                      onClick={handleNextMonth}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={handleCurrentMonth}
                      className="px-3 py-1 rounded-full bg-emerald-500/30 hover:bg-emerald-500/40 text-xs font-bold transition border border-emerald-400/30 cursor-pointer"
                    >
                      {currentLanguage === 'bn' ? 'আজ' : 'Today'}
                    </button>
                  </div>
                </div>
                <div className="min-w-0 sm:text-right">
                  <span className="text-xs text-emerald-200">{t('accounts.totalAvailableCash')}</span>
                  <div className="break-words text-xl font-black text-emerald-300 sm:text-3xl">
                    {formatLocalizedCurrency(cashInHand, currentLanguage, useBanglaNumerals)}
                  </div>
                </div>
              </div>

              {/* 4 Summary Metrics */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 border-t border-emerald-700/60 pt-4 text-xs lg:grid-cols-4 lg:gap-3">
                <div className="min-w-0">
                  <span className="text-emerald-200/80 block">{t('accounts.metrics.rentCollected')}</span>
                  <span className="break-words text-sm font-bold text-white sm:text-base">
                    {formatLocalizedCurrency(totalRentCollected, currentLanguage, useBanglaNumerals)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-emerald-200/80 block">{t('accounts.metrics.rentDue')}</span>
                  <span className="break-words text-sm font-bold text-red-300 sm:text-base">
                    {formatLocalizedCurrency(totalRentDue, currentLanguage, useBanglaNumerals)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-emerald-200/80 block">{t('accounts.metrics.totalExpenses')}</span>
                  <span className="break-words text-sm font-bold text-amber-300 sm:text-base">
                    {formatLocalizedCurrency(totalExpenses, currentLanguage, useBanglaNumerals)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-emerald-200/80 block">{t('accounts.metrics.familyPayout')}</span>
                  <span className="break-words text-sm font-bold text-emerald-200 sm:text-base">
                    {formatLocalizedCurrency(familyPayoutsTotal, currentLanguage, useBanglaNumerals)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Detail Khata Subsections */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
              {/* 1. ভাড়া আদায় ও রশিদ */}
              <HyperCard variant="default" className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 sm:text-base">
                    <CreditCard className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('accounts.cards.rentCollection.title')}</span>
                  </h3>
                  <button
                    onClick={() => {
                      if (!canAccessTab('rent')) return;
                      setDrillDownView('rent');
                    }}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {t('accounts.cards.rentCollection.viewDetail')}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('accounts.cards.rentCollection.desc')}
                </p>
                <div className="p-3 bg-white/70 dark:bg-white/5 backdrop-blur-xs rounded-2xl flex justify-between items-center text-xs border border-white/80 dark:border-white/10 shadow-2xs">
                  <span className="text-slate-600 dark:text-slate-300">{t('accounts.cards.rentCollection.currMonthTotal')}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatLocalizedCurrency(totalRentCollected, currentLanguage, useBanglaNumerals)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleOpenRentDeposit(null);
                  }}
                  disabled={!canAccessTab('rent')}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-xs shadow-md shadow-emerald-700/20 border border-white/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {t('accounts.cards.rentCollection.btn')}
                </button>
              </HyperCard>

              {/* 2. রক্ষণাবেক্ষণ ও খরচ */}
              <HyperCard variant="default" className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 sm:text-base">
                    <ReceiptText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{t('accounts.cards.expenses.title')}</span>
                  </h3>
                  <button
                    onClick={() => {
                      if (!canAccessTab('expenses')) return;
                      setDrillDownView('expenses');
                    }}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {t('accounts.cards.expenses.viewDetail')}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('accounts.cards.expenses.desc')}
                </p>
                <div className="p-3 bg-white/70 dark:bg-white/5 backdrop-blur-xs rounded-2xl flex justify-between items-center text-xs border border-white/80 dark:border-white/10 shadow-2xs">
                  <span className="text-slate-600 dark:text-slate-300">{t('accounts.cards.expenses.currMonthTotal')}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                    {formatLocalizedCurrency(totalExpenses, currentLanguage, useBanglaNumerals)}
                  </span>
                </div>
                <button
                  onClick={() => handleOpenAddExpense()}
                  disabled={!canAccessTab('expenses')}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-xs shadow-md shadow-amber-600/20 border border-white/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {t('accounts.cards.expenses.btn')}
                </button>
              </HyperCard>

              {/* 3. পারিবারিক বণ্টন ও রিজার্ভ */}
              <HyperCard variant="default" className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 sm:text-base">
                    <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('accounts.cards.distribution.title')}</span>
                  </h3>
                  {canAccessTab('distribution') ? (
                    <button
                      onClick={() => setDrillDownView('distribution')}
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {t('accounts.cards.distribution.viewDetail')}
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/40">
                      {t('accounts.cards.distribution.locked')}
                    </span>
                  )}
                </div>

                {!canAccessTab('distribution') ? (
                  <div className="p-4 bg-white/60 dark:bg-white/5 backdrop-blur-xs rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400 space-y-1 border border-white/70 dark:border-white/10">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{t('accounts.cards.distribution.lockedDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('accounts.cards.distribution.targetDesc')}
                    </p>
                    <div className="space-y-1.5 text-xs">
                      {['Brother 1', 'Brother 2', 'Brother 3'].map((bName) => (
                        <div
                          key={bName}
                          className="flex justify-between items-center p-2 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xs border border-white/80 dark:border-white/10 shadow-2xs"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{bName}</span>
                          <div className="text-right">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">{t('accounts.cards.distribution.brotherTarget')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </HyperCard>

              {/* 4. বকেয়া ও হিসাব রিপোর্ট */}
              <HyperCard variant="default" className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 sm:text-base">
                    <BarChart3 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>{t('accounts.cards.reports.title')}</span>
                  </h3>
                  <button
                    onClick={() => {
                      if (!canAccessTab('reports')) return;
                      setDrillDownView('reports');
                    }}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {t('accounts.cards.reports.viewDetail')}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('accounts.cards.reports.desc')}
                </p>
                <div className="p-3 bg-red-50/80 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-2xl flex justify-between items-center text-xs shadow-2xs">
                  <span className="text-red-900 dark:text-red-300 font-semibold">{t('accounts.cards.reports.totalDue')}</span>
                  <span className="font-bold text-red-700 dark:text-red-400 text-sm">
                    {formatLocalizedCurrency(totalRentDue, currentLanguage, useBanglaNumerals)}
                  </span>
                </div>
                <button
                  onClick={() => setDrillDownView('reports')}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-800 hover:from-teal-800 hover:to-emerald-900 text-white font-semibold text-xs shadow-md shadow-teal-800/20 border border-white/20 transition cursor-pointer"
                >
                  {t('accounts.cards.reports.btn')}
                </button>
              </HyperCard>
            </div>

            {/* Active Property Card Overview */}
            <HyperCard variant="default" className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{properties[0]?.name || 'ভূঁইয়া বাড়ি'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/50">
                      {t('dashboard.activeBuilding')}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.propertyDescription')}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setDrillDownView('properties')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-semibold text-xs border border-emerald-200 dark:border-emerald-800/40 transition cursor-pointer"
                  >
                    {t('dashboard.propertiesAndFlats')}
                  </button>
                  <button
                    onClick={() => setDrillDownView('properties')}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 font-semibold text-xs border border-slate-300 dark:border-white/10 transition cursor-pointer"
                  >
                    {t('dashboard.manageFlats')}
                  </button>
                </div>
              </div>

              {/* Units summary badge */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                <div className="p-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block">{t('dashboard.totalUnits')}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {useBanglaNumerals && currentLanguage === 'bn'
                      ? (activeUnits.length > 0 ? activeUnits.length : 1).toLocaleString('bn-BD')
                      : activeUnits.length > 0
                      ? activeUnits.length
                      : 1}{' '}
                    {t('dashboard.unitsCountUnit')}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 shadow-2xs">
                  <span className="text-emerald-800 dark:text-emerald-300 block">{t('dashboard.occupiedUnits')}</span>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                    {useBanglaNumerals && currentLanguage === 'bn'
                      ? (activeTenants.length > 0 ? activeTenants.length : 1).toLocaleString('bn-BD')
                      : activeTenants.length > 0
                      ? activeTenants.length
                      : 1}{' '}
                    {t('dashboard.unitsCountUnit')}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block">{t('dashboard.vacantUnits')}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {useBanglaNumerals && currentLanguage === 'bn' ? '০' : '0'}{' '}
                    {t('dashboard.unitsCountUnit')}
                  </span>
                </div>
              </div>
            </HyperCard>

            {/* Tenant Cards List (Readable Family Cards) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('dashboard.tenantsList')}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('dashboard.tenantsListSubtitle')}
                  </p>
                </div>
                <button
                  onClick={() => setDrillDownView('tenants')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline cursor-pointer"
                >
                  {t('dashboard.viewFullTenantList')}
                </button>
              </div>

              {activeTenants.length === 0 ? (
                <div className="p-8 text-center bg-white/80 dark:bg-white/5 backdrop-blur-md rounded-3xl border border-white/80 dark:border-white/10 shadow-sm space-y-2">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.noTenants')}</p>
                  <button
                    onClick={() => setTenantModalOpen(true)}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                  >
                    {t('dashboard.addNewTenant')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activeTenants.map((tItem) => {
                    const status = getTenantMonthStatus(tItem);
                    const assignedUnit = units.find((u) => u.id === tItem.unitId);
                    return (
                      <HyperCard
                        key={tItem.id}
                        variant="default"
                        className="p-4 sm:p-5 flex flex-col justify-between space-y-3"
                      >
                        {/* Tenant Top */}
                        <div className="flex items-start justify-between">
                          <button
                            type="button"
                            onClick={() => handleOpenTenantDetails(tItem)}
                            className="flex items-center gap-3 text-left group cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-base group-hover:scale-105 transition shadow-2xs border border-emerald-200 dark:border-emerald-800/50">
                              <UserRound className="w-5 h-5 text-emerald-800 dark:text-emerald-300" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                                {tItem.name}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                ভবন: ভূঁইয়া বাড়ি •{' '}
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {assignedUnit?.unitNumber || 'Flat 1A'}
                                </span>
                              </p>
                            </div>
                          </button>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                              status.isPaid
                                ? 'bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/50'
                                : status.isPartial
                                ? 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50'
                                : 'bg-red-100/90 dark:bg-red-950/60 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800/50'
                            }`}
                          >
                            {status.isPaid
                              ? t('dashboard.statusPaid')
                              : status.isPartial
                              ? t('dashboard.statusPartial')
                              : t('dashboard.statusDue')}
                          </span>
                        </div>

                        {/* Rent Breakdown */}
                        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-white/60 dark:bg-white/5 backdrop-blur-xs rounded-2xl text-xs border border-white/70 dark:border-white/10">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">{t('dashboard.monthlyRentLabel')}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatLocalizedCurrency(tItem.monthlyRent, currentLanguage, useBanglaNumerals)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">{t('dashboard.rentCollected')}</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatLocalizedCurrency(status.paid, currentLanguage, useBanglaNumerals)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">{t('dashboard.rentRemaining')}</span>
                            <span className="font-bold text-red-600 dark:text-red-400">
                              {formatLocalizedCurrency(status.due, currentLanguage, useBanglaNumerals)}
                            </span>
                          </div>
                        </div>

                        {/* Action row */}
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100 dark:border-white/10">
                          <span className="text-slate-400">
                            {t('dashboard.mobileLabel')} {tItem.mobile || t('dashboard.notProvided')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPaymentForTenant(tItem.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-2xs cursor-pointer"
                          >
                            {t('dashboard.collectRentAction')}
                          </button>
                        </div>
                      </HyperCard>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white dark:bg-[#1c1c1f] p-5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-xs space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>{t('dashboard.recentActivity')}</span>
              </h3>

              {selectedMonthPayments.length === 0 && selectedMonthExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  {t('dashboard.emptyActivity')}
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedMonthPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-emerald-200/70 dark:bg-emerald-800/50 text-emerald-900 dark:text-emerald-100 flex items-center justify-center font-bold">
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-900 dark:text-emerald-100" />
                        </span>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{t('dashboard.rentCollectedActivity')}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {t('dashboard.receipt')} {p.receiptNumber || p.id.slice(0, 8)} ({p.paymentMethod})
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                          +{formatLocalizedCurrency(p.amount, currentLanguage, useBanglaNumerals)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.paymentDate?.toDate?.()?.toLocaleDateString() || String(p.billingMonth)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedMonthExpenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex justify-between items-center p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-amber-200/70 dark:bg-amber-800/50 text-amber-900 dark:text-amber-100 flex items-center justify-center font-bold">
                          <ArrowUpRight className="w-3.5 h-3.5 text-amber-900 dark:text-amber-100" />
                        </span>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{e.title}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('dashboard.category')} {e.category}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                          -{formatLocalizedCurrency(e.amount, currentLanguage, useBanglaNumerals)}
                        </div>
                        <div className="text-[10px] text-slate-400">{e.expenseDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* SECTION 3: অ্যাডমিন প্রোফাইল ও সেটিংস নেভিগেশন (PROFILE & SETTINGS)   */}
        {/* --------------------------------------------------------------------- */}
        {!drillDownView && activeSection === 'profile' && (
          <div className="space-y-4 max-w-2xl mx-auto pb-24">
            {/* 1. User Profile & Identity Card */}
            <HyperCard variant="default" className="p-4 sm:p-5">
              <div className="flex items-center gap-3.5 sm:gap-4">
                {/* Avatar with Camera Overlay & Interactive Click */}
                <div className="relative group shrink-0">
                  <div
                    onClick={() => {
                      if (photoURL) {
                        setPreviewPhoto(null);
                        setIsPhotoModalOpen(true);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-emerald-700/20 border-2 border-white/80 dark:border-white/10 cursor-pointer active:scale-95 transition-transform"
                    title={isBn ? 'প্রোফাইল ছবি পরিবর্তন করতে ক্লিক করুন' : 'Click to change profile picture'}
                  >
                    {photoURL ? (
                      <img src={photoURL} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <UserRound className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={isBn ? 'ছবি পরিবর্তন করুন' : 'Change Photo'}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#202023] transition-transform active:scale-90 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--hyper-text-primary)] leading-tight truncate">
                      {userName}
                    </h2>
                    <StatusBadge tone={isMasterAdmin || role === 'manager' ? 'success' : 'neutral'}>
                      {isMasterAdmin
                        ? t('common.roles.master_admin')
                        : role === 'manager'
                        ? t('common.roles.manager')
                        : t('common.roles.viewer')}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5 truncate">
                    {user?.email?.split('@')[0] || 'admin'}
                  </p>
                  
                  {/* Photo Actions Row */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      <span>{photoURL ? (isBn ? 'ছবি পরিবর্তন' : 'Change Photo') : (isBn ? 'ছবি যোগ করুন' : 'Add Photo')}</span>
                    </button>
                    {photoURL && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewPhoto(null);
                          setIsPhotoModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] font-medium text-[11px] transition cursor-pointer"
                      >
                        {isBn ? 'ছবি দেখুন / মুছুন' : 'View / Remove'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Hidden native file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </HyperCard>

            {/* 2. Master Admin Member Management Card */}
            {isMasterAdmin && (
              <HyperCard variant="default" className="p-5 sm:p-6 space-y-3 border-[var(--hyper-green)]/20">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--hyper-border-subtle)]">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-[var(--hyper-green)]" />
                    <h3 className="font-bold text-[var(--hyper-text-primary)] text-base">
                      {t('profile.memberManagementTitle')}
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--hyper-green-bg)] text-[var(--hyper-green)]">
                    {t('profile.masterAdminOnlyBadge')}
                  </span>
                </div>
                <p className="text-xs text-[var(--hyper-text-secondary)]">
                  {t('profile.memberManagementDesc')}
                </p>
                <button
                  type="button"
                  onClick={() => setMemberManagementModalOpen(true)}
                  className="w-full p-3.5 rounded-2xl bg-[var(--hyper-green-bg)] hover:bg-[#22B84A]/20 border border-[#22B84A]/20 text-[var(--hyper-green)] font-bold text-xs transition flex items-center justify-between cursor-pointer select-none group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--hyper-green)] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <KeyRound className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold">{t('profile.memberManagementBtnTitle')}</div>
                      <div className="text-xs text-[var(--hyper-green)]/80 font-normal">
                        {t('profile.memberManagementBtnSubtitle')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </HyperCard>
            )}

            {/* 3. Centralized Settings Center Entry Point (Full-Page Navigation) */}
            <HyperCard
              variant="default"
              clickable
              data-settings-trigger="true"
              onClick={() => navigateTo('settings')}
              className="p-5 sm:p-6 cursor-pointer border border-[#22B84A]/30 bg-[#22B84A]/[0.04] hover:bg-[#22B84A]/[0.08] transition-all select-none group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-[16px] bg-[var(--hyper-green-bg)] text-[#22B84A] flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <SlidersHorizontal className="w-6 h-6 text-[#22B84A]" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-[var(--hyper-text-primary)] leading-tight">
                        {isBn ? 'অ্যাপ সেটিংস ও কাস্টমাইজেশন' : 'App Settings & Customization'}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#22B84A]/15 text-[#22B84A]">
                        {isBn ? 'ফুল পেজ' : 'Full Page'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--hyper-text-secondary)] mt-1">
                      {isBn
                        ? 'সিস্টেম থিম, ড্যাশবোর্ড কার্ড, ভাষা, নেভিগেশন ও পারমিশন কন্ট্রোল'
                        : 'Theme, dashboard cards, language, navigation and permissions'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[#22B84A] font-bold text-xs shrink-0">
                  <span className="hidden sm:inline">{isBn ? 'খুলুন' : 'Open'}</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </HyperCard>

            {/* 4. Quick Property & Unit Creation Shortcuts (for Admin) */}
            {isMasterAdmin && (
              <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
                <span className="text-xs font-bold text-[var(--hyper-text-secondary)] uppercase tracking-wider block px-1">
                  {isBn ? 'দ্রুত রেকর্ড তৈরি' : 'Quick Creation'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {quickCreationItems.map(({ id, label, icon: Icon, onClick }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={onClick}
                      className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-[var(--hyper-text-primary)] font-semibold text-sm transition flex items-center justify-between cursor-pointer"
                    >
                      <span>{label}</span>
                      <Icon className="w-4 h-4 text-[var(--hyper-green)]" />
                    </button>
                  ))}
                </div>
              </HyperCard>
            )}

            {/* 5. Sign Out Action */}
            <HyperCard variant="default" className="p-4 border-red-500/20">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full py-3 rounded-2xl bg-transparent hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/40 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>{loggingOut ? t('profile.signingOut') : t('profile.signOutBtn')}</span>
              </button>
            </HyperCard>
          </div>
        )}
        </PageTransitionContainer>
        <div className="mt-4 ml-auto max-w-sm">
          <SyncStatusBar />
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. FIXED BOTTOM FIVE-OPTION FLOATING PILL NAVIGATION DOCK (HYPEROS)       */}
      {/* ========================================================================= */}
      <FloatingPillNav
        activeSection={activeSection}
        drillDownView={drillDownView}
        onSelectSection={(section) => {
          navigateTo(section);
        }}
        onOpenNewExpense={() => {
          if (!canAccessTab('expenses')) {
            alert('আপনার খরচ যুক্ত করার অনুমতি নেই।');
            return;
          }
          handleOpenAddExpense();
        }}
        onOpenRentPayment={() => {
          if (!canAccessTab('rent')) {
            alert('আপনার ভাড়া আদায় করার অনুমতি নেই।');
            return;
          }
          handleOpenRentDeposit(null);
        }}
        canCreateExpense={canAccessTab('expenses')}
        canCollectRent={canAccessTab('rent')}
      />

      {/* ========================================================================= */}
      {/* 4. MODALS CONTAINER (Zero Popup for Rent & Expense)                      */}
      {/* ========================================================================= */}
      {/* Simple Tenant Details Modal */}
      <SimpleTenantDetailsModal
        isOpen={tenantDetailsModalOpen}
        onClose={() => setTenantDetailsModalOpen(false)}
        tenant={selectedTenantForDetails}
        property={
          properties.find((p) => p.id === selectedTenantForDetails?.propertyId) ||
          properties[0] ||
          null
        }
        unit={units.find((u) => u.id === selectedTenantForDetails?.unitId) || null}
        currentBill={
          bills.find(
            (b) =>
              b.tenantId === selectedTenantForDetails?.id && b.billingMonth === selectedMonth
          ) || null
        }
        payments={payments}
        onOpenPaymentModal={(tenantId) => handleOpenPaymentForTenant(tenantId)}
        canManageRent={canAccessTab('rent')}
      />

      {/* Property Creation Modal */}
      <PropertyModal
        isOpen={propertyModalOpen}
        onClose={() => setPropertyModalOpen(false)}
        onSave={async () => {
          setPropertyModalOpen(false);
        }}
        propertyToEdit={null}
        ownerUid={currentOwnerUid}
      />

      {/* Unit Creation Modal */}
      <UnitModal
        isOpen={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        onSave={async () => {
          setUnitModalOpen(false);
        }}
        unitToEdit={null}
        propertyId={activeProperties[0]?.id || ''}
        propertyName={activeProperties[0]?.name || ''}
        ownerUid={currentOwnerUid}
      />

      {/* Tenant Creation Modal */}
      <TenantModal
        isOpen={tenantModalOpen}
        onClose={() => setTenantModalOpen(false)}
        onSave={async () => {
          setTenantModalOpen(false);
        }}
        properties={activeProperties}
        units={activeUnits}
      />

      {/* Member Management Modal (Master Admin Only) */}
      {isMasterAdmin && (
        <MemberManagementModal
          isOpen={memberManagementModalOpen}
          onClose={() => setMemberManagementModalOpen(false)}
          currentAdminUid={user?.uid || ''}
        />
      )}

      {/* Profile Photo Modal */}
      <ProfilePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => {
          setIsPhotoModalOpen(false);
          setPreviewPhoto(null);
        }}
        previewUrl={previewPhoto}
        currentPhotoUrl={photoURL}
        onSave={handleSavePhoto}
        onRemove={handleRemovePhoto}
        onPickAnother={() => fileInputRef.current?.click()}
      />

      {/* Floating Toast Notification */}
      {photoToast && (
        <div className="fixed top-5 inset-x-0 z-[10000] flex justify-center pointer-events-none px-4 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="px-4 py-2 rounded-2xl bg-[#22B84A] text-white font-semibold text-xs shadow-lg flex items-center gap-2 pointer-events-auto">
            <Check className="w-4 h-4" />
            <span>{photoToast}</span>
          </div>
        </div>
      )}
    </div>
  );
}