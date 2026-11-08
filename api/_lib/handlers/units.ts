import { db, FieldValue } from '../firebaseAdmin.ts';
import {
  ApiError,
  ALLOWED_UNIT_TYPES,
  validateId,
  validateNumber,
  validateOptionalString,
  validateAndNormalizeUnitNumber,
  hasUnitMapping,
  createSafeMapping,
} from '../validation.ts';

export async function createUnitCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; unitId: string; normalizedUnitNumber: string }> {
  const propertyId = validateId(payload.propertyId, 'propertyId');
  const { trimmed: unitNumber, normalized } = validateAndNormalizeUnitNumber(payload.unitNumber);

  const type = payload.type || 'flat';
  if (typeof type !== 'string' || !ALLOWED_UNIT_TYPES.has(type)) {
    throw new ApiError('invalid-argument', `Invalid unit type "${type}". Allowed: ${Array.from(ALLOWED_UNIT_TYPES).join(', ')}.`);
  }

  const floor = validateNumber(payload.floor ?? 1, 'floor', { min: -10, max: 200, integerOnly: true });
  const monthlyRent = validateNumber(payload.monthlyRent ?? 0, 'monthlyRent', { min: 0, max: 100000000 });
  const serviceCharge = validateNumber(payload.serviceCharge ?? 0, 'serviceCharge', { min: 0, max: 10000000 });

  const notes = validateOptionalString(payload.notes, 'notes', 1000);
  const electricityMeterNumber = validateOptionalString(payload.electricityMeterNumber, 'electricityMeterNumber', 64);
  const gasMeterNumber = validateOptionalString(payload.gasMeterNumber, 'gasMeterNumber', 64);

  return await db.runTransaction(async (tx) => {
    const propRef = db.collection('properties').doc(propertyId);
    const propSnap = await tx.get(propRef);

    if (!propSnap.exists) {
      throw new ApiError('not-found', 'Property does not exist.');
    }

    const propData = propSnap.data()!;
    if (propData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized: property does not belong to user.');
    }
    if (propData.isArchived) {
      throw new ApiError('failed-precondition', 'Cannot add units to an archived property.');
    }

    const activeMap = createSafeMapping(propData.activeUnitNumbers as Record<string, string>);
    if (hasUnitMapping(activeMap, normalized)) {
      throw new ApiError('already-exists', `Unit "${unitNumber}" already exists in this property.`);
    }

    const newUnitRef = db.collection('units').doc();
    tx.set(newUnitRef, {
      ownerUid: callerUid,
      propertyId,
      unitNumber,
      normalizedUnitNumber: normalized,
      type,
      floor,
      monthlyRent,
      serviceCharge,
      status: 'vacant',
      currentTenantId: null,
      electricityMeterNumber,
      gasMeterNumber,
      notes,
      isArchived: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    activeMap[normalized] = newUnitRef.id;
    tx.update(propRef, {
      activeUnitNumbers: Object.assign({}, activeMap),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, unitId: newUnitRef.id, normalizedUnitNumber: normalized };
  });
}

export async function renameUnitCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; unitId: string; newNormalized: string }> {
  const unitId = validateId(payload.unitId, 'unitId');
  const { trimmed: newUnitNumber, normalized: newNormalized } = validateAndNormalizeUnitNumber(payload.newUnitNumber);

  return await db.runTransaction(async (tx) => {
    const unitRef = db.collection('units').doc(unitId);
    const unitSnap = await tx.get(unitRef);
    if (!unitSnap.exists) throw new ApiError('not-found', 'Unit does not exist.');
    const unitData = unitSnap.data()!;

    const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : unitData.propertyId;
    const propRef = db.collection('properties').doc(propertyId);
    const propSnap = await tx.get(propRef);
    if (!propSnap.exists) throw new ApiError('not-found', 'Property does not exist.');
    const propData = propSnap.data()!;

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }
    if (unitData.propertyId !== propertyId) {
      throw new ApiError('invalid-argument', 'Unit does not belong to specified property.');
    }

    const oldNormalized = unitData.normalizedUnitNumber;
    const activeMap = createSafeMapping(propData.activeUnitNumbers as Record<string, string>);

    if (unitData.isArchived) {
      tx.update(unitRef, {
        unitNumber: newUnitNumber,
        normalizedUnitNumber: newNormalized,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      if (newNormalized !== oldNormalized) {
        if (hasUnitMapping(activeMap, newNormalized) && activeMap[newNormalized] !== unitId) {
          throw new ApiError('already-exists', `Unit "${newUnitNumber}" already exists in this property.`);
        }

        delete activeMap[oldNormalized];
        activeMap[newNormalized] = unitId;

        tx.update(propRef, {
          activeUnitNumbers: Object.assign({}, activeMap),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.update(unitRef, {
        unitNumber: newUnitNumber,
        normalizedUnitNumber: newNormalized,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { success: true, unitId, newNormalized };
  });
}

export async function archiveUnitCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; unitId: string; isArchived: boolean }> {
  const unitId = validateId(payload.unitId, 'unitId');

  return await db.runTransaction(async (tx) => {
    const unitRef = db.collection('units').doc(unitId);
    const unitSnap = await tx.get(unitRef);
    if (!unitSnap.exists) throw new ApiError('not-found', 'Unit does not exist.');
    const unitData = unitSnap.data()!;

    const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : unitData.propertyId;
    const propRef = db.collection('properties').doc(propertyId);
    const propSnap = await tx.get(propRef);
    if (!propSnap.exists) throw new ApiError('not-found', 'Property does not exist.');
    const propData = propSnap.data()!;

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }
    if (unitData.propertyId !== propertyId) {
      throw new ApiError('invalid-argument', 'Unit does not belong to specified property.');
    }

    const normalized = unitData.normalizedUnitNumber;
    const activeMap = createSafeMapping(propData.activeUnitNumbers as Record<string, string>);

    if (hasUnitMapping(activeMap, normalized) && activeMap[normalized] === unitId) {
      delete activeMap[normalized];
    }

    tx.update(propRef, {
      activeUnitNumbers: Object.assign({}, activeMap),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(unitRef, {
      isArchived: true,
      status: 'archived',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, unitId, isArchived: true };
  });
}

export async function restoreUnitCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; unitId: string; isArchived: boolean }> {
  const unitId = validateId(payload.unitId, 'unitId');

  return await db.runTransaction(async (tx) => {
    const unitRef = db.collection('units').doc(unitId);
    const unitSnap = await tx.get(unitRef);
    if (!unitSnap.exists) throw new ApiError('not-found', 'Unit does not exist.');
    const unitData = unitSnap.data()!;

    const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : unitData.propertyId;
    const propRef = db.collection('properties').doc(propertyId);
    const propSnap = await tx.get(propRef);
    if (!propSnap.exists) throw new ApiError('not-found', 'Property does not exist.');
    const propData = propSnap.data()!;

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }
    if (unitData.propertyId !== propertyId) {
      throw new ApiError('invalid-argument', 'Unit does not belong to specified property.');
    }

    const normalized = unitData.normalizedUnitNumber;
    const activeMap = createSafeMapping(propData.activeUnitNumbers as Record<string, string>);

    if (hasUnitMapping(activeMap, normalized) && activeMap[normalized] !== unitId) {
      throw new ApiError('already-exists', `Cannot restore: Key "${unitData.unitNumber}" (${normalized}) is occupied by another active unit.`);
    }

    activeMap[normalized] = unitId;

    tx.update(propRef, {
      activeUnitNumbers: Object.assign({}, activeMap),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(unitRef, {
      isArchived: false,
      status: 'vacant',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, unitId, isArchived: false };
  });
}
