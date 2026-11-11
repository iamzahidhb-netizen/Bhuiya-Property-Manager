import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  syncEngine,
  subscribeSyncStatus,
  type SyncEngineStatus,
} from '../../lib/syncEngine';
import { useLanguage } from '../../contexts/LanguageContext';

export const SyncStatusBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [status, setStatus] = useState<SyncEngineStatus>(syncEngine.getStatus());
  const [expanded, setExpanded] = useState<boolean>(false);
  const [manualSyncing, setManualSyncing] = useState<boolean>(false);

  useEffect(() => {
    // Initialize sync engine on mount
    syncEngine.init().catch(() => {});
    const unsub = subscribeSyncStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsub;
  }, []);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (manualSyncing || status.isSyncing) return;
    setManualSyncing(true);
    try {
      await syncEngine.triggerSyncNow();
    } finally {
      setManualSyncing(false);
    }
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return isBn ? 'এখনো কোনো সিঙ্ক হয়নি' : 'No sync recorded';
    const date = new Date(timestamp);
    return date.toLocaleTimeString(isBn ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`w-full transition-all duration-200 ${className}`}>
      {/* Primary Pill Bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`px-3 py-1.5 rounded-2xl flex items-center justify-between text-xs font-semibold backdrop-blur-md transition-all cursor-pointer border select-none ${
          !status.isOnline
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
            : status.isSyncing || manualSyncing
            ? 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300'
            : status.failedCount > 0
            ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300'
            : status.pendingCount > 0
            ? 'bg-orange-500/15 border-orange-500/30 text-orange-700 dark:text-orange-300'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!status.isOnline ? (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isBn ? 'অফলাইন মোড' : 'Offline Mode'}
              </span>
            </div>
          ) : status.isSyncing || manualSyncing ? (
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-blue-500" />
              <span className="truncate">
                {isBn ? 'ক্লাউডের সাথে সিঙ্ক হচ্ছে...' : 'Syncing with cloud...'}
              </span>
            </div>
          ) : status.failedCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span className="truncate">
                {isBn ? `সিঙ্ক সমস্যা (${status.failedCount}টি)` : `Sync Error (${status.failedCount})`}
              </span>
            </div>
          ) : status.pendingCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0 text-orange-500" />
              <span className="truncate">
                {isBn
                  ? `${status.pendingCount}টি রেকর্ড সিঙ্ক বাকি`
                  : `${status.pendingCount} records pending`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <Wifi className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">
                {isBn ? 'অনলাইন • সব সিঙ্কড' : 'Online • All Synced'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status.pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/40 dark:bg-black/40">
              {status.pendingCount}
            </span>
          )}

          {/* Sync Button */}
          {status.isOnline && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={status.isSyncing || manualSyncing}
              title={isBn ? 'এখনই সিঙ্ক করুন' : 'Sync Now'}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  status.isSyncing || manualSyncing ? 'animate-spin' : ''
                }`}
              />
            </button>
          )}

          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 opacity-60" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          )}
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {expanded && (
        <div className="mt-1.5 p-3 rounded-2xl bg-[var(--hyper-surface-elevated)] border border-[var(--hyper-border-subtle)] text-xs space-y-2 shadow-lg">
          <div className="flex items-center justify-between pb-1.5 border-b border-[var(--hyper-border-subtle)]">
            <span className="text-[var(--hyper-text-secondary)] font-medium">
              {isBn ? 'সর্বশেষ সফল সিঙ্ক:' : 'Last Synced:'}
            </span>
            <span className="font-semibold text-[var(--hyper-text-primary)]">
              {formatLastSync(status.lastSyncedAt)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-xl bg-[var(--hyper-surface)] border border-[var(--hyper-border-subtle)]">
              <span className="text-[var(--hyper-text-tertiary)] block">
                {isBn ? 'সিঙ্ক বাকি (Pending)' : 'Pending Queue'}
              </span>
              <span className="font-bold text-sm text-[var(--hyper-text-primary)]">
                {status.pendingCount}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-[var(--hyper-surface)] border border-[var(--hyper-border-subtle)]">
              <span className="text-[var(--hyper-text-tertiary)] block">
                {isBn ? 'ব্যর্থ হয়েছে (Failed)' : 'Failed Retries'}
              </span>
              <span className="font-bold text-sm text-rose-500">
                {status.failedCount}
              </span>
            </div>
          </div>

          {status.lastError && (
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px]">
              <span className="font-bold block">{isBn ? 'সর্বশেষ ত্রুটি:' : 'Last Error:'}</span>
              <span className="break-words">{status.lastError}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] text-[var(--hyper-text-tertiary)]">
              {status.isOnline
                ? isBn
                  ? 'সংযোগ সক্রিয় • রিয়েল-টাইম ফায়ারস্টোর'
                  : 'Connected • Real-time Firestore'
                : isBn
                ? 'অফলাইনে কাজ চলবে • ডেটা হারাবে না'
                : 'Working offline • Zero data loss'}
            </span>

            {status.isOnline && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={status.isSyncing || manualSyncing}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${
                    status.isSyncing || manualSyncing ? 'animate-spin' : ''
                  }`}
                />
                <span>{isBn ? 'সিঙ্ক করুন' : 'Sync Now'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
