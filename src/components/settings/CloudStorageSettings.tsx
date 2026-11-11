import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Cloud, RefreshCw, ShieldAlert } from 'lucide-react';
import { getR2StorageStatus, type R2StorageStatus } from '../../services/storageService';
import { useLanguage } from '../../contexts/LanguageContext';
import { HyperCard } from '../ui/hyperos';

export interface CloudStorageSettingsProps {
  onBack?: () => void;
}

export const CloudStorageSettings: React.FC<CloudStorageSettingsProps> = ({ onBack }) => {
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';
  const [status, setStatus] = useState<R2StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async (): Promise<R2StorageStatus> => {
    try {
      return await getR2StorageStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { state: 'unavailable', message };
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setStatus(await fetchStatus());
    setLoading(false);
  }, [fetchStatus]);

  useEffect(() => {
    let active = true;
    void fetchStatus().then((nextStatus) => {
      if (active) {
        setStatus(nextStatus);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchStatus]);

  const available = status?.state === 'available';
  const message = status && status.state !== 'available' ? status.message : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--hyper-border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="cursor-pointer rounded-xl p-2 text-[var(--hyper-text-secondary)] hover:bg-black/5 hover:text-[var(--hyper-text-primary)]"
              aria-label={isBn ? 'ফিরে যান' : 'Back'}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--hyper-text-primary)]">
              <Cloud className="h-5 w-5 text-[#1685E8]" />
              {isBn ? 'Cloudflare R2 স্টোরেজ' : 'Cloudflare R2 Storage'}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'ব্যক্তিগত ফাইল স্টোরেজের সংযোগ পরীক্ষা করুন' : 'Check the private file storage connection'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshStatus()}
          disabled={loading}
          className="cursor-pointer rounded-xl p-2 text-[var(--hyper-text-secondary)] hover:bg-black/5 disabled:opacity-50"
          title={isBn ? 'রিফ্রেশ' : 'Refresh'}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <HyperCard variant="default" glass className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          {available
            ? <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            : <ShieldAlert className="h-6 w-6 text-amber-500" />}
          <div>
            <h3 className="font-semibold text-[var(--hyper-text-primary)]">
              {loading
                ? (isBn ? 'সংযোগ পরীক্ষা হচ্ছে…' : 'Checking connection…')
                : available
                  ? (isBn ? 'R2 সংযুক্ত এবং প্রস্তুত' : 'R2 connected and ready')
                  : (isBn ? 'R2 সংযোগ অনুপলব্ধ' : 'R2 connection unavailable')}
            </h3>
            <p className="text-sm text-[var(--hyper-text-secondary)]">
              {message || (isBn
                ? 'আপলোড করা ফাইল ব্যক্তিগত Cloudflare R2-তে সংরক্ষিত হয়।'
                : 'Uploaded files are stored in private Cloudflare R2.')}
            </p>
          </div>
        </div>
      </HyperCard>
    </div>
  );
};
