import type { Timestamp } from 'firebase/firestore';

export type AuditOperation =
  | 'create'
  | 'update'
  | 'archive'
  | 'restore'
  | 'rename'
  | 'delete'
  | 'vacate'
  | 'reverse'
  | 'record'
  | 'generate'
  | 'seed'
  | 'apply'
  | 'withdraw'
  | 'transfer'
  | 'initialize'
  | 'invite'
  | 'deactivate'
  | 'send'
  | 'get'
  | 'list'
  | 'execute';

export type AuditEntityType =
  | 'property'
  | 'unit'
  | 'tenant'
  | 'rent_bill'
  | 'rent_payment'
  | 'expense'
  | 'beneficiary'
  | 'family_distribution'
  | 'reserve_fund'
  | 'workspace_member';

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  operation: AuditOperation | string;
  entityType: AuditEntityType | string;
  documentId: string;
  status: 'success' | 'failure' | string;
  errorCode?: string | null;
  previousValues?: Record<string, unknown> | null;
  updatedValues?: Record<string, unknown> | null;
  reason?: string | null;
  relatedTransactionId?: string | null;
  source?: string;
  createdAt: Timestamp | null;
}

export const AUDIT_OPERATION_LABELS: Record<string, { bn: string; en: string }> = {
  create: { bn: 'তৈরি', en: 'Create' },
  update: { bn: 'সংশোধন', en: 'Update' },
  archive: { bn: 'আর্কাইভ', en: 'Archive' },
  restore: { bn: 'পুনরুদ্ধার', en: 'Restore' },
  rename: { bn: 'নাম পরিবর্তন', en: 'Rename' },
  delete: { bn: 'মুছে ফেলা', en: 'Delete' },
  vacate: { bn: 'ভাড়াটিয়া প্রস্থান', en: 'Vacate' },
  reverse: { bn: 'বাতিল (Reverse)', en: 'Reverse' },
  record: { bn: 'রেকর্ড', en: 'Record' },
  generate: { bn: 'বিল তৈরি', en: 'Generate' },
  seed: { bn: 'ডিফল্ট সেটআপ', en: 'Seed' },
  apply: { bn: 'প্রয়োগ', en: 'Apply' },
  withdraw: { bn: 'উত্তোলন', en: 'Withdraw' },
  transfer: { bn: 'স্থানান্তর', en: 'Transfer' },
  initialize: { bn: 'সূচনা', en: 'Initialize' },
  invite: { bn: 'আমন্ত্রণ', en: 'Invite' },
  deactivate: { bn: 'নিষ্ক্রিয়', en: 'Deactivate' },
  send: { bn: 'পাঠানো', en: 'Send' },
  execute: { bn: 'সম্পাদন', en: 'Execute' },
};

export const AUDIT_ENTITY_LABELS: Record<string, { bn: string; en: string }> = {
  property: { bn: 'প্রপার্টি', en: 'Property' },
  unit: { bn: 'ইউনিট', en: 'Unit' },
  tenant: { bn: 'ভাড়াটিয়া', en: 'Tenant' },
  rent_bill: { bn: 'ভাড়া বিল', en: 'Rent bill' },
  rent_payment: { bn: 'ভাড়া পেমেন্ট', en: 'Rent payment' },
  expense: { bn: 'খরচ', en: 'Expense' },
  beneficiary: { bn: 'অংশীদার', en: 'Beneficiary' },
  family_distribution: { bn: 'পারিবারিক বণ্টন', en: 'Distribution' },
  reserve_fund: { bn: 'রিজার্ভ ফান্ড', en: 'Reserve fund' },
  workspace_member: { bn: 'সদস্য', en: 'Member' },
};
