import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/authMiddleware.ts';
import { ApiError } from '../_lib/validation.ts';

// Import domain handlers
import {
  createUnitCallable,
  renameUnitCallable,
  archiveUnitCallable,
  restoreUnitCallable,
} from '../_lib/handlers/units.ts';

import {
  registerTenantCallable,
  vacateTenantCallable,
} from '../_lib/handlers/tenants.ts';

import {
  generateMonthlyBillsCallable,
  recordRentPaymentCallable,
} from '../_lib/handlers/rent.ts';

import {
  createExpenseCallable,
  updateExpenseCallable,
  reverseExpenseCallable,
} from '../_lib/handlers/expenses.ts';

import {
  seedDefaultBeneficiariesCallable,
  createBeneficiaryCallable,
  updateBeneficiaryCallable,
  archiveBeneficiaryCallable,
  getOrCreateMonthlyDistributionCallable,
  applySpecialAdjustmentCallable,
  recordBeneficiaryPayoutCallable,
} from '../_lib/handlers/distribution.ts';

import {
  initializeReserveFundCallable,
  withdrawFromReserveCallable,
  transferSurplusToReserveCallable,
} from '../_lib/handlers/reserve.ts';

type ActionHandler = (callerUid: string, payload: Record<string, unknown>, userEmail?: string) => Promise<unknown>;

const actionHandlers: Record<string, ActionHandler> = {
  // Units (4)
  createUnitCallable: (uid, p) => createUnitCallable(uid, p),
  renameUnitCallable: (uid, p) => renameUnitCallable(uid, p),
  archiveUnitCallable: (uid, p) => archiveUnitCallable(uid, p),
  restoreUnitCallable: (uid, p) => restoreUnitCallable(uid, p),

  // Tenants (2)
  registerTenantCallable: (uid, p) => registerTenantCallable(uid, p),
  vacateTenantCallable: (uid, p) => vacateTenantCallable(uid, p),

  // Rent & Bills (2)
  generateMonthlyBillsCallable: (uid, p) => generateMonthlyBillsCallable(uid, p),
  recordRentPaymentCallable: (uid, p) => recordRentPaymentCallable(uid, p),

  // Expenses (3)
  createExpenseCallable: (uid, p, email) => createExpenseCallable(uid, p, email),
  updateExpenseCallable: (uid, p, email) => updateExpenseCallable(uid, p, email),
  reverseExpenseCallable: (uid, p, email) => reverseExpenseCallable(uid, p, email),

  // Beneficiaries & Distribution (7)
  seedDefaultBeneficiariesCallable: (uid) => seedDefaultBeneficiariesCallable(uid),
  createBeneficiaryCallable: (uid, p) => createBeneficiaryCallable(uid, p),
  updateBeneficiaryCallable: (uid, p) => updateBeneficiaryCallable(uid, p),
  archiveBeneficiaryCallable: (uid, p) => archiveBeneficiaryCallable(uid, p),
  getOrCreateMonthlyDistributionCallable: (uid, p) => getOrCreateMonthlyDistributionCallable(uid, p),
  applySpecialAdjustmentCallable: (uid, p) => applySpecialAdjustmentCallable(uid, p),
  recordBeneficiaryPayoutCallable: (uid, p, email) => recordBeneficiaryPayoutCallable(uid, p, email),

  // Reserve Fund (3)
  initializeReserveFundCallable: (uid, p, email) => initializeReserveFundCallable(uid, p, email),
  withdrawFromReserveCallable: (uid, p, email) => withdrawFromReserveCallable(uid, p, email),
  transferSurplusToReserveCallable: (uid, p, email) => transferSurplusToReserveCallable(uid, p, email),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 2. CORS Handling
  const origin = req.headers.origin;
  if (origin && typeof origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 3. HTTP Method Validation
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'invalid-argument',
      code: 'invalid-argument',
      message: `HTTP ${req.method} method not allowed. Only POST requests are supported.`,
    });
  }

  // 4. Resolve Action Name from Query or URL
  let action = req.query?.action;
  if (Array.isArray(action)) action = action[0];
  if (!action && req.url) {
    const match = req.url.match(/\/api\/callable\/([^?/#]+)/);
    if (match) action = match[1];
  }

  if (!action || typeof action !== 'string') {
    return res.status(400).json({
      error: 'invalid-argument',
      code: 'invalid-argument',
      message: 'Missing or invalid callable action name.',
    });
  }

  const handlerFn = actionHandlers[action];
  if (!handlerFn) {
    return res.status(404).json({
      error: 'not-found',
      code: 'not-found',
      message: `Callable action "${action}" not recognized.`,
    });
  }

  try {
    // 5. Authenticate Request via Firebase ID Token
    const authUser = await authenticateRequest(req);
    const callerUid = authUser.uid;

    // 6. Parse and Validate Body
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        throw new ApiError('invalid-argument', 'Malformed JSON request body.');
      }
    }
    const payload = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {};

    // 7. Execute Business Logic Handler
    const result = await handlerFn(callerUid, payload, authUser.email);

    // 8. Return Success Payload matching Firebase HttpsCallableResult shape
    return res.status(200).json({
      data: result,
      success: true,
    });
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        error: err.code,
        code: err.code,
        message: err.message,
      });
    }

    const error = err as { code?: string; message?: string; statusCode?: number };
    console.error(`[API Router Error] ${action}:`, error);

    const statusCode = error.statusCode || 500;
    const code = error.code || 'internal';
    const message = error.message || 'An internal server error occurred.';

    return res.status(statusCode).json({
      error: code,
      code,
      message,
    });
  }
}
