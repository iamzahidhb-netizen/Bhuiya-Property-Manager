# Phase 10.2B-6: Local Staging Credentials Audit & Disambiguation Report

**Project:** Bhuiya Property Manager (ভূঁইয়া প্রপার্টি ম্যানেজার)  
**Location:** `C:\Bhuiya-Property-Manager`  
**Prototype Directory:** `poc\phase-10-2a\`  
**Date:** November 8, 2026  
**Status:** **AUDITED — MULTIPLE VALID STAGING KEYS FOUND (AWAITING USER SELECTION)**  

---

## 1. Executive Summary

In accordance with Phase 10.2B-6 directives, a local filesystem audit was conducted to locate and validate downloaded Firebase service-account JSON keys for the project `bhuiya-property-staging`.

**Key Finding:** Exactly **4 valid, structurally compliant service-account JSON files** for `bhuiya-property-staging` were identified in the user's Downloads directory (`C:\Users\Onty's zZz\Downloads\`).

In strict compliance with **Mandatory Rule 6**:
> *"If zero or multiple matching files are found, stop and report the issue without changing credentials."*

No modifications were made to `poc/phase-10-2a/.dev.vars`. The system has safely stopped and presents the 4 candidate keys below for user selection.

---

## 2. Current `.dev.vars` Status

The local configuration file ([`poc/phase-10-2a/.dev.vars`](file:///C:/Bhuiya-Property-Manager/poc/phase-10-2a/.dev.vars)) was inspected without exposing sensitive values:

| Setting | Value in `.dev.vars` | Status |
| :--- | :--- | :---: |
| **`FIREBASE_PROJECT_ID`** | `bhuiya-property-staging` | **PRESERVED** |
| **`EXECUTION_MODE`** | `staging` | **PRESERVED** |
| **`DISABLE_FINANCIAL_WRITES`** | `true` | **PRESERVED** |
| **`FIREBASE_SERVICE_ACCOUNT_KEY`** | Template string (Length: 40 chars, incomplete JSON prefix) | **UNCHANGED** |

---

## 3. Discovered Service Account Candidate Keys

All 4 files located in `C:\Users\Onty's zZz\Downloads\` were parsed and structurally validated in memory:
- **`type`:** `service_account` (Verified in all 4)
- **`project_id`:** `bhuiya-property-staging` (Verified in all 4)
- **`client_email`:** Present with domain `@bhuiya-property-staging.iam.gserviceaccount.com` (Verified in all 4)
- **`private_key`:** Valid PKCS#8 RSA private key structure (Verified in all 4)

| Candidate | Filename | Download Timestamp | Key ID Fingerprint |
| :---: | :--- | :--- | :--- |
| **1 (Newest)** | `bhuiya-property-staging-7848f253737b.json` | November 8, 2026 at 12:49:34 AM | `7848f253...` |
| **2** | `bhuiya-property-staging-firebase-adminsdk-fbsvc-9e88fa41b8.json` | November 8, 2026 at 12:06:48 AM | `9e88fa41...` |
| **3** | `bhuiya-property-staging-firebase-adminsdk-fbsvc-8511fef72e.json` | November 8, 2026 at 12:00:39 AM | `8511fef7...` |
| **4 (Oldest)** | `bhuiya-property-staging-firebase-adminsdk-fbsvc-b5c4623c60.json` | November 7, 2026 at 10:57:30 PM | `b5c4623c...` |

---

## 4. Security & Immutability Adherence

1. **Zero Secret Exposure:**
   - Private key PEM bodies were neither printed, displayed, logged, nor written to reports.
   - Client email user prefixes and Base64 encoded blocks were strictly redacted.
2. **Zero Modification to `.dev.vars`:**
   - Because multiple matching keys exist, the file was preserved in its existing state to prevent accidentally using an inactive or superseded key.
3. **Zero Database / Network Operations:**
   - No Firestore writes, updates, or deletes were performed.
   - No deployments to Cloudflare or Firebase were executed.

---

## 5. Conclusion & Action Required

Local credentials are **not yet ready for live read-only connectivity testing** solely because multiple valid keys exist and disambiguation is required.

Once you select which key is the active service account key for your staging project, `poc/phase-10-2a/.dev.vars` will be updated with its Base64 encoding to proceed immediately with read-only connectivity testing.
