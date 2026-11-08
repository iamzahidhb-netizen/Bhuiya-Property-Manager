import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createCallable } from '../lib/apiClient';
import type { Property, PropertyInput, Unit, UnitInput } from '../types/property';

const PROPERTIES_COLL = 'properties';
const UNITS_COLL = 'units';

/**
 * Normalizes a unit number string for uniqueness comparison (e.g. "Flat 1A" -> "flat1a").
 */
export function normalizeUnitNumber(unitNumber: string): string {
  return unitNumber.trim().toLowerCase().replace(/[\s\-_/.,#]+/g, '');
}

// =============================================================================
// PROPERTY OPERATIONS
// =============================================================================

/**
 * Real-time subscription to properties belonging to an owner or workspace.
 */
export function subscribeProperties(
  ownerUid: string,
  onUpdate: (properties: Property[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const constraints = workspaceId
    ? [where('workspaceId', '==', workspaceId)]
    : [where('ownerUid', '==', ownerUid)];

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
}

/**
 * Fetch all properties for an owner or workspace one-time.
 */
export async function getProperties(ownerUid: string, workspaceId?: string | null): Promise<Property[]> {
  const constraints = workspaceId
    ? [where('workspaceId', '==', workspaceId)]
    : [where('ownerUid', '==', ownerUid)];

  const q = query(
    collection(db, PROPERTIES_COLL),
    ...constraints
  );
  const snapshot = await getDocs(q);
  const properties = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Property, 'id'>),
  }));
  return properties.sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return a.name.localeCompare(b.name, 'bn');
  });
}

/**
 * Create a new property document via trusted Callable API.
 */
export async function createProperty(
  input: PropertyInput
): Promise<string> {
  const createFn = createCallable<PropertyInput, { success: boolean; propertyId: string }>(
    'createPropertyCallable'
  );
  const res = await createFn(input);
  return res.data.propertyId;
}

/**
 * Update an existing property via trusted Callable API.
 */
export async function updateProperty(
  propertyId: string,
  input: Partial<PropertyInput>
): Promise<void> {
  const updateFn = createCallable<
    { propertyId: string } & Partial<PropertyInput>,
    { success: boolean; propertyId: string }
  >('updatePropertyCallable');

  await updateFn({
    propertyId,
    ...input,
  });
}

/**
 * Soft-archive or unarchive a property via trusted Callable API.
 */
export async function archiveProperty(
  propertyId: string,
  archive: boolean
): Promise<void> {
  const archiveFn = createCallable<
    { propertyId: string; isArchived: boolean },
    { success: boolean; propertyId: string }
  >('archivePropertyCallable');

  await archiveFn({
    propertyId,
    isArchived: archive,
  });
}

// =============================================================================
// SAFE, RACE-SAFE, IDEMPOTENT PROPERTY SEEDING
// =============================================================================

export interface InitialPropertySeed {
  code: string;
  name: string;
  nameEn: string;
  type: 'residential' | 'commercial' | 'mixed';
  address: string;
  totalFloors: number;
  description: string;
}

export const INITIAL_PROPERTIES: InitialPropertySeed[] = [
  {
    code: 'bhuiya-bari',
    name: 'ভূঁইয়া বাড়ি',
    nameEn: 'Bhuiya Bari',
    type: 'residential',
    address: 'পৈতৃক ভিটা, বাংলাদেশ',
    totalFloors: 3,
    description: 'পারিবারিক পৈতৃক আবাসিক ভবন ও ইউনিটসমূহ',
  },
  {
    code: 'mitali-market',
    name: 'মিতালী মার্কেট',
    nameEn: 'Mitali Market',
    type: 'commercial',
    address: 'বাণিজ্যিক এলাকা, বাংলাদেশ',
    totalFloors: 2,
    description: 'বাণিজ্যিক বিপণিবিতান ও দোকানসমূহ',
  },
  {
    code: 'nm-bhuiya-tower',
    name: 'এন.এম. ভূঁইয়া টাওয়ার',
    nameEn: 'N.M. Bhuiya Tower',
    type: 'mixed',
    address: 'প্রধান সড়ক, বাংলাদেশ',
    totalFloors: 6,
    description: 'আধুনিক বাণিজ্যিক ও আবাসিক বহুতল টাওয়ার',
  },
];

/**
 * Seeds the three initial properties using an owner-scoped query with create-only semantics.
 * Existing documents and user customizations are NEVER overwritten.
 */
