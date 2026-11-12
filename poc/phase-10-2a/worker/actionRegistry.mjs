/**
 * Phase 10.2B-2: Unified Action Registry for All 21 Backend Operations
 * 
 * Defines schemas, validation, RBAC mapping, and execution handlers.
 * Enforces packaging gate (disableFinancialWrites) to guarantee zero live writes.
 */

import { ACTION_PERMISSIONS, sanitizeClientPayload, normalizePermissions } from '../workspaceAuth.mjs';
import { getGoogleAdminAccessToken } from '../serviceAccountAuth.mjs';

function validateRequired(payload, fieldName, type = 'string') {
  const val = payload[fieldName];
  if (val === undefined || val === null || val === '') {
    const err = new Error(`Missing required field: "${fieldName}"`);
    err.code = 'INVALID_ARGUMENT';
    err.status = 400;
    throw err;
  }
  if (type === 'number' && (typeof val !== 'number' || isNaN(val))) {
    const err = new Error(`Field "${fieldName}" must be a valid number`);
    err.code = 'INVALID_ARGUMENT';
    err.status = 400;
    throw err;
  }
}

function validatePositiveNumber(payload, fieldName) {
  validateRequired(payload, fieldName, 'number');
  if (payload[fieldName] < 0) {
    const err = new Error(`Field "${fieldName}" must be a positive number`);
    err.code = 'INVALID_ARGUMENT';
    err.status = 400;
    throw err;
  }
}

