/**
 * Phase 10.2B-2: Unified Action Registry for All 21 Backend Operations
 * 
 * Defines schemas, validation, RBAC mapping, and execution handlers.
 * Enforces packaging gate (disableFinancialWrites) to guarantee zero live writes.
 */

import { ACTION_PERMISSIONS, sanitizeClientPayload } from '../workspaceAuth.mjs';

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

export const ACTION_REGISTRY = {
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
      throw new Error('Live execution not configured in packaging phase');
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
      throw new Error('Live execution not configured');
    }
  },
  'archiveUnitCallable': {
    permission: ACTION_PERMISSIONS['archiveUnitCallable'],
    validate: (p) => validateRequired(p, 'unitId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'archiveUnitCallable', status: 'PACKAGING_VALIDATED', unitId: payload.unitId, isArchived: true };
      }
      throw new Error('Live execution not configured');
    }
  },
  'restoreUnitCallable': {
    permission: ACTION_PERMISSIONS['restoreUnitCallable'],
    validate: (p) => validateRequired(p, 'unitId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'restoreUnitCallable', status: 'PACKAGING_VALIDATED', unitId: payload.unitId, isArchived: false };
      }
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
    }
  },
  'vacateTenantCallable': {
    permission: ACTION_PERMISSIONS['vacateTenantCallable'],
    validate: (p) => {
      validateRequired(p, 'tenantId');
      validateRequired(p, 'unitId');
      validateRequired(p, 'vacateDate');
      validatePositiveNumber(p, 'refundAmount');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'vacateTenantCallable', status: 'PACKAGING_VALIDATED', tenantId: payload.tenantId };
      }
      throw new Error('Live execution not configured');
    }
  },

  // ===========================================================================
  // GROUP 3: RENT BILLING & PAYMENTS (2 Actions)
  // ===========================================================================
  'generateMonthlyBillsCallable': {
    permission: ACTION_PERMISSIONS['generateMonthlyBillsCallable'],
    validate: (p) => {
      validateRequired(p, 'propertyId');
      validateMonth(p, 'billingMonth');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'generateMonthlyBillsCallable', status: 'PACKAGING_VALIDATED', billingMonth: payload.billingMonth };
      }
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
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
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'createBeneficiaryCallable', status: 'PACKAGING_VALIDATED', beneficiaryId: `mock_ben_${Date.now()}` };
      }
      throw new Error('Live execution not configured');
    }
  },
  'updateBeneficiaryCallable': {
    permission: ACTION_PERMISSIONS['updateBeneficiaryCallable'],
    validate: (p) => validateRequired(p, 'beneficiaryId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'updateBeneficiaryCallable', status: 'PACKAGING_VALIDATED', beneficiaryId: payload.beneficiaryId };
      }
      throw new Error('Live execution not configured');
    }
  },
  'archiveBeneficiaryCallable': {
    permission: ACTION_PERMISSIONS['archiveBeneficiaryCallable'],
    validate: (p) => validateRequired(p, 'beneficiaryId'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'archiveBeneficiaryCallable', status: 'PACKAGING_VALIDATED', beneficiaryId: payload.beneficiaryId, isArchived: true };
      }
      throw new Error('Live execution not configured');
    }
  },
  'getOrCreateMonthlyDistributionCallable': {
    permission: ACTION_PERMISSIONS['getOrCreateMonthlyDistributionCallable'],
    validate: (p) => validateMonth(p, 'distributionMonth'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'getOrCreateMonthlyDistributionCallable', status: 'PACKAGING_VALIDATED', month: payload.distributionMonth };
      }
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
    }
  },

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
      throw new Error('Live execution not configured');
    }
  },

  // ===========================================================================
  // GROUP 7: WORKSPACE & MEMBERSHIP MANAGEMENT (3 Actions)
  // ===========================================================================
  'inviteFamilyMemberCallable': {
    permission: ACTION_PERMISSIONS['inviteFamilyMemberCallable'],
    validate: (p) => {
      validateRequired(p, 'email');
      validateRequired(p, 'assignedRole');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'inviteFamilyMemberCallable', status: 'PACKAGING_VALIDATED', email: payload.email, assignedRole: payload.assignedRole };
      }
      throw new Error('Live execution not configured');
    }
  },
  'updateMemberPermissionsCallable': {
    permission: ACTION_PERMISSIONS['updateMemberPermissionsCallable'],
    validate: (p) => {
      validateRequired(p, 'targetUid');
      validateRequired(p, 'assignedRole');
    },
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'updateMemberPermissionsCallable', status: 'PACKAGING_VALIDATED', targetUid: payload.targetUid, assignedRole: payload.assignedRole };
      }
      throw new Error('Live execution not configured');
    }
  },
  'deactivateFamilyMemberCallable': {
    permission: ACTION_PERMISSIONS['deactivateFamilyMemberCallable'],
    validate: (p) => validateRequired(p, 'targetUid'),
    execute: async (ctx, payload) => {
      if (ctx.config.disableFinancialWrites) {
        return { success: true, action: 'deactivateFamilyMemberCallable', status: 'PACKAGING_VALIDATED', targetUid: payload.targetUid, isActive: false };
      }
      throw new Error('Live execution not configured');
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
  const sanitizedPayload = sanitizeClientPayload(rawPayload, authContext);

  // 2. Input Validation
  actionDef.validate(sanitizedPayload);

  // 3. Execution
  const result = await actionDef.execute(workerContext, sanitizedPayload);
  return result;
}
