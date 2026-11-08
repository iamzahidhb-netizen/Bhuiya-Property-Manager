const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();

// Allowed unit types
const ALLOWED_UNIT_TYPES = new Set([
  'flat',
  'commercial',
  'office',
  'shop',
  'garage',
  'warehouse',
  'other',
]);

// Reserved JavaScript object prototype keys to prevent prototype collision / pollution
const DISALLOWED_UNIT_KEYS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'tostring',
  'valueof',
  'hasownproperty',
  'isprototypeof',
  'propertyisenumerable',
  'tolocalestring',
]);

const VALID_NORMALIZED_REGEX = /^[a-z0-9]+$/;
const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validates and normalizes unitNumber on the trusted backend.
 */
function validateAndNormalizeUnitNumber(unitNumber) {
  if (typeof unitNumber !== 'string') {
    throw new HttpsError('invalid-argument', 'unitNumber must be a string.');
  }

  const trimmed = unitNumber.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new HttpsError('invalid-argument', 'unitNumber length must be between 1 and 50 characters.');
  }

  const normalized = trimmed.toLowerCase().replace(/[\s\-_\/.,#]+/g, '');

  if (!normalized || !VALID_NORMALIZED_REGEX.test(normalized)) {
    throw new HttpsError('invalid-argument', 'Normalized unit number must be alphanumeric (^[a-z0-9]+$).');
  }

  if (normalized.length > 32) {
    throw new HttpsError('invalid-argument', 'Normalized unit number cannot exceed 32 characters.');
  }

  if (DISALLOWED_UNIT_KEYS.has(normalized)) {
    throw new HttpsError('invalid-argument', `Unit number "${unitNumber}" resolves to a reserved prototype identifier.`);
  }

  return { trimmed, normalized };
}

function validateId(id, fieldName) {
  if (typeof id !== 'string' || !ID_REGEX.test(id)) {
    throw new HttpsError('invalid-argument', `Invalid or missing ${fieldName}.`);
  }
  return id;
}

function validateNumber(value, fieldName, { min = 0, max = Infinity, integerOnly = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpsError('invalid-argument', `${fieldName} must be a valid, finite number.`);
  }
  if (value < min || value > max) {
    throw new HttpsError('invalid-argument', `${fieldName} must be between ${min} and ${max}.`);
  }
  if (integerOnly && !Number.isInteger(value)) {
    throw new HttpsError('invalid-argument', `${fieldName} must be an integer.`);
  }
  return value;
}

function validateOptionalString(value, fieldName, maxLength = 64) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpsError('invalid-argument', `${fieldName} exceeds maximum length of ${maxLength}.`);
  }
  return trimmed;
}

function hasUnitMapping(activeMap, key) {
  if (!activeMap || typeof activeMap !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(activeMap, key);
}

function createSafeMapping(rawMap) {
  const safe = Object.create(null);
  if (rawMap && typeof rawMap === 'object') {
    for (const key of Object.keys(rawMap)) {
      if (Object.prototype.hasOwnProperty.call(rawMap, key)) {
        safe[key] = rawMap[key];
      }
    }
  }
  return safe;
}

// =============================================================================
// 1. UNIT LIFECYCLE (CALLABLE CLOUD FUNCTIONS)
// =============================================================================

exports.createUnitCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const propertyId = validateId(payload.propertyId, 'propertyId');
  const { trimmed: unitNumber, normalized } = validateAndNormalizeUnitNumber(payload.unitNumber);

  const type = payload.type || 'flat';
  if (typeof type !== 'string' || !ALLOWED_UNIT_TYPES.has(type)) {
    throw new HttpsError('invalid-argument', `Invalid unit type "${type}". Allowed: ${Array.from(ALLOWED_UNIT_TYPES).join(', ')}.`);
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
      throw new HttpsError('not-found', 'Property does not exist.');
    }

    const propData = propSnap.data();
    if (propData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized: property does not belong to user.');
    }
    if (propData.isArchived) {
      throw new HttpsError('failed-precondition', 'Cannot add units to an archived property.');
    }

    const activeMap = createSafeMapping(propData.activeUnitNumbers);
    if (hasUnitMapping(activeMap, normalized)) {
      throw new HttpsError('already-exists', `Unit "${unitNumber}" already exists in this property.`);
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
});

