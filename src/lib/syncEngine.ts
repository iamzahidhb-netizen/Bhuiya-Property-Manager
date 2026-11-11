/**
 * syncEngine.ts — Centralized Automatic Synchronization Engine
 * 
 * Manages:
 * 1. Network connectivity detection (online/offline/visibility events + heartbeat ping)
 * 2. Offline mutation queue processing (FIFO, idempotent, atomic)
 * 3. Offline attachment uploading to storage before mutation dispatch
 * 4. Exponential backoff and concurrency control (mutex lock)
 * 5. Reusable event subscription for real-time Sync Status UI
 */

import {
  STORES,
  saveItem,
  getItem,
  getAllItems,
  deleteItem,
  getMetadata,
  setMetadata,
  type OfflineQueueItem,
  type OfflineAttachment,
  type SyncStatus,
} from './offlineDb';
import { callCallable, resolveApiBase } from './apiClient';
import { getActiveWorkspaceId } from './apiClient';
import { auth } from './firebase';
import { uploadFileToR2, StorageNetworkError } from '../services/storageUploadApi';

export type GlobalNetworkState =
  | 'ONLINE'
  | 'OFFLINE'
  | 'SYNCING'
  | 'PENDING'
  | 'SYNC_ERROR'
  | 'SYNCED';

