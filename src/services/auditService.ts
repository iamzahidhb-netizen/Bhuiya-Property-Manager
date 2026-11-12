import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AuditLogEntry } from '../types/audit';

const AUDIT_COLLECTION = 'audit_logs';
const MAX_AUDIT_ENTRIES = 400;

function timestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Subscribe to the immutable administrative audit trail for one workspace.
 * Firestore rules restrict this read to active Master Admins of that workspace.
 */
export function subscribeAuditLogs(
  workspaceId: string,
  onData: (entries: AuditLogEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  const auditQuery = query(
    collection(db, AUDIT_COLLECTION),
    where('workspaceId', '==', workspaceId),
    limit(MAX_AUDIT_ENTRIES)
  );

  return onSnapshot(
    auditQuery,
    (snapshot) => {
      const entries = snapshot.docs.map((document) => ({
        id: document.id,
        ...(document.data() as Omit<AuditLogEntry, 'id'>),
      }));
      entries.sort((first, second) => timestampMillis(second.createdAt) - timestampMillis(first.createdAt));
      onData(entries);
    },
    (error) => {
      console.error('[AuditService] subscribe error:', error);
      onError?.(error);
    }
  );
}

export function formatAuditTimestamp(value: unknown, locale: 'bn' | 'en' = 'bn'): string {
  const millis = timestampMillis(value);
  if (!millis) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Dhaka',
    }).format(new Date(millis));
  } catch {
    return new Date(millis).toISOString();
  }
}