exports.renameUnitCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const unitId = validateId(payload.unitId, 'unitId');
  const { trimmed: newUnitNumber, normalized: newNormalized } = validateAndNormalizeUnitNumber(payload.newUnitNumber);

  return await db.runTransaction(async (tx) => {
    const unitRef = db.collection('units').doc(unitId);
    const unitSnap = await tx.get(unitRef);
    if (!unitSnap.exists) throw new HttpsError('not-found', 'Unit does not exist.');
    const unitData = unitSnap.data();

    const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : unitData.propertyId;
    const propRef = db.collection('properties').doc(propertyId);
    const propSnap = await tx.get(propRef);
    if (!propSnap.exists) throw new HttpsError('not-found', 'Property does not exist.');
    const propData = propSnap.data();

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }
    if (unitData.propertyId !== propertyId) {
      throw new HttpsError('invalid-argument', 'Unit does not belong to specified property.');
    }

    const oldNormalized = unitData.normalizedUnitNumber;
    const activeMap = createSafeMapping(propData.activeUnitNumbers);

    if (unitData.isArchived) {
      tx.update(unitRef, {
        unitNumber: newUnitNumber,
        normalizedUnitNumber: newNormalized,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      if (newNormalized !== oldNormalized) {
        if (hasUnitMapping(activeMap, newNormalized) && activeMap[newNormalized] !== unitId) {
          throw new HttpsError('already-exists', `Unit "${newUnitNumber}" already exists in this property.`);
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
});

exports.archiveUnitCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const unitId = validateId(payload.unitId, 'unitId');

  return await db.runTransaction(async (tx) => {
    const unitRef = db.collection('units').doc(unitId);
    const unitSnap = await tx.get(unitRef);
    if (!unitSnap.exists) throw new HttpsError('not-found', 'Unit does not exist.');
    const unitData = unitSnap.data();

    const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : unitData.propertyId;
    const propRef = db.collection('properties').doc(propertyId);
    const propSnap = await tx.get(propRef);
    if (!propSnap.exists) throw new HttpsError('not-found', 'Property does not exist.');
    const propData = propSnap.data();

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }
    if (unitData.propertyId !== propertyId) {
      throw new HttpsError('invalid-argument', 'Unit does not belong to specified property.');
    }

    const normalized = unitData.normalizedUnitNumber;
    const activeMap = createSafeMapping(propData.activeUnitNumbers);

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
});

exports.restoreUnitCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const unitId = validateId(payload.unitId, 'unitId');

  return await db.runTransaction(async (tx) => {
    const unitRef = db.collection('units').doc(unitId);
    const unitSnap = await tx.get(unitRef);
    if (!unitSnap.exists) throw new HttpsError('not-found', 'Unit does not exist.');
    const unitData = unitSnap.data();

    const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : unitData.propertyId;
    const propRef = db.collection('properties').doc(propertyId);
    const propSnap = await tx.get(propRef);
    if (!propSnap.exists) throw new HttpsError('not-found', 'Property does not exist.');
    const propData = propSnap.data();

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }
    if (unitData.propertyId !== propertyId) {
      throw new HttpsError('invalid-argument', 'Unit does not belong to specified property.');
    }

    const normalized = unitData.normalizedUnitNumber;
    const activeMap = createSafeMapping(propData.activeUnitNumbers);

    if (hasUnitMapping(activeMap, normalized) && activeMap[normalized] !== unitId) {
      throw new HttpsError('already-exists', `Cannot restore: Key "${unitData.unitNumber}" (${normalized}) is occupied by another active unit.`);
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
});

// =============================================================================
// 2. TENANT LIFECYCLE (CALLABLE CLOUD FUNCTIONS - PHASE 3)
// =============================================================================

/**
 * Registers a new tenant and atomically occupies the vacant Unit.
 * If advanceDeposit > 0, creates a separate SecurityDeposit liability record.
 */
exports.registerTenantCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const propertyId = validateId(payload.propertyId, 'propertyId');
  const unitId = validateId(payload.unitId, 'unitId');

  const name = validateOptionalString(payload.name, 'name', 100);
  if (!name) {
    throw new HttpsError('invalid-argument', 'Tenant name is required.');
  }

  const mobile = validateOptionalString(payload.mobile, 'mobile', 30);
  if (!mobile) {
    throw new HttpsError('invalid-argument', 'Tenant mobile number is required.');
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

    if (!propSnap.exists) throw new HttpsError('not-found', 'Property does not exist.');
    if (!unitSnap.exists) throw new HttpsError('not-found', 'Unit does not exist.');

    const propData = propSnap.data();
    const unitData = unitSnap.data();

    if (propData.ownerUid !== callerUid || unitData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }
    if (propData.isArchived) {
      throw new HttpsError('failed-precondition', 'Cannot assign tenants to an archived property.');
    }
    if (unitData.isArchived) {
      throw new HttpsError('failed-precondition', 'Cannot assign tenants to an archived unit.');
    }

    // STRICT OCCUPANCY ENFORCEMENT: Only vacant units with no active tenant may be occupied
    if (unitData.status !== 'vacant' || unitData.currentTenantId) {
      throw new HttpsError('failed-precondition', `Unit is not vacant (status: ${unitData.status}). Cannot assign two active tenants to the same unit.`);
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
    let depositId = null;
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
});

/**
 * Vacates an active tenant, restores Unit status to 'vacant', and settles the security deposit.
 */
exports.vacateTenantCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const tenantId = validateId(payload.tenantId, 'tenantId');
  const vacatingDate = validateOptionalString(payload.vacatingDate, 'vacatingDate', 30) || new Date().toISOString().split('T')[0];
  const damageDeductions = validateNumber(payload.damageDeductions ?? 0, 'damageDeductions', { min: 0, max: 100000000 });
  const refundAmount = validateNumber(payload.refundAmount ?? 0, 'refundAmount', { min: 0, max: 100000000 });
  const settlementNotes = validateOptionalString(payload.settlementNotes, 'settlementNotes', 1000);

  return await db.runTransaction(async (tx) => {
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tx.get(tenantRef);

    if (!tenantSnap.exists) throw new HttpsError('not-found', 'Tenant does not exist.');
    const tenantData = tenantSnap.data();

    if (tenantData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }
    if (tenantData.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Tenant is already vacated or inactive.');
    }

    const unitRef = db.collection('units').doc(tenantData.unitId);
    const unitSnap = await tx.get(unitRef);

    // FETCH DEPOSIT SNAPSHOT BEFORE ANY WRITES (All reads must precede writes in Firestore)
    const depositId = payload.depositId ? validateId(payload.depositId, 'depositId') : null;
    let depSnap = null;
    let depositRef = null;
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
    if (depositRef && depSnap && depSnap.exists && depSnap.data().ownerUid === callerUid) {
      const totalHeld = depSnap.data().depositAmount || 0;
      const totalSettled = refundAmount + damageDeductions;
      const depositStatus = totalSettled >= totalHeld ? 'fully_refunded' : 'partially_refunded';

      tx.update(depositRef, {
        status: depositStatus,
        refundedAmount: refundAmount,
        damageDeductionAmount: damageDeductions,
        settlementDate: FieldValue.serverTimestamp(),
        notes: `${depSnap.data().notes || ''} | Settled: ${settlementNotes}`.trim(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      tenantId,
      unitId: tenantData.unitId,
    };
  });
});

// =============================================================================
// PHASE 4: RENT BILLING & PAYMENT MANAGEMENT
// =============================================================================

const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'bank', 'bkash', 'nagad', 'other']);
const BILLING_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Generates monthly bills for all active tenants.
 * Prevents duplicates idempotently.
 */
exports.generateMonthlyBillsCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const billingMonth = typeof payload.billingMonth === 'string' ? payload.billingMonth.trim() : '';
  if (!BILLING_MONTH_REGEX.test(billingMonth)) {
    throw new HttpsError('invalid-argument', 'billingMonth must be in YYYY-MM format (e.g. 2026-11).');
  }

  const propertyId = payload.propertyId ? validateId(payload.propertyId, 'propertyId') : null;

  // 1. Fetch active tenants for this owner
  let tenantsQuery = db.collection('tenants')
    .where('ownerUid', '==', callerUid)
    .where('status', '==', 'active');

  if (propertyId) {
    tenantsQuery = tenantsQuery.where('propertyId', '==', propertyId);
  }

  const [tenantsSnap, propsSnap, unitsSnap] = await Promise.all([
    tenantsQuery.get(),
    db.collection('properties').where('ownerUid', '==', callerUid).get(),
    db.collection('units').where('ownerUid', '==', callerUid).get(),
  ]);

  if (tenantsSnap.empty) {
    return {
      success: true,
      countCreated: 0,
      countSkipped: 0,
      totalAmountBilled: 0,
      message: 'No active tenants found to bill.',
    };
  }

  // Build property and unit lookup maps
  const propMap = new Map();
  propsSnap.forEach((doc) => propMap.set(doc.id, doc.data()));

  const unitMap = new Map();
  unitsSnap.forEach((doc) => unitMap.set(doc.id, doc.data()));

  // 2. Fetch existing bills for this billingMonth to guarantee duplicate prevention
  const existingBillsSnap = await db.collection('rent_bills')
    .where('ownerUid', '==', callerUid)
    .where('billingMonth', '==', billingMonth)
    .get();

  const existingTenantBillSet = new Set();
  existingBillsSnap.forEach((doc) => {
    existingTenantBillSet.add(doc.data().tenantId);
  });

  const batch = db.batch();
  let countCreated = 0;
  let countSkipped = 0;
  let totalAmountBilled = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    if (existingTenantBillSet.has(tenantId)) {
      countSkipped++;
      continue;
    }

    const tenant = tenantDoc.data();
    const prop = propMap.get(tenant.propertyId) || {};
    const unit = unitMap.get(tenant.unitId) || {};

    const rentAmount = Number(tenant.monthlyRent) || 0;
    const gasCharge = Number(tenant.gasCharge) || 0;
    const waterCharge = Number(tenant.waterCharge) || 0;
    const serviceCharge = Number(unit.serviceCharge) || 0;
    const totalDue = rentAmount + gasCharge + waterCharge + serviceCharge;

    // Deterministic Bill Document ID for idempotent generation
    const billDocId = `bill_${tenant.propertyId}_${tenantId}_${billingMonth.replace('-', '')}`;
    const billRef = db.collection('rent_bills').doc(billDocId);

    batch.set(billRef, {
      ownerUid: callerUid,
      propertyId: tenant.propertyId,
      propertyName: prop.name || 'Property',
      unitId: tenant.unitId,
      unitNumber: unit.unitNumber || 'Unit',
      tenantId,
      tenantName: tenant.name || 'Tenant',
      tenantMobile: tenant.mobile || '',
      billingMonth,
      rentAmount,
      gasCharge,
      waterCharge,
      serviceCharge,
      otherCharges: 0,
      totalDue,
      totalPaid: 0,
      balanceDue: totalDue,
      status: 'unpaid',
      dueDate: `${billingMonth}-10`,
      notes: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    countCreated++;
    totalAmountBilled += totalDue;
  }

  if (countCreated > 0) {
    await batch.commit();
  }

  return {
    success: true,
    billingMonth,
    countCreated,
    countSkipped,
    totalAmountBilled,
  };
});

/**
 * Records a full or partial rent payment against a monthly bill.
 * Atomically updates bill totalPaid, balanceDue, and status.
 * Prevents duplicate transactions and enforces financial integrity.
 */
exports.recordRentPaymentCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const billId = validateId(payload.billId, 'billId');
  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });

  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : '';
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new HttpsError('invalid-argument', `Invalid payment method. Allowed: ${Array.from(ALLOWED_PAYMENT_METHODS).join(', ')}`);
  }

  const transactionId = typeof payload.transactionId === 'string' ? payload.transactionId.trim() : null;
  if (transactionId && transactionId.length > 100) {
    throw new HttpsError('invalid-argument', 'transactionId cannot exceed 100 characters.');
  }

  const notes = validateOptionalString(payload.notes, 'notes', 500);
  const paymentDate = typeof payload.paymentDate === 'string' ? payload.paymentDate.trim() : null;

  // Duplicate digital transaction ID guard
  if (transactionId) {
    const existingTxSnap = await db.collection('rent_payments')
      .where('ownerUid', '==', callerUid)
      .where('transactionId', '==', transactionId)
      .where('entryType', '==', 'payment')
      .limit(1)
      .get();

    if (!existingTxSnap.empty) {
      throw new HttpsError('already-exists', `Duplicate transaction ID "${transactionId}". This payment has already been recorded.`);
    }
  }

  return await db.runTransaction(async (tx) => {
    const billRef = db.collection('rent_bills').doc(billId);
    const billSnap = await tx.get(billRef);

    if (!billSnap.exists) {
      throw new HttpsError('not-found', 'Rent bill not found.');
    }

    const bill = billSnap.data();
    if (bill.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized: bill does not belong to user.');
    }

    if (bill.status === 'paid' || bill.balanceDue <= 0) {
      throw new HttpsError('failed-precondition', 'This bill is already fully paid.');
    }

    if (amount > bill.balanceDue) {
      throw new HttpsError(
        'invalid-argument',
        `Payment amount (৳${amount.toLocaleString('en-IN')}) exceeds remaining balance due (৳${bill.balanceDue.toLocaleString('en-IN')}).`
      );
    }

    // Generate formatted receipt number
    const timestampStr = Date.now().toString().slice(-4);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString().slice(-2);
    const receiptNumber = `REC-${bill.billingMonth.replace('-', '')}-${timestampStr}${randomSuffix}`;

    const newTotalPaid = bill.totalPaid + amount;
    const newBalanceDue = Math.max(0, bill.totalDue - newTotalPaid);
    const newStatus = newBalanceDue === 0 ? 'paid' : 'partial';

    // 1. Create Payment Record (append-only ledger)
    const paymentRef = db.collection('rent_payments').doc();
    tx.set(paymentRef, {
      ownerUid: callerUid,
      billId,
      propertyId: bill.propertyId,
      propertyName: bill.propertyName,
      unitId: bill.unitId,
      unitNumber: bill.unitNumber,
      tenantId: bill.tenantId,
      tenantName: bill.tenantName,
      billingMonth: bill.billingMonth,
      amount,
      paymentMethod,
      transactionId: transactionId || null,
      receiptNumber,
      notes,
      entryType: 'payment',
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Atomically update Bill balances and status
    tx.update(billRef, {
      totalPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      paymentId: paymentRef.id,
      receiptNumber,
      amount,
      totalPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      status: newStatus,
      tenantName: bill.tenantName,
      unitNumber: bill.unitNumber,
      propertyName: bill.propertyName,
      billingMonth: bill.billingMonth,
    };
  });
});

// =============================================================================
// PHASE 5: EXPENSE MANAGEMENT
// =============================================================================

const ALLOWED_BUILDING_CATEGORIES = new Set([
  'electricity',
  'gas',
  'water',
  'caretaker_salary',
  'maintenance_repair',
  'cleaning',
  'security',
  'other_building',
]);

const ALLOWED_FAMILY_CATEGORIES = new Set([
  'bazaar',
  'invitation_event',
  'gift',
  'medical',
  'transport',
  'emergency',
  'other_family',
]);

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Validates expense category and group.
 */
function validateExpenseCategory(group, category) {
  if (group === 'building') {
    if (!ALLOWED_BUILDING_CATEGORIES.has(category)) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid building expense category "${category}". Allowed: ${Array.from(ALLOWED_BUILDING_CATEGORIES).join(', ')}`
      );
    }
  } else if (group === 'family') {
    if (!ALLOWED_FAMILY_CATEGORIES.has(category)) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid family expense category "${category}". Allowed: ${Array.from(ALLOWED_FAMILY_CATEGORIES).join(', ')}`
      );
    }
  } else {
    throw new HttpsError('invalid-argument', 'Expense group must be either "building" or "family".');
  }
}