export interface SyncEngineStatus {
  networkState: GlobalNetworkState;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

type SyncListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private pendingCount: number = 0;
  private failedCount: number = 0;
  private lastSyncedAt: number | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private isInitialized: boolean = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAt: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initListeners();
    }
  }

  /**
   * Initializes network and visibility listeners.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load persisted metadata
    const storedLastSync = await getMetadata<number>('lastSyncedAt');
    if (storedLastSync) this.lastSyncedAt = storedLastSync;

    await this.refreshCounts();
    await this.recoverUnqueuedAttachments();
    this.notify();

    // Trigger initial drain if online
    if (this.isOnline) {
      this.drainQueue().catch((err) => console.warn('[SyncEngine] Initial drain error:', err));
    }
  }

  private async recoverUnqueuedAttachments(): Promise<void> {
    const [attachments, queue] = await Promise.all([
      getAllItems<OfflineAttachment>(STORES.OFFLINE_ATTACHMENTS),
      getAllItems<OfflineQueueItem>(STORES.OFFLINE_QUEUE)
    ]);
    const queuedAttachmentIds = new Set(queue.flatMap((item) => item.attachmentIds || []));

    for (const attachment of attachments) {
      if (attachment.status !== 'pending' || queuedAttachmentIds.has(attachment.id)) continue;
      const user = auth.currentUser;
      const workspaceId = attachment.workspaceId || getActiveWorkspaceId() || 'workspace_bhuiya_family';
      if (!user || !attachment.uploadedBy || attachment.uploadedBy !== user.uid) continue;

      if (!attachment.uploadId) {
        attachment.uploadId = `file_${crypto.randomUUID()}`;
      }
      attachment.workspaceId = workspaceId;
      await saveItem(STORES.OFFLINE_ATTACHMENTS, attachment);
      await this.enqueueAction({
        actionName: 'uploadStorageAttachment',
        payload: { uploadId: attachment.uploadId },
        category: 'file',
        workspaceId,
        callerUid: user.uid,
        attachmentIds: [attachment.id]
      });
      queuedAttachmentIds.add(attachment.id);
    }
  }

  private initListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.lastError = null;
      this.notify();
      this.drainQueue().catch((err) => console.warn('[SyncEngine] Online drain error:', err));
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notify();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        this.drainQueue().catch((err) => console.warn('[SyncEngine] Visibility drain error:', err));
      }
    });

    // Heartbeat check every 30 seconds
    setInterval(() => {
      this.checkHeartbeat();
    }, 30000);
  }

  /**
   * Probes network availability via a fast HEAD or GET request.
   */
  public async checkHeartbeat(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      this.notify();
      return false;
    }

    try {
      const apiBase = resolveApiBase();
      const testUrl = apiBase ? `${apiBase}/` : '/index.html';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      let res: Response;
      try {
        res = await fetch(testUrl, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const onlineNow = res.status < 500;
      if (onlineNow !== this.isOnline) {
        this.isOnline = onlineNow;
        if (onlineNow) {
          this.drainQueue().catch((err) => console.warn('[SyncEngine] Heartbeat restore drain:', err));
        }
      }
      this.notify();
      return onlineNow;
    } catch {
      // If server unreachable, mark as offline
      this.isOnline = false;
      this.notify();
      return false;
    }
  }

  /**
   * Refreshes the count of pending and failed queue items from IndexedDB.
   */
  public async refreshCounts(): Promise<{ pending: number; failed: number }> {
    try {
      const queue = await getAllItems<OfflineQueueItem>(STORES.OFFLINE_QUEUE);
      this.pendingCount = queue.filter((item) => item.status === 'pending' || item.status === 'syncing').length;
      this.failedCount = queue.filter((item) => item.status === 'failed').length;
      this.notify();
      return { pending: this.pendingCount, failed: this.failedCount };
    } catch (err) {
      console.warn('[SyncEngine] Failed to refresh counts:', err);
      return { pending: this.pendingCount, failed: this.failedCount };
    }
  }

  /**
   * Computes the current aggregate network and synchronization status.
   */
  public getStatus(): SyncEngineStatus {
    let networkState: GlobalNetworkState;

    if (!this.isOnline) {
      networkState = 'OFFLINE';
    } else if (this.isSyncing) {
      networkState = 'SYNCING';
    } else if (this.failedCount > 0) {
      networkState = 'SYNC_ERROR';
    } else if (this.pendingCount > 0) {
      networkState = 'PENDING';
    } else {
      networkState = 'SYNCED';
    }

    return {
      networkState,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      failedCount: this.failedCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  /**
   * Subscribes a listener to sync engine status updates. Returns unsubscribe function.
   */
  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[SyncEngine] Listener error:', err);
      }
    });
  }

  /**
   * Enqueues an offline action to be synchronized with the cloud.
   */
  public async enqueueAction<T = Record<string, unknown>>(params: {
    actionName: string;
    payload: T;
    category: OfflineQueueItem['category'];
    workspaceId: string;
    callerUid: string;
    attachmentIds?: string[];
    localEntityId?: string;
  }): Promise<OfflineQueueItem<T>> {
    const id = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyKey = `${params.actionName}_${params.callerUid}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const queueItem: OfflineQueueItem<T> = {
      id,
      actionName: params.actionName,
      idempotencyKey,
      payload: params.payload,
      category: params.category,
      status: 'pending',
      retryCount: 0,
      maxRetries: 5,
      createdAt: Date.now(),
      workspaceId: params.workspaceId,
      callerUid: params.callerUid,
      attachmentIds: params.attachmentIds || [],
      localEntityId: params.localEntityId,
    };

    await saveItem(STORES.OFFLINE_QUEUE, queueItem);
    await this.refreshCounts();

    // If online, kick off queue drain immediately in background
    if (this.isOnline && !this.isSyncing) {
      this.drainQueue().catch((err) => console.warn('[SyncEngine] Enqueue auto-drain error:', err));
    }

    return queueItem;
  }

  /**
   * Uploads an offline attachment stored in IndexedDB.
   */
  private async uploadOfflineAttachment(attachmentId: string, queueItem: OfflineQueueItem): Promise<string> {
    const attachment = await getItem<OfflineAttachment>(STORES.OFFLINE_ATTACHMENTS, attachmentId);
    if (!attachment) {
      throw new Error(`Pending attachment ${attachmentId} was not found in local storage.`);
    }
    if (attachment.status === 'uploaded') {
      return attachment.downloadUrl || attachment.uploadId || attachment.id;
    }

    try {
      const user = auth.currentUser;
      if (!user || user.uid !== queueItem.callerUid || (attachment.uploadedBy && attachment.uploadedBy !== user.uid)) {
        throw new Error('Sign in as the original uploader to synchronize this file.');
      }
      const blob = attachment.blob || this.decodeLegacyAttachment(attachment);
      if (!attachment.uploadId) {
        attachment.uploadId = `file_${crypto.randomUUID()}`;
      }
      const cloudFile = await uploadFileToR2(blob, {
        fileId: attachment.uploadId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        category: attachment.category,
        workspaceId: attachment.workspaceId || queueItem.workspaceId,
        tenantId: attachment.tenantId,
        propertyId: attachment.propertyId
      });
      attachment.status = 'uploaded';
      attachment.downloadUrl = cloudFile.id;
      attachment.error = undefined;
      await saveItem(STORES.OFFLINE_ATTACHMENTS, attachment);
      return cloudFile.id;
    } catch (uploadErr: unknown) {
      attachment.status = 'pending';
      attachment.error = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      await saveItem(STORES.OFFLINE_ATTACHMENTS, attachment);
      throw uploadErr;
    }
  }

  private decodeLegacyAttachment(attachment: OfflineAttachment): Blob {
    if (!attachment.base64Data) {
      throw new Error(`Pending attachment ${attachment.id} has no locally persisted file data.`);
    }
    const binary = atob(attachment.base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: attachment.mimeType });
  }

  private scheduleRetry(at: number): void {
    if (!this.isOnline || (this.retryAt !== null && this.retryAt <= at)) return;
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryAt = at;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryAt = null;
      this.drainQueue().catch((err) => console.warn('[SyncEngine] Scheduled retry error:', err));
    }, Math.max(0, at - Date.now()));
  }

  /**
   * Processes all pending queue items sequentially.
   */
  public async drainQueue(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isOnline) return;

    this.isSyncing = true;
    this.notify();

    try {
      const allItems = await getAllItems<OfflineQueueItem>(STORES.OFFLINE_QUEUE);
      const pendingItems = allItems
        .filter((item) => item.status === 'pending' || item.status === 'syncing')
        .sort((a, b) => a.createdAt - b.createdAt);

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        await this.refreshCounts();
        return;
      }

      const now = Date.now();
      const readyItems = pendingItems.filter((item) => !item.nextAttemptAt || item.nextAttemptAt <= now);
      if (readyItems.length === 0) {
        const nextAttemptAt = Math.min(...pendingItems.map((item) => item.nextAttemptAt || now));
        this.isSyncing = false;
        this.scheduleRetry(nextAttemptAt);
        await this.refreshCounts();
        return;
      }

      for (const item of readyItems) {
        if (!this.isOnline) {
          break;
        }

        item.status = 'syncing';
        item.lastAttemptAt = Date.now();
        await saveItem(STORES.OFFLINE_QUEUE, item);
        this.notify();

        try {
          // 1. Process pending attachments first if any
          if (item.attachmentIds && item.attachmentIds.length > 0) {
            for (const attId of item.attachmentIds) {
              await this.uploadOfflineAttachment(attId, item);
            }
          }

          if (item.category === 'file' && item.actionName === 'uploadStorageAttachment') {
            await deleteItem(STORES.OFFLINE_QUEUE, item.id);
            continue;
          }

          // 2. Attach idempotency key to payload
          const augmentedPayload = {
            ...(item.payload as Record<string, unknown>),
            idempotencyKey: item.idempotencyKey,
            workspaceId: item.workspaceId,
          };

          // 3. Dispatch callable API request
          await callCallable(item.actionName, augmentedPayload);

          // 4. On success: update local cache entity if mapped
          if (item.localEntityId) {
            if (item.category === 'payment') {
              const localPay = await getItem<{ id: string; syncStatus: SyncStatus }>(
                STORES.RENT_PAYMENTS,
                item.localEntityId
              );
              if (localPay) {
                localPay.syncStatus = 'synced';
                await saveItem(STORES.RENT_PAYMENTS, localPay);
              }
            } else if (item.category === 'expense') {
              const localExp = await getItem<{ id: string; syncStatus: SyncStatus }>(
                STORES.EXPENSES,
                item.localEntityId
              );
              if (localExp) {
                localExp.syncStatus = 'synced';
                await saveItem(STORES.EXPENSES, localExp);
              }
            }
          }

          // 5. Remove completed item from queue
          await deleteItem(STORES.OFFLINE_QUEUE, item.id);
        } catch (itemErr: unknown) {
          const errMsg = itemErr instanceof Error ? itemErr.message : String(itemErr);
          const isNetworkIssue = itemErr instanceof StorageNetworkError ||
            errMsg.includes('Failed to fetch') ||
            errMsg.includes('unavailable') ||
            errMsg.includes('NetworkError');

          if (isNetworkIssue) {
            // Transient network disconnect: revert status to 'pending' and back off
            this.isOnline = false;
            item.status = 'pending';
            item.nextAttemptAt = undefined;
            item.error = errMsg;
            await saveItem(STORES.OFFLINE_QUEUE, item);
            this.lastError = errMsg;
            break;
          }

          // Non-network failure: increment retry count
          item.retryCount = (item.retryCount || 0) + 1;
          item.error = errMsg;
          this.lastError = errMsg;

          if (item.retryCount >= item.maxRetries) {
            item.status = 'failed';
            item.nextAttemptAt = undefined;
            for (const attachmentId of item.attachmentIds || []) {
              const attachment = await getItem<OfflineAttachment>(STORES.OFFLINE_ATTACHMENTS, attachmentId);
              if (attachment) {
                attachment.status = 'failed';
                attachment.error = errMsg;
                await saveItem(STORES.OFFLINE_ATTACHMENTS, attachment);
              }
            }
          } else {
            item.status = 'pending';
            const retryDelay = Math.min(60_000, 1000 * (2 ** (item.retryCount - 1)));
            item.nextAttemptAt = Date.now() + retryDelay;
            this.scheduleRetry(item.nextAttemptAt);
          }
          await saveItem(STORES.OFFLINE_QUEUE, item);
        }
      }

      this.lastSyncedAt = Date.now();
      await setMetadata('lastSyncedAt', this.lastSyncedAt);
    } catch (globalErr) {
      console.error('[SyncEngine] Fatal queue drain error:', globalErr);
      this.lastError = globalErr instanceof Error ? globalErr.message : String(globalErr);
    } finally {
      this.isSyncing = false;
      await this.refreshCounts();
      this.notify();
    }
  }

  /**
   * User-triggered immediate manual synchronization.
   */
  public async triggerSyncNow(): Promise<void> {
    this.lastError = null;
    await this.checkHeartbeat();
    await this.drainQueue();
  }
}

// Export singleton instance
export const syncEngine = new SyncEngine();

/**
 * React hook friendly helper to subscribe to sync engine updates.
 */
export function subscribeSyncStatus(listener: SyncListener): () => void {
  return syncEngine.subscribe(listener);
}