export async function seedInitialProperties(
  ownerUid: string
): Promise<{ created: number; existing: number }> {
  // Query existing properties for this owner (authorized under isDocOwner rules)
  const q = query(collection(db, PROPERTIES_COLL), where('ownerUid', '==', ownerUid));
  const existingSnap = await getDocs(q);
  const existingCodes = new Set(
    existingSnap.docs
      .map((d) => d.data().code as string | undefined)
      .filter(Boolean)
  );

  let created = 0;
  let existing = 0;

  for (const prop of INITIAL_PROPERTIES) {
    if (existingCodes.has(prop.code)) {
      existing++;
    } else {
      const docId = `prop_${ownerUid}_${prop.code.replace(/-/g, '_')}`;
      await setDoc(doc(db, PROPERTIES_COLL, docId), {
        ownerUid,
        name: prop.name,
        nameEn: prop.nameEn,
        code: prop.code,
        type: prop.type,
        address: prop.address,
        totalFloors: prop.totalFloors,
        description: prop.description,
        status: 'active',
        isArchived: false,
        activeUnitNumbers: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
    }
  }

  return { created, existing };
}

// =============================================================================
// UNIT OPERATIONS (ROUTED TO TRUSTED CALLABLE CLOUD FUNCTIONS)
// =============================================================================

/**
 * Real-time subscription to units.
 */
export function subscribeUnits(
  ownerUid: string,
  propertyId: string | null,
  onUpdate: (units: Unit[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
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
      units.sort((a, b) => {
        if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
        return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
      });
      onUpdate(units);
    },
    (err) => {
      console.error('[PropertyService] subscribeUnits error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch all units for an owner or workspace, optionally filtered by propertyId.
 */
export async function getUnits(
  ownerUid: string,
  propertyId?: string,
  workspaceId?: string | null
): Promise<Unit[]> {
  const constraints = workspaceId
    ? [where('workspaceId', '==', workspaceId)]
    : [where('ownerUid', '==', ownerUid)];

  if (propertyId) {
    constraints.push(where('propertyId', '==', propertyId));
  }

  const q = query(collection(db, UNITS_COLL), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Unit, 'id'>),
  }));
}

/**
 * Create a new unit via trusted Callable Cloud Function.
 */
export async function createUnit(input: UnitInput): Promise<string> {
  const createFn = createCallable<{
    propertyId: string;
    unitNumber: string;
    type?: string;
    floor?: number;
    monthlyRent?: number;
    serviceCharge?: number;
    notes?: string;
    electricityMeterNumber?: string;
    gasMeterNumber?: string;
  }, { success: boolean; unitId: string; normalizedUnitNumber: string }>('createUnitCallable');

  const res = await createFn({
    propertyId: input.propertyId,
    unitNumber: input.unitNumber,
    type: input.type,
    floor: Number(input.floor) || 1,
    monthlyRent: Number(input.monthlyRent) || 0,
    serviceCharge: Number(input.serviceCharge) || 0,
    notes: input.notes,
    electricityMeterNumber: input.electricityMeterNumber,
    gasMeterNumber: input.gasMeterNumber,
  });

  return res.data.unitId;
}

/**
 * Update an existing unit. If the unit number changed, calls renameUnitCallable.
 */
export async function updateUnit(
  unitId: string,
  input: Partial<UnitInput>
): Promise<void> {
  if (input.unitNumber !== undefined && input.propertyId) {
    const renameFn = createCallable<{
      propertyId: string;
      unitId: string;
      newUnitNumber: string;
    }, { success: boolean }>('renameUnitCallable');

    await renameFn({
      propertyId: input.propertyId,
      unitId,
      newUnitNumber: input.unitNumber,
    });
  }

  const unitRef = doc(db, UNITS_COLL, unitId);
  const metadataUpdate: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.type !== undefined) metadataUpdate.type = input.type;
  if (input.floor !== undefined) metadataUpdate.floor = Number(input.floor) || 1;
  if (input.serviceCharge !== undefined) metadataUpdate.serviceCharge = Number(input.serviceCharge) || 0;
  if (input.notes !== undefined) metadataUpdate.notes = input.notes.trim();
  if (input.electricityMeterNumber !== undefined) metadataUpdate.electricityMeterNumber = input.electricityMeterNumber.trim();
  if (input.gasMeterNumber !== undefined) metadataUpdate.gasMeterNumber = input.gasMeterNumber.trim();

  if (Object.keys(metadataUpdate).length > 1) {
    await updateDoc(unitRef, metadataUpdate);
  }
}

/**
 * Soft-archive or restore a unit via trusted Callable Cloud Function.
 */
export async function archiveUnit(
  unitId: string,
  archive: boolean,
  propertyId?: string
): Promise<void> {
  let targetPropId = propertyId;
  if (!targetPropId) {
    const unitSnap = await getDoc(doc(db, UNITS_COLL, unitId));
    if (unitSnap.exists()) {
      targetPropId = unitSnap.data().propertyId;
    }
  }

  if (!targetPropId) {
    throw new Error('Unit or propertyId not found.');
  }

  if (archive) {
    const archiveFn = createCallable<{ propertyId: string; unitId: string }, { success: boolean }>('archiveUnitCallable');
    await archiveFn({ propertyId: targetPropId, unitId });
  } else {
    const restoreFn = createCallable<{ propertyId: string; unitId: string }, { success: boolean }>('restoreUnitCallable');
    await restoreFn({ propertyId: targetPropId, unitId });
  }
}