/**
 * Create a new operating expense (Building or Family/Social).
 */
exports.createExpenseCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const title = validateOptionalString(payload.title, 'title', 150);
  if (!title) {
    throw new HttpsError('invalid-argument', 'Expense title is required.');
  }

  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const group = typeof payload.group === 'string' ? payload.group.toLowerCase().trim() : '';
  const category = typeof payload.category === 'string' ? payload.category.toLowerCase().trim() : '';
  validateExpenseCategory(group, category);

  const expenseDate = typeof payload.expenseDate === 'string' ? payload.expenseDate.trim() : '';
  if (!DATE_REGEX.test(expenseDate)) {
    throw new HttpsError('invalid-argument', 'expenseDate must be in YYYY-MM-DD format.');
  }
  const billingMonth = expenseDate.slice(0, 7);

  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : 'cash';
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new HttpsError('invalid-argument', `Invalid payment method "${paymentMethod}".`);
  }

  let propertyId = null;
  let propertyName = null;

  if (payload.propertyId) {
    propertyId = validateId(payload.propertyId, 'propertyId');
    const propSnap = await db.collection('properties').doc(propertyId).get();
    if (!propSnap.exists || propSnap.data().ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Property does not exist or unauthorized.');
    }
    propertyName = propSnap.data().name || propSnap.data().nameEn || 'Property';
  }

  const paidTo = validateOptionalString(payload.paidTo, 'paidTo', 150);
  const description = validateOptionalString(payload.description, 'description', 1000);
  const receiptUrl = validateOptionalString(payload.receiptUrl, 'receiptUrl', 500);

  const expenseRef = db.collection('expenses').doc();
  await expenseRef.set({
    ownerUid: callerUid,
    title,
    amount,
    group,
    category,
    propertyId: propertyId || null,
    propertyName: propertyName || null,
    expenseDate,
    billingMonth,
    paymentMethod,
    paidTo: paidTo || null,
    description: description || null,
    receiptUrl: receiptUrl || null,
    status: 'active',
    reversalReason: null,
    reversedAt: null,
    createdBy: request.auth.token.email || callerUid,
    auditHistory: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    expenseId: expenseRef.id,
    title,
    amount,
    group,
    category,
    billingMonth,
  };
});

