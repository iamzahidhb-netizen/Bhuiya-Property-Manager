import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSelector } from './common/LanguageSelector';
import { ShieldAlert, LogOut, RotateCw } from 'lucide-react';
import type { User } from 'firebase/auth';
import { UserUidDisplay } from './ui/hyperos/UserUidDisplay';
import { StatusBadge } from './ui/hyperos/StatusBadge';

interface AccessRestrictedScreenProps {
  user: User;
  error?: string | null;
  onRetry: () => void;
}

export default function AccessRestrictedScreen({
  user,
  error,
  onRetry,
}: AccessRestrictedScreenProps) {
  const { logout } = useAuth();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Sign out encountered error, forcing location reload:', err);
      window.location.reload();
    }
  };

  // Only display real errors that are not raw permission-denied or standard non-membership
  const displayError =
    error &&
    !error.includes('Missing or insufficient permissions') &&
    !error.includes('permission-denied') &&
    !error.includes('No workspace membership found')
      ? error
      : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/40 to-slate-100 p-4 relative">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200/30 rounded-full blur-3xl" />
      </div>

      {/* Top Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <LanguageSelector compact />
      </div>

      <div className="relative max-w-md w-full bg-white/95 backdrop-blur-xl rounded-3xl border border-emerald-100 shadow-xl shadow-emerald-950/5 p-6 sm:p-8 text-center space-y-6">
        {/* Brand identity badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          <img
            src="/brand/anwar-bhuiyan-property.svg"
            alt="Logo"
            className="w-4 h-4 object-contain"
          />
          <span>{t('app.title')}</span>
        </div>

        {/* Warning Icon */}
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-amber-50/60 shadow-xs">
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-800">{t('accessRestricted.title')}</h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            {t('accessRestricted.desc')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {t('accessRestricted.contactAdmin')}
          </p>
        </div>

        {/* Identity Details */}
        <div className="bg-slate-50 rounded-2xl p-3.5 text-left space-y-2 border border-slate-200/70 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-500">
            <span>Email:</span>
            <span className="font-semibold text-slate-800">{user.email?.split('@')[0] || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span>UID:</span>
            <UserUidDisplay uid={user.uid} className="max-w-[210px] text-slate-700" />
          </div>
          <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200/60 font-sans">
            <span>{t('common.status')}:</span>
            <StatusBadge tone="warning">
              {t('accessRestricted.nonMemberStatus')}
            </StatusBadge>
          </div>
          {displayError && (
            <div className="pt-1.5 text-[11px] text-amber-700 border-t border-slate-200">
              {displayError}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-white" />
            <span>{t('accessRestricted.switchAccount')}</span>
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="sm:w-auto py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCw className="w-4 h-4 text-slate-600" />
            <span>{t('accessRestricted.retry')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}