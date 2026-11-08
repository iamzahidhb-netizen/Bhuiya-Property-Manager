import React from 'react';
import {
  Users,
  KeyRound,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface UserPermissionSettingsProps {
  onBack: () => void;
  onOpenMemberManagement?: () => void;
}

export const UserPermissionSettings: React.FC<UserPermissionSettingsProps> = ({
  onBack,
  onOpenMemberManagement,
}) => {
  const { currentLanguage } = useLanguage();
  const { isMasterAdmin, role } = useWorkspace();
  const isBn = currentLanguage === 'bn';

  const ROLES = [
    {
      role: 'master_admin',
      titleBn: 'মাস্টার অ্যাডমিন (Master Admin)',
      titleEn: 'Master Admin',
      descBn: 'সম্পূর্ণ সিস্টেম নিয়ন্ত্রণ, সদস্য অনুমোদন, সেটিংস ও খতিয়ান ব্যবস্থাপনা।',
      descEn: 'Full system control, member approval, settings, and full financial operations.',
      color: 'border-purple-500/30 bg-purple-500/10 text-purple-600',
      badge: isBn ? 'সর্বোচ্চ ক্ষমতা' : 'Full Access',
      capabilities: [
        isBn ? 'সদস্য অনুমোদন ও ভূমিকা পরিবর্তন' : 'Manage members & roles',
        isBn ? 'ভাড়া আদায় ও খরচ ভাউচার এন্ট্রি' : 'Full financial writes (rent & expense)',
        isBn ? 'সম্পূর্ণ অ্যাপ ও ড্যাশবোর্ড সেটিংস পরিবর্তন' : 'Full settings & app customization',
        isBn ? 'সম্পত্তি ও ফ্ল্যাট সংযোজন/পরিবর্তন' : 'Manage properties & units',
      ],
    },
    {
      role: 'manager',
      titleBn: 'ম্যানেজার (Manager)',
      titleEn: 'Property Manager',
      descBn: 'দৈনন্দিন প্রপার্টি পরিচালনা, ভাড়া সংগ্রহ ও খরচের ভাউচার তৈরি।',
      descEn: 'Day-to-day operations, rent collection & expense entries.',
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
      badge: isBn ? 'অপারেশনাল' : 'Operational',
      capabilities: [
        isBn ? 'ভাড়া আদায় ও রসিদ প্রদান' : 'Collect rent & issue receipts',
        isBn ? 'দৈনন্দিন ভবন খরচ লিপিবদ্ধকরণ' : 'Log daily building expenses',
        isBn ? 'ভাড়াটিয়া রেজিস্টার ও ইউনিট তথ্য দেখা' : 'View tenants and units',
        isBn ? 'সদস্য পরিবর্তন সংরক্ষিত (অনুমতি নেই)' : 'No member permission changes',
      ],
    },
    {
      role: 'viewer',
      titleBn: 'দর্শক (Viewer)',
      titleEn: 'Viewer / Family Member',
      descBn: 'শুধুমাত্র হিসাব ও প্রপার্টির রিপোর্ট দেখার অনুমতি (রিড-অনলি)।',
      descEn: 'Read-only access to financial reports, distribution, and properties.',
      color: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300',
      badge: isBn ? 'রিড-অনলি' : 'Read-Only',
      capabilities: [
        isBn ? 'আর্থিক বিবরণী ও খাতা পরিদর্শন' : 'View financial summaries & ledger',
        isBn ? 'পারিবারিক বণ্টন হিসাব দেখা' : 'Inspect family distributions',
        isBn ? 'কোনো প্রকার সম্পাদনা বা মোছার ক্ষমতা নেই' : 'No write or delete privileges',
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'ব্যবহারকারী ও অনুমতি সেটিংস' : 'Users & Permissions'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'ভূমিকা ভিত্তিক অনুমতি কাঠামো ও সদস্য ব্যবস্থাপনা' : 'Role-based access control (RBAC) & member roles'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* Member Management Action Card */}
      {isMasterAdmin && (
        <HyperCard variant="default" className="p-4 sm:p-5 border-purple-500/30 bg-purple-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'সদস্য অনুমোদন ও ভূমিকা নিয়ন্ত্রণ' : 'Manage Member Access'}
                </h4>
                <p className="text-xs text-[var(--hyper-text-secondary)]">
                  {isBn ? 'নতুন সদস্যদের অনুমতি দিন বা ভূমিকা পরিবর্তন করুন' : 'Approve workspace members and adjust roles'}
                </p>
              </div>
            </div>

            {onOpenMemberManagement && (
              <PillButton
                variant="primary"
                size="sm"
                onClick={onOpenMemberManagement}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-xs shrink-0"
              >
                {isBn ? 'সদস্য তালিকা খুলুন' : 'Open Members'}
              </PillButton>
            )}
          </div>
        </HyperCard>
      )}

      {/* Current User Role Notice */}
      <div className="p-3.5 rounded-[20px] bg-black/5 dark:bg-white/5 border border-[var(--hyper-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-[#22B84A]" />
          <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'আপনার বর্তমান ভূমিকা:' : 'Your Active Role:'}
          </span>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#22B84A]/10 text-[#22B84A] border border-[#22B84A]/20">
          {isMasterAdmin ? 'Master Admin' : role || 'Viewer'}
        </span>
      </div>

      {/* Roles Breakdown */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-purple-bg)] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#7655E8]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'ভূমিকা ম্যাট্রিক্স (Role Matrix)' : 'Role Capabilities Matrix'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'অ্যাপের তিনটি প্রধান স্তরের অনুমতি কাঠামো' : 'Security specifications for application tiers'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {ROLES.map((r) => (
            <div
              key={r.role}
              className="p-4 rounded-[22px] border border-[var(--hyper-border-subtle)] bg-black/3 dark:bg-white/3 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? r.titleBn : r.titleEn}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${r.color}`}>
                  {r.badge}
                </span>
              </div>
              <p className="text-[11px] text-[var(--hyper-text-secondary)] leading-relaxed">
                {isBn ? r.descBn : r.descEn}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {r.capabilities.map((cap, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--hyper-text-primary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22B84A] shrink-0" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </HyperCard>
    </div>
  );
};