/**
 * Edit an existing expense with mandatory audit reason and historical tracking.
 */
exports.updateExpenseCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const expenseId = validateId(payload.expenseId, 'expenseId');
  const reason = validateOptionalString(payload.reason, 'reason', 500);
  if (!reason) {
    throw new HttpsError('invalid-argument', 'A reason for editing is required to maintain financial audit history.');
  }

  const title = validateOptionalString(payload.title, 'title', 150);
  if (!title) {
    throw new HttpsError('invalid-argument', 'Expense title is required.');
  }

  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const group = typeof payload.group === 'string' ? payload.group.toLowerCase().trim() : '';
  const category = typeof payload.category === 'string' ? payload.category.toLowerCase().trim() : '';
  validateExpenseCategory(group, category);

  const expenseDate = typeof payload.expenseDate === 'string' ? payload.expenseDate.trim() : '';
  if (!DATE_REGEX.test(expenseDate)) {
    throw new HttpsError('invalid-argument', 'expenseDate must be in YYYY-MM-DD format.');
  }
  const billingMonth = expenseDate.slice(0, 7);

  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : 'cash';
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new HttpsError('invalid-argument', `Invalid payment method "${paymentMethod}".`);
  }

  let propertyId = null;
  let propertyName = null;
  if (payload.propertyId) {
    propertyId = validateId(payload.propertyId, 'propertyId');
    const propSnap = await db.collection('properties').doc(propertyId).get();
    if (!propSnap.exists || propSnap.data().ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Property does not exist or unauthorized.');
    }
    propertyName = propSnap.data().name || 'Property';
  }

  const paidTo = validateOptionalString(payload.paidTo, 'paidTo', 150);
  const description = validateOptionalString(payload.description, 'description', 1000);
  const receiptUrl = validateOptionalString(payload.receiptUrl, 'receiptUrl', 500);

  return await db.runTransaction(async (tx) => {
    const expenseRef = db.collection('expenses').doc(expenseId);
    const snap = await tx.get(expenseRef);

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Expense record not found.');
    }

    const oldData = snap.data();
    if (oldData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized: expense record does not belong to user.');
    }

    if (oldData.status === 'reversed') {
      throw new HttpsError('failed-precondition', 'Cannot edit a reversed expense record.');
    }

    // Create immutable audit entry
    const auditEntry = {
      editedAt: new Date().toISOString(),
      editedBy: request.auth.token.email || callerUid,
      reason,
      previousAmount: oldData.amount,
      newAmount: amount,
      previousTitle: oldData.title,
      newTitle: title,
      previousCategory: oldData.category,
      newCategory: category,
    };

    const currentHistory = Array.isArray(oldData.auditHistory) ? oldData.auditHistory : [];
    const updatedHistory = [...currentHistory, auditEntry];

    tx.update(expenseRef, {
      title,
      amount,
      group,
      category,
      propertyId: propertyId || null,
      propertyName: propertyName || null,
      expenseDate,
      billingMonth,
      paymentMethod,
      paidTo: paidTo || null,
      description: description || null,
      receiptUrl: receiptUrl || null,
      auditHistory: updatedHistory,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      expenseId,
      newAmount: amount,
      auditEntriesCount: updatedHistory.length,
    };
  });
});

/**
 * Reverses an expense with an audit reason. Financial records are never hard-deleted.
 */
exports.reverseExpenseCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const expenseId = validateId(payload.expenseId, 'expenseId');
  const reason = validateOptionalString(payload.reason, 'reason', 500);
  if (!reason) {
    throw new HttpsError('invalid-argument', 'A reason is required to reverse an expense record.');
  }

  return await db.runTransaction(async (tx) => {
    const expenseRef = db.collection('expenses').doc(expenseId);
    const snap = await tx.get(expenseRef);

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Expense record not found.');
    }

    const data = snap.data();
    if (data.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }

    if (data.status === 'reversed') {
      throw new HttpsError('failed-precondition', 'This expense has already been reversed.');
    }

    const auditEntry = {
      editedAt: new Date().toISOString(),
      editedBy: request.auth.token.email || callerUid,
      reason: `[REVERSAL] ${reason}`,
      previousAmount: data.amount,
      newAmount: 0,
      previousTitle: data.title,
      newTitle: `[REVERSED] ${data.title}`,
      previousCategory: data.category,
      newCategory: data.category,
    };

    const currentHistory = Array.isArray(data.auditHistory) ? data.auditHistory : [];

    tx.update(expenseRef, {
      status: 'reversed',
      reversalReason: reason,
      auditHistory: [...currentHistory, auditEntry],
      reversedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      expenseId,
      status: 'reversed',
    };
  });
});

// =============================================================================
// PHASE 6: BENEFICIARY MANAGEMENT, FAMILY DISTRIBUTION & RESERVE FUND
// =============================================================================

