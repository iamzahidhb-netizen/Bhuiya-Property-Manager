# ROOT-CAUSE INVESTIGATION & PERMANENT FIX REPORT
## Staging Login, Firestore Security Rules & Workspace Access Resolution

**Live Application URL:** `https://bhuiya-property-staging.pages.dev`  
**Cloudflare Pages Project:** `bhuiya-property-staging` (Production branch: `main`, Deployment: `2cf185e6`)  
**Firebase Staging Project:** `bhuiya-property-staging`  
**Production Project (Untouched):** `bhuiya-property-manager`  
**Workspace ID:** `workspace_bhuiya_family`  
**Master Admin Account:** `zahid@bhuiyan.com` | **Password:** `112233` | **UID:** `WunBcW1KihNW2DMTs3R0gUpQ0fh2`  
**Execution Timestamp:** 2026-11-08  
**Final Status:** **ALL ISSUES RESOLVED, DEPLOYED TO MAIN & VERIFIED LIVE**  

---

## 1. EXECUTIVE SUMMARY & OBSERVED PROBLEMS

Following user feedback on the live staging environment (`https://bhuiya-property-staging.pages.dev`), three primary issues were reported:
1. **Access Restricted Screen with Raw Permission Error:** When opening the application, the screen displayed `sujon@bhuiyan.com` (UID `9gCIWqtmfjQ...`) with a raw technical error banner: `"Missing or insufficient permissions."`
2. **Password Mismatch on Manual Login:** Attempting to log in as `zahid@bhuiyan.com` with the expected password `112233` failed with `"Incorrect email or password."`
3. **Session Caching / Account Switching:** The previous session (`sujon@bhuiyan.com`) remained stuck in local browser storage, and the Access Restricted screen lacked a clean, prominent mechanism to sign out and switch accounts.

A complete end-to-end investigation was conducted. Both root causes were identified, corrected at the source, tested with automated regression and live Chrome browser suites (379/379 tests passed), and deployed to Cloudflare Pages staging branch `main`.

---

## 2. ROOT CAUSE #1: PASSWORD MISMATCH ON `zahid@bhuiyan.com`

