# Final Remediation Report: Bhuiya Property Manager Staging Architecture

**Project**: Bhuiya Property Manager  
**Environment**: Staging (`bhuiya-property-staging`)  
**Status**: COMPLETE (All 5 Priorities Fully Remediated & Verified)  
**Safety Gate**: `DISABLE_FINANCIAL_WRITES=true` actively maintained  
**Date**: November 8, 2026  

---

## Executive Summary

Following the comprehensive audit findings in [`PHASE-10-2B-13-FINAL-AUDIT.md`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/PHASE-10-2B-13-FINAL-AUDIT.md), all confirmed Critical, High, Medium, and Low architectural findings have been systematically resolved.

All Worker mutation handlers now target canonical root Firestore collections (`tenants`, `security_deposits`, `rent_bills`, `rent_payments`, `expenses`, `reserve_funds`, `reserve_ledger`), fully aligning backend transactional paths with frontend schema definitions and deployed Firestore security rules. Permissive DTO normalization bridges all seven identified contract divergences without breaking client callers. Property lifecycle operations (`createPropertyCallable`, `updatePropertyCallable`, `archivePropertyCallable`) have been implemented as trusted Worker callable actions under `master_admin` RBAC, completely removing direct client writes from [`propertyService.ts`](file:///c:/Bhuiya-Property-Manager/src/services/propertyService.ts). Worker bundling is fully integrated into the root build pipeline, generating [`dist/_worker.js`](file:///c:/Bhuiya-Property-Manager/dist/_worker.js) (71.69 KB), and JWT clock-skew tolerance is tightened to 60 seconds while preserving legacy `ownerUid` compatibility.

---

## Remediation Matrix & Status

| Priority | Finding ID | Severity | Component | Issue | Remediation Applied | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P1** | ARCH-01 | **CRITICAL** | [`actionRegistry.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/worker/actionRegistry.mjs) | Dormant live transactions targeted subcollections `workspaces/${workspaceId}/*` instead of root collections | Aligned all paths to canonical root collections (`tenants`, `security_deposits`, `rent_bills`, `rent_payments`, `expenses`, `reserve_funds`, `reserve_ledger`); injected dual `workspaceId` and `ownerUid` on all writes | **RESOLVED** |
| **P2** | ARCH-02 | **HIGH** | [`actionRegistry.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/worker/actionRegistry.mjs) | 7 frontend/backend DTO divergences caused payload validation rejections | Implemented `normalizeActionPayload` in dispatch pipeline to handle field aliases (`phone`/`mobile`, `securityDeposit`/`advanceDeposit`, `billingMonth`, `reason`, `recipientName`, `distributionMonth`) | **RESOLVED** |
| **P3** | SEC-01 | **HIGH** | [`propertyService.ts`](file:///c:/Bhuiya-Property-Manager/src/services/propertyService.ts), [`actionRegistry.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/worker/actionRegistry.mjs) | Property creation, updates, and archiving used direct client writes blocked by Firestore rules | Implemented `createPropertyCallable`, `updatePropertyCallable`, `archivePropertyCallable` under `master_admin` RBAC; updated frontend service | **RESOLVED** |
| **P4** | DEPL-01 | **MEDIUM** | [`package.json`](file:///c:/Bhuiya-Property-Manager/package.json), [`package-worker.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/package-worker.mjs) | Worker packaging was manual and did not output `dist/_worker.js` during root build | Added worker packaging step to `package.json` `"build"` script; mirrored bundle to root `dist/_worker.js` | **RESOLVED** |
| **P5** | SEC-02 | **LOW** | [`tokenVerifier.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/tokenVerifier.mjs) | Clock-skew tolerance of 300s was overly permissive | Tightened default `clockSkewSec` to 60 seconds; preserved legacy `ownerUid` rule matching | **RESOLVED** |

---

## Technical Details by Priority

### Priority 1: Firestore Collection Path & Schema Alignment (CRITICAL)

#### Problem
In [`actionRegistry.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/worker/actionRegistry.mjs), dormant live transaction handlers referenced subcollection paths such as `workspaces/${workspaceId}/tenants`, `workspaces/${workspaceId}/liabilities`, `workspaces/${workspaceId}/bills`, `workspaces/${workspaceId}/payments`, `workspaces/${workspaceId}/expenses`, and `workspaces/${workspaceId}/reserveFund`. In contrast, the frontend services and deployed Firestore rules strictly query and match root collections (`/tenants`, `/security_deposits`, `/rent_bills`, `/rent_payments`, `/expenses`, `/reserve_funds`, `/reserve_ledger`) with document-level workspace filtering (`where('workspaceId', '==', activeWorkspaceId)`).

#### Implementation
All transaction write and read paths in [`actionRegistry.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/worker/actionRegistry.mjs) were refactored to canonical root collections:
- `tenants`: Stores tenant leases with `workspaceId`, `ownerUid`, `propertyId`, `unitId`, `phone`, `mobile`, `monthlyRent`, `securityDeposit`, `advanceDeposit`, and `status: 'active'`.
- `security_deposits`: Stores tenant deposit liabilities with `workspaceId`, `ownerUid`, `tenantId`, `propertyId`, `unitId`, `depositAmount`, `isLiability: true`, `isRentalIncome: false`, and `status: 'held'`.
- `rent_bills`: Stores monthly tenant bills with `workspaceId`, `ownerUid`, `propertyId`, `billingMonth`, `rentAmount`, `totalDue`, `totalPaid: 0`, `balanceDue`, and `status: 'unpaid'`.
- `rent_payments`: Stores received rental income payments with `workspaceId`, `ownerUid`, `billId`, `amount`, `paymentMethod`, `paymentDate`, `isRentalIncome: true`, and `entryType: 'payment'`.
- `expenses`: Stores operating expenses with `workspaceId`, `ownerUid`, `group`, `category`, `amount`, `expenseDate`, `billingMonth`, `description`, `title`, `isOperatingExpense: true`, and `isRentalIncome: false`.
- `reserve_funds`: Stores workspace reserve account balance documents keyed by `workspaceId` with `balance`, `currentBalance`, `totalDeposited`, and `totalWithdrawn`.
- `reserve_ledger`: Append-only audit ledger for reserve allocations and emergency withdrawals with `workspaceId`, `ownerUid`, `balanceBefore`, `balanceAfter`, and `isRentalIncome: false`.

Dual identity fields (`workspaceId` and `ownerUid`) are populated on every document write to ensure seamless multi-tenancy workspace isolation and backward compatibility with legacy owner queries.

---

### Priority 2: Frontend/Backend DTO Normalization (HIGH)

#### Problem
Frontend input forms and service wrappers in [`src/services/`](file:///c:/Bhuiya-Property-Manager/src/services/) evolved slight naming variations relative to initial Worker action validators, resulting in client validation rejections.

#### Implementation
Implemented `normalizeActionPayload(actionName, rawPayload)` inside [`actionRegistry.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/worker/actionRegistry.mjs), executed authoritatively prior to schema validation in `dispatchAction`:

```javascript
export function normalizeActionPayload(actionName, rawPayload) {
  const p = { ...(rawPayload || {}) };
  switch (actionName) {
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

    case 'applySpecialAdjustmentCallable':
    case 'recordBeneficiaryPayoutCallable':
      p.distributionId = p.distributionId || p.distributionMonth;
      p.distributionMonth = p.distributionMonth || p.distributionId;
      if (!p.paymentDate) p.paymentDate = new Date().toISOString().slice(0, 10);
      break;
  }
  return p;
}
```

This normalization preserves complete backward compatibility with raw backend API calls while transparently supporting all existing frontend TypeScript interfaces (`TenantFormData`, `VacateTenantFormData`, `ExpenseFormData`, `RecordPayoutInput`, `ReserveWithdrawalInput`, `ReserveTransferInput`).

---

### Priority 3: Property Lifecycle Callable APIs & RBAC (HIGH)

#### Problem
[`src/services/propertyService.ts`](file:///c:/Bhuiya-Property-Manager/src/services/propertyService.ts) invoked `runTransaction`, `setDoc`, and `updateDoc` directly from the browser SDK. Because Firestore security rules enforce `allow write: if false;` on the `/properties` collection, client direct writes fail by design.

#### Implementation
1. **RBAC Mapping**: Registered in [`workspaceAuth.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/workspaceAuth.mjs):
   - `createPropertyCallable`: `['master_admin']`
   - `updatePropertyCallable`: `['master_admin']`
   - `archivePropertyCallable`: `['master_admin']`
2. **Action Handlers**: Registered in [`actionRegistry.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/worker/actionRegistry.mjs) with strict input validation, packaging dry-run gates (`status: 'PACKAGING_VALIDATED'`), and transactional writes to the `/properties` root collection with `workspaceId` and `ownerUid`.
3. **Frontend Service Migration**: Replaced direct Firestore mutation logic in [`propertyService.ts`](file:///c:/Bhuiya-Property-Manager/src/services/propertyService.ts):
   ```typescript
   export async function createProperty(input: PropertyInput): Promise<string> {
     const createFn = createCallable<PropertyInput, { success: boolean; propertyId: string }>('createPropertyCallable');
     const res = await createFn(input);
     return res.data.propertyId;
   }

   export async function updateProperty(propertyId: string, input: Partial<PropertyInput>): Promise<void> {
     const updateFn = createCallable<{ propertyId: string } & Partial<PropertyInput>, { success: boolean; propertyId: string }>('updatePropertyCallable');
     await updateFn({ propertyId, ...input });
   }

   export async function archiveProperty(propertyId: string, archive: boolean): Promise<void> {
     const archiveFn = createCallable<{ propertyId: string; isArchived: boolean }, { success: boolean; propertyId: string }>('archivePropertyCallable');
     await archiveFn({ propertyId, isArchived: archive });
   }
   ```
4. Removed all unused imports (`runTransaction`) to guarantee clean TypeScript compilation and lint compliance.

---

### Priority 4: Worker Packaging & Build Pipeline Integration (MEDIUM)

#### Problem
Worker bundling was previously performed via a standalone script (`package-worker.mjs`) targeting only `poc/phase-10-2a/dist/_worker.js`. Running `npm run build` did not bundle the worker or place `_worker.js` into the root `dist/` directory required for Cloudflare Pages Advanced Mode deployments.

#### Implementation
1. **Pipeline Integration**: Updated [`package.json`](file:///c:/Bhuiya-Property-Manager/package.json):
   ```json
   "scripts": {
     "dev": "vite",
     "build": "tsc -b && vite build && node poc/phase-10-2a/package-worker.mjs",
     "lint": "eslint .",
     "preview": "vite preview"
   }
   ```
2. **Dual Distribution Output**: Refactored [`package-worker.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/package-worker.mjs) to mirror the compiled bundle to both `poc/phase-10-2a/dist/_worker.js` and `dist/_worker.js`.
3. **Bundle Metrics Verified**:
   - Bundle file: `dist/_worker.js`
   - Bundle size: **71.69 KB** (73,407 bytes) — well within the 1MB Cloudflare Worker limit (< 7% of budget).
   - Zero forbidden Node.js built-ins (`fs`, `child_process`, `net`, `http2`, etc.).
   - Zero hardcoded private keys or leaked credentials.
   - Verified valid ESM default export with `fetch()` request handler.

---

### Priority 5: Token Clock-Skew Tolerance & Legacy Compatibility (LOW)

#### Problem
[`tokenVerifier.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/tokenVerifier.mjs) utilized a 300-second (5 minute) clock-skew tolerance, which was wider than industry best practices (60 seconds) for edge JWT verification.

#### Implementation
1. Updated default `clockSkewSec = 60` in [`tokenVerifier.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/tokenVerifier.mjs).
2. Preserved dual authorization check in [`firestore.workspace-candidate.rules`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/firestore.workspace-candidate.rules):
   ```javascript
   function isAuthorizedReader() {
     return isAuthenticated() &&
            resource != null &&
            (('workspaceId' in resource.data && isWorkspaceMember(resource.data.workspaceId)) ||
             ('ownerUid' in resource.data && resource.data.ownerUid == request.auth.uid));
   }
   ```
   Ensuring zero risk of breaking existing user data while enforcing workspace boundary checks.

---

## Verification Summary

All verification suites were executed against the remediated codebase:

```
========================================================================
FINAL REMEDIATION COMPREHENSIVE VERIFICATION SUITE: 60 / 60 PASSED
PHASE 10.2B-12 FULL SECURITY AUDIT SUITE:           238 / 238 PASSED
PHASE 10.2B-10 LIVE STAGING DATA READ SUITE:         121 / 121 PASSED
PHASE 10.2B-2 MASTER POC SUITE:                     101 / 101 PASSED
ESLINT VALIDATION (npm run lint):                    0 ERRORS, 0 WARNINGS
PRODUCTION BUILD (npm run build):                   SUCCESS (dist/_worker.js: 71.69 KB)
STAGING BUILD (npx vite build --mode staging):       SUCCESS
========================================================================
```

- **Live Financial Writes Committed**: 0
- **Staging Firestore Rent Bills Count**: 0
- **Staging Firestore Rent Payments Count**: 0
- **Staging Firestore Expenses Count**: 0
- **Staging Firestore Security Deposits Count**: 0
- **Security Regressions**: None

---

## Unresolved Issues & Recommendations

1. **Production Deployment Gate**: Financial writes remain intentionally disabled (`DISABLE_FINANCIAL_WRITES=true`). When promoting from staging to production, follow the formal cutover checklist in [`PRODUCTION-READINESS-CHECKLIST.md`](file:///c:/Bhuiya-Property-Manager/PRODUCTION-READINESS-CHECKLIST.md).
2. **Environment Separation**: Ensure production Firebase service account credentials (`bhuiya-property-manager`) are provisioned exclusively as Cloudflare Pages secret environment variables (`FIREBASE_SERVICE_ACCOUNT_JSON`), never checked into version control.
