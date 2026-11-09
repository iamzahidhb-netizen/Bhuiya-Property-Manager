import React, { useState, useRef } from 'react';
import {
  UserRound,
  Building,
  LogOut,
  CheckCircle2,
  Camera,
  Check,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getUserDisplayName } from '../../utils/dhakaDate';
import { processProfileImage } from '../../utils/imageUtils';
import { ProfilePhotoModal } from '../profile/ProfilePhotoModal';

export const ProfileAccountSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user, logout, photoURL, updatePhotoURL } = useAuth();
  const { workspaceId, role, isMasterAdmin } = useWorkspace();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const displayName = getUserDisplayName(user?.displayName, user?.email);

  // Photo management
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
      alert(isBn ? 'ছবি প্রক্রিয়া করতে সমস্যা হয়েছে।' : 'Failed to process image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSavePhoto = async (photoDataUrl: string) => {
    await updatePhotoURL(photoDataUrl);
    setPhotoToast(isBn ? 'প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে!' : 'Profile photo updated successfully!');
    setTimeout(() => setPhotoToast(null), 3000);
  };

  const handleRemovePhoto = async () => {
    await updatePhotoURL(null);
    setPhotoToast(isBn ? 'প্রোফাইল ছবি সরানো হয়েছে!' : 'Profile photo removed!');
    setTimeout(() => setPhotoToast(null), 3000);
  };

  async function handleLogout() {
    if (window.confirm(isBn ? 'আপনি কি লগআউট করতে চান?' : 'Are you sure you want to sign out?')) {
      setIsLoggingOut(true);
      try {
        await logout();
      } catch (err) {
        console.error('Logout failed:', err);
        setIsLoggingOut(false);
      }
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'প্রোফাইল ও অ্যাকাউন্ট' : 'Profile & Account'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'ব্যবহারকারীর তথ্য, ওয়ার্কস্পেস পরিচয় এবং লগআউট' : 'User credentials, workspace identity and session'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* User Hero Card */}
      <HyperCard variant="default" className="p-4 sm:p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
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
              className="w-14 h-14 rounded-[22px] overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-emerald-600/20 border-2 border-white/80 dark:border-white/10 cursor-pointer active:scale-95 transition-transform"
              title={isBn ? 'ছবি পরিবর্তন করুন' : 'Change Photo'}
            >
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <UserRound className="w-7 h-7 text-white" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={isBn ? 'ছবি পরিবর্তন করুন' : 'Change Photo'}
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#202023] transition-transform active:scale-90 cursor-pointer"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <div className="min-w-0">
            <h4 className="text-base font-bold text-[var(--hyper-text-primary)] truncate">
              {displayName}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)] truncate">
              {user?.email || 'admin@bhuiyan.com'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isMasterAdmin
                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                    : role === 'manager'
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    : 'bg-black/5 dark:bg-white/10 text-[var(--hyper-text-secondary)] border-transparent'
                }`}
              >
                {isMasterAdmin
                  ? 'Master Admin'
                  : role === 'manager'
                  ? 'Manager'
                  : 'Viewer'}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[#22B84A] font-semibold">
                <CheckCircle2 className="w-3 h-3 text-[#22B84A]" />
                <span>{isBn ? 'সক্রিয় সেশন' : 'Active'}</span>
              </span>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </HyperCard>

      {/* Identity & Workspace Details */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-8 h-8 rounded-[12px] bg-blue-500/10 flex items-center justify-center shrink-0">
            <Building className="w-4 h-4 text-[#1685E8]" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-[var(--hyper-text-primary)] uppercase tracking-wider">
              {isBn ? 'সক্রিয় ওয়ার্কস্পেস তথ্য' : 'Active Workspace Identity'}
            </h5>
            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              Anwar Bhuiyan Property Ledger Partition
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-[16px] bg-black/5 dark:bg-white/5 flex items-center justify-between">
            <span className="text-[var(--hyper-text-secondary)] font-medium">Workspace ID</span>
            <span className="font-mono font-bold text-[var(--hyper-text-primary)]">
              {workspaceId || 'anwar-bhuiyan-main'}
            </span>
          </div>

          <div className="p-3 rounded-[16px] bg-black/5 dark:bg-white/5 flex items-center justify-between">
            <span className="text-[var(--hyper-text-secondary)] font-medium">User UID</span>
            <span className="font-mono font-bold text-[var(--hyper-text-primary)] truncate max-w-[200px]">
              {user?.uid || 'usr_master_admin_001'}
            </span>
          </div>

          <div className="p-3 rounded-[16px] bg-black/5 dark:bg-white/5 flex items-center justify-between">
            <span className="text-[var(--hyper-text-secondary)] font-medium">Auth Provider</span>
            <span className="font-bold text-[var(--hyper-text-primary)]">Firebase Authentication</span>
          </div>
        </div>
      </HyperCard>

      {/* Sign Out Card */}
      <div className="p-4 rounded-[22px] bg-red-500/5 border border-red-500/20 flex items-center justify-between gap-3">
        <div>
          <h5 className="text-xs font-bold text-red-600">
            {isBn ? 'অ্যাকাউন্ট থেকে লগআউট' : 'Sign Out of Account'}
          </h5>
          <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
            {isBn ? 'বর্তমান অধিবেশন বন্ধ করে লগইন স্ক্রিনে ফিরে যান।' : 'End active session and return to login screen.'}
          </p>
        </div>
        <PillButton
          variant="secondary"
          size="sm"
          disabled={isLoggingOut}
          onClick={handleLogout}
          className="border-red-500/30 text-red-600 hover:bg-red-500/10 shrink-0 flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isBn ? 'লগআউট' : 'Sign Out'}</span>
        </PillButton>
      </div>

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
};
