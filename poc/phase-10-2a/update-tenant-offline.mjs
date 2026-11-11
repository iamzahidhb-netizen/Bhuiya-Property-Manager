import fs from 'fs';

let code = fs.readFileSync('src/services/tenantService.ts', 'utf8');

if (!code.includes('offlineDb')) {
  code = code.replace(
    "import { createCallable } from '../lib/apiClient';",
    "import { createCallable, getActiveWorkspaceId } from '../lib/apiClient';\nimport { STORES, saveItem, saveItemsBatch, getAllItems } from '../lib/offlineDb';\nimport { syncEngine } from '../lib/syncEngine';\nimport { auth } from '../lib/firebase';"
  );
}

// Update subscribeTenants
const oldSubTenants = `export function subscribeTenants(
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
}`;

const oldSubTenantsRegex = /export function subscribeTenants[\s\S]*?return onSnapshot\([\s\S]*?\n  \);\n\}/;
code = code.replace(oldSubTenantsRegex, oldSubTenants);

// Update registerTenant with offline fallback
const oldRegTenantRegex = /export async function registerTenant[\s\S]*?return result\.data;\s*\}/;
const newRegTenant = `export async function registerTenant(
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
  const offlineId = \`tenant_offline_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;

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
}`;

code = code.replace(oldRegTenantRegex, newRegTenant);

fs.writeFileSync('src/services/tenantService.ts', code, 'utf8');
console.log('tenantService updated with offline capabilities');
