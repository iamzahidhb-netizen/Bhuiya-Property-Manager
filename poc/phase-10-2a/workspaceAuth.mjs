/**
 * Phase 10.2B-1: Family Workspace RBAC & Authorization Resolver
 * 
 * Enforces server-side workspace isolation and granular role permissions.
 * Never trusts client-supplied workspaceId, ownerUid, or role claims.
 */

export const ACTION_PERMISSIONS = {
  // Properties
  'createPropertyCallable': ['createProperty', 'master_admin'],
  'updatePropertyCallable': ['updateProperty', 'master_admin'],
  'archivePropertyCallable': ['archiveProperty', 'master_admin'],
  'deletePropertyCallable': ['archiveProperty', 'master_admin'],

  // Units & Properties
  'createUnitCallable': ['createUnit', 'canManageTenants', 'master_admin'],
  'renameUnitCallable': ['updateUnit', 'canManageTenants', 'master_admin'],
  'updateUnitCallable': ['updateUnit', 'canManageTenants', 'master_admin'],
  'deleteUnitCallable': ['archiveUnit', 'master_admin'],
  'archiveUnitCallable': ['archiveUnit', 'master_admin'],
  'restoreUnitCallable': ['archiveUnit', 'master_admin'],

  // Tenants & Leases
  'registerTenantCallable': ['createTenant', 'manageTenants', 'canManageTenants', 'master_admin'],
  'updateTenantCallable': ['updateTenant', 'manageTenants', 'canManageTenants', 'master_admin'],
  'vacateTenantCallable': ['updateTenant', 'manageTenants', 'canManageTenants', 'master_admin'],

  // Rent Billing & Payments
  'generateMonthlyBillsCallable': ['manageRentReceipts', 'collectRent', 'canCollectRent', 'master_admin'],
  'recordRentPaymentCallable': ['collectRent', 'canCollectRent', 'master_admin'],

  // Operating Expenses
  'createExpenseCallable': ['addExpense', 'canRecordExpenses', 'master_admin'],
  'updateExpenseCallable': ['updateExpense', 'master_admin'],
  'reverseExpenseCallable': ['reverseExpense', 'master_admin'],

  // Beneficiaries & Distributions
  'seedDefaultBeneficiariesCallable': ['manageFamilyDistribution', 'master_admin'],
  'createBeneficiaryCallable': ['manageFamilyDistribution', 'master_admin'],
  'updateBeneficiaryCallable': ['manageFamilyDistribution', 'master_admin'],
  'archiveBeneficiaryCallable': ['manageFamilyDistribution', 'master_admin'],
  'getOrCreateMonthlyDistributionCallable': ['manageFamilyDistribution', 'canViewReports', 'master_admin'],
  'applySpecialAdjustmentCallable': ['manageFamilyDistribution', 'master_admin'],
  'recordBeneficiaryPayoutCallable': ['manageFamilyDistribution', 'master_admin'],
  'restoreBeneficiaryCallable': ['manageFamilyDistribution', 'master_admin'],
  'getBeneficiaryHistoryCallable': ['manageFamilyDistribution', 'canViewReports', 'master_admin'],

  // Reserve Fund
  'initializeReserveFundCallable': ['manageReserveFund', 'master_admin'],
  'withdrawFromReserveCallable': ['withdrawFromReserve', 'master_admin'],
  'transferSurplusToReserveCallable': ['manageReserveFund', 'master_admin'],
  'recordReserveTransactionCallable': ['manageReserveFund', 'master_admin'],
  'reconcileReserveBalanceCallable': ['manageReserveFund', 'master_admin'],
  'reverseRentPaymentCallable': ['collectRent', 'master_admin'],
  'cancelRentBillCallable': ['manageRentReceipts', 'master_admin'],
  'refundSecurityDepositCallable': ['manageTenants', 'master_admin'],

  // Workspace & Membership Management (Master Admin ONLY!)
  'listWorkspaceMembersCallable': ['manageWorkspaceMembers', 'master_admin'],
  'createWorkspaceMemberCallable': ['manageWorkspaceMembers', 'master_admin'],
  'updateWorkspaceMemberPermissionsCallable': ['manageWorkspaceMembers', 'master_admin'],
  'updateWorkspaceMemberStatusCallable': ['manageWorkspaceMembers', 'master_admin'],
  'sendWorkspaceMemberPasswordResetCallable': ['manageWorkspaceMembers', 'master_admin'],

  // Legacy aliases
  'inviteFamilyMemberCallable': ['manageWorkspaceMembers', 'master_admin'],
  'updateMemberPermissionsCallable': ['manageWorkspaceMembers', 'master_admin'],
  'deactivateFamilyMemberCallable': ['manageWorkspaceMembers', 'master_admin']
};

