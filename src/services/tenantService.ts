import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createCallable, getActiveWorkspaceId } from '../lib/apiClient';
import { STORES, saveItem, saveItemsBatch, getAllItems } from '../lib/offlineDb';
import { syncEngine } from '../lib/syncEngine';
import { auth } from '../lib/firebase';
import type { Tenant, TenantFormData, VacateTenantFormData } from '../types/tenant';
import type { SecurityDeposit } from '../types/finance';

const TENANTS_COLL = 'tenants';
const DEPOSITS_COLL = 'security_deposits';

// =============================================================================
// REAL-TIME SUBSCRIPTIONS
// =============================================================================

/**
 * Real-time subscription to tenants.
 */
export function subscribeTenants(
  _ownerUid: string,
  propertyId: string | null,
  onUpdate: (tenants: Tenant[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const effectiveWsId = workspaceId || 'workspace_bhuiya_family';

  // 1. Pre-load immediately from IndexedDB cache
  getAllItems<Tenant>(STORES.TENANTS)
    .then((cached) => {
      if (cached && cached.length > 0) {
        const filtered = cached.filter((t) => {
          if (t.workspaceId && t.workspaceId !== effectiveWsId) return false;
          if (propertyId && t.propertyId !== propertyId) return false;
          return true;
        });
        filtered.sort((a, b) => {
          if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
          return a.name.localeCompare(b.name, 'bn');
        });
        if (filtered.length > 0) onUpdate(filtered);
      }
    })
    .catch((err) => console.warn('[TenantService] Failed to read cached tenants:', err));

  const constraints = [where('workspaceId', '==', effectiveWsId)];

  if (propertyId) {
    constraints.push(where('propertyId', '==', propertyId));
  }

  const q = query(collection(db, TENANTS_COLL), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const tenants: Tenant[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Tenant, 'id'>),
      }));

      // Cache latest tenants in IndexedDB
      saveItemsBatch(STORES.TENANTS, tenants).catch((err) =>
        console.warn('[TenantService] Failed to cache tenants:', err)
      );

      // Sort active first, then by name
      tenants.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.name.localeCompare(b.name, 'bn');
      });
      onUpdate(tenants);
    },
    (err) => {
      console.warn('[TenantService] subscribeTenants offline/error:', err.message);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch all tenants for an owner or workspace one-time.
 */
export async function getTenants(
  ownerUid: string,
  propertyId?: string,
  workspaceId?: string | null
): Promise<Tenant[]> {
  const constraints = workspaceId
    ? [where('workspaceId', '==', workspaceId)]
    : [where('ownerUid', '==', ownerUid)];

  if (propertyId) {
    constraints.push(where('propertyId', '==', propertyId));
  }

  const q = query(collection(db, TENANTS_COLL), ...constraints);
  const snapshot = await getDocs(q);
  const tenants = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Tenant, 'id'>),
  }));
  return tenants.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return a.name.localeCompare(b.name, 'bn');
  });
}

/**
 * Real-time subscription to security deposits (Liabilities).
 */
export function subscribeSecurityDeposits(
  ownerUid: string,
  propertyId: string | null,
  onUpdate: (deposits: SecurityDeposit[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const constraints = workspaceId
    ? [where('workspaceId', '==', workspaceId)]
    : [where('ownerUid', '==', ownerUid)];

  if (propertyId) {
    constraints.push(where('propertyId', '==', propertyId));
  }

  const q = query(collection(db, DEPOSITS_COLL), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const deposits: SecurityDeposit[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SecurityDeposit, 'id'>),
      }));
      onUpdate(deposits);
    },
    (err) => {
      console.error('[TenantService] subscribeSecurityDeposits error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch all security deposits for an owner one-time.
 */
export async function getSecurityDeposits(
  ownerUid: string,
  propertyId?: string
): Promise<SecurityDeposit[]> {
  const constraints = [where('ownerUid', '==', ownerUid)];
  if (propertyId) {
    constraints.push(where('propertyId', '==', propertyId));
  }

  const q = query(collection(db, DEPOSITS_COLL), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<SecurityDeposit, 'id'>),
  }));
}

// =============================================================================
// CALLABLE MUTATIONS (TRUSTED SERVER BOUNDARY)
// =============================================================================

/**
 * Register a new tenant. Atomically marks the unit as occupied and creates the security deposit liability.
 */
export async function registerTenant(
  data: TenantFormData
): Promise<{ success: boolean; tenantId: string; depositId?: string | null; isOffline?: boolean }> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const registerFn = createCallable<TenantFormData, { success: boolean; tenantId: string; depositId?: string | null }>(
        'registerTenantCallable'
      );
      const result = await registerFn(data);

      // Cache in IndexedDB
      const tenantDoc = {
        id: result.data.tenantId,
        ...data,
        status: 'active' as const,
        workspaceId: getActiveWorkspaceId() || 'workspace_bhuiya_family',
        createdAt: new Date().toISOString(),
      };
      saveItem(STORES.TENANTS, tenantDoc).catch(() => {});

      return {
        ...result.data,
        isOffline: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isNetworkErr =
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('unavailable') ||
        errMsg.includes('NetworkError');

      if (!isNetworkErr) throw err;
      console.warn('[TenantService] Cloud unreachable; saving tenant offline:', errMsg);
    }
  }

  // Offline Execution Path
  const currentWsId = getActiveWorkspaceId() || 'workspace_bhuiya_family';
  const offlineId = `tenant_offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const offlineTenantDoc = {
    id: offlineId,
    ...data,
    status: 'active' as const,
    workspaceId: currentWsId,
    syncStatus: 'pending' as const,
    isOfflineCreated: true,
    createdAt: new Date().toISOString(),
  };

  await saveItem(STORES.TENANTS, offlineTenantDoc);

  await syncEngine.enqueueAction({
    actionName: 'registerTenantCallable',
    payload: {
      ...data,
      isOfflineGenerated: true,
    },
    category: 'tenant',
    workspaceId: currentWsId,
    callerUid: auth.currentUser?.uid || 'offline_user',
    localEntityId: offlineId,
  });

  return {
    success: true,
    tenantId: offlineId,
    depositId: null,
    isOffline: true,
  };
}

/**
 * Vacate an active tenant. Atomically restores unit to vacant and settles the security deposit.
 */
export async function vacateTenant(
  data: VacateTenantFormData
): Promise<{ success: boolean; tenantId: string; unitId: string }> {
  const vacateFn = createCallable<VacateTenantFormData, { success: boolean; tenantId: string; unitId: string }>(
    'vacateTenantCallable'
  );

  const result = await vacateFn(data);
  return result.data;
}
