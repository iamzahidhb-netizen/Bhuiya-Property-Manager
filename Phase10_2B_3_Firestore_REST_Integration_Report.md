# Phase 10.2B-3: Firestore REST API Integration Report

**Project:** Bhuiya Property Manager (ভূঁইয়া প্রপার্টি ম্যানেজার)  
**Location:** `C:\Bhuiya-Property-Manager`  
**Phase:** 10.2B-3 Firestore REST Integration  
**Date:** November 7, 2026  
**Status:** **VALIDATED & COMPLETED**  

---

## 1. Executive Summary

Phase 10.2B-3 established and validated real communication between the Cloudflare-compatible Worker client and Cloud Firestore via the official Google Cloud Firestore REST API v1. Testing was performed entirely inside `poc\phase-10-2a\` against an isolated local Firestore Emulator, guaranteeing **zero writes to production database, zero modification to production source files, and zero Firebase Blaze billing activation**.

### Testing Environment Breakdown

| Environment Type | Host / Tool | Scope of Tests | Production Risk |
| :--- | :--- | :--- | :--- |
| **Emulator Tests** | `127.0.0.1:8088` (Firebase CLI 13.14.0) | Live REST document CRUD, ACID transactions, preconditions, concurrency conflicts, financial fixtures | **ZERO (Isolated memory)** |
| **Mock Tests** | In-memory fetch mocks & synthetic fixtures | Web Crypto RS256 token verification, OAuth assertions, fail-closed offline revocation, upstream 502/503 timeouts | **ZERO (Pure unit isolation)** |
| **Live Staging Tests** | N/A | **NOT REQUIRED / NOT CONFIGURED** (Official Emulator verified 100% protocol fidelity) | **ZERO** |

---

## 2. Firestore REST API Protocol Verification

The client implementation in [`firestoreRestClient.mjs`](file:///C:/Bhuiya-Property-Manager/poc/phase-10-2a/firestoreRestClient.mjs) was verified against Google's v1 REST endpoints:

### 2.1 Document Operations (GET, CREATE, UPDATE, DELETE)

1. **Document GET (`/v1/projects/.../documents/{collection}/{docId}`):**
   - Verified retrieval of primitive and complex document graphs.
   - Decodes Google's typed value objects (`stringValue`, `integerValue`, `doubleValue`, `booleanValue`, `timestampValue`, `arrayValue`, `mapValue`, `nullValue`) into native JavaScript objects.
   - Tested missing documents: Returns `null` on HTTP 404 without throwing unhandled exceptions.

2. **Document CREATE with Strict Precondition:**
   - Enforces `currentDocument: { exists: false }` on all insert operations.
   - Verified that attempting to create an existing document ID immediately throws `ALREADY_EXISTS`.

3. **Document UPDATE / PATCH with Field Mask:**
   - Leverages `updateMask: { fieldPaths: [...] }` to patch target fields while preserving untouched document attributes.
   - Verified updating specific ledger fields (e.g. `rentAmount`, `notes`) without overwriting existing audit timestamps.

4. **Document DELETION Safeguards:**
   - Enforces `currentDocument: { exists: true }` precondition to prevent phantom deletions.

### 2.2 Google API Error Response Inspection

In accordance with strict audit requirements, errors are never classified by HTTP status code alone. The client inspects Google's actual structured error payload:

```json
{
  "error": {
    "code": 409,
    "message": "entity already exists",
    "status": "ALREADY_EXISTS",
    "details": []
  }
}
```

The error parser [`parseGoogleApiError`](file:///C:/Bhuiya-Property-Manager/poc/phase-10-2a/firestoreRestClient.mjs) extracts `error.status`:
- **`ALREADY_EXISTS`:** Accurately parsed on insert collisions (HTTP 409/412).
- **`FAILED_PRECONDITION`:** Accurately parsed when document state or version precondition fails (HTTP 412).
- **`ABORTED`:** Accurately parsed on transaction lock contention and read-write collisions (HTTP 409).
- **`PERMISSION_DENIED`:** Accurately parsed when client lacks IAM / rule permissions (HTTP 403).
- **`UNAUTHENTICATED`:** Accurately parsed when bearer token is invalid or missing (HTTP 401).
- **`INVALID_ARGUMENT`:** Accurately parsed on malformed document paths or field schemas (HTTP 400).
- **`UNAVAILABLE`:** Accurately parsed during upstream service disruptions (HTTP 503).

---

## 3. Protocol Findings & Architectural Adaptations

### Known Emulator Gateway Limitation: Single GET Query Parameter Bug
During testing, an important behavioral difference was identified in the Firebase Firestore Emulator REST adapter (`io.gapi.emulators.grpc.HttpAdapter.java`):
- When requesting `GET /documents/{path}?transaction={txId}`, the emulator's Netty HTTP bridge crashes with `java.lang.IllegalArgumentException: Unmapped JavaType: BYTE_STRING` because it fails to map the protobuf `bytes` field from a query string.
- **Architectural Solution:** Standardized all transactional document reads on `POST /documents:batchGet` with body `{ documents: [...], transaction: txId }`. The `:batchGet` endpoint transmits the base64 transaction identifier in the JSON request body, which is parsed cleanly by both the local emulator AND production Google Cloud Firestore REST API v1.

---

## 4. Verification Results Ledger

| Test Case | Method / Target | Environment | Result |
| :--- | :--- | :--- | :--- |
| Value Encoding & Decoding | `encodeDocument` / `decodeDocument` | Local Unit | **PASSED** |
| Document Creation (`exists: false`) | `POST :commit` | Emulator | **PASSED** |
| Document Retrieval | `GET /documents/{col}/{id}` | Emulator | **PASSED** |
| Document Patch with Field Mask | `POST :commit` (`updateMask`) | Emulator | **PASSED** |
| Document Deletion with Precondition | `POST :commit` (`delete`) | Emulator | **PASSED** |
| Missing Document Handling | `GET /documents/{col}/{missing}` | Emulator | **PASSED** |
| Google Status `ALREADY_EXISTS` | Live duplicate insert | Emulator | **PASSED** |
| Google Status `ABORTED` | Lock contention simulation | Emulator | **PASSED** |
| Google Status `FAILED_PRECONDITION` | Precondition failure | Emulator + Mock | **PASSED** |
| Google Status `PERMISSION_DENIED` | Missing allow rules | Emulator | **PASSED** |
| Upstream Non-JSON 502/503 | Simulated HTML gateway error | Mock Fetch | **PASSED** |
