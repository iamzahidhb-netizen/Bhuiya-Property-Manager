import fs from 'fs';

let code = fs.readFileSync('src/services/propertyService.ts', 'utf8');

// Ensure import is clean
if (!code.includes("import { STORES, saveItemsBatch, getAllItems }")) {
  code = code.replace(
    "import { createCallable } from '../lib/apiClient';",
    "import { createCallable } from '../lib/apiClient';\nimport { STORES, saveItemsBatch, getAllItems } from '../lib/offlineDb';"
  );
}

const oldSubPropRegex = /export function subscribeProperties[\s\S]*?return onSnapshot\([\s\S]*?\r?\n  \);\r?\n\}/;
const newSubProp = `export function subscribeProperties(
  _ownerUid: string,
  onUpdate: (properties: Property[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const effectiveWsId = workspaceId || 'workspace_bhuiya_family';

  // 1. Pre-load immediately from IndexedDB cache
  getAllItems<Property>(STORES.PROPERTIES)
    .then((cached) => {
      if (cached && cached.length > 0) {
        const filtered = cached.filter((p) => !p.workspaceId || p.workspaceId === effectiveWsId);
        filtered.sort((a, b) => {
          if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
          return a.name.localeCompare(b.name, 'bn');
        });
        if (filtered.length > 0) onUpdate(filtered);
      }
    })
    .catch((err) => console.warn('[PropertyService] Failed to read cached properties:', err));

  const constraints = [where('workspaceId', '==', effectiveWsId)];

  const q = query(
    collection(db, PROPERTIES_COLL),
    ...constraints
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const properties: Property[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Property, 'id'>),
      }));

      // Cache in IndexedDB
      saveItemsBatch(STORES.PROPERTIES, properties).catch((err) =>
        console.warn('[PropertyService] Failed to cache properties:', err)
      );

      properties.sort((a, b) => {
        if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
        return a.name.localeCompare(b.name, 'bn');
      });
      onUpdate(properties);
    },
    (err) => {
      console.error('[PropertyService] subscribeProperties error:', err);
      if (onError) onError(err);
    }
  );
}`;

code = code.replace(oldSubPropRegex, newSubProp);
fs.writeFileSync('src/services/propertyService.ts', code, 'utf8');
console.log('Successfully updated propertyService.ts');
