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
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const tenantId = payload.tenantId || `tenant_${Date.now()}`;
        const tenantPath = 'tenants';
        const liabilityPath = 'security_deposits';

        return await ctx.firestore.runTransaction(async (tx) => {
          tx.create(tenantPath, tenantId, {
            propertyId: payload.propertyId,
            unitId: payload.unitId,
            name: payload.name,
            phone: payload.phone,
            mobile: payload.phone,
            monthlyRent: payload.monthlyRent,
            securityDeposit: payload.securityDeposit,
            advanceDeposit: payload.securityDeposit,
            status: 'active',
            workspaceId,
            ownerUid: payload.ownerUid || ctx.authContext.uid,
            createdAt: new Date()
          });

          // Record Security Deposit strictly as liability, NOT rental income
          if (payload.securityDeposit > 0) {
            tx.create(liabilityPath, `deposit_${tenantId}`, {
              tenantId,
              propertyId: payload.propertyId,
              unitId: payload.unitId,
              amount: payload.securityDeposit,
              depositAmount: payload.securityDeposit,
              type: 'security_deposit',
              classification: 'liability',
              isLiability: true,
              isRentalIncome: false,
              status: 'held',
              workspaceId,
              ownerUid: payload.ownerUid || ctx.authContext.uid,
              createdAt: new Date()
            });
          }

          return {
            success: true,
            action: 'registerTenantCallable',
            tenantId,
            securityDeposit: payload.securityDeposit,
            isLiability: true,
            isRentalIncome: false
          };
        });
      }
      throw new Error('Live execution not configured');
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
      throw new Error('Live execution not configured');
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
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const propertyId = payload.propertyId || 'all';
        const billId = payload.billId || `${propertyId}_${payload.billingMonth}`;
        const billPath = 'rent_bills';

        return await ctx.firestore.runTransaction(async (tx) => {
          const rentAmount = payload.rentAmount || 15000;
          tx.create(billPath, billId, {
            propertyId,
            billingMonth: payload.billingMonth,
            rentAmount,
            totalDue: rentAmount,
            totalPaid: 0,
            balanceDue: rentAmount,
            status: 'unpaid',
            workspaceId,
            ownerUid: payload.ownerUid || ctx.authContext.uid,
            createdAt: new Date()
          });
          return {
            success: true,
            action: 'generateMonthlyBillsCallable',
            billId,
            billingMonth: payload.billingMonth,
            rentAmount,
            status: 'unpaid'
          };
        });
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
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const billPath = 'rent_bills';
        const paymentPath = 'rent_payments';
        const idempotencyKey = payload.idempotencyKey || null;

        return await ctx.firestore.runTransaction(async (tx) => {
          if (idempotencyKey) {
            const existing = await tx.get(paymentPath, idempotencyKey);
            if (existing) {
              return {
                success: true,
                action: 'recordRentPaymentCallable',
                idempotentDuplicate: true,
                paymentId: idempotencyKey,
                amount: existing.data.amount,
                status: 'POSTED_PREVIOUSLY'
              };
            }
          }

          let billDoc = await tx.get(billPath, payload.billId);
          let billData;
          if (!billDoc) {
            const rentAmount = payload.amount || 15000;
            billData = {
              tenantId: payload.tenantId || null,
              propertyId: payload.propertyId || 'prop_bhuiya',
              billingMonth: payload.billingMonth || (payload.paymentDate ? payload.paymentDate.slice(0, 7) : new Date().toISOString().slice(0, 7)),
              rentAmount,
              totalDue: rentAmount,
              totalPaid: 0,
              balanceDue: rentAmount,
              status: 'unpaid',
              workspaceId,
              ownerUid: payload.ownerUid || ctx.authContext.uid,
              createdAt: new Date()
            };
            tx.create(billPath, payload.billId, billData);
          } else {
            billData = billDoc.data;
          }
          const currentTotalPaid = billData.totalPaid || 0;
          const rentAmount = billData.rentAmount || billData.totalDue || 15000;
          const currentBalanceDue = rentAmount - currentTotalPaid;

          if (currentBalanceDue <= 0) {
            const err = new Error(`Bill "${payload.billId}" is already fully paid`);
            err.code = 'FAILED_PRECONDITION';
            err.status = 412;
            throw err;
          }

          if (payload.amount > currentBalanceDue) {
            const err = new Error(`Payment amount ৳${payload.amount} exceeds balance due ৳${currentBalanceDue}`);
            err.code = 'INVALID_ARGUMENT';
            err.status = 400;
            throw err;
          }

          const newTotalPaid = currentTotalPaid + payload.amount;
          const newBalanceDue = rentAmount - newTotalPaid;
          const newStatus = newBalanceDue === 0 ? 'paid' : 'partial';

          tx.update(billPath, payload.billId, {
            totalPaid: newTotalPaid,
            balanceDue: newBalanceDue,
            status: newStatus,
            updatedAt: new Date()
          });

          const paymentId = idempotencyKey || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          tx.create(paymentPath, paymentId, {
            billId: payload.billId,
            amount: payload.amount,
            paymentMethod: payload.paymentMethod,
            paymentDate: payload.paymentDate,
            isRentalIncome: true,
            entryType: 'payment',
            receiptNumber: payload.receiptNumber || `REC_${Date.now()}`,
            workspaceId,
            ownerUid: payload.ownerUid || ctx.authContext.uid,
            callerUid: ctx.authContext.uid,
            createdAt: new Date()
          });

          return {
            success: true,
            action: 'recordRentPaymentCallable',
            paymentId,
            billId: payload.billId,
            amount: payload.amount,
            totalPaid: newTotalPaid,
            balanceDue: newBalanceDue,
            status: newStatus
          };
        });
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
      if (!ctx.config.disableFinancialWrites && ctx.firestore) {
        const workspaceId = ctx.authContext.workspaceId;
        const expensePath = 'expenses';
        const expenseId = payload.expenseId || `exp_${Date.now()}`;

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
            status: 'active',
            isOperatingExpense: true,
            isRentalIncome: false,
            propertyId: payload.propertyId || null,
            workspaceId,
            ownerUid: payload.ownerUid || ctx.authContext.uid,
            createdBy: ctx.authContext.uid,
            createdAt: new Date()
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
      throw new Error('Live execution not configured');
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
        ...payload,
        password: payload.password || 'TemporaryPass2026!'
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

  // 4. Execution
  const result = await actionDef.execute(workerContext, normalizedPayload);
  return result;
}
