# Phase 10.2A: Architectural Recommendation & Decision Record
**Project Name**: ভূঁইয়া প্রপার্টি ম্যানেজার (Bhuiya Property Manager)  
**Location**: `C:\Bhuiya-Property-Manager\poc\phase-10-2a`  
**Decision Type**: Architectural Migration Gate Assessment  
**Evaluation Date**: 2026-11-07  

---

## 1. Final Architectural Recommendation

### Verdict: **CONDITIONAL GO**

The proposed migration to **Cloudflare Pages (Advanced Mode `_worker.js`) + Cloudflare Pages Functions + Firebase Authentication + Cloud Firestore Spark Plan** is **technically viable, financially free, and structurally sound**.

The architecture preserves all 12 mandatory financial accounting invariants, enforces zero-trust multi-user workspace isolation, and operates well within the free-tier quotas of both Cloudflare and Firebase without requiring Firebase Blaze billing.

However, because this investigation was executed in an isolated prototype environment, a **CONDITIONAL GO** is issued subject to satisfying four explicit prerequisites before production cutover.

---

## 2. Evidence Supporting Feasibility

```mermaid
graph TD
    subgraph "Verified Capabilities (38/38 Tests Passed)"
        E1["Cloudflare Advanced Mode (_worker.js)<br/>Preserves root functions/ directory"]
        E2["Edge Web Crypto RS256<br/>0.24ms JWT Verification"]
        E3["Firestore REST Protocol v1<br/>ACID Transactions & Automated Conflict Retry"]
        E4["Zero-Trust Workspace RBAC<br/>Multi-User Access for 5 Family Members"]
        E5["12 Financial Invariants<br/>Double-Entry, Liability Segregation, Audit Trails"]
        E6["Permanent Zero Cost<br/>Runs on Spark & Cloudflare Free Tiers"]
    end
```

### 1. Root Directory Conflict Safely Resolved:
- **Challenge**: The project contains a root `functions/` directory used by Firebase Cloud Functions.
- **Resolution**: Adopting Cloudflare Pages **Advanced Mode (`_worker.js`)** outputs the worker bundle into `dist/_worker.js`. Cloudflare Pages completely ignores any root `functions/` directory when `_worker.js` is present in the output folder.
- **Evidence**: Verified in router prototype test (Suite 3) and confirmed via official Cloudflare Pages technical documentation.

### 2. Elimination of Firebase Blaze Plan:
- **Challenge**: Firebase Cloud Functions require a paid Blaze billing account.
- **Resolution**: Moving all 21 backend mutation actions to Cloudflare Pages Functions calling the **Cloud Firestore REST API v1** completely eliminates the need for Firebase Cloud Functions.
- **Evidence**: Firestore REST API and Firebase Authentication are free on the Firebase Spark tier. Prototyped and verified in Suite 4.

### 3. Edge Performance & Free-Tier Quota Headroom:
- **Challenge**: Cloudflare Free tier limits scripts to 10 ms CPU time per request.
- **Resolution**: Using standard Web Crypto API (`crypto.subtle`) for RS256 token verification and opportunistic in-memory OAuth2 token caching keeps active CPU execution between **1.5 ms and 2.5 ms** (network wait time for external `fetch` does not count toward CPU limits).
- **Evidence**: Benchmarked across 100 iterations (Suite 7) with 0.243 ms JWT verification and 1.427 ms OAuth assertion signing.

### 4. Multi-User Family Workspace Isolation:
- **Challenge**: Existing single-user `ownerUid` rules lock out the other 4 family members.
- **Resolution**: Backend RBAC validates workspace membership and enforces role permissions (`master_admin`, `family_manager`, `family_viewer`), preventing cross-workspace data access and privilege escalation.
- **Evidence**: Verified across 7 security scenarios in Suite 5.

### 5. Financial Accounting Integrity:
- **Challenge**: Preventing duplicate rent payments, balance corruption, and revenue misclassification without the Firebase Admin SDK.
- **Resolution**: ACID multi-document transactions using Firestore REST `:beginTransaction` and `:commit` with automated exponential backoff on HTTP 409 `ABORTED`.
- **Evidence**: Verified across all 12 financial integrity rules in Suite 6.

---

## 3. Explicit Conditions for Phase 10.2B Implementation

To transition from **CONDITIONAL GO** to **FULL GO**, the following conditions must be fulfilled in Phase 10.2B:

### Condition 1: Git Repository & GitHub Remote Setup
- **Requirement**: Cloudflare Pages builds require source code hosted in a remote Git repository (GitHub).
- **Action**: Initialize local `.git` repository and link to an approved private GitHub repository. (Requires explicit user confirmation).

### Condition 2: Cloudflare Build Configuration (`wrangler.jsonc` or Pages Build Command)
- **Requirement**: Build pipeline must bundle the edge worker into `dist/_worker.js` alongside the Vite client build (`dist/index.html`, `dist/assets/`).
- **Action**: Add an automated build step (e.g. `vite build && esbuild src/worker/index.ts --bundle --outfile=dist/_worker.js --format=esm --target=es2022`).

### Condition 3: Secure Service Account Credentials in Cloudflare Secrets
- **Requirement**: The service account credentials must be provisioned exclusively as encrypted environment variables in Cloudflare Pages dashboard (`FIREBASE_SERVICE_ACCOUNT_KEY`).
- **Action**: Verify that no private keys or secrets are stored in client `.env` files or committed to Git.

### Condition 4: Firestore Rules Workspace Update
- **Requirement**: Existing `firestore.rules` must be updated to authorize reads based on `isWorkspaceMember(resource.data.workspaceId)`.
- **Action**: Test updated rules in Firebase Emulator before modifying production security rules.

---

## 4. Phase Decision Summary

| Recommendation Level | Assessment | Action Item |
|---|---|---|
| **CONDITIONAL GO** | Architecture is validated; all 38 prototype tests passed; zero Blaze required; safe root directory resolution confirmed. | **AWAIT USER APPROVAL to proceed to Phase 10.2B (Implementation & Build Pipeline Setup).** |
