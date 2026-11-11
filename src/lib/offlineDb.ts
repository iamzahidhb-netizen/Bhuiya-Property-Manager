/**
 * offlineDb.ts — Persistent Typed IndexedDB Storage Engine
 * 
 * Provides robust offline storage for:
 * - Cached Firestore entities (properties, units, tenants, bills, payments, expenses)
 * - Offline mutations queue (offline_queue) with idempotency tokens
 * - Offline attachments (offline_attachments) up to 25MB
 * - Metadata and synchronization state tracking
 * 
 * Implemented with pure Web Standard IndexedDB APIs: zero external dependencies,
 * 100% compatible with modern mobile WebViews (Capacitor/Android) and desktop browsers.
 */

export const DB_NAME = 'BhuiyaPropertyManagerOfflineDB';
export const DB_VERSION = 1;

export const STORES = {
  PROPERTIES: 'properties',
  UNITS: 'units',
  TENANTS: 'tenants',
  RENT_BILLS: 'rent_bills',
  RENT_PAYMENTS: 'rent_payments',
  EXPENSES: 'expenses',
  OFFLINE_QUEUE: 'offline_queue',
  OFFLINE_ATTACHMENTS: 'offline_attachments',
  METADATA: 'metadata',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';

export interface OfflineQueueItem<T = Record<string, unknown>> {
  id: string;
  actionName: string;
  idempotencyKey: string;
  payload: T;
  category: 'payment' | 'expense' | 'tenant' | 'unit' | 'property' | 'file';
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  nextAttemptAt?: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
  workspaceId: string;
  callerUid: string;
  attachmentIds?: string[];
  localEntityId?: string;
}

export interface OfflineAttachment {
  id: string;
  uploadId?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: string;
  workspaceId?: string;
  uploadedBy?: string;
  tenantId?: string;
  propertyId?: string;
  blob?: Blob;
  base64Data?: string;
  status: 'pending' | 'uploaded' | 'failed';
  downloadUrl?: string;
  createdAt: number;
  parentQueueId?: string;
  error?: string;
}

export interface CachedEntity<T = unknown> {
  id: string;
  workspaceId: string;
  data: T;
  syncStatus: SyncStatus;
  localUpdatedAt: number;
  isOfflineCreated?: boolean;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and opens the IndexedDB database instance with schema migrations.
 */
export function getOfflineDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this runtime environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Properties
      if (!db.objectStoreNames.contains(STORES.PROPERTIES)) {
        const store = db.createObjectStore(STORES.PROPERTIES, { keyPath: 'id' });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
        store.createIndex('localUpdatedAt', 'localUpdatedAt', { unique: false });
      }

      // 2. Units
      if (!db.objectStoreNames.contains(STORES.UNITS)) {
        const store = db.createObjectStore(STORES.UNITS, { keyPath: 'id' });
        store.createIndex('propertyId', 'propertyId', { unique: false });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      // 3. Tenants
      if (!db.objectStoreNames.contains(STORES.TENANTS)) {
        const store = db.createObjectStore(STORES.TENANTS, { keyPath: 'id' });
        store.createIndex('propertyId', 'propertyId', { unique: false });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      // 4. Rent Bills
      if (!db.objectStoreNames.contains(STORES.RENT_BILLS)) {
        const store = db.createObjectStore(STORES.RENT_BILLS, { keyPath: 'id' });
        store.createIndex('tenantId', 'tenantId', { unique: false });
        store.createIndex('billingMonth', 'billingMonth', { unique: false });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      // 5. Rent Payments
      if (!db.objectStoreNames.contains(STORES.RENT_PAYMENTS)) {
        const store = db.createObjectStore(STORES.RENT_PAYMENTS, { keyPath: 'id' });
        store.createIndex('tenantId', 'tenantId', { unique: false });
        store.createIndex('billingMonth', 'billingMonth', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      // 6. Expenses
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const store = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        store.createIndex('group', 'group', { unique: false });
        store.createIndex('billingMonth', 'billingMonth', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      // 7. Offline Queue (Pending mutations)
      if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
        const store = db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      // 8. Offline Attachments (Vouchers, Photos, Documents up to 25MB)
      if (!db.objectStoreNames.contains(STORES.OFFLINE_ATTACHMENTS)) {
        const store = db.createObjectStore(STORES.OFFLINE_ATTACHMENTS, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('parentQueueId', 'parentQueueId', { unique: false });
      }

      // 9. Metadata & Sync Timestamps
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error || new Error('Failed to open BhuiyaOfflineDB.'));
    };
  });

  return dbPromise;
}

/**
 * Saves or updates a single item in an object store.
 */
export async function saveItem<T>(storeName: StoreName, item: T): Promise<T> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);

    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error || new Error(`Error saving to ${storeName}`));
  });
}

/**
 * Saves multiple items atomically in a single transaction.
 */
export async function saveItemsBatch<T>(storeName: StoreName, items: T[]): Promise<void> {
  if (!items || items.length === 0) return;
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const item of items) {
      store.put(item);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error(`Error batch saving to ${storeName}`));
  });
}

/**
 * Retrieves a single item by key.
 */
export async function getItem<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);

    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error || new Error(`Error reading from ${storeName}`));
  });
}

/**
 * Retrieves all items from an object store, optionally filtered by an index value.
 */
export async function getAllItems<T>(
  storeName: StoreName,
  indexName?: string,
  indexValue?: IDBValidKey
): Promise<T[]> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);

    let req: IDBRequest;
    if (indexName && indexValue !== undefined) {
      const idx = store.index(indexName);
      req = idx.getAll(indexValue);
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error || new Error(`Error getting all items from ${storeName}`));
  });
}

/**
 * Deletes an item by key.
 */
export async function deleteItem(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`Error deleting from ${storeName}`));
  });
}

/**
 * Clears all records from an object store.
 */
export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`Error clearing store ${storeName}`));
  });
}

/**
 * Helper to get or set global metadata keys.
 */
export async function getMetadata<T>(key: string): Promise<T | null> {
  const res = await getItem<{ key: string; value: T }>(STORES.METADATA, key);
  return res ? res.value : null;
}

export async function setMetadata<T>(key: string, value: T): Promise<void> {
  await saveItem(STORES.METADATA, { key, value, updatedAt: Date.now() });
}
