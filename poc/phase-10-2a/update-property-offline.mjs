import fs from 'fs';

let code = fs.readFileSync('src/services/propertyService.ts', 'utf8');

if (!code.includes('offlineDb')) {
  code = code.replace(
    "import { createCallable } from '../lib/apiClient';",
    "import { createCallable } from '../lib/apiClient';\nimport { STORES, saveItemsBatch, getAllItems } from '../lib/offlineDb';"
  );
}

// Update subscribeProperties
const oldSubPropRegex = /export function subscribeProperties[\s\S]*?return onSnapshot\([\s\S]*?\n  \);\n\}/;
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

      // Cache latest properties in IndexedDB
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
      console.warn('[PropertyService] subscribeProperties offline/error:', err.message);
      if (onError) onError(err);
    }
  );
}`;

code = code.replace(oldSubPropRegex, newSubProp);

// Update subscribeUnits
const oldSubUnitsRegex = /export function subscribeUnits[\s\S]*?return onSnapshot\([\s\S]*?\n  \);\n\}/;
const newSubUnits = `export function subscribeUnits(
  ownerUid: string,
  propertyId: string | null,
  onUpdate: (units: Unit[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const effectiveWsId = workspaceId || 'workspace_bhuiya_family';

  // 1. Pre-load immediately from IndexedDB cache
  getAllItems<Unit>(STORES.UNITS)
    .then((cached) => {
      if (cached && cached.length > 0) {
        const filtered = cached.filter((u) => {
          if (u.workspaceId && u.workspaceId !== effectiveWsId) return false;
          if (propertyId && u.propertyId !== propertyId) return false;
          return true;
        });
        filtered.sort((a, b) => {
          if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
          return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
        });
        if (filtered.length > 0) onUpdate(filtered);
      }
    })
    .catch((err) => console.warn('[PropertyService] Failed to read cached units:', err));

  const constraints = workspaceId
    ? [where('workspaceId', '==', workspaceId)]
    : [where('ownerUid', '==', ownerUid)];

  if (propertyId) {
    constraints.push(where('propertyId', '==', propertyId));
  }

  const q = query(collection(db, UNITS_COLL), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const units: Unit[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Unit, 'id'>),
      }));

      // Cache latest units in IndexedDB
      saveItemsBatch(STORES.UNITS, units).catch((err) =>
        console.warn('[PropertyService] Failed to cache units:', err)
      );

      units.sort((a, b) => {
        if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
        return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
      });
      onUpdate(units);
    },
    (err) => {
      console.warn('[PropertyService] subscribeUnits offline/error:', err.message);
      if (onError) onError(err);
    }
  );
}`;

code = code.replace(oldSubUnitsRegex, newSubUnits);

fs.writeFileSync('src/services/propertyService.ts', code, 'utf8');
console.log('propertyService updated with offline cache capabilities');