function validateMonth(payload, fieldName = 'billingMonth') {
  validateRequired(payload, fieldName);
  if (!/^\d{4}-\d{2}$/.test(payload[fieldName])) {
    const err = new Error(`Field "${fieldName}" must match format YYYY-MM`);
    err.code = 'INVALID_ARGUMENT';
    err.status = 400;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers for live (non-packaging) administrative actions
// ---------------------------------------------------------------------------

const ALLOWED_UNIT_TYPES = new Set([
  'flat', 'shop', 'room', 'office', 'warehouse', 'other', 'commercial', 'garage',
]);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function fail(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function newDocumentId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function optionalString(value, fieldName, maxLength = 500) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw fail('INVALID_ARGUMENT', `Field "${fieldName}" must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw fail('INVALID_ARGUMENT', `Field "${fieldName}" exceeds ${maxLength} characters`);
  }
  return trimmed;
}

function finiteNumber(value, fieldName, { min = -Infinity, max = Infinity } = {}) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw fail('INVALID_ARGUMENT', `Field "${fieldName}" must be a valid number`);
  }
  if (num < min || num > max) {
    throw fail('INVALID_ARGUMENT', `Field "${fieldName}" is out of the allowed range`);
  }
  return num;
}

/**
 * Every administrative write must target a record that belongs to the caller's
 * authorized workspace (or, for legacy documents, the caller's own ownerUid).
 */
function assertResourceAccess(ctx, data, label = 'Record') {
  if (!data) throw fail('NOT_FOUND', `${label} not found.`, 404);
  const workspaceId = ctx.authContext.workspaceId;
  if (data.workspaceId && data.workspaceId !== workspaceId) {
    throw fail('PERMISSION_DENIED', 'Record belongs to another workspace.', 403);
  }
  if (!data.workspaceId && data.ownerUid && data.ownerUid !== ctx.authContext.uid) {
    throw fail('PERMISSION_DENIED', 'Unauthorized record access.', 403);
  }
}

function normalizedUnitKey(unitNumber) {
  return String(unitNumber).trim().toLowerCase().replace(/[\s\-_/.,#]+/g, '');
}

function parseUnitNumber(raw) {
  const trimmed = optionalString(raw, 'unitNumber', 50);
  if (!trimmed) throw fail('INVALID_ARGUMENT', 'Field "unitNumber" is required');
  const normalized = normalizedUnitKey(trimmed);
  if (!/^[a-z0-9]{1,32}$/.test(normalized)) {
    throw fail('INVALID_ARGUMENT', 'Unit number must normalize to 1-32 alphanumeric characters.');
  }
  return { trimmed, normalized };
}

function readUnitMap(raw) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value) out[String(key).toLowerCase()] = value;
    }
  }
  return out;
}

const AUDIT_ENTITY_BY_ACTION = {
  createPropertyCallable: ['property', 'propertyId'],
  updatePropertyCallable: ['property', 'propertyId'],
  archivePropertyCallable: ['property', 'propertyId'],
  deletePropertyCallable: ['property', 'propertyId'],
  createUnitCallable: ['unit', 'unitId'],
  renameUnitCallable: ['unit', 'unitId'],
  updateUnitCallable: ['unit', 'unitId'],
  archiveUnitCallable: ['unit', 'unitId'],
  restoreUnitCallable: ['unit', 'unitId'],
  deleteUnitCallable: ['unit', 'unitId'],
  registerTenantCallable: ['tenant', 'tenantId'],
  updateTenantCallable: ['tenant', 'tenantId'],
  vacateTenantCallable: ['tenant', 'tenantId'],
  generateMonthlyBillsCallable: ['rent_bill', 'billingMonth'],
  recordRentPaymentCallable: ['rent_payment', 'billId'],
  createExpenseCallable: ['expense', 'expenseId'],
  updateExpenseCallable: ['expense', 'expenseId'],
  reverseExpenseCallable: ['expense', 'expenseId'],
  seedDefaultBeneficiariesCallable: ['beneficiary', 'workspaceId'],
  createBeneficiaryCallable: ['beneficiary', 'beneficiaryId'],
  updateBeneficiaryCallable: ['beneficiary', 'beneficiaryId'],
  archiveBeneficiaryCallable: ['beneficiary', 'beneficiaryId'],
  getOrCreateMonthlyDistributionCallable: ['family_distribution', 'distributionMonth'],
  applySpecialAdjustmentCallable: ['family_distribution', 'distributionId'],
  recordBeneficiaryPayoutCallable: ['family_distribution', 'distributionId'],
  initializeReserveFundCallable: ['reserve_fund', 'workspaceId'],
  withdrawFromReserveCallable: ['reserve_fund', 'workspaceId'],
  transferSurplusToReserveCallable: ['reserve_fund', 'workspaceId'],
  reverseRentPaymentCallable: ['rent_payment', 'paymentId'],
  cancelRentBillCallable: ['rent_bill', 'billId'],
  refundSecurityDepositCallable: ['security_deposit', 'depositId'],
  restoreBeneficiaryCallable: ['beneficiary', 'beneficiaryId'],
  getBeneficiaryHistoryCallable: ['beneficiary', 'beneficiaryId'],
  createWorkspaceMemberCallable: ['workspace_member', 'email'],
  updateWorkspaceMemberPermissionsCallable: ['workspace_member', 'targetUid'],
  updateWorkspaceMemberStatusCallable: ['workspace_member', 'targetUid'],
  sendWorkspaceMemberPasswordResetCallable: ['workspace_member', 'email'],
  inviteFamilyMemberCallable: ['workspace_member', 'email'],
  updateMemberPermissionsCallable: ['workspace_member', 'targetUid'],
  deactivateFamilyMemberCallable: ['workspace_member', 'targetUid'],
};

const AUDIT_COLLECTION_BY_ENTITY = {
  property: 'properties',
  unit: 'units',
  tenant: 'tenants',
  rent_bill: 'rent_bills',
  rent_payment: 'rent_payments',
  expense: 'expenses',
  beneficiary: 'beneficiaries',
  family_distribution: 'family_distributions',
  reserve_fund: 'reserve_funds',
  security_deposit: 'security_deposits',
  workspace_member: 'workspace_members',
};

const REDACTED_AUDIT_KEYS = new Set([
  'password', 'initialpassword', 'token', 'idtoken', 'refreshtoken',
  'privatekey', 'serviceaccount', 'apikey', 'authorization',
]);

function sanitizeAuditPayload(payload) {
  const safe = {};
  let count = 0;
  for (const [key, value] of Object.entries(payload || {})) {
    if (count >= 40) break;
    count += 1;
    const lowerKey = key.toLowerCase();
    if (REDACTED_AUDIT_KEYS.has(lowerKey)) {
      safe[key] = '[REDACTED]';
    } else if (value === null || value === undefined) {
      safe[key] = null;
    } else if (typeof value === 'string') {
      safe[key] = value.length > 300 ? `${value.slice(0, 300)}…` : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = value.slice(0, 10);
    } else {
      safe[key] = '[object]';
    }
  }
  return safe;
}

function operationFromAction(actionName) {
  const match = /^(create|update|archive|restore|rename|delete|vacate|reverse|record|generate|seed|apply|withdraw|transfer|initialize|invite|deactivate|send|get|list)/i
    .exec(actionName);
  return match ? match[1].toLowerCase() : 'execute';
}

async function readAuditTarget(ctx, actionName, payload) {
  const mapping = AUDIT_ENTITY_BY_ACTION[actionName];
  if (!mapping || !ctx?.firestore) return null;
  const [entityType, idField] = mapping;
  const collection = AUDIT_COLLECTION_BY_ENTITY[entityType];
  const documentId = payload?.[idField];
  if (!collection || typeof documentId !== 'string' || !documentId) return null;
  try {
    const existing = await ctx.firestore.getDocument(collection, documentId);
    return existing?.data || null;
  } catch (error) {
    console.warn(`[Audit] Could not read previous values for ${actionName}:`, error?.message || error);
    return null;
  }
}

/**
 * Best-effort immutable audit trail. The business transaction commits first;
 * an audit write failure is logged but never hides a successful mutation.
 * Read-only list actions are intentionally excluded.
 */
async function recordAuditLog(ctx, actionName, payload, outcome, previousValues = null) {
  if (!ctx || !ctx.firestore || ctx.config?.disableFinancialWrites) return;
  const mapping = AUDIT_ENTITY_BY_ACTION[actionName];
  if (!mapping) return;
  const [entityType, idField] = mapping;
  const result = outcome?.result || {};
  const documentId =
    (typeof result?.[idField] === 'string' && result[idField]) ||
    (typeof payload?.[idField] === 'string' && payload[idField]) ||
    '';
  const auditId = newDocumentId('audit');
  const record = {
    workspaceId: ctx.authContext.workspaceId,
    actorUid: ctx.authContext.uid,
    actorEmail: ctx.verifiedUser?.email || '',
    action: actionName,
    operation: operationFromAction(actionName),
    entityType,
    documentId,
    status: outcome?.status || 'unknown',
    errorCode: outcome?.errorCode || null,
    previousValues: previousValues ? sanitizeAuditPayload(previousValues) : null,
    updatedValues: sanitizeAuditPayload(payload),
    reason: typeof payload?.reason === 'string' ? payload.reason.slice(0, 500) : null,
    relatedTransactionId: typeof result?.transactionId === 'string' ? result.transactionId : null,
    source: 'cloudflare-worker',
    createdAt: new Date(),
  };
  try {
    await ctx.firestore.createDocument('audit_logs', auditId, record);
  } catch (auditError) {
    console.warn(`[Audit] Failed to persist audit record for ${actionName}:`, auditError?.message || auditError);
  }
}


/**
 * Normalizes client payloads to bridge frontend/backend DTO divergences safely
 */
export function normalizeActionPayload(actionName, rawPayload) {
  const p = { ...(rawPayload || {}) };

  switch (actionName) {
    case 'createPropertyCallable':
      if (p.totalFloors !== undefined) p.totalFloors = Number(p.totalFloors) || 1;
      break;

    case 'archivePropertyCallable':
      if (p.isArchived === undefined && p.archive !== undefined) {
        p.isArchived = Boolean(p.archive);
      }
      if (p.isArchived === undefined) {
        p.isArchived = true;
      }
      break;

    case 'registerTenantCallable':
      p.phone = p.phone || p.mobile;
      p.mobile = p.mobile || p.phone;
      if (p.securityDeposit === undefined && p.advanceDeposit !== undefined) p.securityDeposit = p.advanceDeposit;
      if (p.advanceDeposit === undefined && p.securityDeposit !== undefined) p.advanceDeposit = p.securityDeposit;
      if (p.monthlyRent === undefined && p.rentAmount !== undefined) p.monthlyRent = p.rentAmount;
      break;

    case 'vacateTenantCallable':
      p.vacateDate = p.vacateDate || p.vacatingDate;
      p.vacatingDate = p.vacatingDate || p.vacateDate;
      if (p.refundAmount === undefined) p.refundAmount = 0;
      break;

    case 'updateTenantCallable':
      p.mobile = p.mobile || p.phone;
      break;

    case 'generateMonthlyBillsCallable':
      if (!p.propertyId) p.propertyId = 'all';
      break;

    case 'recordRentPaymentCallable':
      if (!p.paymentDate) p.paymentDate = new Date().toISOString().slice(0, 10);
      break;

    case 'createExpenseCallable':
      if (!p.billingMonth && p.expenseDate && typeof p.expenseDate === 'string') {
        p.billingMonth = p.expenseDate.slice(0, 7);
      }
      if (!p.description && p.title) p.description = p.title;
      if (!p.title && p.description) p.title = p.description;
      if (!p.paymentMethod) p.paymentMethod = 'cash';
      break;

    case 'initializeReserveFundCallable':
      if (p.openingBalance === undefined && p.initialBalance !== undefined) {
        p.openingBalance = p.initialBalance;
      }
      if (p.openingBalance === undefined) p.openingBalance = 0;
      break;

    case 'withdrawFromReserveCallable':
      if (!p.recipientName) p.recipientName = 'Authorized Member';
      if (!p.paymentMethod) p.paymentMethod = 'cash';
      break;

    case 'transferSurplusToReserveCallable':
      p.fromBillingMonth = p.fromBillingMonth || p.distributionMonth || p.month;
      break;
    case 'reverseRentPaymentCallable':
      p.paymentId = p.paymentId || p.rentPaymentId;
      break;
    case 'cancelRentBillCallable':
      p.billId = p.billId || p.rentBillId;
      break;
    case 'refundSecurityDepositCallable':
      p.depositId = p.depositId || p.securityDepositId;
      break;

    case 'getOrCreateMonthlyDistributionCallable':
      p.distributionMonth = p.distributionMonth || p.billingMonth || p.month;
      p.billingMonth = p.billingMonth || p.distributionMonth;
      break;

    case 'applySpecialAdjustmentCallable':
    case 'recordBeneficiaryPayoutCallable':
      p.distributionId = p.distributionId || p.distributionMonth;
      p.distributionMonth = p.distributionMonth || p.distributionId;
      if (!p.paymentDate) p.paymentDate = new Date().toISOString().slice(0, 10);
      break;

    case 'createWorkspaceMemberCallable':
    case 'inviteFamilyMemberCallable':
      p.email = (p.email || p.targetEmail || '').trim().toLowerCase();
      p.displayName = p.displayName || p.fullName || p.name || (p.email ? p.email.split('@')[0] : 'Member');
      p.role = p.role || p.assignedRole || 'viewer';
      p.password = p.password || p.initialPassword || '';
      p.permissions = p.permissions || {};
      p.mobile = p.mobile || p.phone || null;
      p.confirmExistingLink = Boolean(p.confirmExistingLink);
      break;

    case 'updateWorkspaceMemberPermissionsCallable':
    case 'updateMemberPermissionsCallable':
      p.targetUid = p.targetUid || p.uid;
      p.role = p.role || p.assignedRole || 'viewer';
      p.permissions = p.permissions || {};
      break;

    case 'updateWorkspaceMemberStatusCallable':
    case 'deactivateFamilyMemberCallable':
      p.targetUid = p.targetUid || p.uid;
      p.status = p.status || (p.isActive === false ? 'inactive' : 'active');
      break;

    case 'sendWorkspaceMemberPasswordResetCallable':
      p.email = (p.email || p.targetEmail || '').trim().toLowerCase();
      p.targetUid = p.targetUid || p.uid;
      break;
  }

  return p;
}

export const ACTION_REGISTRY = {
  // ===========================================================================
  // GROUP 0: PROPERTY LIFECYCLE (3 Actions)
  // ===========================================================================
  'createPropertyCallable': {
    permission: ACTION_PERMISSIONS['createPropertyCallable'],
    validate: (p) => {
      validateRequired(p, 'name');
      validateRequired(p, 'type');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return {
          success: true,
          action: 'createPropertyCallable',
          status: 'PACKAGING_VALIDATED',
          propertyId: payload.propertyId || `mock_prop_${Date.now()}`
        };
      }
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const propertyId = payload.propertyId || `prop_${workspaceId}_${Date.now()}`;
        return await ctx.firestore.runTransaction(async (tx) => {
          tx.create('properties', propertyId, {
            name: payload.name.trim(),
            nameEn: (payload.nameEn || '').trim(),
            code: (payload.code || '').trim().toLowerCase(),
            type: payload.type,
            address: (payload.address || '').trim(),
            totalFloors: Number(payload.totalFloors) || 1,
            description: (payload.description || '').trim(),
            status: 'active',
            isArchived: false,
            activeUnitNumbers: {},
            workspaceId,
            ownerUid: ctx.authContext.uid,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          return { success: true, action: 'createPropertyCallable', propertyId };
        });
      }
      throw new Error('Live execution not configured in packaging phase');
    }
  },
  'updatePropertyCallable': {
    permission: ACTION_PERMISSIONS['updatePropertyCallable'],
    validate: (p) => {
      validateRequired(p, 'propertyId');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return {
          success: true,
          action: 'updatePropertyCallable',
          status: 'PACKAGING_VALIDATED',
          propertyId: payload.propertyId
        };
      }
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        return await ctx.firestore.runTransaction(async (tx) => {
          const updates = { updatedAt: new Date() };
          if (payload.name !== undefined) updates.name = payload.name.trim();
          if (payload.nameEn !== undefined) updates.nameEn = payload.nameEn.trim();
          if (payload.code !== undefined) updates.code = payload.code.trim().toLowerCase();
          if (payload.type !== undefined) updates.type = payload.type;
          if (payload.address !== undefined) updates.address = payload.address.trim();
          if (payload.totalFloors !== undefined) updates.totalFloors = Number(payload.totalFloors);
          if (payload.description !== undefined) updates.description = payload.description.trim();
          tx.update('properties', payload.propertyId, updates);
          return { success: true, action: 'updatePropertyCallable', propertyId: payload.propertyId };
        });
      }
      throw new Error('Live execution not configured');
    }
  },
  'archivePropertyCallable': {
    permission: ACTION_PERMISSIONS['archivePropertyCallable'],
    validate: (p) => {
      validateRequired(p, 'propertyId');
    },
    execute: async (ctx, payload) => {
      const isArchived = payload.isArchived !== undefined ? Boolean(payload.isArchived) : true;
      if (ctx.config.disableFinancialWrites) {
        return {
          success: true,
          action: 'archivePropertyCallable',
          status: 'PACKAGING_VALIDATED',
          propertyId: payload.propertyId,
          isArchived
        };
      }
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        return await ctx.firestore.runTransaction(async (tx) => {
          tx.update('properties', payload.propertyId, {
            isArchived,
            status: isArchived ? 'archived' : 'active',
            updatedAt: new Date()
          });
          return { success: true, action: 'archivePropertyCallable', propertyId: payload.propertyId, isArchived };
        });
      }
      throw new Error('Live execution not configured');
    }
  },

  'deletePropertyCallable': {
    permission: ACTION_PERMISSIONS['deletePropertyCallable'],
    validate: (p) => validateRequired(p, 'propertyId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'deletePropertyCallable', status: 'PACKAGING_VALIDATED', propertyId: payload.propertyId };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const property = await ctx.firestore.getDocument('properties', String(payload.propertyId));
      assertResourceAccess(ctx, property?.data, 'Property');
      if (!property.data.isArchived) {
        throw fail('FAILED_PRECONDITION', 'Archive the property before permanently deleting it.', 412);
      }
      const bills = await ctx.firestore.queryByField('rent_bills', 'propertyId', 'EQUAL', String(payload.propertyId));
      if (bills.length > 0) {
        throw fail('FAILED_PRECONDITION', 'Cannot permanently delete a property that has billing history.', 412);
      }
      const tenants = await ctx.firestore.queryByField('tenants', 'propertyId', 'EQUAL', String(payload.propertyId));
      if (tenants.length > 0) {
        throw fail('FAILED_PRECONDITION', 'Cannot permanently delete a property that has tenant history. Archive it instead.', 412);
      }
      const units = await ctx.firestore.queryByField('units', 'propertyId', 'EQUAL', String(payload.propertyId));
      if (units.some((unit) => !unit.data.isArchived)) {
        throw fail('FAILED_PRECONDITION', 'Archive every unit before permanently deleting the property.', 412);
      }
      return await ctx.firestore.runTransaction(async (tx) => {
        for (const unit of units) {
          tx.delete('units', unit.id);
        }
        tx.delete('properties', payload.propertyId);
        return { success: true, action: 'deletePropertyCallable', propertyId: payload.propertyId, deletedUnits: units.length };
      });
    }
  },

  // ===========================================================================
  // GROUP 1: UNITS & PROPERTY LIFECYCLE (4 Actions)
  // ===========================================================================
  'createUnitCallable': {
    permission: ACTION_PERMISSIONS['createUnitCallable'],
    validate: (p) => {
      validateRequired(p, 'propertyId');
      validateRequired(p, 'unitNumber');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'createUnitCallable', status: 'PACKAGING_VALIDATED', unitId: `mock_${Date.now()}` };
      }
      const propertyId = String(payload.propertyId);
      const { trimmed: unitNumber, normalized } = parseUnitNumber(payload.unitNumber);
      const type = payload.type || 'flat';
      if (!ALLOWED_UNIT_TYPES.has(type)) {
        throw fail('INVALID_ARGUMENT', `Invalid unit type "${type}".`);
      }
      const floor = finiteNumber(payload.floor ?? 1, 'floor', { min: -10, max: 200 });
      const monthlyRent = finiteNumber(payload.monthlyRent ?? 0, 'monthlyRent', { min: 0, max: 100000000 });
      const serviceCharge = finiteNumber(payload.serviceCharge ?? 0, 'serviceCharge', { min: 0, max: 10000000 });
      const notes = optionalString(payload.notes, 'notes', 1000);
      const electricityMeterNumber = optionalString(payload.electricityMeterNumber, 'electricityMeterNumber', 64);
      const gasMeterNumber = optionalString(payload.gasMeterNumber, 'gasMeterNumber', 64);

      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);

      return await ctx.firestore.runTransaction(async (tx) => {
        const property = await tx.get('properties', propertyId);
        assertResourceAccess(ctx, property?.data, 'Property');
        if (property.data.isArchived) {
          throw fail('FAILED_PRECONDITION', 'Cannot add units to an archived property.', 412);
        }
        const activeMap = readUnitMap(property.data.activeUnitNumbers);
        if (activeMap[normalized]) {
          throw fail('ALREADY_EXISTS', `Unit "${unitNumber}" already exists in this property.`, 409);
        }
        const unitId = payload.unitId || newDocumentId('unit');
        tx.create('units', unitId, {
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
          workspaceId: ctx.authContext.workspaceId,
          ownerUid: ctx.authContext.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        activeMap[normalized] = unitId;
        tx.update('properties', propertyId, {
          activeUnitNumbers: activeMap,
          updatedAt: new Date(),
        });
        return { success: true, action: 'createUnitCallable', unitId, normalizedUnitNumber: normalized };
      });
    }
  },
  'renameUnitCallable': {
    permission: ACTION_PERMISSIONS['renameUnitCallable'],
    validate: (p) => {
      validateRequired(p, 'unitId');
      validateRequired(p, 'newUnitNumber');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'renameUnitCallable', status: 'PACKAGING_VALIDATED', unitId: payload.unitId };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const { trimmed: newUnitNumber, normalized } = parseUnitNumber(payload.newUnitNumber);
      return await ctx.firestore.runTransaction(async (tx) => {
        const unit = await tx.get('units', payload.unitId);
        assertResourceAccess(ctx, unit?.data, 'Unit');
        const propertyId = payload.propertyId || unit.data.propertyId;
        const property = await tx.get('properties', propertyId);
        assertResourceAccess(ctx, property?.data, 'Property');
        if (unit.data.propertyId !== propertyId) {
          throw fail('INVALID_ARGUMENT', 'Unit does not belong to the specified property.');
        }
        if (!unit.data.isArchived) {
          const activeMap = readUnitMap(property.data.activeUnitNumbers);
          const previousNormalized = unit.data.normalizedUnitNumber || normalizedUnitKey(unit.data.unitNumber || '');
          if (activeMap[normalized] && activeMap[normalized] !== payload.unitId) {
            throw fail('ALREADY_EXISTS', `Unit "${newUnitNumber}" already exists in this property.`, 409);
          }
          if (previousNormalized && previousNormalized !== normalized) {
            delete activeMap[previousNormalized];
            activeMap[normalized] = payload.unitId;
            tx.update('properties', propertyId, { activeUnitNumbers: activeMap, updatedAt: new Date() });
          }
        }
        tx.update('units', payload.unitId, {
          unitNumber: newUnitNumber,
          normalizedUnitNumber: normalized,
          updatedAt: new Date(),
        });
        return { success: true, action: 'renameUnitCallable', unitId: payload.unitId, normalizedUnitNumber: normalized };
      });
    }
  },
  'updateUnitCallable': {
    permission: ACTION_PERMISSIONS['updateUnitCallable'],
    validate: (p) => validateRequired(p, 'unitId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'updateUnitCallable', status: 'PACKAGING_VALIDATED', unitId: payload.unitId };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const updates = { updatedAt: new Date() };
      if (payload.unitNumber !== undefined) {
        const parsed = parseUnitNumber(payload.unitNumber);
        updates.unitNumber = parsed.trimmed;
        updates.normalizedUnitNumber = parsed.normalized;
      }
      if (payload.type !== undefined) {
        if (!ALLOWED_UNIT_TYPES.has(payload.type)) throw fail('INVALID_ARGUMENT', `Invalid unit type "${payload.type}".`);
        updates.type = payload.type;
      }
      if (payload.floor !== undefined) updates.floor = finiteNumber(payload.floor, 'floor', { min: -10, max: 200 });
      if (payload.monthlyRent !== undefined) updates.monthlyRent = finiteNumber(payload.monthlyRent, 'monthlyRent', { min: 0, max: 100000000 });
      if (payload.serviceCharge !== undefined) updates.serviceCharge = finiteNumber(payload.serviceCharge, 'serviceCharge', { min: 0, max: 10000000 });
      if (payload.notes !== undefined) updates.notes = optionalString(payload.notes, 'notes', 1000);
      if (payload.electricityMeterNumber !== undefined) updates.electricityMeterNumber = optionalString(payload.electricityMeterNumber, 'electricityMeterNumber', 64);
      if (payload.gasMeterNumber !== undefined) updates.gasMeterNumber = optionalString(payload.gasMeterNumber, 'gasMeterNumber', 64);

      return await ctx.firestore.runTransaction(async (tx) => {
        const unit = await tx.get('units', payload.unitId);
        assertResourceAccess(ctx, unit?.data, 'Unit');
        const propertyId = payload.propertyId || unit.data.propertyId;
        const property = await tx.get('properties', propertyId);
        assertResourceAccess(ctx, property?.data, 'Property');
        if (unit.data.propertyId !== propertyId) {
          throw fail('INVALID_ARGUMENT', 'Unit does not belong to the specified property.');
        }
        if (updates.normalizedUnitNumber && updates.normalizedUnitNumber !== unit.data.normalizedUnitNumber) {
          if (!unit.data.isArchived) {
            const activeMap = readUnitMap(property.data.activeUnitNumbers);
            if (activeMap[updates.normalizedUnitNumber] && activeMap[updates.normalizedUnitNumber] !== payload.unitId) {
              throw fail('ALREADY_EXISTS', `Unit "${updates.unitNumber}" already exists in this property.`, 409);
            }
            const previousNormalized = unit.data.normalizedUnitNumber || normalizedUnitKey(unit.data.unitNumber || '');
            if (previousNormalized) delete activeMap[previousNormalized];
            activeMap[updates.normalizedUnitNumber] = payload.unitId;
            tx.update('properties', propertyId, { activeUnitNumbers: activeMap, updatedAt: new Date() });
          }
        }
        tx.update('units', payload.unitId, updates);
        return { success: true, action: 'updateUnitCallable', unitId: payload.unitId };
      });
    }
  },
  'archiveUnitCallable': {
    permission: ACTION_PERMISSIONS['archiveUnitCallable'],
    validate: (p) => validateRequired(p, 'unitId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'archiveUnitCallable', status: 'PACKAGING_VALIDATED', unitId: payload.unitId, isArchived: true };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      return await ctx.firestore.runTransaction(async (tx) => {
        const unit = await tx.get('units', payload.unitId);
        assertResourceAccess(ctx, unit?.data, 'Unit');
        if (unit.data.status === 'occupied' || unit.data.currentTenantId) {
          throw fail('FAILED_PRECONDITION', 'Vacate the active tenant before archiving this unit.', 412);
        }
        const propertyId = payload.propertyId || unit.data.propertyId;
        const property = await tx.get('properties', propertyId);
        assertResourceAccess(ctx, property?.data, 'Property');
        const activeMap = readUnitMap(property.data.activeUnitNumbers);
        const normalized = unit.data.normalizedUnitNumber || normalizedUnitKey(unit.data.unitNumber || '');
        if (activeMap[normalized] === payload.unitId) delete activeMap[normalized];
        tx.update('properties', propertyId, { activeUnitNumbers: activeMap, updatedAt: new Date() });
        tx.update('units', payload.unitId, { isArchived: true, status: 'archived', updatedAt: new Date() });
        return { success: true, action: 'archiveUnitCallable', unitId: payload.unitId, isArchived: true };
      });
    }
  },
  'restoreUnitCallable': {
    permission: ACTION_PERMISSIONS['restoreUnitCallable'],
    validate: (p) => validateRequired(p, 'unitId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'restoreUnitCallable', status: 'PACKAGING_VALIDATED', unitId: payload.unitId, isArchived: false };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      return await ctx.firestore.runTransaction(async (tx) => {
        const unit = await tx.get('units', payload.unitId);
        assertResourceAccess(ctx, unit?.data, 'Unit');
        const propertyId = payload.propertyId || unit.data.propertyId;
        const property = await tx.get('properties', propertyId);
        assertResourceAccess(ctx, property?.data, 'Property');
        const activeMap = readUnitMap(property.data.activeUnitNumbers);
        const normalized = unit.data.normalizedUnitNumber || normalizedUnitKey(unit.data.unitNumber || '');
        if (activeMap[normalized] && activeMap[normalized] !== payload.unitId) {
          throw fail('ALREADY_EXISTS', `Cannot restore: "${unit.data.unitNumber}" is used by another active unit.`, 409);
        }
        activeMap[normalized] = payload.unitId;
        tx.update('properties', propertyId, { activeUnitNumbers: activeMap, updatedAt: new Date() });
        tx.update('units', payload.unitId, { isArchived: false, status: 'vacant', updatedAt: new Date() });
        return { success: true, action: 'restoreUnitCallable', unitId: payload.unitId, isArchived: false };
      });
    }
  },
  'deleteUnitCallable': {
    permission: ACTION_PERMISSIONS['deleteUnitCallable'],
    validate: (p) => validateRequired(p, 'unitId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'deleteUnitCallable', status: 'PACKAGING_VALIDATED', unitId: payload.unitId };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const bills = await ctx.firestore.queryByField('rent_bills', 'unitId', 'EQUAL', String(payload.unitId));
      if (bills.length > 0) {
        throw fail('FAILED_PRECONDITION', 'Cannot permanently delete a unit that has billing history. Archive it instead.', 412);
      }
      const tenants = await ctx.firestore.queryByField('tenants', 'unitId', 'EQUAL', String(payload.unitId));
      if (tenants.length > 0) {
        throw fail('FAILED_PRECONDITION', 'Cannot permanently delete a unit with tenant history. Archive it instead.', 412);
      }
      return await ctx.firestore.runTransaction(async (tx) => {
        const unit = await tx.get('units', payload.unitId);
        assertResourceAccess(ctx, unit?.data, 'Unit');
        if (!unit.data.isArchived) {
          throw fail('FAILED_PRECONDITION', 'Archive the unit before permanently deleting it.', 412);
        }
        const propertyId = payload.propertyId || unit.data.propertyId;
        const property = await tx.get('properties', propertyId);
        assertResourceAccess(ctx, property?.data, 'Property');
        const activeMap = readUnitMap(property.data.activeUnitNumbers);
        const normalized = unit.data.normalizedUnitNumber || normalizedUnitKey(unit.data.unitNumber || '');
        delete activeMap[normalized];
        tx.update('properties', propertyId, { activeUnitNumbers: activeMap, updatedAt: new Date() });
        tx.delete('units', payload.unitId);
        return { success: true, action: 'deleteUnitCallable', unitId: payload.unitId };
      });
    }
  },


  // ===========================================================================
  // GROUP 2: TENANTS & LEASES (2 Actions)
  // ===========================================================================
  'registerTenantCallable': {
    permission: ACTION_PERMISSIONS['registerTenantCallable'],
    validate: (p) => {
      validateRequired(p, 'propertyId');
      validateRequired(p, 'unitId');
      validateRequired(p, 'name');
      validateRequired(p, 'phone');
      validatePositiveNumber(p, 'monthlyRent');
      validatePositiveNumber(p, 'securityDeposit');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'registerTenantCallable', status: 'PACKAGING_VALIDATED', tenantId: `mock_t_${Date.now()}` };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const workspaceId = ctx.authContext.workspaceId;
      const propertyId = String(payload.propertyId);
      const unitId = String(payload.unitId);
      const name = optionalString(payload.name, 'name', 100);
      const mobile = optionalString(payload.mobile || payload.phone, 'mobile', 30);
      if (!name || !mobile) throw fail('INVALID_ARGUMENT', 'Tenant name and mobile are required.');
      const monthlyRent = finiteNumber(payload.monthlyRent, 'monthlyRent', { min: 0, max: 100000000 });
      const gasCharge = finiteNumber(payload.gasCharge ?? 0, 'gasCharge', { min: 0, max: 10000000 });
      const waterCharge = finiteNumber(payload.waterCharge ?? 0, 'waterCharge', { min: 0, max: 10000000 });
      const advanceDeposit = finiteNumber(payload.securityDeposit ?? payload.advanceDeposit ?? 0, 'advanceDeposit', { min: 0, max: 100000000 });
      const moveInDate = optionalString(payload.moveInDate, 'moveInDate', 30) || new Date().toISOString().slice(0, 10);

      return await ctx.firestore.runTransaction(async (tx) => {
        const property = await tx.get('properties', propertyId);
        assertResourceAccess(ctx, property?.data, 'Property');
        if (property.data.isArchived) throw fail('FAILED_PRECONDITION', 'Cannot assign tenants to an archived property.', 412);
        const unit = await tx.get('units', unitId);
        assertResourceAccess(ctx, unit?.data, 'Unit');
        if (unit.data.propertyId !== propertyId) throw fail('INVALID_ARGUMENT', 'Unit does not belong to the specified property.');
        if (unit.data.isArchived) throw fail('FAILED_PRECONDITION', 'Cannot assign tenants to an archived unit.', 412);
        if (unit.data.status !== 'vacant' || unit.data.currentTenantId) {
          throw fail('FAILED_PRECONDITION', `Unit is not vacant (status: ${unit.data.status}).`, 412);
        }

        const tenantId = payload.tenantId || newDocumentId('tenant');
        tx.create('tenants', tenantId, {
          propertyId,
          unitId,
          name,
          mobile,
          phone: mobile,
          nid: optionalString(payload.nid, 'nid', 30),
          address: optionalString(payload.address, 'address', 300),
          monthlyRent,
          gasCharge,
          waterCharge,
          advanceDeposit,
          securityDeposit: advanceDeposit,
          moveInDate,
          notes: optionalString(payload.notes, 'notes', 1000),
          status: 'active',
          isArchived: false,
          vacatingDate: null,
          workspaceId,
          ownerUid: ctx.authContext.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        tx.update('units', unitId, {
          status: 'occupied',
          currentTenantId: tenantId,
          monthlyRent,
          updatedAt: new Date(),
        });

        let depositId = null;
        if (advanceDeposit > 0) {
          depositId = `deposit_${tenantId}`;
          tx.create('security_deposits', depositId, {
            propertyId,
            unitId,
            tenantId,
            depositAmount: advanceDeposit,
            receivedDate: new Date(),
            status: 'held',
            refundedAmount: 0,
            damageDeductionAmount: 0,
            settlementDate: null,
            classification: 'liability',
            isLiability: true,
            isRentalIncome: false,
            notes: `Security deposit received on tenant registration (${name})`,
            workspaceId,
            ownerUid: ctx.authContext.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return { success: true, action: 'registerTenantCallable', tenantId, depositId };
      });
    }
  },
  'updateTenantCallable': {
    permission: ACTION_PERMISSIONS['updateTenantCallable'],
    validate: (p) => validateRequired(p, 'tenantId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'updateTenantCallable', status: 'PACKAGING_VALIDATED', tenantId: payload.tenantId };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const updates = { updatedAt: new Date() };
      if (payload.name !== undefined) {
        const name = optionalString(payload.name, 'name', 100);
        if (!name) throw fail('INVALID_ARGUMENT', 'Tenant name cannot be empty.');
        updates.name = name;
      }
      if (payload.mobile !== undefined) {
        const mobile = optionalString(payload.mobile, 'mobile', 30);
        if (!mobile) throw fail('INVALID_ARGUMENT', 'Tenant mobile cannot be empty.');
        updates.mobile = mobile;
        updates.phone = mobile;
      }
      if (payload.nid !== undefined) updates.nid = optionalString(payload.nid, 'nid', 30);
      if (payload.address !== undefined) updates.address = optionalString(payload.address, 'address', 300);
      if (payload.notes !== undefined) updates.notes = optionalString(payload.notes, 'notes', 1000);
      if (payload.moveInDate !== undefined) {
        const moveInDate = optionalString(payload.moveInDate, 'moveInDate', 30);
        if (moveInDate && !DATE_ONLY_REGEX.test(moveInDate)) throw fail('INVALID_ARGUMENT', 'moveInDate must be YYYY-MM-DD.');
        updates.moveInDate = moveInDate;
      }
      return await ctx.firestore.runTransaction(async (tx) => {
        const tenant = await tx.get('tenants', payload.tenantId);
        assertResourceAccess(ctx, tenant?.data, 'Tenant');
        tx.update('tenants', payload.tenantId, updates);
        return { success: true, action: 'updateTenantCallable', tenantId: payload.tenantId };
      });
    }
  },
  'vacateTenantCallable': {
    permission: ACTION_PERMISSIONS['vacateTenantCallable'],
    validate: (p) => {
      validateRequired(p, 'tenantId');
      validateRequired(p, 'vacateDate');
      validatePositiveNumber(p, 'refundAmount');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'vacateTenantCallable', status: 'PACKAGING_VALIDATED', tenantId: payload.tenantId };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const vacatingDate = optionalString(payload.vacatingDate || payload.vacateDate, 'vacatingDate', 30);
      if (!DATE_ONLY_REGEX.test(vacatingDate)) throw fail('INVALID_ARGUMENT', 'vacatingDate must be YYYY-MM-DD.');
      const damageDeductions = finiteNumber(payload.damageDeductions ?? 0, 'damageDeductions', { min: 0, max: 100000000 });
      const refundAmount = finiteNumber(payload.refundAmount ?? 0, 'refundAmount', { min: 0, max: 100000000 });
      const settlementNotes = optionalString(payload.settlementNotes, 'settlementNotes', 1000);

      return await ctx.firestore.runTransaction(async (tx) => {
        const tenant = await tx.get('tenants', payload.tenantId);
        assertResourceAccess(ctx, tenant?.data, 'Tenant');
        if (tenant.data.status !== 'active') {
          throw fail('FAILED_PRECONDITION', 'Tenant is already vacated or inactive.', 412);
        }
        const unit = await tx.get('units', tenant.data.unitId);
        let depositId = payload.depositId || null;
        let depositData = null;
        if (depositId) {
          const depositSnap = await tx.get('security_deposits', depositId);
          depositData = depositSnap?.data || null;
        } else {
          const deposits = await ctx.firestore.queryByField(
            'security_deposits',
            'tenantId',
            'EQUAL',
            String(payload.tenantId)
          );
          if (deposits.length > 0) {
            depositId = deposits[0].id;
            depositData = deposits[0].data;
          }
        }

        if (unit?.data) {
          tx.update('units', tenant.data.unitId, {
            status: 'vacant',
            currentTenantId: null,
            updatedAt: new Date(),
          });
        }
        tx.update('tenants', payload.tenantId, {
          status: 'vacated',
          vacatingDate,
          finalDamageDeductions: damageDeductions,
          finalRefundAmount: refundAmount,
          settlementNotes,
          settledAt: new Date(),
          updatedAt: new Date(),
        });
        if (depositData && depositId) {
          const totalHeld = Number(depositData.depositAmount) || 0;
          const totalSettled = refundAmount + damageDeductions;
          tx.update('security_deposits', depositId, {
            status: totalSettled >= totalHeld ? 'fully_refunded' : 'partially_refunded',
            refundedAmount: refundAmount,
            damageDeductionAmount: damageDeductions,
            settlementDate: new Date(),
            notes: `${depositData.notes || ''} | Settled: ${settlementNotes}`.trim(),
            updatedAt: new Date(),
          });
        }
        return { success: true, action: 'vacateTenantCallable', tenantId: payload.tenantId, unitId: tenant.data.unitId };
      });
    }
  },


  // ===========================================================================
  // GROUP 3: RENT BILLING & PAYMENTS (2 Actions)
  // ===========================================================================
  'generateMonthlyBillsCallable': {
    permission: ACTION_PERMISSIONS['generateMonthlyBillsCallable'],
    validate: (p) => {
      validateMonth(p, 'billingMonth');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'generateMonthlyBillsCallable', status: 'PACKAGING_VALIDATED', billingMonth: payload.billingMonth };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const workspaceId = ctx.authContext.workspaceId;
      const billingMonth = String(payload.billingMonth);
      const propertyId = payload.propertyId && payload.propertyId !== 'all' ? String(payload.propertyId) : null;

      const allTenants = await ctx.firestore.queryByField('tenants', 'workspaceId', 'EQUAL', workspaceId);
      const activeTenants = allTenants.filter(
        (tenant) =>
          tenant.data.status === 'active' &&
          !tenant.data.isArchived &&
          (!propertyId || tenant.data.propertyId === propertyId)
      );
      if (activeTenants.length === 0) {
        return { success: true, action: 'generateMonthlyBillsCallable', billingMonth, countCreated: 0, countSkipped: 0, totalAmountBilled: 0 };
      }

      const properties = await ctx.firestore.queryByField('properties', 'workspaceId', 'EQUAL', workspaceId);
      const units = await ctx.firestore.queryByField('units', 'workspaceId', 'EQUAL', workspaceId);
      const propertyMap = new Map(properties.map((property) => [property.id, property.data]));
      const unitMap = new Map(units.map((unit) => [unit.id, unit.data]));
      const existingBills = await ctx.firestore.queryByField('rent_bills', 'workspaceId', 'EQUAL', workspaceId);
      const existingTenantBillSet = new Set(
        existingBills
          .filter((bill) => bill.data.billingMonth === billingMonth)
          .map((bill) => bill.data.tenantId)
      );

      const toCreate = [];
      let countSkipped = 0;
      let totalAmountBilled = 0;
      for (const tenantDoc of activeTenants) {
        const tenant = tenantDoc.data;
        if (existingTenantBillSet.has(tenantDoc.id)) {
          countSkipped += 1;
          continue;
        }
        const property = propertyMap.get(tenant.propertyId) || {};
        const unit = unitMap.get(tenant.unitId) || {};
        const rentAmount = finiteNumber(tenant.monthlyRent ?? 0, 'monthlyRent', { min: 0, max: 100000000 });
        const gasCharge = finiteNumber(tenant.gasCharge ?? 0, 'gasCharge', { min: 0, max: 10000000 });
        const waterCharge = finiteNumber(tenant.waterCharge ?? 0, 'waterCharge', { min: 0, max: 10000000 });
        const serviceCharge = finiteNumber(unit.serviceCharge ?? 0, 'serviceCharge', { min: 0, max: 10000000 });
        const totalDue = rentAmount + gasCharge + waterCharge + serviceCharge;
        const billId = `bill_${tenant.propertyId}_${tenantDoc.id}_${billingMonth.replace('-', '')}`;
        toCreate.push({
          billId,
          data: {
            propertyId: tenant.propertyId,
            propertyName: property.name || 'Property',
            unitId: tenant.unitId,
            unitNumber: unit.unitNumber || 'Unit',
            tenantId: tenantDoc.id,
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
            workspaceId,
            ownerUid: tenant.ownerUid || ctx.authContext.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        totalAmountBilled += totalDue;
      }

      if (toCreate.length === 0) {
        return { success: true, action: 'generateMonthlyBillsCallable', billingMonth, countCreated: 0, countSkipped, totalAmountBilled: 0 };
      }

      await ctx.firestore.runTransaction(async (tx) => {
        for (const bill of toCreate) {
          tx.create('rent_bills', bill.billId, bill.data);
        }
      });

      return {
        success: true,
        action: 'generateMonthlyBillsCallable',
        billingMonth,
        countCreated: toCreate.length,
        countSkipped,
        totalAmountBilled,
      };
    }
  },
  'recordRentPaymentCallable': {
    permission: ACTION_PERMISSIONS['recordRentPaymentCallable'],
    validate: (p) => {
      validateRequired(p, 'billId');
      validatePositiveNumber(p, 'amount');
      validateRequired(p, 'paymentMethod');
      validateRequired(p, 'paymentDate');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return {
          success: true,
          action: 'recordRentPaymentCallable',
          status: 'PACKAGING_VALIDATED',
          paymentId: `mock_pay_${Date.now()}`,
          amount: payload.amount
        };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const workspaceId = ctx.authContext.workspaceId;
      const amount = finiteNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
      const paymentMethod = String(payload.paymentMethod || '').toLowerCase();
      if (!['cash', 'bank', 'bkash', 'nagad', 'other'].includes(paymentMethod)) {
        throw fail('INVALID_ARGUMENT', `Invalid payment method "${paymentMethod}".`);
      }
      const transactionId = optionalString(payload.transactionId, 'transactionId', 100) || null;
      const paymentDate = optionalString(payload.paymentDate, 'paymentDate', 10);
      if (!DATE_ONLY_REGEX.test(paymentDate)) throw fail('INVALID_ARGUMENT', 'paymentDate must be YYYY-MM-DD.');

      if (transactionId) {
        const existingPayments = await ctx.firestore.queryByField('rent_payments', 'workspaceId', 'EQUAL', workspaceId);
        if (
          existingPayments.some(
            (payment) =>
              payment.data.transactionId === transactionId &&
              payment.data.entryType === 'payment'
          )
        ) {
          throw fail('ALREADY_EXISTS', `Duplicate transaction ID "${transactionId}".`, 409);
        }
      }

      const idempotencyKey = optionalString(payload.idempotencyKey, 'idempotencyKey', 128) || null;
      return await ctx.firestore.runTransaction(async (tx) => {
        if (idempotencyKey) {
          const existingPayment = await tx.get('rent_payments', idempotencyKey);
          if (existingPayment) {
            return {
              success: true,
              action: 'recordRentPaymentCallable',
              idempotentDuplicate: true,
              paymentId: idempotencyKey,
              amount: existingPayment.data.amount,
              status: 'POSTED_PREVIOUSLY',
            };
          }
        }

        const billDoc = await tx.get('rent_bills', payload.billId);
        assertResourceAccess(ctx, billDoc?.data, 'Rent bill');
        const bill = billDoc.data;
        if (bill.status === 'paid' || Number(bill.balanceDue) <= 0) {
          throw fail('FAILED_PRECONDITION', 'This bill is already fully paid.', 412);
        }
        if (amount > Number(bill.balanceDue)) {
          throw fail(
            'INVALID_ARGUMENT',
            `Payment amount (৳${amount}) exceeds remaining balance due (৳${bill.balanceDue}).`
          );
        }

        const timestampStr = Date.now().toString().slice(-4);
        const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString().slice(-2);
        const receiptNumber = `REC-${String(bill.billingMonth).replace('-', '')}-${timestampStr}${randomSuffix}`;
        const newTotalPaid = Number(bill.totalPaid || 0) + amount;
        const newBalanceDue = Math.max(0, Number(bill.totalDue) - newTotalPaid);
        const newStatus = newBalanceDue === 0 ? 'paid' : 'partial';
        const paymentId = idempotencyKey || newDocumentId('pay');

        tx.create('rent_payments', paymentId, {
          billId: payload.billId,
          propertyId: bill.propertyId || null,
          propertyName: bill.propertyName || '',
          unitId: bill.unitId || null,
          unitNumber: bill.unitNumber || '',
          tenantId: bill.tenantId || null,
          tenantName: bill.tenantName || '',
          billingMonth: bill.billingMonth,
          amount,
          paymentMethod,
          transactionId,
          receiptNumber,
          notes: optionalString(payload.notes, 'notes', 500),
          entryType: 'payment',
          isRentalIncome: true,
          paymentDate,
          workspaceId,
          ownerUid: ctx.authContext.uid,
          createdAt: new Date(),
        });

        tx.update('rent_bills', payload.billId, {
          totalPaid: newTotalPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          updatedAt: new Date(),
        });

        return {
          success: true,
          action: 'recordRentPaymentCallable',
          paymentId,
          receiptNumber,
          amount,
          totalPaid: newTotalPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          tenantName: bill.tenantName || '',
          unitNumber: bill.unitNumber || '',
          propertyName: bill.propertyName || '',
          billingMonth: bill.billingMonth,
        };
      });
    }
  },

  // ===========================================================================
  // GROUP 4: OPERATING EXPENSES (3 Actions)
  // ===========================================================================
  'createExpenseCallable': {
    permission: ACTION_PERMISSIONS['createExpenseCallable'],
    validate: (p) => {
      validateRequired(p, 'group');
      validateRequired(p, 'category');
      validatePositiveNumber(p, 'amount');
      validateRequired(p, 'expenseDate');
      validateMonth(p, 'billingMonth');
      validateRequired(p, 'description');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'createExpenseCallable', status: 'PACKAGING_VALIDATED', expenseId: `mock_exp_${Date.now()}` };
      }
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const expensePath = 'expenses';
        const expenseId = payload.expenseId || `exp_${Date.now()}`;

        let propertyName = payload.propertyName || null;
        if (payload.propertyId) {
          const property = await ctx.firestore.getDocument('properties', String(payload.propertyId));
          assertResourceAccess(ctx, property?.data, 'Property');
          propertyName = property.data.name || property.data.nameEn || 'Property';
        }

        return await ctx.firestore.runTransaction(async (tx) => {
          tx.create(expensePath, expenseId, {
            title: payload.title || payload.description,
            group: payload.group,
            category: payload.category,
            amount: payload.amount,
            expenseDate: payload.expenseDate,
            billingMonth: payload.billingMonth,
            description: payload.description,
            paymentMethod: payload.paymentMethod || 'cash',
            propertyId: payload.propertyId || null,
            propertyName: payload.propertyName || null,
            status: 'active',
            reversalReason: null,
            reversedAt: null,
            isOperatingExpense: true,
            isRentalIncome: false,
            auditHistory: [],
            workspaceId,
            ownerUid: ctx.authContext.uid,
            createdBy: ctx.verifiedUser?.email || ctx.authContext.uid,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          return {
            success: true,
            action: 'createExpenseCallable',
            expenseId,
            amount: payload.amount,
            isOperatingExpense: true
          };
        });
      }
      throw new Error('Live execution not configured');
    }
  },
  'updateExpenseCallable': {
    permission: ACTION_PERMISSIONS['updateExpenseCallable'],
    validate: (p) => {
      validateRequired(p, 'expenseId');
      validatePositiveNumber(p, 'amount');
      validateRequired(p, 'reason'); // Mandatory justification
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'updateExpenseCallable', status: 'PACKAGING_VALIDATED', expenseId: payload.expenseId };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const title = optionalString(payload.title || payload.description, 'title', 150);
      if (!title) throw fail('INVALID_ARGUMENT', 'Expense title is required.');
      const amount = finiteNumber(payload.amount, 'amount', { min: 1, max: 100000000 });
      const group = String(payload.group || '').toLowerCase().trim();
      const category = String(payload.category || '').toLowerCase().trim();
      if (!group || !category) throw fail('INVALID_ARGUMENT', 'Expense group and category are required.');
      const expenseDate = optionalString(payload.expenseDate, 'expenseDate', 10);
      if (!DATE_ONLY_REGEX.test(expenseDate)) throw fail('INVALID_ARGUMENT', 'expenseDate must be YYYY-MM-DD.');
      const reason = optionalString(payload.reason, 'reason', 500);
      if (!reason) throw fail('INVALID_ARGUMENT', 'A reason for editing is required.');

      let propertyName = null;
      if (payload.propertyId) {
        const property = await ctx.firestore.getDocument('properties', String(payload.propertyId));
        assertResourceAccess(ctx, property?.data, 'Property');
        propertyName = property.data.name || property.data.nameEn || 'Property';
      }

      return await ctx.firestore.runTransaction(async (tx) => {
        const expense = await tx.get('expenses', payload.expenseId);
        assertResourceAccess(ctx, expense?.data, 'Expense');
        const oldData = expense.data;
        if (oldData.status === 'reversed') {
          throw fail('FAILED_PRECONDITION', 'Cannot edit a reversed expense record.', 412);
        }
        const auditEntry = {
          editedAt: new Date().toISOString(),
          editedBy: ctx.verifiedUser?.email || ctx.authContext.uid,
          reason,
          previousAmount: oldData.amount,
          newAmount: amount,
          previousTitle: oldData.title,
          newTitle: title,
          previousCategory: oldData.category,
          newCategory: category,
        };
        const history = Array.isArray(oldData.auditHistory) ? oldData.auditHistory : [];
        const updatedHistory = [...history, auditEntry];
        tx.update('expenses', payload.expenseId, {
          title,
          amount,
          group,
          category,
          propertyId: payload.propertyId || null,
          propertyName,
          expenseDate,
          billingMonth: expenseDate.slice(0, 7),
          paymentMethod: String(payload.paymentMethod || 'cash').toLowerCase(),
          paidTo: optionalString(payload.paidTo, 'paidTo', 150) || null,
          description: optionalString(payload.description, 'description', 1000) || null,
          receiptUrl: optionalString(payload.receiptUrl, 'receiptUrl', 500) || null,
          auditHistory: updatedHistory,
          updatedAt: new Date(),
        });
        return {
          success: true,
          action: 'updateExpenseCallable',
          expenseId: payload.expenseId,
          newAmount: amount,
          auditEntriesCount: updatedHistory.length,
        };
      });
    }
  },
  'reverseExpenseCallable': {
    permission: ACTION_PERMISSIONS['reverseExpenseCallable'],
    validate: (p) => {
      validateRequired(p, 'expenseId');
      validateRequired(p, 'reason'); // Mandatory justification
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'reverseExpenseCallable', status: 'PACKAGING_VALIDATED', expenseId: payload.expenseId, statusReversed: true };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const reason = optionalString(payload.reason, 'reason', 500);
      if (!reason) throw fail('INVALID_ARGUMENT', 'A reason is required to reverse an expense record.');
      return await ctx.firestore.runTransaction(async (tx) => {
        const expense = await tx.get('expenses', payload.expenseId);
        assertResourceAccess(ctx, expense?.data, 'Expense');
        const data = expense.data;
        if (data.status === 'reversed') {
          throw fail('FAILED_PRECONDITION', 'This expense has already been reversed.', 412);
        }
        const auditEntry = {
          editedAt: new Date().toISOString(),
          editedBy: ctx.verifiedUser?.email || ctx.authContext.uid,
          reason: `[REVERSAL] ${reason}`,
          previousAmount: data.amount,
          newAmount: 0,
          previousTitle: data.title,
          newTitle: `[REVERSED] ${data.title}`,
          previousCategory: data.category,
          newCategory: data.category,
        };
        const history = Array.isArray(data.auditHistory) ? data.auditHistory : [];
        tx.update('expenses', payload.expenseId, {
          status: 'reversed',
          reversalReason: reason,
          auditHistory: [...history, auditEntry],
          reversedAt: new Date(),
          updatedAt: new Date(),
        });
        return { success: true, action: 'reverseExpenseCallable', expenseId: payload.expenseId, status: 'reversed' };
      });
    }
  },

  'reverseRentPaymentCallable': {
    permission: ACTION_PERMISSIONS['reverseRentPaymentCallable'],
    validate: (p) => { validateRequired(p, 'paymentId'); validateRequired(p, 'reason'); },
    execute: async (ctx, p) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'reverseRentPaymentCallable', status: 'PACKAGING_VALIDATED' };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const reversalId = `reversal_${p.paymentId}`;
      return ctx.firestore.runTransaction(async (tx) => {
        const payment = await tx.get('rent_payments', p.paymentId); assertResourceAccess(ctx, payment?.data, 'Rent payment');
        if (payment.data.status === 'reversed' || payment.data.reversalId) return { success: true, duplicate: true, reversalId };
        const amount = Number(payment.data.amount) || 0; const bill = payment.data.billId ? await tx.get('rent_bills', payment.data.billId) : null;
        tx.update('rent_payments', p.paymentId, { status: 'reversed', reversedAt: new Date(), reversalId, reversalReason: p.reason, originalPaymentId: p.paymentId });
        if (bill?.data) { const paid = Math.max(0, (Number(bill.data.totalPaid) || 0) - amount); const due = Number(bill.data.totalDue) || 0; tx.update('rent_bills', payment.data.billId, { totalPaid: paid, balanceDue: Math.max(0, due - paid), status: paid >= due ? 'paid' : paid > 0 ? 'partial' : 'unpaid', updatedAt: new Date() }); }
        tx.create('rent_payments', reversalId, { entryType: 'reversal', amount: -amount, originalPaymentId: p.paymentId, billId: payment.data.billId || null, billingMonth: payment.data.billingMonth || null, workspaceId: ctx.authContext.workspaceId, ownerUid: ctx.authContext.uid, reason: p.reason, createdAt: new Date() });
        return { success: true, paymentId: p.paymentId, reversalId, amount };
      });
    }
  },
  'cancelRentBillCallable': {
    permission: ACTION_PERMISSIONS['cancelRentBillCallable'],
    validate: (p) => { validateRequired(p, 'billId'); validateRequired(p, 'reason'); },
    execute: async (ctx, p) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'cancelRentBillCallable', status: 'PACKAGING_VALIDATED' };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      return ctx.firestore.runTransaction(async (tx) => { const bill = await tx.get('rent_bills', p.billId); assertResourceAccess(ctx, bill?.data, 'Rent bill'); if (['cancelled','canceled'].includes(bill.data.status)) return { success: true, duplicate: true, billId: p.billId }; if ((Number(bill.data.totalPaid) || 0) > 0 && !p.allowPaidCancellation) throw fail('FAILED_PRECONDITION', 'Paid bills require payment reversal before cancellation.', 412); tx.update('rent_bills', p.billId, { status: 'cancelled', cancelledAt: new Date(), cancellationReason: p.reason, previousStatus: bill.data.status, balanceDue: 0, updatedAt: new Date() }); return { success: true, billId: p.billId, status: 'cancelled' }; });
    }
  },
  'refundSecurityDepositCallable': {
    permission: ACTION_PERMISSIONS['refundSecurityDepositCallable'],
    validate: (p) => { validateRequired(p, 'depositId'); validateRequired(p, 'reason'); validatePositiveNumber(p, 'amount'); },
    execute: async (ctx, p) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'refundSecurityDepositCallable', status: 'PACKAGING_VALIDATED' };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const key = p.idempotencyKey || `refund:${p.depositId}:${p.amount}`; const refundId = `refund_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      return ctx.firestore.runTransaction(async (tx) => { const dep = await tx.get('security_deposits', p.depositId); assertResourceAccess(ctx, dep?.data, 'Security deposit'); const existing = await tx.get('security_deposit_refunds', refundId); if (existing?.data) return { success: true, duplicate: true, refundId }; const balance = Number(dep.data.balance ?? dep.data.remainingBalance ?? dep.data.amount ?? 0); const amount = finiteNumber(p.amount, 'amount', { min: .01, max: balance }); const remaining = balance - amount; tx.update('security_deposits', p.depositId, { refundedAmount: (Number(dep.data.refundedAmount) || 0) + amount, balance: remaining, remainingBalance: remaining, status: remaining <= 0 ? 'refunded' : 'partially_refunded', updatedAt: new Date(), refundHistory: [...(Array.isArray(dep.data.refundHistory) ? dep.data.refundHistory : []), { refundId, amount, reason: p.reason, createdAt: new Date(), createdBy: ctx.authContext.uid }] }); tx.create('security_deposit_refunds', refundId, { depositId: p.depositId, amount, reason: p.reason, idempotencyKey: key, workspaceId: ctx.authContext.workspaceId, ownerUid: ctx.authContext.uid, isRentalIncome: false, createdAt: new Date() }); return { success: true, refundId, depositId: p.depositId, amount, remainingBalance: remaining }; });
    }
  },

  // ===========================================================================
  // GROUP 5: BENEFICIARIES & DISTRIBUTIONS (7 Actions)
  // ===========================================================================
  'seedDefaultBeneficiariesCallable': {
    permission: ACTION_PERMISSIONS['seedDefaultBeneficiariesCallable'],
    validate: () => {},
    execute: async (ctx) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'seedDefaultBeneficiariesCallable', status: 'PACKAGING_VALIDATED', count: 5 };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const existing = await ctx.firestore.queryByField('beneficiaries', 'workspaceId', 'EQUAL', ctx.authContext.workspaceId);
      if (existing.some((d) => !d.data?.isArchived)) return { success: true, seeded: false, count: 0 };
      const defaults = [['Brother 1','brother',45000,1],['Brother 2','brother',45000,2],['Brother 3','brother',45000,3],['Mother','mother',25000,4],['Sister','sister',25000,5]];
      return await ctx.firestore.runTransaction(async (tx) => {
        const ids = [];
        for (const [name, relationship, target, priorityOrder] of defaults) {
          const id = newDocumentId('beneficiary'); ids.push(id);
          tx.create('beneficiaries', id, { workspaceId: ctx.authContext.workspaceId, ownerUid: ctx.authContext.uid, name, relationship, defaultMonthlyTarget: target, effectiveFromMonth: payload.effectiveFromMonth || new Date().toISOString().slice(0,7), targetHistory: [{ monthlyTarget: target, effectiveFromMonth: payload.effectiveFromMonth || new Date().toISOString().slice(0,7), reason: 'Initial system default allocation', updatedAt: new Date() }], payoutMethod: { type: 'bank' }, priorityOrder, status: 'active', isArchived: false, notes: 'Initial default family beneficiary', createdAt: new Date(), updatedAt: new Date() });
        }
        return { success: true, seeded: true, count: ids.length, beneficiaryIds: ids, totalTarget: 185000 };
      });
    }
  },
  'createBeneficiaryCallable': {
    permission: ACTION_PERMISSIONS['createBeneficiaryCallable'],
      validate: (p) => {
      validateRequired(p, 'name');
      validateRequired(p, 'relationship');
      validatePositiveNumber(p, 'targetAmount');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'createBeneficiaryCallable', status: 'PACKAGING_VALIDATED', beneficiaryId: `mock_ben_${Date.now()}` };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const id = payload.beneficiaryId || newDocumentId('beneficiary'); const target = finiteNumber(payload.targetAmount ?? payload.defaultMonthlyTarget, 'targetAmount', { min: 0, max: 100000000 }); const month = payload.effectiveFromMonth || new Date().toISOString().slice(0,7);
      return await ctx.firestore.runTransaction(async (tx) => { tx.create('beneficiaries', id, { workspaceId:ctx.authContext.workspaceId, ownerUid:ctx.authContext.uid, name:optionalString(payload.name,'name',100), relationship:optionalString(payload.relationship,'relationship',30).toLowerCase(), defaultMonthlyTarget:target, effectiveFromMonth:month, targetHistory:[{monthlyTarget:target,effectiveFromMonth:month,reason:'Beneficiary registered',updatedAt:new Date()}], payoutMethod:payload.payoutMethod||{type:'bank'}, priorityOrder:Number(payload.priorityOrder)||10, notes:optionalString(payload.notes,'notes',500), status:'active', isArchived:false, createdAt:new Date(), updatedAt:new Date() }); return {success:true,beneficiaryId:id}; });
    }
  },
  'updateBeneficiaryCallable': {
    permission: ACTION_PERMISSIONS['updateBeneficiaryCallable'],
    validate: (p) => validateRequired(p, 'beneficiaryId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'updateBeneficiaryCallable', status: 'PACKAGING_VALIDATED', beneficiaryId: payload.beneficiaryId };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      return await ctx.firestore.runTransaction(async (tx) => { const ref=await tx.get('beneficiaries',payload.beneficiaryId); assertResourceAccess(ctx,ref?.data,'Beneficiary'); if(ref.data.isArchived) throw fail('FAILED_PRECONDITION','Cannot edit an archived beneficiary.',412); const u={updatedAt:new Date()}; for(const k of ['name','relationship','notes','payoutMethod','priorityOrder','status']) if(payload[k]!==undefined) u[k]=payload[k]; if(payload.defaultMonthlyTarget!==undefined||payload.targetAmount!==undefined){const target=finiteNumber(payload.defaultMonthlyTarget??payload.targetAmount,'defaultMonthlyTarget',{min:0,max:100000000});const month=payload.effectiveFromMonth||new Date().toISOString().slice(0,7);u.defaultMonthlyTarget=target;u.effectiveFromMonth=month;u.targetHistory=[...(Array.isArray(ref.data.targetHistory)?ref.data.targetHistory:[]),{monthlyTarget:target,effectiveFromMonth:month,reason:payload.reason||'Target updated',updatedAt:new Date()}];} tx.update('beneficiaries',payload.beneficiaryId,u); return {success:true,beneficiaryId:payload.beneficiaryId}; });
    }
  },
  'archiveBeneficiaryCallable': {
    permission: ACTION_PERMISSIONS['archiveBeneficiaryCallable'],
    validate: (p) => validateRequired(p, 'beneficiaryId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'archiveBeneficiaryCallable', status: 'PACKAGING_VALIDATED', beneficiaryId: payload.beneficiaryId, isArchived: true };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION','Firestore is not configured.',500); return await ctx.firestore.runTransaction(async(tx)=>{const ref=await tx.get('beneficiaries',payload.beneficiaryId);assertResourceAccess(ctx,ref?.data,'Beneficiary');tx.update('beneficiaries',payload.beneficiaryId,{status:'archived',isArchived:true,archivedAt:new Date(),updatedAt:new Date()});return {success:true,beneficiaryId:payload.beneficiaryId,isArchived:true};});
    }
  },
  'getOrCreateMonthlyDistributionCallable': {
    permission: ACTION_PERMISSIONS['getOrCreateMonthlyDistributionCallable'],
    validate: (p) => validateMonth(p, 'distributionMonth'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'getOrCreateMonthlyDistributionCallable', status: 'PACKAGING_VALIDATED', month: payload.distributionMonth };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION','Firestore is not configured.',500); const id=`${ctx.authContext.workspaceId}_${payload.distributionMonth}`; return await ctx.firestore.runTransaction(async(tx)=>{const old=await tx.get('family_distributions',id);if(old?.data)return {success:true,isNew:false,distributionId:id,...old.data};const docs=await ctx.firestore.queryByField('beneficiaries','workspaceId','EQUAL',ctx.authContext.workspaceId);const rows=docs.filter(d=>d.data?.status==='active'&&!d.data?.isArchived).map(d=>{const target=Number(d.data.defaultMonthlyTarget)||0;return {beneficiaryId:d.id,name:d.data.name,relationship:d.data.relationship,baseMonthlyTarget:target,specialAdjustment:0,effectiveTarget:target,actualDisbursed:0,pendingAmount:target,payoutStatus:'unpaid',payouts:[]};});const total=rows.reduce((s,b)=>s+b.effectiveTarget,0);tx.create('family_distributions',id,{workspaceId:ctx.authContext.workspaceId,ownerUid:ctx.authContext.uid,distributionMonth:payload.distributionMonth,calculatedTargetTotal:total,finalTargetTotal:total,actualTotalDisbursed:0,remainingPendingTotal:total,specialAdjustmentTotal:0,netRentCollected:0,totalExpensesDeducted:0,distributableSurplus:0,reserveInflow:0,surplusTransferredToReserve:0,status:'draft',isFinalized:false,beneficiarySnapshots:rows,createdAt:new Date(),updatedAt:new Date()});return {success:true,isNew:true,distributionId:id,distributionMonth:payload.distributionMonth,finalTargetTotal:total,beneficiarySnapshots:rows};});
    }
  },
  'applySpecialAdjustmentCallable': {
    permission: ACTION_PERMISSIONS['applySpecialAdjustmentCallable'],
      validate: (p) => {
      validateRequired(p, 'distributionId');
      validateRequired(p, 'beneficiaryId');
      validateRequired(p, 'adjustmentAmount', 'number');
      validateRequired(p, 'reason');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'applySpecialAdjustmentCallable', status: 'PACKAGING_VALIDATED' };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION','Firestore is not configured.',500); const id=payload.distributionId||payload.distributionMonth; return await ctx.firestore.runTransaction(async(tx)=>{const ref=await tx.get('family_distributions',id);assertResourceAccess(ctx,ref?.data,'Distribution');const rows=Array.isArray(ref.data.beneficiarySnapshots)?[...ref.data.beneficiarySnapshots]:[];const i=rows.findIndex((b)=>b.beneficiaryId===payload.beneficiaryId);if(i<0)throw fail('NOT_FOUND','Beneficiary is not in this distribution.',404);const b={...rows[i],specialAdjustment:finiteNumber(payload.adjustmentAmount,'adjustmentAmount',{min:-10000000,max:10000000}),adjustmentReason:optionalString(payload.reason,'reason',300)};b.effectiveTarget=Math.max(0,(Number(b.baseMonthlyTarget)||0)+b.specialAdjustment);b.pendingAmount=Math.max(0,b.effectiveTarget-(Number(b.actualDisbursed)||0));rows[i]=b;const total=rows.reduce((s,x)=>s+(Number(x.effectiveTarget)||0),0);tx.update('family_distributions',id,{beneficiarySnapshots:rows,specialAdjustmentTotal:rows.reduce((s,x)=>s+(Number(x.specialAdjustment)||0),0),finalTargetTotal:total,remainingPendingTotal:Math.max(0,total-(Number(ref.data.actualTotalDisbursed)||0)),updatedAt:new Date()});return {success:true,distributionId:id,beneficiaryId:payload.beneficiaryId,newEffectiveTarget:b.effectiveTarget};});
    }
  },
  'recordBeneficiaryPayoutCallable': {
    permission: ACTION_PERMISSIONS['recordBeneficiaryPayoutCallable'],
    validate: (p) => {
      validateRequired(p, 'distributionId');
      validateRequired(p, 'beneficiaryId');
      validatePositiveNumber(p, 'amount');
      validateRequired(p, 'paymentMethod');
      validateRequired(p, 'paymentDate');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'recordBeneficiaryPayoutCallable', status: 'PACKAGING_VALIDATED', amount: payload.amount };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION','Firestore is not configured.',500); const id=payload.distributionId||payload.distributionMonth; const key=payload.idempotencyKey||payload.transactionId||`${id}:${payload.beneficiaryId}:${payload.amount}:${payload.paymentDate}`; return await ctx.firestore.runTransaction(async(tx)=>{const ref=await tx.get('family_distributions',id);assertResourceAccess(ctx,ref?.data,'Distribution');const rows=Array.isArray(ref.data.beneficiarySnapshots)?[...ref.data.beneficiarySnapshots]:[];const i=rows.findIndex((b)=>b.beneficiaryId===payload.beneficiaryId);if(i<0)throw fail('NOT_FOUND','Beneficiary is not in this distribution.',404);const b={...rows[i]};const amount=finiteNumber(payload.amount,'amount',{min:.01,max:100000000});if(amount>(Number(b.effectiveTarget)||0)-(Number(b.actualDisbursed)||0))throw fail('FAILED_PRECONDITION','Payout exceeds beneficiary target.',412);if((b.payouts||[]).some((p)=>p.idempotencyKey===key))return {success:true,duplicate:true,distributionId:id};b.actualDisbursed=(Number(b.actualDisbursed)||0)+amount;b.pendingAmount=Math.max(0,(Number(b.effectiveTarget)||0)-b.actualDisbursed);b.payoutStatus=b.pendingAmount<=0?'paid':'partial';b.payouts=[...(b.payouts||[]),{payoutId:`payout_${key}`,idempotencyKey:key,amount,paymentDate:payload.paymentDate,paymentMethod:payload.paymentMethod,transactionId:payload.transactionId||null,paidBy:ctx.authContext.uid,createdAt:new Date()}];rows[i]=b;const total=(Number(ref.data.actualTotalDisbursed)||0)+amount;tx.update('family_distributions',id,{beneficiarySnapshots:rows,actualTotalDisbursed:total,remainingPendingTotal:Math.max(0,(Number(ref.data.finalTargetTotal)||0)-total),status:'in_progress',updatedAt:new Date()});return {success:true,payoutId:`payout_${key}`,distributionId:id,beneficiaryId:payload.beneficiaryId,amount};});
    }
  },

  'restoreBeneficiaryCallable': { permission: ACTION_PERMISSIONS['restoreBeneficiaryCallable'], validate: (p) => validateRequired(p,'beneficiaryId'), execute: async (ctx,p) => { if(!ctx.firestore) throw fail('FAILED_PRECONDITION','Firestore is not configured.',500); return ctx.firestore.runTransaction(async(tx)=>{const ref=await tx.get('beneficiaries',p.beneficiaryId);assertResourceAccess(ctx,ref?.data,'Beneficiary');tx.update('beneficiaries',p.beneficiaryId,{status:'active',isArchived:false,restoredAt:new Date(),updatedAt:new Date()});return {success:true,beneficiaryId:p.beneficiaryId,isArchived:false};}); } },
  'getBeneficiaryHistoryCallable': { permission: ACTION_PERMISSIONS['getBeneficiaryHistoryCallable'], validate: (p) => validateRequired(p,'beneficiaryId'), execute: async (ctx,p) => { if(!ctx.firestore) throw fail('FAILED_PRECONDITION','Firestore is not configured.',500); const ref=await ctx.firestore.getDocument('beneficiaries',p.beneficiaryId);assertResourceAccess(ctx,ref?.data,'Beneficiary'); const logs=await ctx.firestore.queryByField('audit_logs','documentId','EQUAL',p.beneficiaryId); return {success:true,beneficiaryId:p.beneficiaryId,history:logs.filter(x=>x.data?.workspaceId===ctx.authContext.workspaceId).map(x=>({id:x.id,...x.data}))}; } },

  // ===========================================================================
  // GROUP 6: FAMILY RESERVE FUND (3 Actions)
  // ===========================================================================
  'initializeReserveFundCallable': {
    permission: ACTION_PERMISSIONS['initializeReserveFundCallable'],
    validate: (p) => validatePositiveNumber(p, 'openingBalance'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'initializeReserveFundCallable', status: 'PACKAGING_VALIDATED', balance: payload.openingBalance };
      }
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const reservePath = 'reserve_funds';
        return await ctx.firestore.runTransaction(async (tx) => {
          // Explicit existence check: Prevent overwriting an existing reserve fund record
          const existing = await tx.get(reservePath, workspaceId);
          if (existing) {
            const err = new Error(`Reserve fund already exists for workspace "${workspaceId}" and cannot be overwritten.`);
            err.code = 'ALREADY_EXISTS';
            err.status = 409;
            throw err;
          }

          // Strict insertion with currentDocument: { exists: false } precondition
          tx.create(reservePath, workspaceId, {
            balance: payload.openingBalance,
            currentBalance: payload.openingBalance,
            totalDeposited: payload.openingBalance,
            totalWithdrawn: 0,
            workspaceId,
            ownerUid: ctx.authContext.uid,
            initializedBy: ctx.authContext.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          return {
            success: true,
            action: 'initializeReserveFundCallable',
            balance: payload.openingBalance
          };
        });
      }
      throw new Error('Live execution not configured');
    }
  },
  'withdrawFromReserveCallable': {
    permission: ACTION_PERMISSIONS['withdrawFromReserveCallable'],
    validate: (p) => {
      validatePositiveNumber(p, 'amount');
      validateRequired(p, 'reason');
      validateRequired(p, 'recipientName');
      validateRequired(p, 'paymentMethod');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'withdrawFromReserveCallable', status: 'PACKAGING_VALIDATED', amount: payload.amount };
      }
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const reservePath = 'reserve_funds';
        const txPath = 'reserve_ledger';

        return await ctx.firestore.runTransaction(async (tx) => {
          const reserveDoc = await tx.get(reservePath, workspaceId);
          const currentBalance = reserveDoc?.data?.balance ?? reserveDoc?.data?.currentBalance ?? 0;

          if (payload.amount > currentBalance) {
            const err = new Error(`Withdrawal amount ৳${payload.amount} exceeds reserve balance ৳${currentBalance}`);
            err.code = 'FAILED_PRECONDITION';
            err.status = 412;
            throw err;
          }

          const newBalance = currentBalance - payload.amount;
          tx.update(reservePath, workspaceId, {
            balance: newBalance,
            currentBalance: newBalance,
            totalWithdrawn: (reserveDoc?.data?.totalWithdrawn || 0) + payload.amount,
            updatedAt: new Date()
          });

          const withdrawalId = `with_${Date.now()}`;
          tx.create(txPath, withdrawalId, {
            type: 'emergency_withdrawal',
            amount: payload.amount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            reason: payload.reason,
            recipientName: payload.recipientName,
            paymentMethod: payload.paymentMethod,
            workspaceId,
            ownerUid: ctx.authContext.uid,
            isRentalIncome: false,
            createdBy: ctx.authContext.uid,
            createdAt: new Date()
          });

          return {
            success: true,
            action: 'withdrawFromReserveCallable',
            withdrawalId,
            amount: payload.amount,
            newBalance,
            isRentalIncome: false
          };
        });
      }
      throw new Error('Live execution not configured');
    }
  },
  'transferSurplusToReserveCallable': {
    permission: ACTION_PERMISSIONS['transferSurplusToReserveCallable'],
    validate: (p) => {
      validatePositiveNumber(p, 'amount');
      validateMonth(p, 'fromBillingMonth');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'transferSurplusToReserveCallable', status: 'PACKAGING_VALIDATED', amount: payload.amount };
      }
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION','Firestore is not configured.',500); const key=payload.idempotencyKey||`${ctx.authContext.workspaceId}:${payload.fromBillingMonth}:${payload.amount}`; const ledgerId=`transfer_${key.replace(/[^a-zA-Z0-9_-]/g,'_')}`; return await ctx.firestore.runTransaction(async(tx)=>{const reserve=await tx.get('reserve_funds',ctx.authContext.workspaceId);if(!reserve?.data)throw fail('NOT_FOUND','Reserve fund not initialized.',404);const existing=await tx.get('reserve_ledger',ledgerId);if(existing?.data)return {success:true,duplicate:true,transactionId:ledgerId,newBalance:reserve.data.balance??reserve.data.currentBalance};const before=Number(reserve.data.balance??reserve.data.currentBalance)||0;const amount=finiteNumber(payload.amount,'amount',{min:.01,max:100000000});const after=before+amount;tx.update('reserve_funds',ctx.authContext.workspaceId,{balance:after,currentBalance:after,totalDeposited:(Number(reserve.data.totalDeposited)||0)+amount,updatedAt:new Date()});tx.create('reserve_ledger',ledgerId,{type:'surplus_transfer',amount,balanceBefore:before,balanceAfter:after,fromBillingMonth:payload.fromBillingMonth,workspaceId:ctx.authContext.workspaceId,ownerUid:ctx.authContext.uid,isRentalIncome:false,isInternalTransfer:true,idempotencyKey:key,createdAt:new Date()});return {success:true,transactionId:ledgerId,amount,newBalance:after,isRentalIncome:false,isInternalTransfer:true};});
    }
  },
  'recordReserveTransactionCallable': {
    permission: ACTION_PERMISSIONS['recordReserveTransactionCallable'],
    validate: (p) => { validatePositiveNumber(p, 'amount'); validateRequired(p, 'type'); validateRequired(p, 'reason'); },
    execute: async (ctx, p) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'recordReserveTransactionCallable', status: 'PACKAGING_VALIDATED' };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const key = p.idempotencyKey || `${ctx.authContext.workspaceId}:${p.type}:${p.amount}:${p.reason}`;
      const id = `reserve_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      return ctx.firestore.runTransaction(async (tx) => {
        const reserve = await tx.get('reserve_funds', ctx.authContext.workspaceId);
        if (!reserve?.data) throw fail('NOT_FOUND', 'Reserve fund not initialized.', 404);
        const existing = await tx.get('reserve_ledger', id);
        if (existing?.data) return { success: true, duplicate: true, transactionId: id };
        const before = Number(reserve.data.balance ?? reserve.data.currentBalance) || 0;
        const signedAmount = ['withdrawal', 'expense', 'debit'].includes(String(p.type).toLowerCase()) ? -Number(p.amount) : Number(p.amount);
        const after = before + signedAmount;
        if (after < 0) throw fail('FAILED_PRECONDITION', 'Reserve balance cannot become negative.', 412);
        tx.update('reserve_funds', ctx.authContext.workspaceId, { balance: after, currentBalance: after, updatedAt: new Date() });
        tx.create('reserve_ledger', id, { type: p.type, amount: Number(p.amount), signedAmount, balanceBefore: before, balanceAfter: after, reason: p.reason, workspaceId: ctx.authContext.workspaceId, ownerUid: ctx.authContext.uid, isRentalIncome: false, isInternalTransfer: true, idempotencyKey: key, createdAt: new Date() });
        return { success: true, transactionId: id, amount: Number(p.amount), newBalance: after, isInternalTransfer: true };
      });
    }
  },
  'reconcileReserveBalanceCallable': {
    permission: ACTION_PERMISSIONS['reconcileReserveBalanceCallable'],
    validate: () => {},
    execute: async (ctx) => {
      if (ctx.config.disableFinancialWrites) return { success: true, action: 'reconcileReserveBalanceCallable', status: 'PACKAGING_VALIDATED' };
      if (!ctx.firestore) throw fail('FAILED_PRECONDITION', 'Firestore is not configured.', 500);
      const reserve = await ctx.firestore.getDocument('reserve_funds', ctx.authContext.workspaceId);
      if (!reserve?.data) throw fail('NOT_FOUND', 'Reserve fund not initialized.', 404);
      const ledger = await ctx.firestore.queryByField('reserve_ledger', 'workspaceId', 'EQUAL', ctx.authContext.workspaceId);
      const calculated = ledger.reduce((sum, row) => sum + (Number(row.data?.signedAmount ?? (['withdrawal','expense','debit'].includes(String(row.data?.type).toLowerCase()) ? -Number(row.data?.amount || 0) : Number(row.data?.amount || 0))) || 0), 0) + (Number(reserve.data.totalDeposited) || 0) - (Number(reserve.data.totalWithdrawn) || 0);
      const recorded = Number(reserve.data.balance ?? reserve.data.currentBalance) || 0;
      return { success: true, recordedBalance: recorded, calculatedBalance: calculated, difference: recorded - calculated, reconciled: Math.abs(recorded - calculated) < 0.01 };
    }
  },

  // ===========================================================================
  // GROUP 7: WORKSPACE & MEMBERSHIP MANAGEMENT (Granular Member System)
  // ===========================================================================
  'listWorkspaceMembersCallable': {
    permission: ACTION_PERMISSIONS['listWorkspaceMembersCallable'],
    validate: () => {},
    execute: async (ctx) => {
      const workspaceId = ctx.authContext.workspaceId;

      // In mock test environment
      if (ctx.env?.__MOCK_WORKSPACE_MEMBERS__) {
        const members = Object.values(ctx.env.__MOCK_WORKSPACE_MEMBERS__)
          .filter(m => !m.workspaceId || m.workspaceId === workspaceId)
          .map(m => ({
            ...m,
            permissions: normalizePermissions(m.permissions, m.role)
          }));
        return {
          success: true,
          workspaceId,
          membersCount: members.length,
          members
        };
      }

      if (!ctx.firestore) {
        throw new Error('Database client unavailable');
      }

      const docs = await ctx.firestore.queryByField('workspace_members', 'workspaceId', 'EQUAL', workspaceId);
      const members = docs.map(d => {
        const data = d.data || {};
        return {
          id: d.id,
          uid: data.uid || d.id.replace(`${workspaceId}_`, ''),
          workspaceId: data.workspaceId || workspaceId,
          email: data.email || null,
          displayName: data.displayName || data.name || 'সদস্য',
          mobile: data.mobile || data.phone || null,
          role: data.role || 'viewer',
          status: data.status || 'inactive',
          permissions: normalizePermissions(data.permissions, data.role),
          permissionsVersion: data.permissionsVersion || 1,
          createdAt: data.createdAt || null,
          createdBy: data.createdBy || null,
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || null
        };
      });

      return {
        success: true,
        workspaceId,
        membersCount: members.length,
        members
      };
    }
  },

  'createWorkspaceMemberCallable': {
    permission: ACTION_PERMISSIONS['createWorkspaceMemberCallable'],
    validate: (p) => {
      validateRequired(p, 'email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
        const err = new Error('Invalid email address format');
        err.code = 'INVALID_ARGUMENT';
        err.status = 400;
        throw err;
      }
      if (p.role === 'master_admin') {
        const err = new Error('Cannot assign master_admin role to new members');
        err.code = 'INVALID_ARGUMENT';
        err.status = 400;
        throw err;
      }
    },
    execute: async (ctx, payload) => {
      const workspaceId = ctx.authContext.workspaceId;
      const targetEmail = payload.email.trim().toLowerCase();
      const displayName = payload.displayName || payload.fullName || targetEmail.split('@')[0];
      const assignedRole = (['manager', 'viewer', 'custom'].includes(payload.role)) ? payload.role : 'viewer';
      const normalizedPerms = normalizePermissions(payload.permissions || {}, assignedRole);

      // In mock test environment
      if (ctx.env?.__MOCK_WORKSPACE_MEMBERS__) {
        const targetDocId = `${workspaceId}_mock_${Date.now()}`;
        const newMember = {
          id: targetDocId,
          uid: `mock_${Date.now()}`,
          workspaceId,
          email: targetEmail,
          displayName,
          role: assignedRole,
          status: 'active',
          permissions: normalizedPerms
        };
        ctx.env.__MOCK_WORKSPACE_MEMBERS__[targetDocId] = newMember;
        return { success: true, action: 'createWorkspaceMemberCallable', isNewAccount: true, member: newMember };
      }

      // Live service-account execution
      const adminToken = await getGoogleAdminAccessToken(ctx.config.credentials, ctx.env?.FETCH_IMPL || fetch);

      // 1. Check if user already exists in Firebase Auth
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${ctx.config.projectId}/accounts:lookup`;
      const lookupRes = await (ctx.env?.FETCH_IMPL || fetch)(lookupUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: [targetEmail] })
      });
      const lookupData = await lookupRes.json();
      const existingUser = (lookupData.users && lookupData.users.length > 0) ? lookupData.users[0] : null;

      let targetUid;
      let isNewAccount = false;

      if (existingUser) {
        targetUid = existingUser.localId;

        // Check if user is already a member of this workspace
        const targetDocId = `${workspaceId}_${targetUid}`;
        const existingMemberDoc = await ctx.firestore.getDocument('workspace_members', targetDocId);
        if (existingMemberDoc && existingMemberDoc.data) {
          const err = new Error(`User "${targetEmail}" is already a member of this workspace`);
          err.code = 'ALREADY_EXISTS';
          err.status = 409;
          throw err;
        }

        // If confirmation not yet provided, prompt Master Admin to confirm linking existing user
        if (!payload.confirmExistingLink) {
          return {
            requiresConfirmation: true,
            existingAccount: true,
            email: targetEmail,
            uid: targetUid,
            displayName: existingUser.displayName || displayName,
            message: `User with email "${targetEmail}" already has an account. Confirm to link to this workspace.`
          };
        }
      } else {
        // Create new Firebase Auth user
        if (!payload.password || payload.password.length < 6) {
          const err = new Error('Password must be at least 6 characters long');
          err.code = 'INVALID_ARGUMENT';
          err.status = 400;
          throw err;
        }

        const createUrl = `https://identitytoolkit.googleapis.com/v1/projects/${ctx.config.projectId}/accounts`;
        const createRes = await (ctx.env?.FETCH_IMPL || fetch)(createUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: targetEmail,
            password: payload.password,
            displayName,
            emailVerified: false
          })
        });

        const createData = await createRes.json();
        if (!createRes.ok || !createData.localId) {
          const errMsg = createData.error?.message || createRes.statusText;
          const err = new Error(`Failed to create Firebase Auth user: ${errMsg}`);
          err.code = errMsg.includes('EMAIL_EXISTS') ? 'ALREADY_EXISTS' : 'INTERNAL_ERROR';
          err.status = createRes.status || 500;
          throw err;
        }

        targetUid = createData.localId;
        isNewAccount = true;
      }

      // 2. Create membership document in Firestore
      const targetDocId = `${workspaceId}_${targetUid}`;
      const now = new Date().toISOString();
      const memberDoc = {
        workspaceId,
        uid: targetUid,
        email: targetEmail,
        displayName,
        mobile: payload.mobile || null,
        role: assignedRole,
        status: 'active',
        permissions: normalizedPerms,
        permissionsVersion: 1,
        createdBy: ctx.authContext.uid,
        createdAt: now,
        updatedBy: ctx.authContext.uid,
        updatedAt: now
      };

      try {
        await ctx.firestore.createDocument('workspace_members', targetDocId, memberDoc);
      } catch (writeErr) {
        // If Auth user was newly created during this request, clean it up on failure
        if (isNewAccount) {
          try {
            const delUrl = `https://identitytoolkit.googleapis.com/v1/projects/${ctx.config.projectId}/accounts:delete`;
            await (ctx.env?.FETCH_IMPL || fetch)(delUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ localId: targetUid })
            });
          } catch (_) {
            // Ignore compensation deletion failure
          }
        }
        throw writeErr;
      }

      return {
        success: true,
        action: 'createWorkspaceMemberCallable',
        isNewAccount,
        member: {
          id: targetDocId,
          uid: targetUid,
          email: targetEmail,
          displayName,
          role: assignedRole,
          status: 'active',
          permissions: normalizedPerms
        }
      };
    }
  },

  'updateWorkspaceMemberPermissionsCallable': {
    permission: ACTION_PERMISSIONS['updateWorkspaceMemberPermissionsCallable'],
    validate: (p) => {
      validateRequired(p, 'targetUid');
      if (p.role === 'master_admin') {
        const err = new Error('Cannot assign master_admin role');
        err.code = 'INVALID_ARGUMENT';
        err.status = 400;
        throw err;
      }
    },
    execute: async (ctx, payload) => {
      const workspaceId = ctx.authContext.workspaceId;
      const targetUid = payload.targetUid;

      // Protection: Master Admin cannot modify their own permissions through this endpoint
      if (targetUid === ctx.authContext.uid) {
        const err = new Error('Master Admin cannot modify their own permissions through this endpoint');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
      }

      // Mock test environment
      if (ctx.env?.__MOCK_WORKSPACE_MEMBERS__) {
        const targetDocId = `${workspaceId}_${targetUid}`;
        const existing = ctx.env.__MOCK_WORKSPACE_MEMBERS__[targetDocId] || ctx.env.__MOCK_WORKSPACE_MEMBERS__[targetUid];
        if (!existing) {
          const err = new Error(`Membership for UID "${targetUid}" not found`);
          err.code = 'NOT_FOUND';
          err.status = 404;
          throw err;
        }
        const assignedRole = (['manager', 'viewer', 'custom'].includes(payload.role)) ? payload.role : (existing.role || 'viewer');
        const normalizedPerms = normalizePermissions(payload.permissions || existing.permissions || {}, assignedRole);
        existing.role = assignedRole;
        existing.permissions = normalizedPerms;
        return { success: true, action: 'updateWorkspaceMemberPermissionsCallable', targetUid, role: assignedRole, permissions: normalizedPerms };
      }

      const targetDocId = `${workspaceId}_${targetUid}`;
      const existingDoc = await ctx.firestore.getDocument('workspace_members', targetDocId);
      if (!existingDoc || !existingDoc.data) {
        const err = new Error(`Membership document "${targetDocId}" not found`);
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      if (existingDoc.data.role === 'master_admin') {
        const err = new Error('Cannot modify Master Admin permissions');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
      }

      const assignedRole = (['manager', 'viewer', 'custom'].includes(payload.role)) ? payload.role : (existingDoc.data.role || 'viewer');
      const normalizedPerms = normalizePermissions(payload.permissions || existingDoc.data.permissions || {}, assignedRole);
      const now = new Date().toISOString();

      await ctx.firestore.updateDocument('workspace_members', targetDocId, {
        role: assignedRole,
        permissions: normalizedPerms,
        updatedBy: ctx.authContext.uid,
        updatedAt: now
      });

      return {
        success: true,
        action: 'updateWorkspaceMemberPermissionsCallable',
        targetUid,
        role: assignedRole,
        permissions: normalizedPerms
      };
    }
  },

  'updateWorkspaceMemberStatusCallable': {
    permission: ACTION_PERMISSIONS['updateWorkspaceMemberStatusCallable'],
    validate: (p) => {
      validateRequired(p, 'targetUid');
      validateRequired(p, 'status');
      if (!['active', 'inactive', 'suspended', 'revoked'].includes(p.status)) {
        const err = new Error(`Invalid status: "${p.status}". Must be active, inactive, suspended, or revoked`);
        err.code = 'INVALID_ARGUMENT';
        err.status = 400;
        throw err;
      }
    },
    execute: async (ctx, payload) => {
      const workspaceId = ctx.authContext.workspaceId;
      const targetUid = payload.targetUid;
      const targetStatus = payload.status;

      // Protection: Master Admin cannot deactivate or suspend themselves
      if (targetUid === ctx.authContext.uid) {
        const err = new Error('Master Admin cannot modify their own workspace status');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
      }

      // Mock test environment
      if (ctx.env?.__MOCK_WORKSPACE_MEMBERS__) {
        const targetDocId = `${workspaceId}_${targetUid}`;
        const existing = ctx.env.__MOCK_WORKSPACE_MEMBERS__[targetDocId] || ctx.env.__MOCK_WORKSPACE_MEMBERS__[targetUid];
        if (!existing) {
          const err = new Error(`Membership document for "${targetUid}" not found`);
          err.code = 'NOT_FOUND';
          err.status = 404;
          throw err;
        }
        if (targetStatus === 'revoked') {
          delete ctx.env.__MOCK_WORKSPACE_MEMBERS__[targetDocId];
          delete ctx.env.__MOCK_WORKSPACE_MEMBERS__[targetUid];
          return { success: true, action: 'updateWorkspaceMemberStatusCallable', targetUid, status: 'revoked', revoked: true };
        }
        existing.status = targetStatus;
        return { success: true, action: 'updateWorkspaceMemberStatusCallable', targetUid, status: targetStatus };
      }

      const targetDocId = `${workspaceId}_${targetUid}`;
      const existingDoc = await ctx.firestore.getDocument('workspace_members', targetDocId);
      if (!existingDoc || !existingDoc.data) {
        const err = new Error(`Membership document "${targetDocId}" not found`);
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      if (existingDoc.data.role === 'master_admin') {
        const err = new Error('Cannot modify Master Admin status');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
      }

      const now = new Date().toISOString();

      if (targetStatus === 'revoked') {
        // Revoke workspace access: deletes membership record, leaves Auth account untouched
        await ctx.firestore.deleteDocument('workspace_members', targetDocId);
        return {
          success: true,
          action: 'updateWorkspaceMemberStatusCallable',
          targetUid,
          status: 'revoked',
          revoked: true
        };
      }

      await ctx.firestore.updateDocument('workspace_members', targetDocId, {
        status: targetStatus,
        updatedBy: ctx.authContext.uid,
        updatedAt: now
      });

      return {
        success: true,
        action: 'updateWorkspaceMemberStatusCallable',
        targetUid,
        status: targetStatus
      };
    }
  },

  'sendWorkspaceMemberPasswordResetCallable': {
    permission: ACTION_PERMISSIONS['sendWorkspaceMemberPasswordResetCallable'],
    validate: (p) => {
      if (!p.email && !p.targetEmail && !p.targetUid) {
        const err = new Error('Must provide email or targetUid');
        err.code = 'INVALID_ARGUMENT';
        err.status = 400;
        throw err;
      }
    },
    execute: async (ctx, payload) => {
      let email = (payload.email || payload.targetEmail || '').trim().toLowerCase();

      if (!email && payload.targetUid) {
        const targetDocId = `${ctx.authContext.workspaceId}_${payload.targetUid}`;
        const memberDoc = await ctx.firestore.getDocument('workspace_members', targetDocId);
        if (memberDoc?.data?.email) {
          email = memberDoc.data.email;
        }
      }

      if (!email) {
        const err = new Error('Target email could not be resolved');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      // Mock test environment
      if (ctx.env?.__MOCK_WORKSPACE_MEMBERS__) {
        return { success: true, action: 'sendWorkspaceMemberPasswordResetCallable', email, message: 'Password reset email sent (mocked)' };
      }

      const apiKey = ctx.config?.apiKey || ctx.env?.FIREBASE_WEB_API_KEY || ctx.env?.VITE_FIREBASE_API_KEY;
      if (!apiKey) {
        const err = new Error('Firebase Web API key is not configured in Worker environment');
        err.code = 'CONFIG_ERROR';
        err.status = 500;
        throw err;
      }
      const oobUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
      const oobRes = await (ctx.env?.FETCH_IMPL || fetch)(oobUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email
        })
      });

      const oobData = await oobRes.json();
      if (!oobRes.ok) {
        const err = new Error(`Password reset request failed: ${oobData.error?.message || oobRes.statusText}`);
        err.code = oobData.error?.message || 'INTERNAL_ERROR';
        err.status = oobRes.status || 500;
        throw err;
      }

      return {
        success: true,
        action: 'sendWorkspaceMemberPasswordResetCallable',
        email,
        message: 'Password reset email sent successfully'
      };
    }
  },

  // Legacy aliases for backward compatibility with earlier suites
  'inviteFamilyMemberCallable': {
    permission: ACTION_PERMISSIONS['inviteFamilyMemberCallable'],
    validate: (p) => {
      validateRequired(p, 'email');
    },
    execute: async (ctx, payload) => {
      return await ACTION_REGISTRY['createWorkspaceMemberCallable'].execute(ctx, {
        ...payload
      });
    }
  },

  'updateMemberPermissionsCallable': {
    permission: ACTION_PERMISSIONS['updateMemberPermissionsCallable'],
    validate: (p) => {
      validateRequired(p, 'targetUid');
    },
    execute: async (ctx, payload) => {
      return await ACTION_REGISTRY['updateWorkspaceMemberPermissionsCallable'].execute(ctx, payload);
    }
  },

  'deactivateFamilyMemberCallable': {
    permission: ACTION_PERMISSIONS['deactivateFamilyMemberCallable'],
    validate: (p) => validateRequired(p, 'targetUid'),
    execute: async (ctx, payload) => {
      return await ACTION_REGISTRY['updateWorkspaceMemberStatusCallable'].execute(ctx, {
        targetUid: payload.targetUid,
        status: 'inactive'
      });
    }
  }
};

/**
 * Dispatches an incoming action request to its registered handler
 */
export async function dispatchAction(actionName, rawPayload, authContext, workerContext) {
  const actionDef = ACTION_REGISTRY[actionName];
  if (!actionDef) {
    const err = new Error(`Unknown action: "${actionName}"`);
    err.code = 'ACTION_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // 1. Authoritative Payload Sanitization
  const sanitizedPayload = sanitizeClientPayload(rawPayload, authContext, actionName);

  // 2. Normalization & Permissive DTO Aliasing
  const normalizedPayload = normalizeActionPayload(actionName, sanitizedPayload);

  // 3. Input Validation
  actionDef.validate(normalizedPayload);

  // 4. Execution (with immutable audit trail for every administrative mutation)
  const previousValues = await readAuditTarget(workerContext, actionName, normalizedPayload);
  try {
    const result = await actionDef.execute(workerContext, normalizedPayload);
    await recordAuditLog(workerContext, actionName, normalizedPayload, { status: 'success', result }, previousValues);
    return result;
  } catch (error) {
    await recordAuditLog(
      workerContext,
      actionName,
      normalizedPayload,
      { status: 'failure', errorCode: error?.code || 'INTERNAL_ERROR' },
      previousValues
    );
    throw error;
  }
}