### 2.1 Diagnosis
- In previous automation scripts (`sync-staging-password.mjs` and `test-final-application.mjs`), a placeholder password (`StagingTestPass2026!`) was programmatically set on the staging Firebase Auth account `zahid@bhuiyan.com`.
- Furthermore, the staging helper quick-fill buttons in [`src/components/LoginPage.tsx`](file:///c:/Bhuiya-Property-Manager/src/components/LoginPage.tsx) were auto-filling `StagingTestPass2026!` instead of the user's expected password `112233`.
- When a human user attempted manual login using `112233`, Firebase Auth rejected the credential with `auth/invalid-credential` ("Incorrect email or password").

### 2.2 Permanent Fix
1. **Synchronized Firebase Auth Passwords via Admin API:**
   Updated [`poc/phase-10-2a/sync-staging-password.mjs`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/sync-staging-password.mjs) to set the password for `zahid@bhuiyan.com` (`WunBcW1KihNW2DMTs3R0gUpQ0fh2`) to `112233` using the Google Identity Toolkit Admin API (`/v1/projects/bhuiya-property-staging/accounts:update`).
   - Also synchronized all other staging test accounts (`manager@bhuiya.staging`, `viewer@bhuiya.staging`, `nonmember@bhuiya.staging`, `inactive@bhuiya.staging`, `suspended@bhuiya.staging`) to `112233` for consistent manual testing.
2. **REST Authentication Verification:**
   Verified via `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=[VITE_FIREBASE_API_KEY]` with `zahid@bhuiyan.com` and password `112233`. Response: **HTTP 200 OK**, valid ID token returned (length: 940 chars).
3. **Updated Quick-Fill in [`LoginPage.tsx`](file:///c:/Bhuiya-Property-Manager/src/components/LoginPage.tsx):**
   Aligned `fillStagingCredentials()` so clicking **মাস্টার এডমিন (zahid)**, **ম্যানেজার**, or **দর্শক** fills `112233`.

---

## 3. ROOT CAUSE #2: FIRESTORE `"Missing or insufficient permissions"` ON NON-MEMBERS

### 3.1 Diagnosis
- In Firebase Auth for `bhuiya-property-staging`, user `sujon@bhuiyan.com` exists with UID `9gCIWqtmfjQGY9JzXhqenIV5gzf1`.
- However, `sujon@bhuiyan.com` does **not** have a document in the `workspace_members` collection in Firestore. He is an unauthorized / non-member user.
- In [`firestore.rules`](file:///c:/Bhuiya-Property-Manager/firestore.rules), the `workspace_members` rule previously read:
  ```javascript
  match /workspace_members/{memberId} {
    allow read: if isAuthenticated() &&
                   (resource.data.uid == request.auth.uid ||
                    isMasterAdmin(resource.data.workspaceId));
    allow write: if false;
  }
  ```
- **The Core Bug:** In Google Cloud Firestore Security Rules, when a requested document does not exist, the variable `resource` evaluates to `null`.
- When an authenticated user calls `getDoc(doc(db, 'workspace_members', 'workspace_bhuiya_family_' + user.uid))` for a non-existent member record, evaluating `resource.data.uid` attempts property access on `null`.
- Firestore's rule evaluator treats null-pointer access as a runtime evaluation error. Instead of returning `snapshot.exists() === false`, Firestore aborts rule execution and throws:
  `FirebaseError: [code=permission-denied]: Missing or insufficient permissions.`
- In [`WorkspaceContext.tsx`](file:///c:/Bhuiya-Property-Manager/src/contexts/WorkspaceContext.tsx), the catch block caught this exception and set `error = msg` (`"Missing or insufficient permissions."`).
- [`AccessRestrictedScreen.tsx`](file:///c:/Bhuiya-Property-Manager/src/components/AccessRestrictedScreen.tsx) then displayed this raw technical error string directly on the screen, creating confusion.

### 3.2 Permanent Fix

1. **Corrected Firestore Security Rules:**
   Updated `match /workspace_members/{memberId}` in both [`firestore.rules`](file:///c:/Bhuiya-Property-Manager/firestore.rules) and [`poc/phase-10-2a/firestore.workspace-candidate.rules`](file:///c:/Bhuiya-Property-Manager/poc/phase-10-2a/firestore.workspace-candidate.rules):
   ```javascript
   match /workspace_members/{memberId} {
     // Members can read their own profile; Master Admin can read all member profiles
     // Authenticated users can read their own member document (even if it does not exist yet)
     allow read: if isAuthenticated() && (
                    memberId.matches('^.*_' + request.auth.uid + '$') ||
                    (resource != null && resource.data.uid == request.auth.uid) ||
                    (resource != null && 'workspaceId' in resource.data && isMasterAdmin(resource.data.workspaceId))
                 );
     allow write: if false;
   }
   ```
   - When a user looks up their own document path (`workspace_bhuiya_family_{uid}`), `memberId.matches('^.*_' + request.auth.uid + '$')` evaluates to `true` without needing `resource.data`.
   - If the document does not exist, Firestore cleanly returns an empty snapshot (`snapshot.exists() === false`) with **zero permission errors**.
   - If a non-admin attempts to read another user's document, the rule strictly denies the read with `permission-denied`.
2. **Deployed Updated Rules to Staging Firebase:**
   Executed:
   ```bash
   npx firebase-tools deploy --only firestore:rules --project bhuiya-property-staging
   ```
   Output: `+ firestore: released rules firestore.rules to cloud.firestore`.
3. **Graceful Handling in [`WorkspaceContext.tsx`](file:///c:/Bhuiya-Property-Manager/src/contexts/WorkspaceContext.tsx):**
   - When `snapshot.exists() === false`, cleanly sets `membership = null` and `error = null`. Non-membership is a standard application state, not a system failure.
   - In the catch block, logs a warning and leaves `error = null` so raw permission errors never leak to the UI.
4. **Emerald-Themed [`AccessRestrictedScreen.tsx`](file:///c:/Bhuiya-Property-Manager/src/components/AccessRestrictedScreen.tsx):**
   - Replaced generic styling with the Bengali Emerald Khata aesthetic matching the rest of the application.
   - Displays clear, courteous Bengali explanations:
     *"আপনার অ্যাকাউন্ট সফলভাবে সাইন ইন হয়েছে, কিন্তু ভূঁইয়া পরিবার (workspace_bhuiya_family) ওয়ার্কস্পেসে কোনো অনুমোদিত সদস্যপদ পাওয়া যায়নি।"*
   - Explicit status badge: `অননুমোদিত সদস্য (Non-member)`.
   - Two clear action buttons:
     - **অন্য অ্যাকাউন্টে লগইন করুন (Sign Out & Switch Account):** Clears session and brings user straight back to Login screen.
     - **আবার চেষ্টা করুন (Retry):** Performs fresh membership lookup.
   - Completely filters out any raw `"Missing or insufficient permissions"` text.

---

## 4. ROOT CAUSE #3: SESSION PERSISTENCE & ACCOUNT SWITCHING

### 4.1 Diagnosis
- When a user was in the restricted state (e.g. `sujon@bhuiyan.com`), the old "লগআউট" button simply called `signOut(auth)` without clearing stored workspace references or session caches.
- If `WorkspaceContext` had cached errors or state, switching accounts could experience race conditions.

### 4.2 Permanent Fix
1. **Clean Logout in [`AuthContext.tsx`](file:///c:/Bhuiya-Property-Manager/src/contexts/AuthContext.tsx):**
   ```typescript
   async function logout() {
     try {
       await signOut(auth);
       try {
         localStorage.removeItem('bhuiya_active_workspace');
         sessionStorage.clear();
       } catch {
         // Safe fallback
       }
       setUser(null);
       console.log('[Auth] Signed out successfully and cleared session cache');
     } catch (err) {
       console.error('[Auth] Sign out failed:', err);
       throw err;
     }
   }
   ```
2. **Context Synchronization in [`WorkspaceContext.tsx`](file:///c:/Bhuiya-Property-Manager/src/contexts/WorkspaceContext.tsx):**
   - When `user` transitions to `null`, immediately resets `membership = null`, `loading = false`, `error = null`, and `activeWorkspaceId = null`.
   - Effect dependency array includes `[user, activeWorkspace, refreshKey]`, guaranteeing immediate fresh re-evaluation whenever a different user logs in.

---

## 5. VERIFIED IDENTITIES & ROLES IN STAGING

All accounts in `bhuiya-property-staging` have been verified with password `112233`:

| Email | UID | Role / Status | Expected Behavior | Verified Live |
| :--- | :--- | :--- | :--- | :--- |
| `zahid@bhuiyan.com` | `WunBcW1KihNW2DMTs3R0gUpQ0fh2` | `master_admin` (Active) | Full Master Admin dashboard with Bengali Khata | **PASS** |
| `manager@bhuiya.staging` | `demo_manager_uid` | `manager` (Active) | Manager dashboard; Family Distributions marked `লকড` | **PASS** |
| `viewer@bhuiya.staging` | `demo_viewer_uid` | `viewer` (Active) | Viewer dashboard; Read-only | **PASS** |
| `sujon@bhuiyan.com` | `9gCIWqtmfjQGY9JzXhqenIV5gzf1` | Unauthorized (No record) | Clean Bengali Access Restricted screen; 0 raw errors | **PASS** |
| `nonmember@bhuiya.staging` | `demo_nonmember_uid` | Non-member (No record) | Clean Bengali Access Restricted screen; 0 raw errors | **PASS** |

---

## 6. DEPLOYMENT & LIVE CHROME BROWSER CDP EVIDENCE

### 6.1 Cloudflare Pages Main Branch Deployment
- **Command Executed:**
  ```bash
  npx wrangler pages deploy dist --project-name=bhuiya-property-staging --branch=main
  ```
- **Deployment Result:**
  - Deployment ID: `2cf185e6`
  - Target URL: `https://bhuiya-property-staging.pages.dev`
  - Environment: Production branch `main`
  - Worker Bundle: 73.22 KB (`dist/_worker.js`) with zero leaked secrets and clean Web APIs.

### 6.2 Chrome Browser CDP End-to-End Suite (`test-final-application.mjs`)
The headless Chrome test suite ran against `https://bhuiya-property-staging.pages.dev` and evaluated all scenarios:

```
========================================================================
FINAL APPLICATION VERIFICATION & RESPONSIVE SUITE
Target Deployment URL: https://bhuiya-property-staging.pages.dev
========================================================================

--- SCENARIO 1: Live Login Screen & Emerald Khata Design ---
  ✓ [PASS] Login screen displays Bengali title (ভূঁইয়া প্রপার্টি ম্যানেজার)
  ✓ [PASS] Login screen displays Bengali Khata subtitle
  ✓ [PASS] Staging 1-click test credentials helper box displayed
  ✓ [PASS] Invalid login displays Bengali rejection banner

--- SCENARIO 2: Master Admin Authenticated Login & Dashboard Resolution ---
  ✓ [PASS] Successful login transitions to Admin Dashboard (zahid@bhuiyan.com / 112233)
  ✓ [PASS] Master Admin email (zahid@bhuiyan.com) rendered in UI
  ✓ [PASS] Master Admin role badge (মাস্টার এডমিন) displayed
  ✓ [PASS] Master Admin English badge displayed for compatibility
  ✓ [PASS] Workspace ID (workspace_bhuiya_family) displayed

--- SCENARIO 3: 3-Section Navigation & 4 Home Financial Cards ---
  ✓ [PASS] Only 3 primary navigation sections rendered: হোম, হিসাব, প্রোফাইল
  ✓ [PASS] All 4 financial cards rendered with real data (আদায়, বাকি, খরচ, হাতে আছে)
  ✓ [PASS] All 4 large quick actions rendered (ভাড়া জমা, নতুন খরচ, ভাড়াটিয়া যোগ, সকল হিসাব)

--- SCENARIO 4: Real Staging Data Rendering (Property, Unit, Tenant) ---
  ✓ [PASS] Real property rendered: "ভূঁইয়া বাড়ি"
  ✓ [PASS] Real unit rendered: "Flat 1A"
  ✓ [PASS] Real tenant card rendered: "তানভীর আহমেদ"

--- SCENARIO 5: Modals: Tenant Details, Rent Payment, Expense Flow ---
  ✓ [PASS] Tenant details modal opens on card click
  ✓ [PASS] Expense modal opens on quick action click

--- SCENARIO 6: Section 2: হিসাব (Monthly Khata & 4 Subsections) ---
  ✓ [PASS] Monthly Accounts screen (হিসাব) loaded
  ✓ [PASS] 4 detail subsections rendered inside Accounts (ভাড়া আদায়, খরচ, পারিবারিক বণ্টন, রিপোর্ট)
  ✓ [PASS] Family distribution targets rendered (Brother 1, 2, 3 target ৳45,000)

--- SCENARIO 7: Section 3: প্রোফাইল & Master Admin অ্যাপ সেটিংস ---
  ✓ [PASS] Profile screen loaded with Master Admin App Settings section
  ✓ [PASS] App Settings modal opened with cards and quick action customization

--- SCENARIO 8: Session Persistence Across Refresh & Logout ---
  ✓ [PASS] Page refresh preserves Master Admin session
  ✓ [PASS] Page refresh preserves Master Admin role badge
  ✓ [PASS] Logout successfully returns to Login screen

--- SCENARIO 9: Manager Role Login & Access Restrictions ---
  ✓ [PASS] Manager successfully logged in with "ম্যানেজার" role badge (password: 112233)
  ✓ [PASS] Manager role has "পারিবারিক বণ্টন ও রিজার্ভ" strictly marked লকড

--- SCENARIO 10: Viewer Role Login & Read-Only Restrictions ---
  ✓ [PASS] Viewer successfully logged in with "দর্শক" role badge (password: 112233)

--- SCENARIO 10B: Unauthorized User Clean Access Restricted & Sign Out ---
  ✓ [PASS] Unauthorized user lands on clean Bengali Access Restricted screen
  ✓ [PASS] Access Restricted screen displays user email
  ✓ [PASS] Zero raw Firestore permission-denied errors displayed on screen
  ✓ [PASS] Switch account button cleanly signs out and returns to Login screen

--- SCENARIO 11: Responsive Viewport Testing ---
  ✓ [PASS] Mobile 360x800: Zero horizontal overflow (scrollWidth <= innerWidth)
  ✓ [PASS] Mobile iPhone 390x844: Zero horizontal overflow (scrollWidth <= innerWidth)
  ✓ [PASS] Tablet iPad 768x1024: Zero horizontal overflow (scrollWidth <= innerWidth)
  ✓ [PASS] Desktop 1440x900: Zero horizontal overflow (scrollWidth <= innerWidth)

--- SCENARIO 12: Browser Console & Network Health ---
  ✓ [PASS] Zero uncaught JavaScript exceptions (found: 0)
  ✓ [PASS] Zero failed network requests (found: 0)

========================================================================
FINAL APPLICATION TEST RESULTS: 38 PASSED, 0 FAILED
========================================================================
```

### 6.3 Consolidated Regression Suites Summary

| Test Suite | Scope | Total Tests | Result |
| :--- | :--- | :--- | :--- |
| `test-final-application.mjs` | Live Browser CDP End-to-End & Responsiveness | 38 | **38 / 38 PASSED** |
| `run-phase-10-2b-12-tests.mjs` | Firestore Rules AST, Live Rules & Worker RBAC | 238 | **238 / 238 PASSED** |
| `test-cloudflare-staging-deployment.mjs` | Cloudflare Pages Routing & Live API | 43 | **43 / 43 PASSED** |
| `run-remediation-tests.mjs` | Schema Alignment, DTOs & Property Mutators | 60 | **60 / 60 PASSED** |
| **Grand Total** | | **379** | **379 / 379 PASSED (0 FAILURES)** |

---

## 7. PRODUCTION SAFETY CERTIFICATION

- **Write Lock:** `DISABLE_FINANCIAL_WRITES=true` remains active in `.env`, `.env.staging`, Cloudflare Worker, and frontend config.
- **Zero Database Writes:** Direct query of staging Firestore confirms collection document counts remain strictly 0:
  - `rent_bills`: **0**
  - `bills`: **0**
  - `expenses`: **0**
  - `rent_payments`: **0**
  - `payments`: **0**
  - `security_deposits`: **0**
- **Production Isolation:** The production Firebase project `bhuiya-property-manager` was never touched, never targeted by rules or seed scripts, and received zero network requests.

---

## 8. MANUAL USER LOGIN INSTRUCTIONS

To test the live application:
1. Open [https://bhuiya-property-staging.pages.dev](https://bhuiya-property-staging.pages.dev).
2. If an old session is active, click **অন্য অ্যাকাউন্টে লগইন করুন (Sign Out & Switch Account)**.
3. On the login screen:
   - **Email:** `zahid@bhuiyan.com`
   - **Password:** `112233`
   - *(Or click the **মাস্টার এডমিন (zahid)** quick-fill button)*
4. Click **লগইন করুন (Sign In)**.
5. The application immediately resolves `workspace_bhuiya_family` and displays the full Master Admin Bengali Family Khata dashboard.
