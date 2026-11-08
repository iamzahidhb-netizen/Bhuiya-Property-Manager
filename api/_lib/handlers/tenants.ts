import { db, FieldValue } from '../firebaseAdmin.ts';
import {
  ApiError,
  validateId,
  validateNumber,
  validateOptionalString,
} from '../validation.ts';

export async function registerTenantCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; tenantId: string; depositId: string | null }> {
  const propertyId = validateId(payload.propertyId, 'propertyId');
  const unitId = validateId(payload.unitId, 'unitId');

  const name = validateOptionalString(payload.name, 'name', 100);
  if (!name) {
    throw new ApiError('invalid-argument', 'Tenant name is required.');
  }

  const mobile = validateOptionalString(payload.mobile, 'mobile', 30);
  if (!mobile) {
    throw new ApiError('invalid-argument', 'Tenant mobile number is required.');
  }

  const nid = validateOptionalString(payload.nid, 'nid', 30);
  const address = validateOptionalString(payload.address, 'address', 300);
  const notes = validateOptionalString(payload.notes, 'notes', 1000);
  const moveInDate = validateOptionalString(payload.moveInDate, 'moveInDate', 30);

  const monthlyRent = validateNumber(payload.monthlyRent ?? 0, 'monthlyRent', { min: 0, max: 100000000 });
  const gasCharge = validateNumber(payload.gasCharge ?? 0, 'gasCharge', { min: 0, max: 10000000 });
  const waterCharge = validateNumber(payload.waterCharge ?? 0, 'waterCharge', { min: 0, max: 10000000 });
  const advanceDeposit = validateNumber(payload.advanceDeposit ?? 0, 'advanceDeposit', { min: 0, max: 100000000 });

  return await db.runTransaction(async (tx) => {
    const propRef = db.collection('properties').doc(propertyId);
    const unitRef = db.collection('units').doc(unitId);

    const [propSnap, unitSnap] = await Promise.all([tx.get(propRef), tx.get(unitRef)]);

    if (!propSnap.exists) throw new ApiError('not-found', 'Property does not exist.');
    if (!unitSnap.exists) throw new ApiError('not-found', 'Unit does not exist.');

    const propData = propSnap.data()!;
    const unitData = unitSnap.data()!;

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }
    if (propData.isArchived) {
      throw new ApiError('failed-precondition', 'Cannot assign tenants to an archived property.');
    }
    if (unitData.isArchived) {
      throw new ApiError('failed-precondition', 'Cannot assign tenants to an archived unit.');
    }

    // STRICT OCCUPANCY ENFORCEMENT: Only vacant units with no active tenant may be occupied
    if (unitData.status !== 'vacant' || unitData.currentTenantId) {
      throw new ApiError('failed-precondition', `Unit is not vacant (status: ${unitData.status}). Cannot assign two active tenants to the same unit.`);
    }

    // 1. Create Tenant Document
    const tenantRef = db.collection('tenants').doc();
    tx.set(tenantRef, {
      ownerUid: callerUid,
      propertyId,
      unitId,
      name,
      mobile,
      nid,
      address,
      monthlyRent,
      gasCharge,
      waterCharge,
      advanceDeposit,
      moveInDate: moveInDate || new Date().toISOString().split('T')[0],
      notes,
      status: 'active',
      isArchived: false,
      vacatingDate: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Atomically Occupy Unit
    tx.update(unitRef, {
      status: 'occupied',
      currentTenantId: tenantRef.id,
      monthlyRent,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. If Advance/Security Deposit paid, record as Liability
    let depositId: string | null = null;
    if (advanceDeposit > 0) {
      const depositRef = db.collection('security_deposits').doc();
      depositId = depositRef.id;
      tx.set(depositRef, {
        ownerUid: callerUid,
        propertyId,
        unitId,
        tenantId: tenantRef.id,
        depositAmount: advanceDeposit,
        receivedDate: FieldValue.serverTimestamp(),
        status: 'held',
        refundedAmount: 0,
        damageDeductionAmount: 0,
        settlementDate: null,
        classification: 'liability',
        notes: `Security deposit received on tenant registration (${name})`,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      tenantId: tenantRef.id,
      depositId,
    };
  });
}

export async function vacateTenantCallable(
  callerUid: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; tenantId: string; unitId: string }> {
  const tenantId = validateId(payload.tenantId, 'tenantId');
  const vacatingDate = validateOptionalString(payload.vacatingDate, 'vacatingDate', 30) || new Date().toISOString().split('T')[0];
  const damageDeductions = validateNumber(payload.damageDeductions ?? 0, 'damageDeductions', { min: 0, max: 100000000 });
  const refundAmount = validateNumber(payload.refundAmount ?? 0, 'refundAmount', { min: 0, max: 100000000 });
  const settlementNotes = validateOptionalString(payload.settlementNotes, 'settlementNotes', 1000);

  return await db.runTransaction(async (tx) => {
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tx.get(tenantRef);

    if (!tenantSnap.exists) throw new ApiError('not-found', 'Tenant does not exist.');
    const tenantData = tenantSnap.data()!;

    if (tenantData.ownerUid !== callerUid) {
      throw new ApiError('permission-denied', 'Unauthorized.');
    }
    if (tenantData.status !== 'active') {
      throw new ApiError('failed-precondition', 'Tenant is already vacated or inactive.');
    }

    const unitRef = db.collection('units').doc(tenantData.unitId as string);
    const unitSnap = await tx.get(unitRef);

    // FETCH DEPOSIT SNAPSHOT BEFORE ANY WRITES (All reads must precede writes in Firestore)
    const depositId = payload.depositId ? validateId(payload.depositId, 'depositId') : null;
    let depSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    let depositRef: FirebaseFirestore.DocumentReference | null = null;
    if (depositId) {
      depositRef = db.collection('security_deposits').doc(depositId);
      depSnap = await tx.get(depositRef);
    }

    // 1. Vacate Unit
    if (unitSnap.exists) {
      tx.update(unitRef, {
        status: 'vacant',
        currentTenantId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // 2. Update Tenant record (Preserve full history, never delete)
    tx.update(tenantRef, {
      status: 'vacated',
      vacatingDate,
      finalDamageDeductions: damageDeductions,
      finalRefundAmount: refundAmount,
      settlementNotes,
      settledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. Settle Security Deposit if depositId provided
    if (depositRef && depSnap && depSnap.exists && depSnap.data()?.ownerUid === callerUid) {
      const totalHeld = depSnap.data()?.depositAmount || 0;
      const totalSettled = refundAmount + damageDeductions;
      const depositStatus = totalSettled >= totalHeld ? 'fully_refunded' : 'partially_refunded';

      tx.update(depositRef, {
        status: depositStatus,
        refundedAmount: refundAmount,
        damageDeductionAmount: damageDeductions,
        settlementDate: FieldValue.serverTimestamp(),
        notes: `${depSnap.data()?.notes || ''} | Settled: ${settlementNotes}`.trim(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      tenantId,
      unitId: tenantData.unitId as string,
    };
  });
}
