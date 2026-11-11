import { useState, useEffect } from 'react';
import type {
  WorkspaceMemberItem,
  UserRole,
  MemberStatus,
} from '../../types/userManagement';
import {
  PERMISSION_MODULES,
  ROLE_PRESET_CONFIGS,
} from '../../types/userManagement';
import {
  listWorkspaceMembers,
  createWorkspaceMember,
  updateWorkspaceMemberPermissions,
  updateWorkspaceMemberStatus,
  sendWorkspaceMemberPasswordReset,
} from '../../services/userManagementService';
import { ApiClientError } from '../../lib/apiClient';
import { LiquidGlass } from '../ui/LiquidGlass';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Users,
  UserRound,
  RotateCw,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  X,
  KeyRound,
  Settings,
  Mail,
  Trash2,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { StatusBadge } from '../ui/hyperos/StatusBadge';

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdminUid: string;
}

export function MemberManagementModal({
  isOpen,
  onClose,
  currentAdminUid,
}: MemberManagementModalProps) {
  const { currentLanguage, t } = useLanguage();
  // Members state
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sub-modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editPermsModalOpen, setEditPermsModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [revokeConfirmModalOpen, setRevokeConfirmModalOpen] = useState(false);
  const [resetResultModalOpen, setResetResultModalOpen] = useState(false);
  const [resetResultInfo, setResetResultInfo] = useState<{ email: string; link?: string | null } | null>(null);

  // Selected member for editing/status/revoke
  const [selectedMember, setSelectedMember] = useState<WorkspaceMemberItem | null>(null);

  // Form states for Add Member
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<'manager' | 'viewer' | 'custom'>('viewer');
  const [addPermissions, setAddPermissions] = useState<Record<string, boolean>>(
    ROLE_PRESET_CONFIGS.viewer.permissions
  );
  const [existingAccountConfirm, setExistingAccountConfirm] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Form states for Edit Permissions
  const [editRole, setEditRole] = useState<'manager' | 'viewer' | 'custom'>('custom');
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [submittingPerms, setSubmittingPerms] = useState(false);

  // Form states for Status Change
  const [newStatus, setNewStatus] = useState<MemberStatus>('active');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Fetch members on open
  useEffect(() => {
    if (!isOpen) return;
    loadMembers();
  }, [isOpen]);

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const data = await listWorkspaceMembers();
      setMembers([...new Map(data.map((member) => [member.uid, member])).values()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'সদস্য তালিকা লোড করতে সমস্যা হয়েছে';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Auto-clear success message after 4s
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Handle Preset Selection for Add Form
  function handleAddRoleChange(role: 'manager' | 'viewer' | 'custom') {
    setAddRole(role);
    if (role === 'manager') {
      setAddPermissions({ ...ROLE_PRESET_CONFIGS.manager.permissions });
    } else if (role === 'viewer') {
      setAddPermissions({ ...ROLE_PRESET_CONFIGS.viewer.permissions });
    }
  }

  // Handle Preset Selection for Edit Form
  function handleEditRoleChange(role: 'manager' | 'viewer' | 'custom') {
    setEditRole(role);
    if (role === 'manager') {
      setEditPermissions({ ...ROLE_PRESET_CONFIGS.manager.permissions });
    } else if (role === 'viewer') {
      setEditPermissions({ ...ROLE_PRESET_CONFIGS.viewer.permissions });
    }
  }

  // Toggle single permission for Add Form with view dependency cascade
  function toggleAddPermission(key: string, isViewKey = false, parentViewKey?: string) {
    setAddPermissions((prev) => {
      const updated = { ...prev };
      const currentVal = Boolean(updated[key]);
      const nextVal = !currentVal;
      updated[key] = nextVal;

      // If view key turned OFF, turn OFF all dependent child keys in this module
      if (isViewKey && !nextVal) {
        const mod = PERMISSION_MODULES.find((m) => m.viewKey === key);
        if (mod) {
          mod.permissions.forEach((p) => {
            if (p.key !== key) updated[p.key] = false;
          });
        }
      }

      // If a child action is turned ON, automatically turn ON the parent view key
      if (!isViewKey && nextVal && parentViewKey) {
        updated[parentViewKey] = true;
      }

      return updated;
    });

    if (addRole !== 'custom') {
      setAddRole('custom');
    }
  }

  // Toggle single permission for Edit Form with view dependency cascade
  function toggleEditPermission(key: string, isViewKey = false, parentViewKey?: string) {
    setEditPermissions((prev) => {
      const updated = { ...prev };
      const currentVal = Boolean(updated[key]);
      const nextVal = !currentVal;
      updated[key] = nextVal;

      // If view key turned OFF, turn OFF all dependent child keys in this module
      if (isViewKey && !nextVal) {
        const mod = PERMISSION_MODULES.find((m) => m.viewKey === key);
        if (mod) {
          mod.permissions.forEach((p) => {
            if (p.key !== key) updated[p.key] = false;
          });
        }
      }

      // If a child action is turned ON, automatically turn ON the parent view key
      if (!isViewKey && nextVal && parentViewKey) {
        updated[parentViewKey] = true;
      }

      return updated;
    });

    if (editRole !== 'custom') {
      setEditRole('custom');
    }
  }

  // Select all permissions helper
  function selectAllPermissions(isEdit = false) {
    const allTrue: Record<string, boolean> = {};
    PERMISSION_MODULES.forEach((mod) => {
      mod.permissions.forEach((p) => {
        allTrue[p.key] = true;
      });
    });
    if (isEdit) {
      setEditPermissions(allTrue);
      setEditRole('custom');
    } else {
      setAddPermissions(allTrue);
      setAddRole('custom');
    }
  }

  // Clear all permissions helper
  function clearAllPermissions(isEdit = false) {
    const allFalse: Record<string, boolean> = {};
    PERMISSION_MODULES.forEach((mod) => {
      mod.permissions.forEach((p) => {
        allFalse[p.key] = false;
      });
    });
    if (isEdit) {
      setEditPermissions(allFalse);
      setEditRole('custom');
    } else {
      setAddPermissions(allFalse);
      setAddRole('custom');
    }
  }

  function closeAddModal() {
    setAddModalOpen(false);
    setAddPassword('');
    setExistingAccountConfirm(false);
  }

  // Submit Add Member
  async function handleCreateMember(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!addEmail.trim()) {
      setError('অনুগ্রহ করে সঠিক ইমেইল ঠিকানা দিন');
      return;
    }

    setSubmittingAdd(true);
    setError(null);

    try {
      const res = await createWorkspaceMember({
        email: addEmail.trim(),
        displayName: addName.trim() || addEmail.trim().split('@')[0],
        role: addRole,
        password: addPassword || undefined,
        mobile: addPhone.trim() || undefined,
        permissions: addPermissions,
        confirmExistingLink: existingAccountConfirm,
      });

      if (res.requireConfirmation) {
        setExistingAccountConfirm(true);
        setError(
          'এই ইমেইলটি ইতোমধ্যে সিস্টেমে নিবন্ধিত। আপনি কি এই অ্যাকাউন্টকে আপনার ওয়ার্কস্পেসে যুক্ত করতে চান? নিশ্চিত করতে আবার সাবমিট বাটনে চাপ দিন।'
        );
        setSubmittingAdd(false);
        return;
      }

      setSuccessMessage(
        res.isNewAccount
          ? `সদস্য "${addName || addEmail}" সফলভাবে যুক্ত করা হয়েছে!`
          : `বিদ্যমান অ্যাকাউন্ট "${addEmail}" সফলভাবে ওয়ার্কস্পেসে সংযুক্ত করা হয়েছে!`
      );

      // Reset and close
      setAddModalOpen(false);
      setAddName('');
      setAddEmail('');
      setAddPhone('');
      setAddPassword('');
      setAddRole('viewer');
      setAddPermissions(ROLE_PRESET_CONFIGS.viewer.permissions);
      setExistingAccountConfirm(false);

      // Refresh list
      loadMembers();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'ALREADY_EXISTS') {
        if (err.message.includes('already a member')) {
          setError('এই সদস্য ইতোমধ্যে আপনার ওয়ার্কস্পেসে যুক্ত আছেন!');
        } else {
          setExistingAccountConfirm(true);
          setError(
            'এই ইমেইলটি ইতোমধ্যে সিস্টেমে নিবন্ধিত। আপনি কি এই অ্যাকাউন্টকে আপনার ওয়ার্কস্পেসে যুক্ত করতে চান?'
          );
        }
      } else {
        const msg = err instanceof Error ? err.message : 'সদস্য যোগ করতে ব্যর্থ হয়েছে';
        setError(msg);
      }
    } finally {
      setSubmittingAdd(false);
    }
  }

  // Open Edit Permissions Submodal
  function openEditPermissions(member: WorkspaceMemberItem) {
    setSelectedMember(member);
    const role = (['manager', 'viewer', 'custom'].includes(member.role)
      ? member.role
      : 'custom') as 'manager' | 'viewer' | 'custom';
    setEditRole(role);
    setEditPermissions(member.permissions || {});
    setEditPermsModalOpen(true);
  }

  // Save Updated Permissions
  async function handleSavePermissions(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;

    setSubmittingPerms(true);
    setError(null);

    try {
      await updateWorkspaceMemberPermissions({
        targetUid: selectedMember.uid,
        role: editRole,
        permissions: editPermissions,
      });

      setSuccessMessage(`সদস্য "${selectedMember.displayName}" এর পারমিশন সফলভাবে আপডেট হয়েছে!`);
      setEditPermsModalOpen(false);
      setSelectedMember(null);
      loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'পারমিশন আপডেট করতে ব্যর্থ হয়েছে';
      setError(msg);
    } finally {
      setSubmittingPerms(false);
    }
  }

  // Open Status Submodal
  function openStatusModal(member: WorkspaceMemberItem) {
    setSelectedMember(member);
    setNewStatus(member.status);
    setStatusModalOpen(true);
  }

  // Save Status Change
  async function handleSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;

    setSubmittingStatus(true);
    setError(null);

    try {
      await updateWorkspaceMemberStatus({
        targetUid: selectedMember.uid,
        status: newStatus,
      });

      setSuccessMessage(`সদস্যের স্ট্যাটাস সফলভাবে পরিবর্তিত হয়েছে: ${getStatusLabel(newStatus)}`);
      setStatusModalOpen(false);
      setSelectedMember(null);
      loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'স্ট্যাটাস পরিবর্তন করতে ব্যর্থ হয়েছে';
      setError(msg);
    } finally {
      setSubmittingStatus(false);
    }
  }

  // Trigger Revoke Access
  async function handleConfirmRevoke() {
    if (!selectedMember) return;

    setSubmittingStatus(true);
    setError(null);

    try {
      await updateWorkspaceMemberStatus({
        targetUid: selectedMember.uid,
        status: 'revoked',
      });

      setSuccessMessage(`সদস্য "${selectedMember.displayName}" এর ওয়ার্কস্পেস এক্সেস বাতিল করা হয়েছে।`);
      setRevokeConfirmModalOpen(false);
      setSelectedMember(null);
      loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'অ্যাক্সেস বাতিল করতে ব্যর্থ হয়েছে';
      setError(msg);
    } finally {
      setSubmittingStatus(false);
    }
  }

  // Trigger Password Reset
  async function handleSendPasswordReset(member: WorkspaceMemberItem) {
    setError(null);
    try {
      const res = await sendWorkspaceMemberPasswordReset({
        targetUid: member.uid,
        email: member.email,
      });

      setResetResultInfo({
        email: member.email,
        link: res.resetLink || null,
      });
      setResetResultModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'পাসওয়ার্ড রিসেট লিংক পাঠাতে সমস্যা হয়েছে';
      setError(msg);
    }
  }

  // Helper Labels & Styles
  function getRoleBadge(role: UserRole) {
    switch (role) {
      case 'master_admin':
        return (
          <StatusBadge tone="success">
            মাস্টার অ্যাডমিন
          </StatusBadge>
        );
      case 'manager':
        return (
          <StatusBadge tone="success">
            ম্যানেজার
          </StatusBadge>
        );
      case 'viewer':
        return (
          <StatusBadge tone="neutral">
            দর্শক
          </StatusBadge>
        );
      case 'custom':
        return (
          <StatusBadge tone="warning">
            কাস্টম পারমিশন
          </StatusBadge>
        );
    }
  }

  function getStatusBadge(status: MemberStatus) {
    switch (status) {
      case 'active':
        return (
          <StatusBadge tone="success">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            সক্রিয়
          </StatusBadge>
        );
      case 'suspended':
        return (
          <StatusBadge tone="danger">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            স্থগিত
          </StatusBadge>
        );
      case 'inactive':
      default:
        return (
          <StatusBadge tone="neutral">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            নিষ্ক্রিয়
          </StatusBadge>
        );
    }
  }

  function getStatusLabel(status: MemberStatus): string {
    switch (status) {
      case 'active':
        return 'সক্রিয় (Active)';
      case 'suspended':
        return 'স্থগিত (Suspended)';
      case 'inactive':
        return 'নিষ্ক্রিয় (Inactive)';
      case 'revoked':
        return 'বাতিল (Revoked)';
    }
  }

  // Count active modules granted for summary
  function getActiveModulesCount(perms: Record<string, boolean> = {}): number {
    let count = 0;
    PERMISSION_MODULES.forEach((mod) => {
      const hasAny = mod.permissions.some((p) => Boolean(perms[p.key]));
      if (hasAny) count++;
    });
    return count;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-4xl bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/80 my-auto overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t('memberManagement.modalTitle')}</h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                {t('memberManagement.modalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition text-lg cursor-pointer"
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar & Notifications */}
        <div className="px-6 py-4 bg-white/70 backdrop-blur-xs border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{t('memberManagement.totalMembers')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
              {members.length} {currentLanguage === 'bn' ? 'জন' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadMembers}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-700 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('memberManagement.refresh')}</span>
            </button>
            <button
              onClick={() => {
                setAddModalOpen(true);
                setExistingAccountConfirm(false);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-700/20 border border-white/20 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-white" />
              <span>{t('memberManagement.addNewMember')}</span>
            </button>
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-red-50/90 backdrop-blur-xs border border-red-200 text-red-700 text-xs flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800 font-bold ml-2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-50/90 backdrop-blur-xs border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Member Cards List (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading && members.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="w-8 h-8 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">সদস্য তালিকা লোড হচ্ছে...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-white/60 backdrop-blur-xs rounded-2xl border border-dashed border-slate-300">
              <Users className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-base font-semibold">কোনো ডেটা নেই</p>
              <button
                onClick={() => setAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                প্রথম সদস্য যুক্ত করুন
              </button>
            </div>
          ) : (
            members.map((member) => {
              const isSelf = member.uid === currentAdminUid;
              const isMaster = member.role === 'master_admin';
              const activeModCount = getActiveModulesCount(member.permissions);

              return (
                <LiquidGlass
                  key={member.id || member.uid}
                  data-member-email={member.email}
                  className={`p-5 rounded-3xl border transition flex flex-col justify-between space-y-3 ${
                    isMaster
                      ? 'bg-emerald-50/40 border-emerald-300/80 shadow-xs'
                      : 'border-white/80 hover:border-emerald-400/80 shadow-2xs'
                  }`}
                  scale={-85}
                  chroma={4}
                  blur={4}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* User Info */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${
                          isMaster
                            ? 'bg-[#22B84A] text-white shadow-sm shadow-[#22B84A]/30'
                            : member.role === 'manager'
                            ? 'bg-[#22B84A] text-white shadow-sm shadow-[#22B84A]/30'
                            : 'bg-slate-700 text-white shadow-sm shadow-slate-700/30'
                        }`}
                      >
                        {member.displayName ? member.displayName.charAt(0).toUpperCase() : <UserRound className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-base">
                            {member.displayName || 'নামহীন সদস্য'}
                          </h3>
                          {getRoleBadge(member.role)}
                          {getStatusBadge(member.status)}
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              (আপনি)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="font-mono">{member.email}</span>
                          {member.mobile && <span>• 📱 {member.mobile}</span>}
                          <span className="text-slate-400 font-mono text-[11px]">
                            UID: {member.uid.slice(0, 10)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 sm:self-center shrink-0">
                      {isMaster ? (
                        <StatusBadge tone="success" className="rounded-xl py-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{t('memberManagement.protectedAdmin')}</span>
                        </StatusBadge>
                      ) : (
                        <>
                          <button
                            data-action="edit-perms"
                            onClick={() => openEditPermissions(member)}
                            className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-emerald-800" />
                            <span>{t('memberManagement.editPermissions')}</span>
                          </button>
                          <button
                            data-action="change-status"
                            onClick={() => openStatusModal(member)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5 text-slate-600" />
                            <span>স্ট্যাটাস</span>
                          </button>
                          <button
                            data-action="reset-password"
                            onClick={() => handleSendPasswordReset(member)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                            title={t('memberManagement.resetPassword')}
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-600" />
                            <span>পাসওয়ার্ড</span>
                          </button>
                          <button
                            data-action="revoke-access"
                            onClick={() => {
                              setSelectedMember(member);
                              setRevokeConfirmModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                            title={t('memberManagement.revokeAccess')}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>{t('memberManagement.revokeAccess')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Permissions Summary Row */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">অনুমোদিত মডিউল:</span>
                      {isMaster ? (
                        <span className="text-emerald-700 font-medium">সকল মডিউলে সর্বময় নিয়ন্ত্রণ (Full Admin)</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">
                          {activeModCount}টি মডিউলের অ্যাক্সেস রয়েছে
                        </span>
                      )}
                    </div>

                    {!isMaster && (
                      <div className="flex flex-wrap gap-1">
                        {PERMISSION_MODULES.filter((mod) => mod.permissions.some((p) => member.permissions?.[p.key])).map(
                          (m) => (
                            <span
                              key={m.id}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700"
                            >
                              {m.icon} {m.titleBangla.split(' ')[0]}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </LiquidGlass>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/70 backdrop-blur-xs border-t border-slate-200/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-MODAL 1: ADD NEW MEMBER                                              */}
      {/* ========================================================================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/80 overflow-hidden my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold">{t('memberManagement.addMemberDialogTitle')}</h3>
              </div>
              <button
                onClick={closeAddModal}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Existing Account Prompt Notification */}
              {existingAccountConfirm && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>বিদ্যমান ফায়ারবেস অ্যাকাউন্ট সনাক্ত হয়েছে</span>
                  </div>
                  <p>
                    ইমেইল <strong>{addEmail}</strong> দিয়ে ইতোমধ্যে ফায়ারবেস অথেনটিকেশনে একটি অ্যাকাউন্ট রয়েছে।
                    ওয়ার্কস্পেস সদস্য হিসেবে যুক্ত করতে চাইলে নিচে নিশ্চিত করুন:
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-800 pt-1">
                    <input
                      type="checkbox"
                      checked={existingAccountConfirm}
                      onChange={(e) => setExistingAccountConfirm(e.target.checked)}
                      className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>হ্যাঁ, এই বিদ্যমান অ্যাকাউন্টকে পারিবারিক ওয়ার্কস্পেসে যুক্ত করুন</span>
                  </label>
                </div>
              )}

              {/* Name & Email Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    সদস্যের নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="উদাঃ কামাল ভূঁইয়া"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ইমেইল ঠিকানা <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="kamal@bhuiyan.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Mobile & Initial Password Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    নতুন অ্যাকাউন্টের পাসওয়ার্ড
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="নতুন অ্যাকাউন্ট হলে কমপক্ষে ৬ অক্ষর"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    আগে থেকে অ্যাকাউন্ট থাকলে পাসওয়ার্ড ফাঁকা রাখুন।
                  </p>
                </div>
              </div>

              {/* Role Preset Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ভূমিকা নির্বাচন করুন (Role Preset)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['viewer', 'manager', 'custom'] as const).map((r) => {
                    const isSelected = addRole === r;
                    const label =
                      r === 'viewer'
                        ? 'দর্শক (Viewer)'
                        : r === 'manager'
                        ? 'ম্যানেজার (Manager)'
                        : 'কাস্টম (Custom)';
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleAddRoleChange(r)}
                        className={`p-3 rounded-2xl border text-left transition ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs">{label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                          {r === 'viewer'
                            ? 'শুধুমাত্র দেখার অনুমতি'
                            : r === 'manager'
                            ? 'দৈনন্দিন অপারেশন'
                            : 'সুনির্দিষ্ট মডিউল নির্বাচন'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Permissions Section */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">সুনির্দিষ্ট মডিউল পারমিশন ক্যাটালগ</h4>
                    <p className="text-[11px] text-slate-500">
                      মডিউলের ভিউ পারমিশন বন্ধ থাকলে অধীনস্থ কোনো একশন কার্যকর হবে না
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectAllPermissions(false)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                    >
                      সব নির্বাচন
                    </button>
                    <button
                      type="button"
                      onClick={() => clearAllPermissions(false)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                    >
                      সব মুছুন
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {PERMISSION_MODULES.map((mod) => {
                    const isModuleViewActive = Boolean(addPermissions[mod.viewKey]);

                    return (
                      <div key={mod.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{mod.icon}</span> <span>{mod.titleBangla}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {mod.permissions.map((p) => {
                            const isChecked = Boolean(addPermissions[p.key]);
                            const isChild = !p.isViewKey;
                            const isChildDisabled = isChild && !isModuleViewActive;

                            return (
                              <label
                                key={p.key}
                                className={`flex items-start gap-2 p-2 rounded-lg text-xs cursor-pointer border transition ${
                                  isChildDisabled
                                    ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                                    : isChecked
                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isChildDisabled}
                                  checked={isChecked}
                                  onChange={() => toggleAddPermission(p.key, p.isViewKey, p.parentViewKey)}
                                  className="w-4 h-4 mt-0.5 rounded-sm text-emerald-600 focus:ring-emerald-500 shrink-0"
                                />
                                <div>
                                  <div className="leading-tight">{p.labelBangla}</div>
                                  <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                    {p.descriptionBangla}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-700/20 disabled:opacity-50"
                >
                  {submittingAdd ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>যুক্ত হচ্ছে...</span>
                    </>
                  ) : (
                    <span>সদস্য যুক্ত করুন</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 2: EDIT PERMISSIONS                                            */}
      {/* ========================================================================= */}
      {editPermsModalOpen && selectedMember && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/80 overflow-hidden my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">অনুমতি ও ভূমিকা পরিবর্তন</h3>
                  <p className="text-xs text-emerald-100">
                    {selectedMember.displayName} ({selectedMember.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditPermsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePermissions} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Role Preset Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ভূমিকা নির্বাচন করুন (Role Preset)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['viewer', 'manager', 'custom'] as const).map((r) => {
                    const isSelected = editRole === r;
                    const label =
                      r === 'viewer'
                        ? 'দর্শক (Viewer)'
                        : r === 'manager'
                        ? 'ম্যানেজার (Manager)'
                        : 'কাস্টম (Custom)';
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleEditRoleChange(r)}
                        className={`p-3 rounded-2xl border text-left transition ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs">{label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Permissions Section */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900">সুনির্দিষ্ট পারমিশন সেটিংস</h4>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectAllPermissions(true)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                    >
                      সব নির্বাচন
                    </button>
                    <button
                      type="button"
                      onClick={() => clearAllPermissions(true)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                    >
                      সব মুছুন
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {PERMISSION_MODULES.map((mod) => {
                    const isModuleViewActive = Boolean(editPermissions[mod.viewKey]);

                    return (
                      <div key={mod.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{mod.icon}</span> <span>{mod.titleBangla}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {mod.permissions.map((p) => {
                            const isChecked = Boolean(editPermissions[p.key]);
                            const isChild = !p.isViewKey;
                            const isChildDisabled = isChild && !isModuleViewActive;

                            return (
                              <label
                                key={p.key}
                                className={`flex items-start gap-2 p-2 rounded-lg text-xs cursor-pointer border transition ${
                                  isChildDisabled
                                    ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                                    : isChecked
                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isChildDisabled}
                                  checked={isChecked}
                                  onChange={() => toggleEditPermission(p.key, p.isViewKey, p.parentViewKey)}
                                  className="w-4 h-4 mt-0.5 rounded-sm text-emerald-600 focus:ring-emerald-500 shrink-0"
                                />
                                <div>
                                  <div className="leading-tight">{p.labelBangla}</div>
                                  <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                    {p.descriptionBangla}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditPermsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingPerms}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-700/20 disabled:opacity-50"
                >
                  {submittingPerms ? 'সংরক্ষণ হচ্ছে...' : 'অনুমতি সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 3: STATUS CHANGE                                               */}
      {/* ========================================================================= */}
      {statusModalOpen && selectedMember && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/80 overflow-hidden my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">সদস্যের স্ট্যাটাস পরিবর্তন</h3>
              </div>
              <button
                onClick={() => setStatusModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                সদস্য: <strong>{selectedMember.displayName}</strong> ({selectedMember.email})
              </p>

              <div className="space-y-2 pt-2">
                {[
                  {
                    val: 'active',
                    label: 'সক্রিয় (Active)',
                    desc: 'সদস্য অ্যাকাউন্টে লগইন ও নির্ধারিত ক্ষমতায় কাজ করতে পারবেন',
                    color: 'text-emerald-700',
                  },
                  {
                    val: 'suspended',
                    label: 'স্থগিত (Suspended)',
                    desc: 'লগইন সীমাবদ্ধ থাকবে এবং অ্যাক্সেস নিষিদ্ধ স্ক্রিন দেখাবে',
                    color: 'text-rose-700',
                  },
                  {
                    val: 'inactive',
                    label: 'নিষ্ক্রিয় (Inactive)',
                    desc: 'অ্যাকাউন্ট সাময়িকভাবে নিষ্ক্রিয় রাখা হবে',
                    color: 'text-slate-700',
                  },
                ].map((s) => (
                  <label
                    key={s.val}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      newStatus === s.val
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-2xs'
                        : 'border-white/80 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={s.val}
                      checked={newStatus === s.val}
                      onChange={() => setNewStatus(s.val as MemberStatus)}
                      className="w-4 h-4 mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className={`font-bold text-xs ${s.color}`}>{s.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingStatus}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-emerald-700/20 border border-white/20 cursor-pointer"
                >
                  {submittingStatus ? 'পরিবর্তন হচ্ছে...' : 'স্ট্যাটাস আপডেট করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 4: CONFIRM REVOKE ACCESS                                        */}
      {/* ========================================================================= */}
      {revokeConfirmModalOpen && selectedMember && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-red-200/80 overflow-hidden my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">ওয়ার্কস্পেস অ্যাক্সেস বাতিল</h3>
              </div>
              <button
                onClick={() => setRevokeConfirmModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                আপনি কি নিশ্চিত যে সদস্য <strong>{selectedMember.displayName}</strong> ({selectedMember.email}) এর
                পারিবারিক ওয়ার্কস্পেস অ্যাক্সেস পুরোপুরি বাতিল করতে চান?
              </p>
              <div className="p-3 bg-red-50/80 rounded-xl border border-red-100 text-[11px] text-red-700 shadow-2xs">
                📌 এই সদস্যের ওয়ার্কস্পেস মেম্বারশিপ ডকুমেন্ট মুছে ফেলা হবে। ফায়ারবেস অথ অ্যাকাউন্ট অপরিবর্তিত
                থাকবে। প্রয়োজনে পরবর্তীতে পুনরায় যুক্ত করা যাবে।
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokeConfirmModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  না, বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={submittingStatus}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-red-600/20 cursor-pointer"
                >
                  {submittingStatus ? 'বাতিল হচ্ছে...' : 'হ্যাঁ, অ্যাক্সেস বাতিল করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 5: PASSWORD RESET RESULT                                        */}
      {/* ========================================================================= */}
      {resetResultModalOpen && resetResultInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-emerald-200/80 overflow-hidden my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">পাসওয়ার্ড রিসেট লিংক তৈরি হয়েছে</h3>
              </div>
              <button
                onClick={() => setResetResultModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs cursor-pointer"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700">
                ইমেইল: <strong>{resetResultInfo.email}</strong>
              </p>
              <p className="text-xs text-slate-600">
                সদস্যের জন্য ফায়ারবেস পাসওয়ার্ড রিসেট সম্পন্ন হয়েছে। যদি সরাসরি লিংক প্রয়োজন হয়, তা নিচে দেওয়া হলো:
              </p>

              {resetResultInfo.link ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">পাসওয়ার্ড রিসেট লিংক:</div>
                  <input
                    type="text"
                    readOnly
                    value={resetResultInfo.link}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-emerald-800"
                  />
                  <button
                    onClick={() => {
                      if (resetResultInfo.link) {
                        navigator.clipboard.writeText(resetResultInfo.link);
                        setSuccessMessage('পাসওয়ার্ড রিসেট লিংক ক্লিপবোর্ডে কপি করা হয়েছে!');
                      }
                    }}
                    className="w-full py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{t('memberManagement.copyLink')}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  সদস্যের ইমেইলে পাসওয়ার্ড রিসেট নির্দেশিকা পাঠানো হয়েছে।
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setResetResultModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
