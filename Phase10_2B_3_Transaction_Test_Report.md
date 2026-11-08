# Phase 10.2B-3: Firestore Transaction Protocol & Concurrency Test Report

**Project:** Bhuiya Property Manager (ভূঁইয়া প্রপার্টি ম্যানেজার)  
**Location:** `C:\Bhuiya-Property-Manager`  
**Phase:** 10.2B-3 Transaction Validation  
**Date:** November 7, 2026  
**Status:** **VALIDATED & COMPLETED**  

---

## 1. Executive Summary

This report documents the verification of Google Cloud Firestore's ACID transaction protocol implemented over HTTP REST in [`firestoreRestClient.mjs`](file:///C:/Bhuiya-Property-Manager/poc/phase-10-2a/firestoreRestClient.mjs). Tests were conducted directly against the local Firestore Emulator (`127.0.0.1:8088`), exercising atomic commits, transactional snapshots, rollback mechanics, and automated concurrency retry handling.

---

## 2. Transaction Lifecycle & REST Implementation

```
Client                              Firestore REST API v1
  │                                           │
  ├────── POST :beginTransaction ────────────►│  (Allocates transaction snapshot)
  │◄───── { transaction: "EQMAA..." } ────────┤
  │                                           │
  ├────── POST :batchGet (with txId) ────────►│  (Strongly consistent read snapshot)
  │◄───── [ { found: { ... } } ] ─────────────┤
  │                                           │
  │   [ Business Validation & Ledger Math ]   │
  │                                           │
  ├────── POST :commit (writes + txId) ──────►│  (Atomic commit with precondition check)
  │◄───── { commitTime: "..." } ──────────────┤
```

### 2.1 Transactional Snapshot Isolation
1. **`beginTransaction`:** Verified that `POST :beginTransaction` returns a base64 transaction handle.
2. **Transactional Reads (`:batchGet`):** Reads execute within the transaction's isolation snapshot. Any changes committed by other clients after transaction start are detected upon commit.
3. **Atomic Commit (`:commit`):** All writes (inserts, updates, deletes) are bundled into a single atomic payload. If any write precondition fails or a read-write conflict occurs, the entire batch is rejected.
4. **Rollback (`:rollback`):** When an unhandled error or client abort occurs, `POST :rollback` is invoked to immediately release server-side locks.

---

## 3. Concurrency Conflict & Automated Retry Policy

### 3.1 Concurrency Collision Generation
In Suite 3, a live concurrency collision was generated against the emulator:
- **Step 1:** Document `conflictDocId` created with `counter = 100`.
- **Step 2:** Transaction 1 reads `conflictDocId` within transaction snapshot (sees `100`).
- **Step 3:** A competing external write attempts to mutate `conflictDocId` out-of-band while Transaction 1 holds its lock.
- **Step 4:** The Firestore transaction engine detects lock contention and rejects the conflicting operation with `ABORTED: Transaction lock timeout`.
- **Step 5:** The client runner automatically intercepts `err.code === 'ABORTED'`, executes exponential backoff with jitter (50ms–150ms), allocates a new transaction handle, re-reads the document, and commits cleanly.
- **Result:** Successfully completed on attempt 2 without manual intervention or data corruption.

### 3.2 Strict Retry Invariants

| Error Condition | Status Code | Client Behavior | Justification |
| :--- | :--- | :--- | :--- |
| **Concurrency Conflict** | `ABORTED` (409) | **AUTOMATED RETRY** (up to 3 times) | Transient conflict; re-reading fresh snapshot allows safe re-calculation |
| **Document Already Exists** | `ALREADY_EXISTS` (409/412) | **IMMEDIATE ABORT** (0 retries) | Permanent conflict; duplicate document cannot be created |
| **Precondition Failed** | `FAILED_PRECONDITION` (412) | **IMMEDIATE ABORT** (0 retries) | Invariant violation (e.g. overdraft or already-paid bill) |
| **Permission Denied** | `PERMISSION_DENIED` (403) | **IMMEDIATE ABORT** (0 retries) | Security failure; cannot succeed on retry |
| **Validation Error** | `INVALID_ARGUMENT` (400) | **IMMEDIATE ABORT** (0 retries) | Bad client input; retrying would waste CPU and I/O |

---

## 4. Verification Results Ledger

| Test Case | Execution Target | Environment | Result |
| :--- | :--- | :--- | :--- |
| `beginTransaction` Handle Allocation | `POST :beginTransaction` | Emulator | **PASSED** |
| Transactional Snapshot Read | `POST :batchGet` | Emulator | **PASSED** |
| Atomic Transactional Commit | `POST :commit` | Emulator | **PASSED** |
| Transaction Rollback on Abort | `POST :rollback` | Emulator | **PASSED** |
| Concurrency Conflict & `ABORTED` Retry | Competing write collision | Emulator | **PASSED (Attempt 2)** |
| Non-Concurrency Immediate Abort | `INVALID_ARGUMENT` thrown in tx | Emulator | **PASSED (Attempt 1)** |
| Overdraft Protection in Transaction | `FAILED_PRECONDITION` thrown in tx | Emulator | **PASSED (Attempt 1)** |
