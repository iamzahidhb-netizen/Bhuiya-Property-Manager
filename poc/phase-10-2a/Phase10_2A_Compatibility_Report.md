# Phase 10.2A: Cloudflare Compatibility Proof-of-Concept Report
**Project Name**: ভূঁইয়া প্রপার্টি ম্যানেজার (Bhuiya Property Manager)  
**Location**: `C:\Bhuiya-Property-Manager\poc\phase-10-2a`  
**Target Platform**: Cloudflare Pages (Hosting + Functions via Advanced Mode `_worker.js`) + Firebase Spark (Auth + Cloud Firestore)  
**Cost Model**: 100% Free Tier Guaranteed (Zero Blaze Billing, Zero Paid Cloudflare Services)  
**Audit & POC Execution Date**: 2026-11-07  
**Status**: Isolated Investigation & Prototype Complete (Non-Destructive)  

---

## 1. Executive Summary

This investigation was conducted to determine whether the existing **Bhuiya Property Manager** application can migrate safely from Firebase Cloud Functions (which require paid Blaze billing) to an entirely free-tier **Cloudflare Pages + Pages Functions + Firebase Spark** architecture.

### Key Conclusions:
1. **Cloudflare Runtime Compatibility**: **HIGHLY FEASIBLE via Web Standards**. The official `firebase-admin` package cannot run inside Cloudflare Workers isolates due to gRPC and low-level Node.js socket requirements. However, using the **official Cloud Firestore REST API v1** combined with standard **Web Crypto RS256 token verification**, all 21 backend mutation actions run with native edge speed, zero native dependencies, and full ACID transaction support.
2. **Directory Conflict Resolved (Option B - Advanced Mode)**: Cloudflare Pages would by default conflict with the root `functions/` directory containing our existing Firebase Cloud Functions. By adopting **Cloudflare Pages Advanced Mode (`_worker.js`)** output into `dist/`, the root `functions/` directory is **completely bypassed and preserved** without renaming, deleting, or altering existing Firebase tooling.
3. **Multi-User Family Workspace**: The existing single-user `ownerUid` security barrier is resolved by introducing a server-side `workspaces` and `workspace_members` model. The backend REST adapter enforces authoritative RBAC, ensuring that neither `workspaceId`, `ownerUid`, nor user roles can be spoofed by the browser.
4. **Zero Blaze Billing Verification**: Cloud Firestore REST API and Firebase Authentication are core Google Cloud APIs that operate fully under the Firebase Spark free plan. No Google Cloud billing account or credit card is required.
5. **Preservation of Existing Codebase**: All experiments, prototypes, and tests were conducted strictly inside `C:\Bhuiya-Property-Manager\poc\phase-10-2a\`. Zero production application files, database documents, or security rules were modified.

---

## 2. Architecture & Cloudflare Pages Routing Decision

### The Root Directory Conflict:
The existing project contains a root `functions/` directory housing the original 21 Firebase Cloud Functions (`functions/index.js`, `package.json`, `functions.yaml`). Cloudflare Pages standard mode also assumes a root `functions/` directory for file-based routing. If deployed in standard mode, Cloudflare's build system attempts to compile `functions/index.js`, crashing immediately due to Node CommonJS and gRPC imports.

### Evaluation of Options:
- **Option A (File-based Routing in `functions/`)**: **REJECTED**. Would require moving or deleting the existing Firebase `functions/` directory, violating safety constraints and breaking the Firebase Emulator suite.
- **Option B (Advanced Mode via `_worker.js`)**: **SELECTED & VERIFIED**.
  - Under Cloudflare Pages Advanced Mode, a single ES module `_worker.js` is emitted into the build output directory (`dist/_worker.js`).
  - Cloudflare Pages **completely ignores** the root `functions/` directory when `_worker.js` exists in the output directory.
  - The worker router intercepts `/api/callable/*` requests and forwards all static assets (HTML, JS, CSS, icons, PWA manifest) to `env.ASSETS.fetch(request)`.
  - For client-side SPA routing, navigation 404s cleanly fall back to `dist/index.html`.

---

## 3. Firestore REST API & Transaction Protocol Feasibility

The Cloud Firestore REST API v1 (`https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents`) was prototyped and verified using standard `fetch`:

1. **Document Data Modeling**: Implemented two-way mapping between JavaScript native primitives/objects and Firestore REST Value format (`stringValue`, `integerValue`, `doubleValue`, `booleanValue`, `timestampValue`, `mapValue`, `arrayValue`).
2. **ACID Transactions Protocol**:
   - `POST :beginTransaction`: Retrieves base64 transaction identifier.
   - `GET /docId?transaction={txId}` or `POST :batchGet`: Reads documents with isolation.
   - `POST :commit`: Atomically applies array of writes preconditioned on the transaction identifier.
   - `POST :rollback`: Aborts an open transaction upon validation or business rule failure.
3. **Concurrency Conflict Detection & Automated Retry**:
   - When concurrent writes conflict, Firestore REST API returns HTTP 409 with status `ABORTED`.
   - The REST client implements an automated retry loop with exponential backoff and jitter (up to 3 retries, totaling ~150ms).
   - In our isolated prototype test suite, a simulated concurrent write conflict was successfully intercepted, retried, and committed on attempt 2 without data loss or balance corruption.

---

## 4. Firebase Authentication & Token Verification (Edge-Native)

Firebase ID Token verification was implemented using pure Web Crypto API (`crypto.subtle`) with zero Node dependencies:
- **Algorithm**: RS256 signature verification against Google Public JWKS (`securetoken@system.gserviceaccount.com`).
- **Claim Validations**:
  - `exp`: Token not expired.
  - `iat`: Token not issued in the future.
  - `aud`: Matches `bhuiya-property-manager`.
  - `iss`: Matches `https://securetoken.google.com/bhuiya-property-manager`.
  - `sub`: Valid non-empty user UID.
  - `auth_time`: Valid authentication timestamp.
- **Revocation Detection Limitation**: Offline RS256 JWT signature verification validates token integrity and expiration, but **cannot detect immediate server-side revocation (e.g. user password change or administrative disable)** without calling the Firebase Auth REST API (`accounts:lookup`). For this 5-member family app, standard 1-hour JWT expiration combined with instant workspace member deactivation checks in the database provides complete access control.

---

## 5. Service Account Credential Security

1. **Zero Secret Leakage**: Service account credentials (`client_email`, `private_key`) reside exclusively in server-side environment secrets in Cloudflare Pages. They are never bundled into the Vite client distribution or exposed in Git.
2. **RS256 OAuth2 Token Minting**: At the edge, the worker signs an RFC 7523 JWT assertion and requests a short-lived Google OAuth2 Access Token (scope `https://www.googleapis.com/auth/datastore`).
3. **Opportunistic Caching**: Tokens are cached in-memory across warm isolate requests with a 5-minute pre-expiration refresh buffer. If an isolate restarts, the cache is cleanly repopulated on the next request.

---

## 6. Family Workspace Authorization (RBAC)

The prototype implements a strict zero-trust authorization pipeline:
1. Extract and verify Firebase ID Token from `Authorization: Bearer <token>`.
2. Extract verified `callerUid`.
3. Authoritatively query `workspace_members` for the caller's membership record.
4. Verify `status === 'active'`. Deactivated or invited accounts are rejected with HTTP 403 `MEMBERSHIP_INACTIVE`.
5. Enforce workspace isolation: Reject requests if the client attempts to access data outside their assigned `workspaceId` (HTTP 403 `CROSS_WORKSPACE_DENIED`).
6. Evaluate granular permissions for the requested action:
   - `master_admin`: Full management rights across all 21 actions.
   - `family_manager`: Authorized for rent collection, expense logging, and tenant registration; rejected for reserve fund withdrawals and member management.
   - `family_viewer`: Authorized for read-only reports and personal distributions; strictly blocked from financial mutations.

---

## 7. Free-Tier Quota & Resource Feasibility

| Resource Dimension | Free Tier Ceiling | Estimated 5-Member Family Peak | Safety Margin |
|---|---|---|---|
| **Cloudflare Dynamic Requests** | 100,000 / day | ~300 to 500 requests / day | **> 99.5% Available** |
| **Cloudflare CPU Time** | 10 ms / request | 1.5 to 2.5 ms (Network I/O excluded) | **~75% Available** |
| **Cloudflare Memory** | 128 MB / isolate | ~25 MB working memory | **~80% Available** |
| **Cloudflare Subrequests** | 50 / request | 2 to 4 subrequests per transaction | **> 90% Available** |
| **Firestore Document Reads** | 50,000 / day | ~500 to 800 reads / day | **> 98% Available** |
| **Firestore Document Writes** | 20,000 / day | ~50 to 150 writes / day | **> 99% Available** |
| **Firestore Storage** | 1,024 MB (1 GB) | ~15 MB projected over 5 years | **> 98% Available** |
| **Firebase Auth MAU** | 50,000 users | 5 family users | **> 99.9% Available** |

---

## 8. Identified Risks & Mitigation Strategies

1. **Token Revocation Lag**: Offline JWT verification trusts tokens until their 1-hour expiration.
   - *Mitigation*: The worker validates the member's database record (`workspace_members`) on every privileged transaction. When the Master Admin clicks "Deactivate Member", all subsequent mutations are rejected immediately regardless of JWT validity.
2. **REST API Cold-Start Overhead**: First-time OAuth token exchange adds ~150ms network round-trip.
   - *Mitigation*: In-memory token caching maintains the token across warm invocations for 55 minutes, eliminating this overhead for consecutive operations.
3. **Firestore REST API Transaction Conflicts**: High concurrency on the same document can cause `ABORTED`.
   - *Mitigation*: Exponential backoff retry loop with random jitter (tested and verified). For a 5-member family property app, concurrent contention on the exact same unit or bill is exceptionally rare.

---

## 9. Compatibility Assessment Conclusion

Cloudflare Pages Functions + Firebase Spark is **fully compatible, highly performant, secure, and preserves 100% of the existing financial and relational business logic** without requiring Firebase Blaze billing.
