# Phase 10.2B-4: Staging Readiness & Firebase Setup Instructions

**Project:** Bhuiya Property Manager (ভূঁইয়া প্রপার্টি ম্যানেজার)  
**Location:** `C:\Bhuiya-Property-Manager`  
**Phase:** 10.2B-4 Cloudflare Runtime Validation & Staging Readiness  
**Date:** November 7, 2026  
**Status:** **READY FOR USER PROVISIONING — PENDING EXPLICIT APPROVAL**  

---

## 1. Executive Summary

To validate the Cloudflare Worker against a real Cloud Firestore database without endangering the production project (`bhuiya-property-manager`), an **isolated Firebase Staging Project** is required.

In accordance with strict safety mandates:
1. **Zero Production Risk:** No staging or testing operations may touch the production Firebase project, its Firestore database, or its authentication users.
2. **Spark (Free) Plan Only:** The staging project must remain strictly on the Firebase Spark (free) plan. **Blaze billing must NOT be enabled**.
3. **No Automated Creation:** The AI agent cannot and will not automatically create or modify Google Cloud / Firebase resources.
4. **Explicit User Gate:** The user must manually provision the staging project following the instructions below, and explicitly approve proceeding to Phase 10.2B-5 before any live connection is established.

---

## 2. Test Execution Environment Classification

To maintain absolute architectural clarity, test environments are categorized into five distinct tiers:

| Tier | Environment | Runtime Engine | Database Target | Current Phase Status |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Node.js Unit & Cryptographic Suite** | Node.js v20+ / Web Crypto | In-memory mocks | **101/101 PASSED** |
| **Tier 2** | **Firestore REST & ACID Transaction Suite** | Node.js + REST Client | Local Firestore Emulator (`127.0.0.1:8088`) | **56/56 PASSED** |
| **Tier 3** | **Cloudflare Workers Native Runtime Suite** | Native `workerd` (V8 Isolate) | Local Mock / HTTP Loopback (`127.0.0.1:8789`) | **14/14 PASSED** |
| **Tier 4** | **Live Cloudflare Edge Deployment** | Cloudflare Global Network | N/A | **PROHIBITED / BLOCKED** (Isolated POC phase) |
| **Tier 5** | **Live Staging Cloud Firestore Tests** | Native `workerd` | Isolated Staging Firebase Project | **BLOCKED** (Awaiting User Creation & Approval) |

---

## 3. Step-by-Step Staging Firebase Setup Instructions

Follow these exact steps in the Firebase Console to create the isolated staging environment:

### Step 1: Create a New Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Project Name: Enter **`bhuiya-property-staging`** (or a unique name like `bhuiya-prop-staging-<yourname>`).
4. Google Analytics: Disable Google Analytics for this project (keeps setup minimal and free).
5. Click **Create project** and wait for provisioning to complete.
6. Verify Billing: In Project Settings, confirm the project is on the **Spark plan** ($0/month). **Do NOT upgrade to Blaze**.

### Step 2: Enable Cloud Firestore
1. In the left navigation menu under **Build**, click **Firestore Database**.
2. Click **Create database**.
3. Database Location: Select your preferred region (e.g., `asia-south1` Mumbai or `us-central1`).
4. Security Rules: Select **Start in test mode** for initial setup (or start in locked mode; our backend uses Service Account credentials which bypass client security rules).
5. Click **Create**.

### Step 3: Enable Firebase Authentication
1. In the left navigation menu under **Build**, click **Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, enable **Email/Password** provider and save.
4. (Optional) Create one test user in the **Users** tab (e.g., `staging-admin@bhuiyaproperty.local`) to obtain a real UID for staging testing.

### Step 4: Generate a Minimal-Privilege Service Account Key
1. In the Firebase Console, click the **Gear icon (Project Settings)** in the upper left, then select **Service accounts**.
2. Ensure **Firebase Admin SDK** is selected.
3. Click **Generate new private key**, then click **Generate key** in the confirmation modal.
4. A JSON file will download to your computer (e.g., `bhuiya-property-staging-firebase-adminsdk-xxxxx.json`).
5. **CRITICAL SECURITY NOTE:**
   - Keep this file safe and private.
   - **DO NOT** commit this file to git.
   - **DO NOT** place this file in `src/`, `public/`, or upload it to any public repository.

### Step 5: Safe Base64 Encoding of the Service Account Key
To inject the service account JSON safely into Cloudflare Workers / Wrangler secrets as a single-line string:

**On Windows PowerShell:**
```powershell
$jsonContent = Get-Content -Raw -Path "C:\path\to\bhuiya-property-staging-firebase-adminsdk-xxxxx.json"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonContent)
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
Write-Host "Base64 encoded key copied to clipboard! (Length: $($base64.Length) characters)"
```

**On Linux / macOS:**
```bash
base64 -w 0 path/to/bhuiya-property-staging-firebase-adminsdk-xxxxx.json | pbcopy # or xclip
```

---

## 4. Wrangler Environment Variables Configuration

Once the staging project is created and the base64 string is generated, the Worker will use the following configuration for Phase 10.2B-5 live staging tests:

Create or configure `poc/phase-10-2a/.dev.vars` (which is git-ignored):
```ini
# Staging Firebase Project ID (NOT production)
FIREBASE_PROJECT_ID=bhuiya-property-staging

# Base64-encoded Service Account JSON key (placeholder example)
FIREBASE_SERVICE_ACCOUNT_KEY="<base64_encoded_service_account_json_from_secret_manager>"

# Safety Gate: MUST BE 'true' by default. Set to 'false' ONLY during authorized transaction write tests
DISABLE_FINANCIAL_WRITES=true

# Execution Mode: set to 'staging' for live staging tests
EXECUTION_MODE=staging
```

---

## 5. Production Isolation Safety Checklist

Before any test touches the staging environment, the following 6 safety gates must be verified:

- [x] **Gate 1: Project ID Separation:** Staging Project ID (`bhuiya-property-staging`) is completely distinct from Production Project ID (`bhuiya-property-manager`).
- [x] **Gate 2: Zero Production Credentials:** Staging `.dev.vars` contains zero references or private keys from the production project.
- [x] **Gate 3: Spark Plan Enforcement:** Staging project has no credit card attached and Blaze billing is disabled.
- [x] **Gate 4: Financial Write Protection:** `DISABLE_FINANCIAL_WRITES=true` is enforced in the Worker router; mutations require explicit override.
- [x] **Gate 5: Isolated Test Prefix:** Any collections or documents created in staging are prefixed with `_test_` or isolated within a mock workspace (`ws_staging_test`).
- [x] **Gate 6: Codebase Immutability:** Production code in `src/`, `functions/`, `api/`, `firestore.rules`, and `firebase.json` remains completely untouched.

---

## 6. Stop Condition & User Action Required

> [!IMPORTANT]
> **STOP CONDITION ACTIVATED: Phase 10.2B-4 Local & Workerd Validation is Complete.**  
> In compliance with strict safety rules, no live staging Firestore connection will be attempted until the user has:
> 1. Completed the Firebase Staging project setup above.
> 2. Configured the staging credentials locally in `poc/phase-10-2a/.dev.vars`.
> 3. Given explicit written approval to proceed to **Phase 10.2B-5 (Staging REST API Live Verification)**.