function getBeneficiaryTargetForMonth(beneficiary, targetMonth) {
  if (Array.isArray(beneficiary.targetHistory) && beneficiary.targetHistory.length > 0) {
    const applicable = beneficiary.targetHistory
      .filter((h) => typeof h.effectiveFromMonth === 'string' && h.effectiveFromMonth <= targetMonth)
      .sort((a, b) => (a.effectiveFromMonth < b.effectiveFromMonth ? -1 : 1));

    if (applicable.length > 0) {
      return applicable[applicable.length - 1].monthlyTarget;
    }
  }
  return beneficiary.defaultMonthlyTarget || 0;
}

/**
 * Idempotently seed the initial default family beneficiaries (Brother 1-3, Mother, Sister).
 * Total default: ৳185,000.
 */
exports.seedDefaultBeneficiariesCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;

  const existingSnap = await db.collection('beneficiaries')
    .where('ownerUid', '==', callerUid)
    .where('isArchived', '==', false)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return {
      success: true,
      seeded: false,
      message: 'Beneficiaries already initialized for this owner.',
    };
  }

  const initialDefaults = [
    { name: 'Brother 1', relationship: 'brother', defaultMonthlyTarget: 45000, priorityOrder: 1 },
    { name: 'Brother 2', relationship: 'brother', defaultMonthlyTarget: 45000, priorityOrder: 2 },
    { name: 'Brother 3', relationship: 'brother', defaultMonthlyTarget: 45000, priorityOrder: 3 },
    { name: 'Mother', relationship: 'mother', defaultMonthlyTarget: 25000, priorityOrder: 4 },
    { name: 'Sister', relationship: 'sister', defaultMonthlyTarget: 25000, priorityOrder: 5 },
  ];

  const batch = db.batch();
  const createdIds = [];

  for (const b of initialDefaults) {
    const docRef = db.collection('beneficiaries').doc();
    createdIds.push(docRef.id);
    batch.set(docRef, {
      ownerUid: callerUid,
      name: b.name,
      relationship: b.relationship,
      defaultMonthlyTarget: b.defaultMonthlyTarget,
      effectiveFromMonth: '2026-01',
      targetHistory: [
        {
          monthlyTarget: b.defaultMonthlyTarget,
          effectiveFromMonth: '2026-01',
          updatedAt: new Date().toISOString(),
          reason: 'Initial system default allocation',
        },
      ],
      payoutMethod: { type: 'bank' },
      status: 'active',
      isArchived: false,
      priorityOrder: b.priorityOrder,
      notes: 'Initial default family beneficiary',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return {
    success: true,
    seeded: true,
    count: createdIds.length,
    beneficiaryIds: createdIds,
    totalTarget: 185000,
  };
});

/**
 * Create a new dynamic beneficiary.
 */
exports.createBeneficiaryCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const name = validateOptionalString(payload.name, 'name', 100);
  if (!name) {
    throw new HttpsError('invalid-argument', 'Beneficiary name is required.');
  }

  const relationship = typeof payload.relationship === 'string' ? payload.relationship.toLowerCase().trim() : 'other';
  if (!['brother', 'mother', 'sister', 'other'].includes(relationship)) {
    throw new HttpsError('invalid-argument', 'Invalid relationship type.');
  }

  const defaultMonthlyTarget = validateNumber(payload.defaultMonthlyTarget, 'defaultMonthlyTarget', { min: 1, max: 100000000 });
  const effectiveFromMonth = typeof payload.effectiveFromMonth === 'string' && BILLING_MONTH_REGEX.test(payload.effectiveFromMonth.trim())
    ? payload.effectiveFromMonth.trim()
    : new Date().toISOString().slice(0, 7);

  const priorityOrder = typeof payload.priorityOrder === 'number' ? payload.priorityOrder : 10;
  const notes = validateOptionalString(payload.notes, 'notes', 500);

  const payoutMethod = payload.payoutMethod && typeof payload.payoutMethod === 'object'
    ? {
        type: typeof payload.payoutMethod.type === 'string' ? payload.payoutMethod.type.toLowerCase().trim() : 'bank',
        accountNo: validateOptionalString(payload.payoutMethod.accountNo, 'accountNo', 50),
        routingNo: validateOptionalString(payload.payoutMethod.routingNo, 'routingNo', 50),
        bankName: validateOptionalString(payload.payoutMethod.bankName, 'bankName', 100),
      }
    : { type: 'bank' };

  const docRef = db.collection('beneficiaries').doc();
  await docRef.set({
    ownerUid: callerUid,
    name,
    relationship,
    defaultMonthlyTarget,
    effectiveFromMonth,
    targetHistory: [
      {
        monthlyTarget: defaultMonthlyTarget,
        effectiveFromMonth,
        updatedAt: new Date().toISOString(),
        reason: 'Beneficiary registered',
      },
    ],
    payoutMethod,
    status: 'active',
    isArchived: false,
    priorityOrder,
    notes: notes || '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    beneficiaryId: docRef.id,
    name,
    defaultMonthlyTarget,
    effectiveFromMonth,
  };
});

/**
 * Edit an existing beneficiary (supports effective date for target changes).
 */
exports.updateBeneficiaryCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const docRef = db.collection('beneficiaries').doc(beneficiaryId);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'Beneficiary record not found.');
  }
  const current = snap.data();
  if (current.ownerUid !== callerUid) {
    throw new HttpsError('permission-denied', 'Unauthorized.');
  }
  if (current.isArchived) {
    throw new HttpsError('failed-precondition', 'Cannot edit an archived beneficiary.');
  }

  const updates = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (payload.name !== undefined) {
    const name = validateOptionalString(payload.name, 'name', 100);
    if (!name) throw new HttpsError('invalid-argument', 'Beneficiary name cannot be empty.');
    updates.name = name;
  }

  if (payload.relationship !== undefined) {
    const relationship = typeof payload.relationship === 'string' ? payload.relationship.toLowerCase().trim() : 'other';
    if (!['brother', 'mother', 'sister', 'other'].includes(relationship)) {
      throw new HttpsError('invalid-argument', 'Invalid relationship.');
    }
    updates.relationship = relationship;
  }

  if (payload.status !== undefined) {
    const status = typeof payload.status === 'string' ? payload.status.toLowerCase().trim() : 'active';
    if (!['active', 'inactive'].includes(status)) {
      throw new HttpsError('invalid-argument', 'Status must be active or inactive.');
    }
    updates.status = status;
  }

  if (payload.priorityOrder !== undefined) {
    updates.priorityOrder = validateNumber(payload.priorityOrder, 'priorityOrder', { min: 1, max: 999, integerOnly: true });
  }

  if (payload.notes !== undefined) {
    updates.notes = validateOptionalString(payload.notes, 'notes', 500);
  }

  if (payload.payoutMethod !== undefined && typeof payload.payoutMethod === 'object') {
    updates.payoutMethod = {
      type: typeof payload.payoutMethod.type === 'string' ? payload.payoutMethod.type.toLowerCase().trim() : 'bank',
      accountNo: validateOptionalString(payload.payoutMethod.accountNo, 'accountNo', 50),
      routingNo: validateOptionalString(payload.payoutMethod.routingNo, 'routingNo', 50),
      bankName: validateOptionalString(payload.payoutMethod.bankName, 'bankName', 100),
    };
  }

  if (payload.defaultMonthlyTarget !== undefined) {
    const newTarget = validateNumber(payload.defaultMonthlyTarget, 'defaultMonthlyTarget', { min: 1, max: 100000000 });
    const effectiveFromMonth = typeof payload.effectiveFromMonth === 'string' && BILLING_MONTH_REGEX.test(payload.effectiveFromMonth.trim())
      ? payload.effectiveFromMonth.trim()
      : new Date().toISOString().slice(0, 7);
    const reason = validateOptionalString(payload.reason, 'reason', 300);

    updates.defaultMonthlyTarget = newTarget;
    updates.effectiveFromMonth = effectiveFromMonth;

    const currentHistory = Array.isArray(current.targetHistory) ? current.targetHistory : [];
    updates.targetHistory = [
      ...currentHistory,
      {
        monthlyTarget: newTarget,
        effectiveFromMonth,
        updatedAt: new Date().toISOString(),
        reason: reason || 'Target updated',
      },
    ];
  }

  await docRef.update(updates);

  return {
    success: true,
    beneficiaryId,
  };
});

