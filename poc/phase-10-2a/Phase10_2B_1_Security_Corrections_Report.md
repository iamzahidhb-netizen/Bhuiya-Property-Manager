# Phase 10.2B-1: Security & Compatibility Corrections Report
**Project Name**: ভূঁইয়া প্রপার্টি ম্যানেজার (Bhuiya Property Manager)  
**Location**: `C:\Bhuiya-Property-Manager`  
**Prototype Directory**: `poc\phase-10-2a`  
**Execution Date**: 2026-11-07  
**Scope**: Implementation and testing of critical security, routing, authorization, and precondition corrections identified in the Phase 10.2A audit.  

---

## 1. Executive Summary

Phase 10.2B-1 successfully addressed all outstanding security gaps and compatibility oversights discovered during the Phase 10.2A evaluation. All changes were applied strictly to the isolated prototype files within `poc\phase-10-2a\`. Prior to modification, all files were backed up to `poc\phase-10-2a\backups\`.

### Key Corrections Implemented:
1. **Firestore Write Preconditions**: Document creation writes now enforce `currentDocument: { exists: false }`, strictly preventing accidental overwriting of existing units, bills, or tenant records. `ALREADY_EXISTS` (HTTP 409) and `FAILED_PRECONDITION` (HTTP 412) abort immediately without wasteful transaction retries.
2. **HTTP Security & Method Enforcement**: Implemented explicit CORS preflight (`OPTIONS`) with exact origin matching against an approved application whitelist (no wildcards `*`). Non-POST API mutations are rejected with HTTP 405 Method Not Allowed and an `Allow: POST, OPTIONS` header. Verified that `OPTIONS` requests do not execute financial mutations.
3. **Safe API Action Normalization**: Incoming action paths are stripped of whitespace and trailing slashes, protected against path traversal attacks (`..`, `/`, `\`), and validated against the `ACTION_PERMISSIONS` whitelist.
4. **Authoritative Client Payload Sanitization**: The server now strips client-provided `ownerUid` and `role`, overriding `workspaceId` and `callerUid` with trusted server-side authorization context.
5. **Multi-User Security Rules Design**: Created `poc\phase-10-2a\firestore.workspace-candidate.rules` introducing `isWorkspaceMember(workspaceId)` and `isMasterAdmin(workspaceId)` while blocking direct client writes across all financial collections.
6. **Token Revocation Strategy**: Documented the offline JWT revocation lag and implemented an optional online verification check via Firebase Identity Toolkit REST API (`accounts:lookup`) for high-value operations.
7. **Comprehensive Regression Suite**: Expanded automated test assertions from 38 to **59 assertions**. All 59 passed with **100% success**.

---

## 2. File Modification & Backup Ledger

| File Modified | Backup Location | Purpose of Correction |
|---|---|---|
| `poc\phase-10-2a\firestoreRestClient.mjs` | `poc\phase-10-2a\backups\firestoreRestClient.mjs` | Added `createInsertWrite` with `currentDocument: { exists: false }`; handled 409/412 error codes; restricted retry to `ABORTED`. |
| `poc\phase-10-2a\workerRouter.mjs` | `poc\phase-10-2a\backups\workerRouter.mjs` | Added explicit `OPTIONS` handler (204 No Content), strict CORS origin matching, HTTP 405 POST-only guard, and `normalizeActionName`. |
| `poc\phase-10-2a\workspaceAuth.mjs` | `poc\phase-10-2a\backups\workspaceAuth.mjs` | Added `sanitizeClientPayload` to strip forged client identity and role claims. |
| `poc\phase-10-2a\tokenVerifier.mjs` | `poc\phase-10-2a\backups\tokenVerifier.mjs` | Added `checkFirebaseAccountRevocation` for on-demand online verification of disabled/revoked accounts via Identity Toolkit. |
| `poc\phase-10-2a\run-poc-tests.mjs` | `poc\phase-10-2a\backups\run-poc-tests.mjs` | Expanded test runner with Suites 8–12 covering preconditions, CORS, normalization, sanitization, and online revocation. |
| `poc\phase-10-2a\firestore.workspace-candidate.rules` | *(New file)* | Candidate Firestore Security Rules supporting 5-member shared family workspace access and blocking client writes. |

---

## 3. Detailed Summary of Security Corrections

### 3.1 Task 2 — Firestore Write Preconditions
- **The Vulnerability**: Previously, `txContext.create` mapped to a generic `update` write without preconditions. If a document ID collided with an existing record, it would overwrite the existing document silently.
- **The Correction**:
  - Implemented `createInsertWrite(collectionPath, docId, data)` which injects:
    ```json
    "currentDocument": { "exists": false }
    ```
  - Differentiated `create` from `update`: Updates support optional preconditions (`exists: true` or update time), while creates strictly enforce `exists: false`.
  - Updated `commit` error parsing: When Firestore returns HTTP 409 with `ALREADY_EXISTS` or HTTP 412 `FAILED_PRECONDITION`, the client sets `err.code = 'ALREADY_EXISTS'` or `'FAILED_PRECONDITION'`.
  - Updated `runTransaction`: Concurrency conflict retry is strictly limited to `err.code === 'ABORTED'`. `ALREADY_EXISTS` and `FAILED_PRECONDITION` abort immediately without retrying.

### 3.2 Task 3 — HTTP Security & CORS Preflight
- **The Vulnerability**: Previously, `workerRouter.mjs` did not handle `OPTIONS` requests, allowed wildcard origins, and did not reject non-POST methods.
- **The Correction**:
  - **Explicit `OPTIONS` Handler**: Intercepts preflight requests and returns HTTP 204 No Content with `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type, Accept`, and `Access-Control-Max-Age: 86400`. Verified that `apiHandler` is never invoked during preflights.
  - **Strict Origin Matching**: Matches incoming `Origin` against `DEFAULT_ALLOWED_ORIGINS` (`bhuiya-property-manager.pages.dev` and local development hosts). If origin matches, reflects that origin in `Access-Control-Allow-Origin: ${origin}` with `Access-Control-Allow-Credentials: true` and `Vary: Origin`. Wildcard `*` is prohibited. Unapproved origins receive no CORS header.
  - **POST-Only Guard**: Non-POST requests to `/api/callable/*` receive HTTP 405 Method Not Allowed with JSON error and `Allow: POST, OPTIONS`.
  - **Bearer Token Enforcement**: Missing or malformed `Authorization` header returns HTTP 401 `UNAUTHENTICATED`.

### 3.3 Task 4 — Action Name Normalization
- **The Vulnerability**: Unsanitized action paths could be vulnerable to path traversal, malformed slashes, or unknown function invocation.
- **The Correction**:
  - `normalizeActionName(rawPath)`:
    1. Trims leading and trailing whitespace.
    2. Strips leading `/api/callable/` and trailing slashes.
    3. Rejects empty action names with HTTP 400 `EMPTY_ACTION_NAME`.
    4. Rejects path traversal (`..`, `/`, `\`, `%2e`, `%2f`, `%5c`) with HTTP 400 `PATH_TRAVERSAL_DETECTED`.
    5. Enforces alphanumeric character whitelist (`/^[a-zA-Z0-9_]+$/`) with HTTP 400 `INVALID_CHARACTERS`.
    6. Validates action against `ACTION_PERMISSIONS` whitelist. Rejects unknown actions with HTTP 404 `ACTION_NOT_FOUND`.
    7. Guarantees that normalization never transforms an unknown action into a privileged action.

### 3.4 Task 5 — Workspace Authorization & Payload Sanitization
- **The Vulnerability**: Client payloads could pass spoofed `role`, `workspaceId`, or `ownerUid` properties.
- **The Correction**:
  - Added `sanitizeClientPayload(clientPayload, authContext)`:
    - Overwrites `workspaceId` with authoritative `authContext.workspaceId`.
    - Overwrites `callerUid` with authoritative `authContext.uid`.
    - Deletes `ownerUid` and `role` from the payload, preventing privilege escalation.
    - Preserves legitimate business payload parameters.

### 3.5 Task 8 — Token Revocation Strategy
- **The Vulnerability**: Offline RS256 signature verification cannot detect immediate session revocation.
- **The Multi-Tier Strategy**:
  - **Tier 1 (Instant Workspace Access Termination)**: Every mutation queries `workspace_members` and verifies `status === 'active'`. Deactivating a family member in the workspace instantly blocks all subsequent mutations (sub-second revocation).
  - **Tier 2 (Offline JWT Performance)**: Standard operations verify RS256 offline in ~0.21 ms without third-party network overhead.
  - **Tier 3 (Optional Online Verification)**: Implemented `checkFirebaseAccountRevocation(idToken, apiKey)` for high-risk actions (e.g. reserve fund withdrawals > ৳50,000) by calling `accounts:lookup` on the Firebase Identity Toolkit REST API.

---

## 4. Test Execution Summary

The expanded test suite was executed via `node poc/phase-10-2a/run-poc-tests.mjs`:

```
======================================================================
  PHASE 10.2B-1: COMPREHENSIVE SECURITY & COMPATIBILITY REGRESSION
======================================================================
  Suite 1: Firebase ID Token Verification (Web Crypto RS256) -> 6/6 PASS
  Suite 2: Service Account OAuth 2.0 (Web Crypto RS256)      -> 6/6 PASS
  Suite 3: Cloudflare Pages Advanced Mode Router (Task B)    -> 5/5 PASS
  Suite 4: Firestore REST Protocol (Task C)                  -> 2/2 PASS
  Suite 5: Family Workspace Authorization & RBAC (Task F)    -> 7/7 PASS
  Suite 6: Financial Integrity Invariants (Task G)           -> 11/11 PASS
  Suite 7: CPU & Runtime Benchmarks                          -> COMPLETED (~0.21ms JWT, ~1.29ms OAuth)
  Suite 8: Write Preconditions & Conflict Prevention (Task 2) -> 4/4 PASS
  Suite 9: HTTP Security & Method Enforcement (Task 3)       -> 5/5 PASS
  Suite 10: Action Name Normalization & Whitelist (Task 4)   -> 7/7 PASS
  Suite 11: Client Payload Sanitization (Task 5)             -> 4/4 PASS
  Suite 12: Online Account Revocation Strategy (Task 8)      -> 2/2 PASS
======================================================================
  TOTAL ASSERTIONS: 59 / 59 PASSED (100% SUCCESS)
======================================================================
```

---

## 5. Production Code & Safety Integrity

- **Production Code Status**: 100% UNCHANGED.
- **Root Security Rules Status**: 100% UNCHANGED (`firestore.rules` was not modified).
- **Firebase Functions Status**: 100% UNCHANGED (`functions/index.js` was not modified or renamed).
- **Firebase Billing Status**: Spark (Free) plan maintained. Zero Blaze billing.
- **Lint & Build Status**:
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run build`: Vite build completed cleanly in **389ms**.

---

## 6. Remaining Risks & Phase 10.2B-2 Gate Recommendation

### Remaining Unverified Items:
1. **Live Google Cloud Firestore REST Execution**: Tests executed against an in-memory mock fetch server; live Google Cloud network transactions have not been run.
2. **Production Cloudflare Workers Edge Execution**: While local Node.js benchmarks demonstrated ~1.5 ms active compute time, live Cloudflare Workers CPU time requires remote deployment.

### Final Recommendation: **GO FOR PHASE 10.2B-2**
All identified security gaps, write preconditions, CORS rules, action normalizations, and payload sanitizations are complete, backed up, and tested. The architecture is ready for Phase 10.2B-2 (Build Pipeline & Worker Packaging).
