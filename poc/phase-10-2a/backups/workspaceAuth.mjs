/**
 * Phase 10.2A Proof-of-Concept: Family Workspace RBAC & Authorization Resolver
 * 
 * Enforces server-side workspace isolation and granular role permissions.
 * Never trusts client-supplied workspaceId, ownerUid, or role claims.
 */

export const ACTION_PERMISSIONS = {
  // Units & Properties
  'createUnitCallable': ['canManageTenants', 'master_admin'],
  'renameUnitCallable': ['canManageTenants', 'master_admin'],
  'archiveUnitCallable': ['master_admin'],
  'restoreUnitCallable': ['master_admin'],

  // Tenants & Leases
  'registerTenantCallable': ['canManageTenants', 'master_admin'],
  'vacateTenantCallable': ['canManageTenants', 'master_admin'],

  // Rent Billing & Payments
  'generateMonthlyBillsCallable': ['canCollectRent', 'master_admin'],
  'recordRentPaymentCallable': ['canCollectRent', 'master_admin'],

  // Operating Expenses
  'createExpenseCallable': ['canRecordExpenses', 'master_admin'],
  'updateExpenseCallable': ['master_admin'],
  'reverseExpenseCallable': ['master_admin'],

  // Beneficiaries & Distributions
  'seedDefaultBeneficiariesCallable': ['master_admin'],
  'createBeneficiaryCallable': ['master_admin'],
  'updateBeneficiaryCallable': ['master_admin'],
  'archiveBeneficiaryCallable': ['master_admin'],
  'getOrCreateMonthlyDistributionCallable': ['canViewReports', 'master_admin'],
  'applySpecialAdjustmentCallable': ['master_admin'],
  'recordBeneficiaryPayoutCallable': ['master_admin'],

  // Reserve Fund
  'initializeReserveFundCallable': ['master_admin'],
  'withdrawFromReserveCallable': ['master_admin'],
  'transferSurplusToReserveCallable': ['master_admin'],

  // Workspace & Membership Management
  'inviteFamilyMemberCallable': ['master_admin'],
  'updateMemberPermissionsCallable': ['master_admin'],
  'deactivateFamilyMemberCallable': ['master_admin']
};

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
  const memberRecord = await membershipLookup(callerUid);

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

  // Evaluate granular permissions for non-admin members
  const hasPermission = requiredPermissions.some(perm => {
    if (perm === 'master_admin') return false;
    return memberRecord.permissions && memberRecord.permissions[perm] === true;
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