/**
 * Archive a beneficiary.
 */
exports.archiveBeneficiaryCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const docRef = db.collection('beneficiaries').doc(beneficiaryId);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'Beneficiary record not found.');
  }
  if (snap.data().ownerUid !== callerUid) {
    throw new HttpsError('permission-denied', 'Unauthorized.');
  }

  await docRef.update({
    status: 'archived',
    isArchived: true,
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, beneficiaryId };
});

/**
 * Create or retrieve an immutable monthly distribution snapshot.
 * Historical snapshots NEVER change when future beneficiary settings are edited.
 */
exports.getOrCreateMonthlyDistributionCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!BILLING_MONTH_REGEX.test(distributionMonth)) {
    throw new HttpsError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const distributionDocId = `${callerUid}_${distributionMonth}`;
  const distRef = db.collection('family_distributions').doc(distributionDocId);

  return await db.runTransaction(async (tx) => {
    const existingSnap = await tx.get(distRef);

    // If historical snapshot exists, return it unchanged!
    if (existingSnap.exists) {
      const data = existingSnap.data();
      return {
        success: true,
        isNew: false,
        distributionId: distributionDocId,
        distributionMonth,
        calculatedTargetTotal: data.calculatedTargetTotal,
        finalTargetTotal: data.finalTargetTotal,
        actualTotalDisbursed: data.actualTotalDisbursed,
        remainingPendingTotal: data.remainingPendingTotal,
        beneficiarySnapshots: data.beneficiarySnapshots,
      };
    }

    // Retrieve active beneficiaries to build fresh monthly snapshot
    const beneficiariesSnap = await tx.get(
      db.collection('beneficiaries')
        .where('ownerUid', '==', callerUid)
        .where('status', '==', 'active')
        .where('isArchived', '==', false)
    );

    const beneficiaryDocs = [];
    beneficiariesSnap.forEach((doc) => {
      beneficiaryDocs.push({ id: doc.id, ...doc.data() });
    });

    beneficiaryDocs.sort((a, b) => (a.priorityOrder || 10) - (b.priorityOrder || 10));

    let calculatedTargetTotal = 0;
    const snapshots = [];

    for (const b of beneficiaryDocs) {
      const target = getBeneficiaryTargetForMonth(b, distributionMonth);
      calculatedTargetTotal += target;

      snapshots.push({
        beneficiaryId: b.id,
        name: b.name,
        relationship: b.relationship || 'other',
        baseMonthlyTarget: target,
        specialAdjustment: 0,
        adjustmentReason: null,
        effectiveTarget: target,
        actualDisbursed: 0,
        pendingAmount: target,
        payoutStatus: 'unpaid',
        payouts: [],
      });
    }

    const newDist = {
      ownerUid: callerUid,
      distributionMonth,
      calculatedTargetTotal,
      specialAdjustmentTotal: 0,
      finalTargetTotal: calculatedTargetTotal,
      netRentCollected: 0,
      totalExpensesDeducted: 0,
      distributableSurplus: 0,
      actualTotalDisbursed: 0,
      remainingPendingTotal: calculatedTargetTotal,
      reserveInflow: 0,
      surplusTransferredToReserve: 0,
      status: 'draft',
      isFinalized: false,
      finalizedAt: null,
      beneficiarySnapshots: snapshots,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.set(distRef, newDist);

    return {
      success: true,
      isNew: true,
      distributionId: distributionDocId,
      distributionMonth,
      calculatedTargetTotal,
      finalTargetTotal: calculatedTargetTotal,
      actualTotalDisbursed: 0,
      remainingPendingTotal: calculatedTargetTotal,
      beneficiarySnapshots: snapshots,
    };
  });
});

/**
 * Apply a special monthly adjustment (e.g. Eid bonus or medical assistance) to a beneficiary.
 */
exports.applySpecialAdjustmentCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!BILLING_MONTH_REGEX.test(distributionMonth)) {
    throw new HttpsError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const adjustmentAmount = validateNumber(payload.adjustmentAmount, 'adjustmentAmount', { min: -10000000, max: 10000000 });
  const reason = validateOptionalString(payload.reason, 'reason', 300);

  const distributionDocId = `${callerUid}_${distributionMonth}`;
  const distRef = db.collection('family_distributions').doc(distributionDocId);

  return await db.runTransaction(async (tx) => {
    const distSnap = await tx.get(distRef);
    if (!distSnap.exists) {
      throw new HttpsError('not-found', 'Monthly distribution not initialized.');
    }
    const distData = distSnap.data();
    if (distData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }

    const snapshots = Array.isArray(distData.beneficiarySnapshots) ? distData.beneficiarySnapshots : [];
    const idx = snapshots.findIndex((s) => s.beneficiaryId === beneficiaryId);
    if (idx === -1) {
      throw new HttpsError('not-found', 'Beneficiary not in monthly distribution snapshot.');
    }

    const b = { ...snapshots[idx] };
    b.specialAdjustment = adjustmentAmount;
    b.adjustmentReason = reason || null;
    b.effectiveTarget = Math.max(0, b.baseMonthlyTarget + adjustmentAmount);
    b.pendingAmount = Math.max(0, b.effectiveTarget - (b.actualDisbursed || 0));
    b.payoutStatus = b.pendingAmount <= 0 ? 'paid' : (b.actualDisbursed > 0 ? 'partial' : 'unpaid');

    const updatedSnapshots = [...snapshots];
    updatedSnapshots[idx] = b;

    let specialAdjustmentTotal = 0;
    let finalTargetTotal = 0;
    for (const item of updatedSnapshots) {
      specialAdjustmentTotal += (item.specialAdjustment || 0);
      finalTargetTotal += item.effectiveTarget;
    }

    const remainingPendingTotal = Math.max(0, finalTargetTotal - (distData.actualTotalDisbursed || 0));

    tx.update(distRef, {
      specialAdjustmentTotal,
      finalTargetTotal,
      remainingPendingTotal,
      beneficiarySnapshots: updatedSnapshots,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      beneficiaryId,
      newEffectiveTarget: b.effectiveTarget,
      specialAdjustmentTotal,
      finalTargetTotal,
      remainingPendingTotal,
    };
  });
});

