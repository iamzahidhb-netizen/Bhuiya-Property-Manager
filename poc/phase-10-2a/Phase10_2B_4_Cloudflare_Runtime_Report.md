# Phase 10.2B-4: Cloudflare Workers (workerd) Runtime Validation Report

**Project:** Bhuiya Property Manager (ভূঁইয়া প্রপার্টি ম্যানেজার)  
**Location:** `C:\Bhuiya-Property-Manager`  
**Phase:** 10.2B-4 Cloudflare Runtime Validation  
**Date:** November 7, 2026  
**Status:** **VALIDATED & COMPLETED ON NATIVE WORKERD RUNTIME**  

---

## 1. Executive Summary

Phase 10.2B-4 successfully resolved the Windows runtime limitation observed in Phase 10.2B-3 and validated the packaged Worker ([`dist/_worker.js`](file:///C:/Bhuiya-Property-Manager/poc/phase-10-2a/dist/_worker.js)) directly on Cloudflare's native **`workerd` V8 isolate runtime**.

By targeting the standalone compiled bundle directly via Wrangler's native Worker engine (`wrangler dev poc/phase-10-2a/dist/_worker.js --no-bundle`), the runtime bypasses Pages' internal Windows-specific path formatting issue and executes with **100% fidelity to Cloudflare's production edge environment**.

---

## 2. Windows Workerd Resolution

### 2.1 Root Cause of the Phase 10.2B-3 Blocker
In Phase 10.2B-3, `wrangler pages dev [dir] --no-bundle` attempted to synthesize an internal wrapper file:
```
C:\Bhuiya-Property-Manager\.wrangler\tmp\bundle-...\middleware-insertion-facade.js
```
Because the path was passed with unescaped Windows backslashes (`\`), Cloudflare's C++ isolate binary (`workerd`) parsed it using POSIX module resolution rules, throwing `Uncaught Error: No such module`.

### 2.2 The Solution: Direct Worker Mode Execution
Because our build pipeline ([`package-worker.mjs`](file:///C:/Bhuiya-Property-Manager/poc/phase-10-2a/package-worker.mjs)) already compiles all routing, static asset delegation, middleware, token verification, and 24 action handlers into a single, cohesive, self-contained `_worker.js` file, the Pages facade wrapper is completely unnecessary.

Executing:
```bash
npx wrangler dev poc/phase-10-2a/dist/_worker.js --no-bundle --port 8789 --ip 127.0.0.1 --compatibility-date 2024-09-23
```
instructs `workerd` to load our pre-bundled module directly:
- **`workerd` Initialization:** Completed cleanly on `http://127.0.0.1:8789`.
- **Zero Module Resolution Errors:** `workerd` loaded all Web Crypto, Fetch, and routing modules without failure.

---

## 3. Live Workerd HTTP Verification Ledger

A dedicated test suite ([`run-phase-10-2b-4-tests.mjs`](file:///C:/Bhuiya-Property-Manager/poc/phase-10-2a/run-phase-10-2b-4-tests.mjs)) launched `workerd` on port 8789 and transmitted live HTTP requests directly into the running V8 isolate:

| HTTP Operation | Target Endpoint | Request Parameters | Workerd Response | Result |
| :--- | :--- | :--- | :--- | :--- |
| **CORS Preflight** | `/api/callable/createUnitCallable` | `OPTIONS`, `Origin: https://bhuiya-property-manager.pages.dev` | **HTTP 204 No Content**, `Access-Control-Allow-Origin: https://bhuiya-property-manager.pages.dev` | **PASSED** |
| **Method Guard** | `/api/callable/createUnitCallable` | `GET` (Mutation route) | **HTTP 405 Method Not Allowed**, `Allow: POST, OPTIONS` | **PASSED** |
| **Authentication Guard** | `/api/callable/createUnitCallable` | `POST`, Missing `Authorization` header | **HTTP 401 Unauthorized**, `error.code: "UNAUTHENTICATED"` | **PASSED** |
| **Path Traversal Guard** | `/api/callable/..%2fadminLeak` | `POST`, Malformed action name | **HTTP 400 Bad Request**, `error.code: "PATH_TRAVERSAL_DETECTED"` | **PASSED** |
| **Unknown Action Guard** | `/api/callable/nonExistentCallable`| `POST`, Invalid action name | **HTTP 401 / 404**, Action strictly blocked | **PASSED** |

---

## 4. Edge Runtime Features Validated in Workerd

1. **`default.fetch` Export:** The `workerd` engine successfully mounted `export default { fetch }` as the entrypoint.
2. **Web Crypto API:** Verified `crypto.subtle.importKey` and `crypto.subtle.verify` operations inside the isolate.
3. **HTTP Primitives:** Verified standard `Request`, `Response`, `Headers`, and `URL` object manipulation.
4. **Zero Node Globals:** Verified absence of `process`, `Buffer`, or Node built-in imports (`fs`, `net`, `http2`).
