import React, { useEffect, useCallback } from 'react';
import { Camera, Check, X, RotateCcw, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppNavigation } from '../../contexts/NavigationContext';

export interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null;
  currentPhotoUrl: string | null;
  onSave: (photoDataUrl: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onPickAnother: () => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  previewUrl,
  currentPhotoUrl,
  onSave,
  onRemove,
  onPickAnother,
}) => {
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';
  const [saving, setSaving] = React.useState(false);

  // Back guard integration for Android Back gesture/button
  let registerBackGuard: ReturnType<typeof useAppNavigation>['registerBackGuard'] | undefined;
  try {
    const nav = useAppNavigation();
    registerBackGuard = nav.registerBackGuard;
  } catch {
    // NavContext optional
  }

  const handleClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  useEffect(() => {
    if (!isOpen || !registerBackGuard) return;
    const unregister = registerBackGuard({
      id: 'profile-photo-modal',
      isDirty: () => isOpen,
      onBlocked: () => {
        handleClose();
      },
    });
    return unregister;
  }, [isOpen, registerBackGuard, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const displayPhoto = previewUrl || currentPhotoUrl;

  const handleConfirmSave = async () => {
    if (!previewUrl) return;
    setSaving(true);
    try {
      await onSave(previewUrl);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemove = async () => {
    setSaving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-[28px] overflow-hidden flex flex-col p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200"
        style={{
          background: 'var(--hyper-glass-popup-bg, rgba(255, 255, 255, 0.85))',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid var(--hyper-glass-popup-border, rgba(255, 255, 255, 0.65))',
          boxShadow: 'var(--hyper-glass-popup-shadow, 0 20px 50px rgba(0, 0, 0, 0.3))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--hyper-text-primary)] leading-tight">
                {previewUrl
                  ? isBn
                    ? 'নতুন ছবি প্রিভিউ'
                    : 'Profile Photo Preview'
                  : isBn
                  ? 'প্রোফাইল ছবি'
                  : 'Profile Photo'}
              </h3>
              <p className="text-[10.5px] text-[var(--hyper-text-secondary)] leading-tight">
                {isBn ? 'আপনার প্রোফাইল ছবি কেমন দেখাবে' : 'How your avatar will appear'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] transition cursor-pointer select-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Photo Display Card */}
        <div className="flex flex-col items-center justify-center py-2 space-y-3">
          <div className="relative">
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[28px] overflow-hidden bg-slate-100 dark:bg-white/5 border-2 border-emerald-500/40 shadow-xl flex items-center justify-center">
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-[var(--hyper-text-tertiary)]" />
              )}
            </div>

            {/* Glowing Aura Ring */}
            <div className="absolute inset-0 rounded-[28px] ring-2 ring-emerald-500/30 pointer-events-none" />
          </div>

          <p className="text-[11px] text-[var(--hyper-text-secondary)] text-center max-w-[240px]">
            {isBn
              ? 'ছবিটি স্বয়ংক্রিয়ভাবে স্কয়ার ক্রপ ও অপ্টিমাইজ করা হয়েছে'
              : 'Auto-centered, square-cropped & high-definition optimized'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {previewUrl ? (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onPickAnother}
                disabled={saving}
                className="w-1/2 h-10 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--hyper-text-primary)] font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isBn ? 'অন্য ছবি' : 'Pick Another'}</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving}
                className="w-1/2 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'সংরক্ষণ করুন' : 'Save Photo')}</span>
              </button>
            </div>
          ) : (
            <div className="flex gap-2.5">
              {currentPhotoUrl && (
                <button
                  type="button"
                  onClick={handleConfirmRemove}
                  disabled={saving}
                  className="w-1/2 h-10 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ছবি মুছুন' : 'Remove Photo'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onPickAnother}
                disabled={saving}
                className={`${currentPhotoUrl ? 'w-1/2' : 'w-full'} h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isBn ? 'নতুন ছবি আপলোড' : 'Upload New'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