/**
 * Record a beneficiary payout.
 * Strictly verifies that payout does not exceed approved available operating funds + reserve inflow.
 */
exports.recordBeneficiaryPayoutCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!BILLING_MONTH_REGEX.test(distributionMonth)) {
    throw new HttpsError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const beneficiaryId = validateId(payload.beneficiaryId, 'beneficiaryId');
  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.toLowerCase().trim() : 'cash';
  const paymentDate = typeof payload.paymentDate === 'string' && DATE_REGEX.test(payload.paymentDate.trim())
    ? payload.paymentDate.trim()
    : new Date().toISOString().slice(0, 10);
  const transactionId = validateOptionalString(payload.transactionId, 'transactionId', 100);
  const notes = validateOptionalString(payload.notes, 'notes', 500);

  const distributionDocId = `${callerUid}_${distributionMonth}`;
  const distRef = db.collection('family_distributions').doc(distributionDocId);

  return await db.runTransaction(async (tx) => {
    // 1. ALL READS FIRST:
    const distSnap = await tx.get(distRef);
    if (!distSnap.exists) {
      throw new HttpsError('not-found', `Distribution snapshot for month ${distributionMonth} does not exist. Please initialize the distribution first.`);
    }

    const distData = distSnap.data();
    if (distData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }

    const paymentsSnap = await tx.get(
      db.collection('rent_payments')
        .where('ownerUid', '==', callerUid)
        .where('billingMonth', '==', distributionMonth)
        .where('entryType', '==', 'payment')
    );

    const expensesSnap = await tx.get(
      db.collection('expenses')
        .where('ownerUid', '==', callerUid)
        .where('billingMonth', '==', distributionMonth)
        .where('status', '==', 'active')
    );

    // Actual rent & utility collections (strictly excluding security deposits and liabilities)
    let totalCollected = 0;
    paymentsSnap.forEach((doc) => {
      totalCollected += (doc.data().amount || 0);
    });

    // Actual building + family operating expenses
    let totalExpenses = 0;
    expensesSnap.forEach((doc) => {
      totalExpenses += (doc.data().amount || 0);
    });

    const netOperatingBalance = totalCollected - totalExpenses;
    const reserveInflow = distData.reserveInflow || 0;
    const totalApprovedPool = netOperatingBalance + reserveInflow;
    const alreadyDisbursed = distData.actualTotalDisbursed || 0;
    const availableFunds = totalApprovedPool - alreadyDisbursed;

    if (amount > availableFunds) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot disburse beyond approved available funds. Available: ৳${availableFunds}, requested: ৳${amount}.`
      );
    }

    const snapshots = Array.isArray(distData.beneficiarySnapshots) ? distData.beneficiarySnapshots : [];
    const bIndex = snapshots.findIndex((s) => s.beneficiaryId === beneficiaryId);
    if (bIndex === -1) {
      throw new HttpsError('not-found', 'Beneficiary not found in this monthly distribution snapshot.');
    }

    const bSnapshot = { ...snapshots[bIndex] };
    const remainingTarget = bSnapshot.effectiveTarget - (bSnapshot.actualDisbursed || 0);
    if (amount > remainingTarget) {
      throw new HttpsError(
        'invalid-argument',
        `Payout amount (৳${amount}) exceeds remaining target for ${bSnapshot.name} (৳${remainingTarget}).`
      );
    }

    // 2. NOW WRITES:
    const payoutRecord = {
      id: `payout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount,
      paymentDate,
      paymentMethod,
      transactionId: transactionId || null,
      notes: notes || null,
      paidAt: new Date().toISOString(),
      paidBy: request.auth.token.email || callerUid,
    };

    bSnapshot.actualDisbursed = (bSnapshot.actualDisbursed || 0) + amount;
    bSnapshot.pendingAmount = Math.max(0, bSnapshot.effectiveTarget - bSnapshot.actualDisbursed);
    bSnapshot.payoutStatus = bSnapshot.pendingAmount <= 0 ? 'paid' : 'partial';
    bSnapshot.payouts = [...(bSnapshot.payouts || []), payoutRecord];

    const updatedSnapshots = [...snapshots];
    updatedSnapshots[bIndex] = bSnapshot;

    const newTotalDisbursed = alreadyDisbursed + amount;
    const newRemainingPending = Math.max(0, (distData.finalTargetTotal || 0) - newTotalDisbursed);
    const newStatus = newRemainingPending <= 0 ? 'finalized' : 'in_progress';

    tx.update(distRef, {
      netRentCollected: totalCollected,
      totalExpensesDeducted: totalExpenses,
      distributableSurplus: netOperatingBalance,
      actualTotalDisbursed: newTotalDisbursed,
      remainingPendingTotal: newRemainingPending,
      status: newStatus,
      isFinalized: newStatus === 'finalized',
      beneficiarySnapshots: updatedSnapshots,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      payoutId: payoutRecord.id,
      beneficiaryId,
      amount,
      beneficiaryName: bSnapshot.name,
      newActualDisbursed: bSnapshot.actualDisbursed,
      remainingTarget: bSnapshot.pendingAmount,
      totalDisbursed: newTotalDisbursed,
      payoutStatus: bSnapshot.payoutStatus,
    };
  });
});

/**
 * Initialize or seed Reserve Fund opening balance.
 */
