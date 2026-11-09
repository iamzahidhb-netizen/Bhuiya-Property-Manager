import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createCallable } from '../lib/apiClient';
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
      // Sort active first, then by name
      tenants.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.name.localeCompare(b.name, 'bn');
      });
      onUpdate(tenants);
    },
    (err) => {
      console.error('[TenantService] subscribeTenants error:', err);
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
): Promise<{ success: boolean; tenantId: string; depositId?: string | null }> {
  const registerFn = createCallable<TenantFormData, { success: boolean; tenantId: string; depositId?: string | null }>(
    'registerTenantCallable'
  );

  const result = await registerFn(data);
  return result.data;
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
