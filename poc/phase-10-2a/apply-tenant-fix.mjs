import fs from 'fs';

let code = fs.readFileSync('src/services/tenantService.ts', 'utf8');

const oldSubTenantsRegex = /export function subscribeTenants[\s\S]*?return onSnapshot\([\s\S]*?\r?\n  \);\r?\n\}/;
const newSubTenants = `export function subscribeTenants(
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

code = code.replace(oldSubTenantsRegex, newSubTenants);
fs.writeFileSync('src/services/tenantService.ts', code, 'utf8');
console.log('Successfully updated tenantService.ts');
