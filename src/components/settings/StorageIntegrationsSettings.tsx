import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Key,
  ShieldCheck,
  FolderTree,
  Folder,
  Unlink,
  ArrowLeft,
  Info
} from 'lucide-react';
import {
  getDriveStatus,
  connectDrive,
  disconnectDrive,
  testDriveConnection,
  configureDriveCredentials,
  type DriveStatus
} from '../../services/storageService';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { HyperCard, PillButton } from '../ui/hyperos';
import { Capacitor } from '@capacitor/core';

export interface StorageIntegrationsSettingsProps {
  onBack?: () => void;
}

export const StorageIntegrationsSettings: React.FC<StorageIntegrationsSettingsProps> = ({ onBack }) => {
  const { currentLanguage } = useLanguage();
  const { isMasterAdmin } = useWorkspace();
  const isBn = currentLanguage === 'bn';

  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showCredForm, setShowCredForm] = useState<boolean>(false);
  const [clientIdInput, setClientIdInput] = useState<string>('');
  const [clientSecretInput, setClientSecretInput] = useState<string>('');
  const [savingCreds, setSavingCreds] = useState<boolean>(false);

  // Check URL query parameters for storage connection result
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('storage') === 'connected') {
        setMessage({
          type: 'success',
          text: isBn
            ? 'গুগল ড্রাইভ সফলভাবে সংযুক্ত হয়েছে এবং ফোল্ডার স্ট্রাকচার প্রস্তুত!'
            : 'Google Drive connected successfully with folder structure initialized!'
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get('storage_error')) {
        setMessage({
          type: 'error',
          text: (isBn ? 'সংযোগে ত্রুটি: ' : 'Connection error: ') + decodeURIComponent(params.get('storage_error') || '')
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    loadStatus();
  }, [isBn]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await getDriveStatus();
      setStatus(res);
    } catch (err: unknown) {
      console.warn('Could not load drive status:', err);
      setStatus({
        connected: false,
        status: 'disconnected'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientIdInput.trim() || !clientSecretInput.trim()) {
      setMessage({
        type: 'error',
        text: isBn ? 'Client ID এবং Client Secret প্রদান করুন।' : 'Client ID and Client Secret are required.'
      });
      return;
    }

    setSavingCreds(true);
    setMessage(null);
    try {
      await configureDriveCredentials({
        clientId: clientIdInput.trim(),
        clientSecret: clientSecretInput.trim()
      });
      setMessage({
        type: 'success',
        text: isBn
          ? 'Google Cloud ক্রেডেনশিয়াল সফলভাবে সংরক্ষণ হয়েছে! এখন নিচের বাটনে ক্লিক করে Google Drive সংযুক্ত করুন।'
          : 'Google Cloud credentials saved! Now click Connect Google Drive.'
      });
      setShowCredForm(false);
      setClientSecretInput('');
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({
        type: 'error',
        text: isBn ? `সংরক্ষণ ব্যর্থ: ${msg}` : `Failed to save credentials: ${msg}`
      });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleConnect = async () => {
    if (!isMasterAdmin) {
      setMessage({
        type: 'error',
        text: isBn ? 'শুধুমাত্র মাস্টার অ্যাডমিন গুগল ড্রাইভ সংযুক্ত করতে পারেন।' : 'Only Master Admin can connect Google Drive.'
      });
      return;
    }

    if (!status?.hasConfig && !showCredForm) {
      setShowCredForm(true);
      setMessage({
        type: 'info',
        text: isBn
          ? 'অনুগ্রহ করে প্রথমে নিচে Google Cloud Console থেকে প্রাপ্ত Client ID এবং Client Secret প্রদান করুন।'
          : 'Please provide your Google Cloud Client ID and Secret below first.'
      });
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      const authUrl = await connectDrive();
      if (Capacitor.isNativePlatform()) {
        window.open(authUrl, '_system');
        setMessage({
          type: 'info',
          text: isBn
            ? 'গুগল ড্রাইভ অনুমোদনের জন্য ব্রাউজার খোলা হয়েছে। ব্রাউজারে অনুমতি প্রদান সম্পন্ন হলে অ্যাপে ফিরে রিলোড করুন।'
            : 'Browser opened for Google Drive authorization. Complete consent and reload in app.'
        });
        setActionLoading(false);
      } else {
        window.location.href = authUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('পাওয়া যায়নি') || msg.includes('not configured')) {
        setShowCredForm(true);
      }
      setMessage({
        type: 'error',
        text: isBn ? `গুগল অনুমোদন শুরু করা যায়নি: ${msg}` : `Failed to start Google OAuth: ${msg}`
      });
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isMasterAdmin) return;
    if (!confirm(isBn ? 'আপনি কি নিশ্চিতভাবে গুগল ড্রাইভ সংযোগ বিচ্ছিন্ন করতে চান?' : 'Are you sure you want to disconnect Google Drive?')) {
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      await disconnectDrive();
      setMessage({
        type: 'info',
        text: isBn ? 'গুগল ড্রাইভ সংযোগ সফলভাবে বিচ্ছিন্ন করা হয়েছে।' : 'Google Drive disconnected successfully.'
      });
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({
        type: 'error',
        text: isBn ? `সংযোগ বিচ্ছিন্ন করতে ব্যর্থ: ${msg}` : `Disconnect failed: ${msg}`
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await testDriveConnection();
      setMessage({
        type: 'success',
        text: isBn
          ? `কানেকশন টেস্ট সফল! ড্রাইভ অ্যাক্টিভ আছে (${res.email || 'সংযুক্ত'})।`
          : `Connection test passed! Drive is active (${res.email || 'Connected'}).`
      });
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({
        type: 'error',
        text: isBn ? `কানেকশন টেস্ট ব্যর্থ: ${msg}` : `Connection test failed: ${msg}`
      });
    } finally {
      setActionLoading(false);
    }
  };

  const isConnected = Boolean(status?.connected);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--hyper-border-subtle)]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold text-[var(--hyper-text-primary)] flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#1685E8]" />
              {isBn ? 'Google Drive ক্লাউড স্টোরেজ' : 'Google Drive Cloud Storage'}
            </h2>
            <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5">
              {isBn
                ? 'ভাড়াটিয়া এনআইডি, চুক্তিপত্র, রসিদ এবং খরচের ইনভয়েস গুগল ড্রাইভে সম্পূর্ণ সুরক্ষিতভাবে সংরক্ষণ করুন'
                : 'Secure cloud vault for Tenant NIDs, lease agreements, receipts, and expense invoices'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadStatus}
          disabled={loading || actionLoading}
          className="p-2 rounded-xl text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          title={isBn ? 'রিফ্রেশ' : 'Refresh'}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Alert Notice */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl flex items-start gap-3 text-xs font-medium border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : message.type === 'error'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : message.type === 'error' ? (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-[var(--hyper-text-tertiary)] hover:text-[var(--hyper-text-primary)]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Connection Card */}
      <HyperCard variant="default" glass className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-zinc-500/15 text-zinc-500'
              }`}
            >
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--hyper-text-primary)]">
                  Google Drive API v3
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {isConnected ? (isBn ? 'সংযুক্ত (Active)' : 'Connected') : (isBn ? 'বিচ্ছিন্ন (Disconnected)' : 'Disconnected')}
                </span>
              </div>
              <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5">
                {isConnected && status?.connectedEmail
                  ? status.connectedEmail
                  : (isBn ? 'কোনো ড্রাইভ অ্যাকাউন্ট সংযুক্ত নেই' : 'No account connected')}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isConnected ? (
              <>
                <PillButton
                  size="sm"
                  variant="secondary"
                  onClick={handleTestConnection}
                  disabled={actionLoading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  {isBn ? 'কানেকশন টেস্ট' : 'Test'}
                </PillButton>
                {isMasterAdmin && (
                  <PillButton
                    size="sm"
                    variant="danger"
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                  >
                    <Unlink className="w-3.5 h-3.5 mr-1.5" />
                    {isBn ? 'সংযোগ বিচ্ছিন্ন' : 'Disconnect'}
                  </PillButton>
                )}
              </>
            ) : (
              isMasterAdmin && (
                <PillButton
                  size="sm"
                  variant="primary"
                  onClick={handleConnect}
                  disabled={actionLoading}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  {isBn ? 'Google Drive সংযুক্ত করুন' : 'Connect Google Drive'}
                </PillButton>
              )
            )}
          </div>
        </div>

        {/* Credentials Configuration Form */}
        {showCredForm && (
          <form onSubmit={handleSaveCredentials} className="pt-4 border-t border-[var(--hyper-border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--hyper-text-primary)] flex items-center gap-1.5">
                <Key className="w-4 h-4 text-[#F28A24]" />
                {isBn ? 'Google Cloud OAuth ক্রেডেনশিয়াল সেটআপ' : 'Google Cloud OAuth Credentials Setup'}
              </span>
              <button
                type="button"
                onClick={() => setShowCredForm(false)}
                className="text-[11px] text-[var(--hyper-text-tertiary)] hover:text-[var(--hyper-text-primary)]"
              >
                {isBn ? 'লুকান' : 'Hide'}
              </button>
            </div>

            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              {isBn
                ? 'Google Cloud Console থেকে তৈরি করা Web Application Client ID এবং Client Secret এখানে পেস্ট করুন।'
                : 'Paste the Web Application Client ID and Client Secret created in Google Cloud Console.'}
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--hyper-text-primary)] mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="w-full h-9 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] px-3 text-xs font-mono text-[var(--hyper-text-primary)] focus:border-[#1685E8] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--hyper-text-primary)] mb-1">
                  Google Client Secret
                </label>
                <input
                  type="password"
                  value={clientSecretInput}
                  onChange={(e) => setClientSecretInput(e.target.value)}
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                  className="w-full h-9 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] px-3 text-xs font-mono text-[var(--hyper-text-primary)] focus:border-[#1685E8] outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <PillButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowCredForm(false)}
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </PillButton>
              <PillButton
                type="submit"
                size="sm"
                variant="primary"
                disabled={savingCreds}
              >
                {savingCreds ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'ক্রেডেনশিয়াল সেভ করুন' : 'Save Credentials')}
              </PillButton>
            </div>
          </form>
        )}

        {/* Connection Metadata Grid */}
        {isConnected && (
          <div className="pt-3 border-t border-[var(--hyper-border-subtle)] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[var(--hyper-text-tertiary)] block text-[11px]">
                {isBn ? 'সংযুক্তির তারিখ' : 'Connected On'}
              </span>
              <span className="font-semibold text-[var(--hyper-text-primary)] mt-0.5 block">
                {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[var(--hyper-text-tertiary)] block text-[11px]">
                {isBn ? 'সর্বশেষ যাচাই' : 'Last Checked'}
              </span>
              <span className="font-semibold text-[var(--hyper-text-primary)] mt-0.5 block">
                {status?.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[var(--hyper-text-tertiary)] block text-[11px]">
                {isBn ? 'স্বয়ংক্রিয় ফোল্ডার' : 'Active Folders'}
              </span>
              <span className="font-semibold text-[#1685E8] mt-0.5 block">
                {status?.folderCount || 13} {isBn ? 'টি ক্যাটাগরি' : 'Categories'}
              </span>
            </div>
          </div>
        )}
      </HyperCard>

      {/* Automatic Folder Hierarchy Overview */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--hyper-text-secondary)] flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-[#1685E8]" />
          {isBn ? 'Google Drive ফোল্ডার স্ট্রাকচার' : 'Google Drive Folder Hierarchy'}
        </h3>

        <HyperCard variant="default" glass className="p-4 space-y-3 text-xs">
          <p className="text-[var(--hyper-text-secondary)] text-[11px]">
            {isBn
              ? 'সংযোগ সম্পন্ন হওয়ার সাথে সাথে আপনার গুগল ড্রাইভে স্বয়ংক্রিয়ভাবে এই সুসংগঠিত ফোল্ডার তালিকা তৈরি হয়। কোনো পাবলিক শেয়ারিং লিংক তৈরি হয় না।'
              : 'The following private folder structure is automatically created on your Drive upon connection. Public sharing is strictly disabled.'}
          </p>

          <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 space-y-2 font-mono text-[11px]">
            <div className="flex items-center gap-2 font-bold text-[var(--hyper-text-primary)]">
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Anwar Bhuiyan Property Manager/</span>
            </div>

            <div className="pl-6 space-y-1.5 text-[var(--hyper-text-secondary)]">
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>1. Tenants/</span>
                <span className="text-[10px] text-[var(--hyper-text-tertiary)] font-sans">(NID, Tenant Photos, Documents)</span>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>2. Agreements/</span>
                <span className="text-[10px] text-[var(--hyper-text-tertiary)] font-sans">(Rental Agreements, Renewals)</span>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>3. Financial Records/</span>
                <span className="text-[10px] text-[var(--hyper-text-tertiary)] font-sans">(Rent Receipts, Expense Invoices, Payment Proofs)</span>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>4. Properties/</span>
                <span className="text-[10px] text-[var(--hyper-text-tertiary)] font-sans">(Property Documents, Maintenance Photos)</span>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>5. Reports/</span>
                <span className="text-[10px] text-[var(--hyper-text-tertiary)] font-sans">(Monthly Reports, Yearly Reports, Tax Summaries)</span>
              </div>
            </div>
          </div>
        </HyperCard>
      </div>

      {/* Security & Privacy Invariants */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--hyper-text-secondary)] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#22B84A]" />
          {isBn ? 'নিরাপত্তা ও প্রাইভেসি নিয়ন্ত্রণ' : 'Security & Privacy Controls'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <HyperCard variant="default" glass className="p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[var(--hyper-text-primary)]">
              <CheckCircle2 className="w-4 h-4 text-[#22B84A]" />
              {isBn ? 'AES-256-GCM এনক্রিপশন' : 'AES-256-GCM Encryption'}
            </div>
            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              {isBn
                ? 'গুগল রিফ্রেশ টোকেন সার্ভার-সাইড হার্ডেনড এনক্রিপশন কিতে সংরক্ষিত। কখনো প্লেইনটেক্সট বা ব্রাউজারে উন্মুক্ত হয় না।'
                : 'Refresh tokens are encrypted at rest with AES-256-GCM Web Crypto. Never exposed to browser or mobile client.'}
            </p>
          </HyperCard>

          <HyperCard variant="default" glass className="p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[var(--hyper-text-primary)]">
              <CheckCircle2 className="w-4 h-4 text-[#22B84A]" />
              {isBn ? 'drive.file ন্যূনতম পারমিশন' : 'Minimal drive.file Scope'}
            </div>
            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              {isBn
                ? 'অ্যাপ্লিকেশন শুধুমাত্র নিজের তৈরি ফাইল অ্যাক্সেস করতে পারে। আপনার ব্যক্তিগত অন্যান্য ফাইলে কোনো অ্যাক্সেস নেই।'
                : 'The application only accesses files created by this property manager, completely isolated from your personal files.'}
            </p>
          </HyperCard>
        </div>
      </div>
    </div>
  );
};