exports.initializeReserveFundCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const initialBalance = typeof payload.initialBalance === 'number' && payload.initialBalance >= 0
    ? payload.initialBalance
    : 0;

  const fundRef = db.collection('reserve_funds').doc(callerUid);

  return await db.runTransaction(async (tx) => {
    const fundSnap = await tx.get(fundRef);

    if (fundSnap.exists) {
      return {
        success: true,
        alreadyInitialized: true,
        currentBalance: fundSnap.data().currentBalance || 0,
      };
    }

    tx.set(fundRef, {
      ownerUid: callerUid,
      currentBalance: initialBalance,
      totalDeposited: initialBalance,
      totalWithdrawn: 0,
      lastTransactionAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (initialBalance > 0) {
      const ledgerRef = db.collection('reserve_ledger').doc();
      tx.set(ledgerRef, {
        ownerUid: callerUid,
        type: 'opening_balance',
        amount: initialBalance,
        balanceBefore: 0,
        balanceAfter: initialBalance,
        reason: 'Initial Reserve Fund opening balance',
        distributionMonth: null,
        isRentalIncome: false,
        createdBy: request.auth.token.email || callerUid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      alreadyInitialized: false,
      currentBalance: initialBalance,
    };
  });
});

/**
 * Withdraw funds from Family Reserve Fund to cover operating shortage or emergency.
 * Strictly prevents negative reserve balance.
 * Reserve withdrawals must NEVER be counted as rental income.
 */
exports.withdrawFromReserveCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const reason = validateOptionalString(payload.reason, 'reason', 500);
  if (!reason) {
    throw new HttpsError('invalid-argument', 'A reason for reserve withdrawal is required.');
  }

  const distributionMonth = typeof payload.distributionMonth === 'string' && BILLING_MONTH_REGEX.test(payload.distributionMonth.trim())
    ? payload.distributionMonth.trim()
    : null;

  const fundRef = db.collection('reserve_funds').doc(callerUid);
  const distRef = distributionMonth
    ? db.collection('family_distributions').doc(`${callerUid}_${distributionMonth}`)
    : null;

  return await db.runTransaction(async (tx) => {
    // 1. ALL READS:
    const fundSnap = await tx.get(fundRef);
    if (!fundSnap.exists) {
      throw new HttpsError('failed-precondition', 'Reserve fund account has not been initialized.');
    }
    const fundData = fundSnap.data();
    if (fundData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }

    const currentBalance = fundData.currentBalance || 0;
    if (currentBalance < amount) {
      throw new HttpsError(
        'failed-precondition',
        `Insufficient reserve fund balance. Available: ৳${currentBalance}, requested: ৳${amount}. Negative reserve balance is strictly prohibited.`
      );
    }

    let distSnap = null;
    if (distRef) {
      distSnap = await tx.get(distRef);
      if (!distSnap.exists) {
        throw new HttpsError('not-found', `Distribution snapshot for month ${distributionMonth} not found.`);
      }
    }

    // 2. ALL WRITES:
    const newBalance = currentBalance - amount;
    tx.update(fundRef, {
      currentBalance: newBalance,
      totalWithdrawn: (fundData.totalWithdrawn || 0) + amount,
      lastTransactionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (distRef && distSnap && distSnap.exists) {
      const distData = distSnap.data();
      const currentInflow = distData.reserveInflow || 0;
      tx.update(distRef, {
        reserveInflow: currentInflow + amount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const ledgerRef = db.collection('reserve_ledger').doc();
    tx.set(ledgerRef, {
      ownerUid: callerUid,
      type: 'shortage_withdrawal',
      amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      reason,
      distributionMonth: distributionMonth || null,
      isRentalIncome: false, // Critical rule: never rental income
      createdBy: request.auth.token.email || callerUid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      amount,
      previousBalance: currentBalance,
      newBalance,
      distributionMonth,
      reason,
    };
  });
});

/**
 * Transfer monthly distributable surplus to the Family Reserve Fund.
 */
exports.transferSurplusToReserveCallable = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerUid = request.auth.uid;
  const payload = request.data || {};

  const distributionMonth = typeof payload.distributionMonth === 'string' ? payload.distributionMonth.trim() : '';
  if (!BILLING_MONTH_REGEX.test(distributionMonth)) {
    throw new HttpsError('invalid-argument', 'distributionMonth must be in YYYY-MM format.');
  }

  const amount = validateNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
  const reason = validateOptionalString(payload.reason, 'reason', 500) || `Monthly surplus transfer for ${distributionMonth}`;

  const fundRef = db.collection('reserve_funds').doc(callerUid);
  const distRef = db.collection('family_distributions').doc(`${callerUid}_${distributionMonth}`);

  return await db.runTransaction(async (tx) => {
    // 1. ALL READS:
    const distSnap = await tx.get(distRef);
    if (!distSnap.exists) {
      throw new HttpsError('not-found', `Distribution snapshot for month ${distributionMonth} not found.`);
    }
    const distData = distSnap.data();
    if (distData.ownerUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Unauthorized.');
    }

    const fundSnap = await tx.get(fundRef);

    // Calculate actual collections and expenses
    const paymentsSnap = await tx.get(
      db.collection('rent_payments')
        .where('ownerUid', '==', callerUid)
        .where('billingMonth', '==', distributionMonth)
        .where('entryType', '==', 'payment')
    );

    const expensesSnap = await tx.get(
      db.collection('expenses')
        .where('ownerUid', '==', callerUid)
        .where('billingMonth', '==', distributionMonth)
        .where('status', '==', 'active')
    );

    let totalCollected = 0;
    paymentsSnap.forEach((doc) => {
      totalCollected += (doc.data().amount || 0);
    });

    let totalExpenses = 0;
    expensesSnap.forEach((doc) => {
      totalExpenses += (doc.data().amount || 0);
    });

    const netOperatingBalance = totalCollected - totalExpenses;
    const totalDisbursed = distData.actualTotalDisbursed || 0;
    const alreadyTransferred = distData.surplusTransferredToReserve || 0;
    const availableSurplus = Math.max(0, netOperatingBalance - totalDisbursed - alreadyTransferred);

    if (amount > availableSurplus) {
      throw new HttpsError(
        'failed-precondition',
        `Requested surplus transfer (৳${amount}) exceeds available monthly surplus (৳${availableSurplus}).`
      );
    }

    // 2. ALL WRITES:
    let balanceBefore = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;

    if (fundSnap.exists) {
      const fundData = fundSnap.data();
      balanceBefore = fundData.currentBalance || 0;
      totalDeposited = fundData.totalDeposited || 0;
      totalWithdrawn = fundData.totalWithdrawn || 0;
    }

    const newBalance = balanceBefore + amount;

    tx.set(fundRef, {
      ownerUid: callerUid,
      currentBalance: newBalance,
      totalDeposited: totalDeposited + amount,
      totalWithdrawn,
      lastTransactionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.update(distRef, {
      surplusTransferredToReserve: alreadyTransferred + amount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = db.collection('reserve_ledger').doc();
    tx.set(ledgerRef, {
      ownerUid: callerUid,
      type: 'surplus_deposit',
      amount,
      balanceBefore,
      balanceAfter: newBalance,
      reason,
      distributionMonth,
      isRentalIncome: false,
      createdBy: request.auth.token.email || callerUid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      amount,
      previousBalance: balanceBefore,
      newBalance,
      distributionMonth,
    };
  });
});
