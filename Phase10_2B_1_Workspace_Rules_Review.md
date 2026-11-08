# Phase 10.2B-1: Firestore Workspace Security Rules Review
**Project Name**: ভূঁইয়া প্রপার্টি ম্যানেজার (Bhuiya Property Manager)  
**Location**: `C:\Bhuiya-Property-Manager`  
**Candidate Rules File**: `poc\phase-10-2a\firestore.workspace-candidate.rules`  
**Production Rules File**: `firestore.rules` (Unchanged)  
**Review Date**: 2026-11-07  

---

## 1. Architectural Motivation & Problem Statement

The production `firestore.rules` file enforces strict single-user isolation:
```javascript
function isDocOwner() {
  return isAuthenticated() &&
         resource != null &&
         ('ownerUid' in resource.data) &&
         resource.data.ownerUid == request.auth.uid;
}
```
Under this model, only the individual user who created a property or recorded a rent payment can read that document. When the other 4 family members (e.g. Brother 2, Brother 3, Mother, Sister) log in with their own Firebase Authentication accounts, Firestore rejects their read requests with `PERMISSION_DENIED`.

To enable a shared family estate workspace while preserving strict multi-tenant isolation from outside users, `firestore.workspace-candidate.rules` was designed and placed in `poc\phase-10-2a\`.

---

## 2. Rule Architecture & Helper Functions

```mermaid
flowchart TD
    Req[Incoming Client Read Request] --> AuthCheck{isAuthenticated?}
    AuthCheck -- No --> Deny[PERMISSION_DENIED]
    AuthCheck -- Yes --> DualCheck{isAuthorizedReader?}
    DualCheck -- Legacy Doc --> OwnerCheck{resource.ownerUid == auth.uid?}
    DualCheck -- Modern Doc --> MemberCheck{exists /workspace_members/{ws_uid}<br/>and status == 'active'?}
    OwnerCheck -- Match --> Allow[ALLOW READ]
    OwnerCheck -- Mismatch --> Deny
    MemberCheck -- Active Member --> Allow
    MemberCheck -- Inactive / Not Found --> Deny
```

### Key Security Helpers in Candidate Rules:
1. **`isWorkspaceMember(workspaceId)`**:
   ```javascript
   function isWorkspaceMember(workspaceId) {
     let memberDocPath = /databases/$(database)/documents/workspace_members/$(workspaceId + '_' + request.auth.uid);
     return isAuthenticated() &&
            exists(memberDocPath) &&
            get(memberDocPath).data.status == 'active';
   }
   ```
   Authoritatively checks that a membership document exists and its `status` is `'active'`. Deactivated or invited members are denied immediately.
2. **`isMasterAdmin(workspaceId)`**:
   ```javascript
   function isMasterAdmin(workspaceId) {
     let memberDocPath = /databases/$(database)/documents/workspace_members/$(workspaceId + '_' + request.auth.uid);
     return isWorkspaceMember(workspaceId) &&
            get(memberDocPath).data.role == 'master_admin';
   }
   ```
   Grants administrative read privileges (such as reading all member profiles).
3. **`isAuthorizedReader()` (Dual-Compatibility)**:
   ```javascript
   function isAuthorizedReader() {
     return isAuthenticated() &&
            resource != null &&
            (('workspaceId' in resource.data && isWorkspaceMember(resource.data.workspaceId)) ||
             ('ownerUid' in resource.data && resource.data.ownerUid == request.auth.uid));
   }
   ```
   Provides seamless backwards-compatibility: allows reads if the caller is an active workspace member OR if they are the legacy document owner.

---

## 3. Collection-by-Collection Security Matrix

| Collection | Client Read Permission | Client Create / Update / Delete | Reason & Enforcement Boundary |
|---|---|---|---|
| `/workspaces/{workspaceId}` | `isWorkspaceMember(workspaceId)` | `allow write: if false;` | Workspace settings managed via trusted server backend only. |
| `/workspace_members/{memberId}` | Self or Master Admin | `allow write: if false;` | Direct member self-promotion or status tampering blocked. |
| `/properties/{propertyId}` | `isAuthorizedReader()` | `allow write: if false;` | Property lifecycle managed via server function. |
| `/units/{unitId}` | `isAuthorizedReader()` | `allow write: if false;` | Unit number uniqueness managed by server transaction. |
| `/tenants/{tenantId}` | `isAuthorizedReader()` | `allow write: if false;` | Leases and vacancies managed atomically by server. |
| `/security_deposits/{depositId}` | `isAuthorizedReader()` | `allow write: if false;` | Balance-sheet liabilities managed by server. |
| `/rent_bills/{billId}` | `isAuthorizedReader()` | `allow write: if false;` | Invoices and balances managed by server. |
| `/rent_payments/{paymentId}` | `isAuthorizedReader()` | `allow write: if false;` | Receipts and reconciliation managed by server. |
| `/expenses/{expenseId}` | `isAuthorizedReader()` | `allow write: if false;` | Operating expenses and audit trails managed by server. |
| `/beneficiaries/{beneficiaryId}` | `isAuthorizedReader()` | `allow write: if false;` | Family shares managed by server. |
| `/family_distributions/{distId}`| `isAuthorizedReader()` | `allow write: if false;` | Monthly snapshots and payouts managed by server. |
| `/reserve_funds/{fundId}` | `isAuthorizedReader()` | `allow write: if false;` | Balance management managed by server. |
| `/reserve_ledger/{entryId}` | `isAuthorizedReader()` | `allow write: if false;` | Append-only ledger; client writes strictly blocked. |

---

## 4. Crucial Architectural Distinction: Client Rules vs. Server IAM

> [!IMPORTANT]
> **Cloudflare Pages Functions bypass client Firestore Security Rules.**
> 
> Cloudflare Pages Functions authenticate to the Cloud Firestore REST API using a Google Cloud Service Account with IAM `roles/datastore.user` credentials. Service accounts bypass `firestore.rules`.
> 
> Therefore:
> 1. `firestore.rules` protects **direct client-side reads** executed by the browser via the Firebase Web Client SDK.
> 2. `workspaceAuth.mjs` enforces **server-side authorization and RBAC** on all mutations (`/api/callable/*`).
> 
> Both layers are strictly aligned: neither layer permits unauthorized users or deactivated members to access workspace data.

---

## 5. Deployment Recommendation

1. Root `firestore.rules` was **preserved without changes** during Phase 10.2B-1.
2. In Phase 10.2B-2, when database schemas are prepared, `poc\phase-10-2a\firestore.workspace-candidate.rules` should be verified against the Firebase Emulator before being promoted to `firestore.rules`.
