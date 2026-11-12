import { lazy, Suspense } from 'react';
import { BarChart3, Lock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { HyperCard } from '../ui/hyperos/HyperCard';

const ReportsAnalyticsView = lazy(() =>
  import('../reports/ReportsAnalyticsView').then((module) => ({
    default: module.ReportsAnalyticsView,
  }))
);

interface ReportsModulePanelProps {
  ownerUid: string;
  month: string;
  onMonthChange: (month: string) => void;
  enabled: boolean;
}

function PanelFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[var(--hyper-green)] border-t-transparent" />
      <p className="text-xs font-medium text-[var(--hyper-text-secondary)]">
        লোড হচ্ছে / Loading…
      </p>
    </div>
  );
}

export default function ReportsModulePanel({
  ownerUid,
  month,
  onMonthChange,
  enabled,
}: ReportsModulePanelProps) {
  const { t } = useLanguage();

  if (!enabled) {
    return (
      <HyperCard className="space-y-2 p-5 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--hyper-red-bg)]">
          <Lock className="h-5 w-5 text-[var(--hyper-red)]" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-bold text-[var(--hyper-text-primary)]">
          {t('hisab.module.reportsLocked')}
        </h2>
        <p className="mx-auto max-w-md text-xs font-medium text-[var(--hyper-text-secondary)]">
          {t('accounts.lockedDesc')}
        </p>
      </HyperCard>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-3 py-2 text-[11px] font-medium text-[var(--hyper-text-secondary)]">
        <BarChart3 className="h-4 w-4 shrink-0 text-[var(--hyper-green)]" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {t('hisab.tabDescriptions.reports')} • {month}
        </span>
      </div>

      <Suspense fallback={<PanelFallback />}>
        <ReportsAnalyticsView
          ownerUid={ownerUid}
          embedded
          month={month}
          onMonthChange={onMonthChange}
        />
      </Suspense>
    </div>
  );
}