export const CANONICAL_PERMISSION_KEYS = [
  // A. Home Dashboard
  'viewHomeSummary',

  // B. Properties
  'viewProperties',
  'createProperty',
  'updateProperty',
  'archiveProperty',

  // C. Units
  'viewUnits',
  'createUnit',
  'updateUnit',
  'archiveUnit',

  // D. Tenants and Leases
  'viewTenants',
  'createTenant',
  'updateTenant',
  'manageTenants',

  // E. Rent and Receipts
  'viewRent',
  'collectRent',
  'manageRentReceipts',

  // F. Expenses
  'viewExpenses',
  'addExpense',
  'updateExpense',
  'reverseExpense',

  // G. Accounts
  'viewAccounts',

  // H. Family Distribution
  'viewFamilyDistribution',
  'manageFamilyDistribution',

  // I. Reserve Fund
  'viewReserveFund',
  'manageReserveFund',
  'withdrawFromReserve',

  // J. Reports
  'viewReports',
  'exportReports',

  // K. Application Settings
  'manageAppSettings'
];

export const ROLE_PRESETS = {
  manager: {
    viewHomeSummary: true,
    viewProperties: true,
    createProperty: false,
    updateProperty: false,
    archiveProperty: false,
    viewUnits: true,
    createUnit: true,
    updateUnit: true,
    archiveUnit: false,
    viewTenants: true,
    createTenant: true,
    updateTenant: true,
    manageTenants: true,
    viewRent: true,
    collectRent: true,
    manageRentReceipts: true,
    viewExpenses: true,
    addExpense: true,
    updateExpense: false,
    reverseExpense: false,
    viewAccounts: true,
    viewFamilyDistribution: false,
    manageFamilyDistribution: false,
    viewReserveFund: false,
    manageReserveFund: false,
    withdrawFromReserve: false,
    viewReports: true,
    exportReports: false,
    manageAppSettings: false,
    manageWorkspaceMembers: false
  },
  viewer: {
    viewHomeSummary: true,
    viewProperties: true,
    createProperty: false,
    updateProperty: false,
    archiveProperty: false,
    viewUnits: true,
    createUnit: false,
    updateUnit: false,
    archiveUnit: false,
    viewTenants: true,
    createTenant: false,
    updateTenant: false,
    manageTenants: false,
    viewRent: true,
    collectRent: false,
    manageRentReceipts: false,
    viewExpenses: true,
    addExpense: false,
    updateExpense: false,
    reverseExpense: false,
    viewAccounts: true,
    viewFamilyDistribution: false,
    manageFamilyDistribution: false,
    viewReserveFund: false,
    manageReserveFund: false,
    withdrawFromReserve: false,
    viewReports: false,
    exportReports: false,
    manageAppSettings: false,
    manageWorkspaceMembers: false
  }
};

/**
 * Normalizes and validates permission objects against the canonical catalog and presets
 */
export function normalizePermissions(rawPermissions = {}, role = 'viewer') {
  const result = {};
  const preset = ROLE_PRESETS[role] || ROLE_PRESETS.viewer;

  for (const key of CANONICAL_PERMISSION_KEYS) {
    if (role === 'master_admin') {
      result[key] = true;
    } else if (rawPermissions && typeof rawPermissions[key] === 'boolean') {
      result[key] = rawPermissions[key];
    } else if (preset && typeof preset[key] === 'boolean') {
      result[key] = preset[key];
    } else {
      result[key] = false;
    }
  }

  // Handle legacy permission adapters if rawPermissions used older keys
  if (rawPermissions?.canManageTenants) {
    result.viewTenants = true;
    result.createTenant = true;
    result.updateTenant = true;
    result.manageTenants = true;
    result.viewUnits = true;
    result.createUnit = true;
    result.updateUnit = true;
  } else if (rawPermissions?.canManageTenants === false) {
    result.createTenant = false;
    result.updateTenant = false;
    result.manageTenants = false;
    result.createUnit = false;
    result.updateUnit = false;
  }

  if (rawPermissions?.canCollectRent) {
    result.viewRent = true;
    result.collectRent = true;
    result.manageRentReceipts = true;
  } else if (rawPermissions?.canCollectRent === false) {
    result.collectRent = false;
    result.manageRentReceipts = false;
  }

  if (rawPermissions?.canRecordExpenses) {
    result.viewExpenses = true;
    result.addExpense = true;
  } else if (rawPermissions?.canRecordExpenses === false) {
    result.addExpense = false;
  }

  if (rawPermissions?.canViewReports) {
    result.viewReports = true;
    result.viewAccounts = true;
  } else if (rawPermissions?.canViewReports === false) {
    result.viewReports = false;
  }

  // Enforce View dependencies: if view is false, dependent actions must be false!
  if (!result.viewProperties) {
    result.createProperty = false;
    result.updateProperty = false;
    result.archiveProperty = false;
  }
  if (!result.viewUnits) {
    result.createUnit = false;
    result.updateUnit = false;
    result.archiveUnit = false;
  }
  if (!result.viewTenants) {
    result.createTenant = false;
    result.updateTenant = false;
    result.manageTenants = false;
  }
  if (!result.viewRent) {
    result.collectRent = false;
    result.manageRentReceipts = false;
  }
  if (!result.viewExpenses) {
    result.addExpense = false;
    result.updateExpense = false;
    result.reverseExpense = false;
  }
  if (!result.viewFamilyDistribution) {
    result.manageFamilyDistribution = false;
  }
  if (!result.viewReserveFund) {
    result.manageReserveFund = false;
    result.withdrawFromReserve = false;
  }
  if (!result.viewReports) {
    result.exportReports = false;
  }

  // manageWorkspaceMembers is NEVER granted via custom permissions
  result.manageWorkspaceMembers = (role === 'master_admin');

  // Maintain backward compatibility for legacy permission adapters
  result.canManageTenants = Boolean(result.manageTenants || (result.createTenant && result.updateTenant));
  result.canCollectRent = Boolean(result.collectRent);
  result.canRecordExpenses = Boolean(result.addExpense);
  result.canViewReports = Boolean(result.viewReports);

  return result;
}

/**
 * Resolves user workspace membership and validates action permission
 */
export async function authorizeWorkspaceRequest(params, membershipLookup) {
  const { callerUid, actionName, requestedWorkspaceId = null } = params;

  if (!callerUid) {
    const err = new Error('Unauthorized: Missing caller UID');
    err.status = 401;
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  // Retrieve authoritative workspace membership from database
  const memberRecord = await membershipLookup(callerUid, requestedWorkspaceId);

  if (!memberRecord) {
    const err = new Error(`Access Denied: User ${callerUid} is not a member of any workspace`);
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  // 1. Verify Active Status
  if (memberRecord.status !== 'active') {
    const err = new Error(`Access Denied: Workspace membership is ${memberRecord.status}`);
    err.status = 403;
    err.code = 'MEMBERSHIP_INACTIVE';
    throw err;
  }

  // 2. Prevent Cross-Workspace Access
  if (requestedWorkspaceId && requestedWorkspaceId !== memberRecord.workspaceId) {
    const err = new Error(`Access Denied: User does not belong to workspace "${requestedWorkspaceId}"`);
    err.status = 403;
    err.code = 'CROSS_WORKSPACE_DENIED';
    throw err;
  }

  // 3. Permission Evaluation
  const requiredPermissions = ACTION_PERMISSIONS[actionName];
  if (!requiredPermissions) {
    const err = new Error(`Unknown action: "${actionName}"`);
    err.status = 404;
    err.code = 'ACTION_NOT_FOUND';
    throw err;
  }

  // Master Admin has unrestricted authority within their workspace
  if (memberRecord.role === 'master_admin') {
    return {
      authorized: true,
      workspaceId: memberRecord.workspaceId,
      uid: callerUid,
      role: 'master_admin',
      member: memberRecord
    };
  }

  // Evaluate granular permissions for non-admin members using normalizePermissions
  const effectivePermissions = normalizePermissions(memberRecord.permissions, memberRecord.role);
  const hasPermission = requiredPermissions.some(perm => {
    if (perm === 'master_admin' || perm === 'manageWorkspaceMembers') return false;
    return effectivePermissions[perm] === true;
  });

  if (!hasPermission) {
    const err = new Error(`Access Denied: Role "${memberRecord.role}" lacks permission for "${actionName}"`);
    err.status = 403;
    err.code = 'PERMISSION_DENIED';
    throw err;
  }

  return {
    authorized: true,
    workspaceId: memberRecord.workspaceId,
    uid: callerUid,
    role: memberRecord.role,
    member: memberRecord
  };
}

/**
 * Sanitizes client payload by stripping client-provided identity claims
 * and injecting authoritative server-verified workspace and caller context.
 */
export function sanitizeClientPayload(clientPayload, authContext, actionName = null) {
  const sanitized = { ...(clientPayload || {}) };
  // Overwrite any forged client fields with verified server context
  sanitized.workspaceId = authContext.workspaceId;
  sanitized.callerUid = authContext.uid;
  delete sanitized.ownerUid; // Ensure ownerUid cannot be forged

  // For member management actions, role/permissions/status are target parameters, not caller authorization.
  // For all other actions (units, expenses, payouts, etc.), callers cannot forge their role/permissions/status.
  const isMemberManagementAction = actionName && [
    'createWorkspaceMemberCallable',
    'updateWorkspaceMemberPermissionsCallable',
    'updateWorkspaceMemberStatusCallable'
  ].includes(actionName);

  if (!isMemberManagementAction) {
    delete sanitized.role; // Ensure role cannot be forged
    delete sanitized.permissions; // Ensure permissions cannot be forged
    delete sanitized.status; // Ensure status cannot be forged
  }
  return sanitized;
}
