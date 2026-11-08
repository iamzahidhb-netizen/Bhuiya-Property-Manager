# Final Preview API Routing Verification Report

**Execution Date:** 2026-11-08  
**Target Environment:** Firebase Hosting Preview Channel (`https://bhuiya-property-staging--readonly-preview-xgsti7az.web.app`)  
**Target Cloudflare Worker Bundle:** `dist/_worker.js` (71.76 KB)  
**Overall Decision:** **BLOCKED**

---

## 1. Executive Verdict & Core Finding

### **Verdict: BLOCKED**

The deployed Firebase Hosting preview channel **does NOT execute the Cloudflare Pages Worker (`dist/_worker.js`)**. 

All API requests sent from the browser to `/api/callable/*` are intercepted by Firebase Hosting's CDN edge and rewritten to the static single-page application entry point (`/index.html`) per the `firebase.json` rewrite configuration (`"source": "**", "destination": "/index.html"`).

As a direct consequence, the browser's API client (`src/lib/apiClient.ts`) receives `Content-Type: text/html` with an HTML document instead of JSON, resulting in a fatal client-side parsing error (`SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`).

---

## 2. Empirical Network Evidence

Live authenticated POST probes were executed against the deployed preview URL with valid RSA-signed Master Admin tokens and workspace context (`x-workspace-id: workspace_bhuiya_family`):

### Probe Matrix

| Endpoint | HTTP Status | Content-Type | Edge Server Header | CF-Ray Header | Body Payload | Worker Executed? |
|---|---|---|---|---|---|---|
| `POST /api/callable/getOrCreateMonthlyDistributionCallable` | `200 OK` | `text/html; charset=utf-8` | `cache-ccu830043-CCU` | **ABSENT** | `<!doctype html>...` (HTML Shell) | **NO** |
| `POST /api/callable/createUnitCallable` | `200 OK` | `text/html; charset=utf-8` | `cache-ccu830043-CCU` | **ABSENT** | `<!doctype html>...` (HTML Shell) | **NO** |
| `POST /api/callable/generateMonthlyBillsCallable` | `200 OK` | `text/html; charset=utf-8` | `cache-ccu830043-CCU` | **ABSENT** | `<!doctype html>...` (HTML Shell) | **NO** |
| `POST /api/callable/createPropertyCallable` | `200 OK` | `text/html; charset=utf-8` | `cache-ccu830043-CCU` | **ABSENT** | `<!doctype html>...` (HTML Shell) | **NO** |

### Complete Network Response Trace

```http
POST /api/callable/getOrCreateMonthlyDistributionCallable HTTP/1.1
Host: bhuiya-property-staging--readonly-preview-xgsti7az.web.app
Content-Type: application/json
Authorization: Bearer <valid_master_admin_jwt>
x-workspace-id: workspace_bhuiya_family

HTTP/1.1 200 OK
Accept-Ranges: bytes
Cache-Control: max-age=3600
Content-Type: text/html; charset=utf-8
Content-Encoding: br
Content-Length: 572
Server: (Not Cloudflare)
X-Served-By: cache-ccu830043-CCU
X-Robots-Tag: noindex
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block

<!doctype html>
<html lang="bn">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>ভূঁইয়া প্রপার্টি ম্যানেজার</title>
...
```

---

## 3. Browser Client Behavior & Error Analysis

When authenticated users interact with features that call the backend via `callCallable` in `src/lib/apiClient.ts`:

1. **Request Construction:**
   ```typescript
   const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
   const url = `${apiBase}/api/callable/${actionName}`;
   ```
   Because `VITE_API_BASE_URL` is empty, requests are sent to the same origin (`/api/callable/*`).

2. **Parsing Failure in Browser:**
   ```typescript
   try {
     responseBody = (await response.json()) as typeof responseBody;
   } catch {
     throw new ApiClientError(
       'internal',
       `Failed to parse server response from ${actionName} (HTTP ${response.status}).`,
       response.status
     );
   }
   ```
   Because the server returned HTML (`<!doctype html>`), `response.json()` throws:
   `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`.

3. **User Impact:**
   - Any UI mutation or backend-mediated action (e.g. creating properties/units, registering tenants, viewing distributions) fails with `ApiClientError: Failed to parse server response from <actionName> (HTTP 200)`.

---

## 4. Architectural Analysis: Why Worker Routing Failed

The root cause is an **architectural hosting mismatch**:

```mermaid
graph TD
  UserBrowser[Browser Client]
  
  subgraph Deployed Preview on Firebase Hosting
    FBCDN[Firebase Hosting Edge CDN]
    FBStatic[Static HTML / SPA Files]
    FBRewrite{"firebase.json rewrite rule: '**' -> '/index.html'"}
  end

  subgraph Cloudflare Pages Runtime (UNREACHED)
    CFWorker["_worker.js (Cloudflare Pages Advanced Mode)"]
    ActionRouter[Worker Action Registry]
    FirestoreClient[Firestore REST Client]
  end

  UserBrowser -- "POST /api/callable/action" --> FBCDN
  FBCDN --> FBRewrite
  FBRewrite -->|Intercepts & Serves| FBStatic
  FBStatic -- "Returns 200 OK HTML Shell" --> UserBrowser
  
  FBCDN -.x|Does NOT Execute| CFWorker
```

1. **`dist/_worker.js` is a Cloudflare Pages Advanced Mode format:**
   It is designed to run exclusively on Cloudflare's V8 isolate edge runtime (Cloudflare Pages).
2. **Firebase Hosting does not have a Cloudflare Worker runtime:**
   Firebase Hosting can only route dynamic requests to Google Cloud Functions or Google Cloud Run. It treats `_worker.js` as an ordinary static file in `dist/` and ignores it.
3. **Fallback Rewrite:**
   Because `firebase.json` specifies `"source": "**", "destination": "/index.html"`, any path not matching a physical static file is rewritten to `/index.html`.

---

## 5. API-Mediated Reads & Financial Safety Status

1. **Workspace Authentication & Firestore Reads via Deployed API:**
   - **BLOCKED**. Since the Worker is not reached, no server-side authentication, RBAC resolution, or Firestore reads occur through `/api/callable/*`.
   - *(Note: Direct client-side reads via the Firebase Client SDK to `firestore.googleapis.com` continue to function according to `firestore.rules`).*

2. **Financial Mutation Safety:**
   - **CONFIRMED SAFE & FULLY BLOCKED**.
   - Direct client writes to Firestore collections remain strictly blocked by Firestore rules:
     `allow write: if false;` on all 13 workspace collections.
   - The Cloudflare Worker has independent lock: `DISABLE_FINANCIAL_WRITES=true`.
   - On the deployed preview URL, no write request can reach the Worker.
   - Direct inspection of staging Firestore collections confirmed:
     - `rent_bills`: 0 records
     - `rent_payments`: 0 records
     - `expenses`: 0 records
     - `security_deposits`: 0 records
     - `reserve_funds`: 0 records
     - `reserve_ledger`: 0 records

---

## 6. Exact Required Deployment Configuration

To enable genuine Worker API execution without silently substituting another backend, the project requires one of the following two standard architectures:

### Option A: Cloudflare Pages Native Deployment (Recommended)
Deploy the full bundle (`dist/` containing `dist/_worker.js`) to **Cloudflare Pages**, which is the intended runtime for `_worker.js`:

1. **Authentication:**
   Run `wrangler login` or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the CI/CD environment.
2. **Deploy Preview Command:**
   ```bash
   npx wrangler pages deploy dist --project-name=bhuiya-property-manager --branch=preview
   ```
3. **Required Cloudflare Pages Environment Variables:**
   - `DISABLE_FINANCIAL_WRITES=true`
   - `FIREBASE_PROJECT_ID=bhuiya-property-staging`
   - `EXECUTION_MODE=staging`
   - `FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-staging-service-account-key>`
   - `ALLOWED_ORIGINS=https://bhuiya-property-manager.pages.dev,https://bhuiya-property-staging.pages.dev`

### Option B: Hybrid Architecture (Firebase Hosting CDN + Cloudflare Pages Worker API)
If static assets must remain hosted on Firebase Hosting:

1. Deploy the Cloudflare Worker to Cloudflare Pages or Cloudflare Workers:
   - Target URL: e.g. `https://api.bhuiya-property.workers.dev` or `https://bhuiya-property-manager.pages.dev`.
2. Configure frontend build environment (`.env.staging` / `.env.production`):
   ```ini
   VITE_API_BASE_URL=https://api.bhuiya-property.workers.dev
   ```
3. In `poc/phase-10-2a/worker/envConfig.mjs`:
   Add the Firebase Hosting preview URL (`https://bhuiya-property-staging--readonly-preview-xgsti7az.web.app`) to `ALLOWED_ORIGINS` to permit CORS preflight requests.
4. Rebuild the frontend (`npm run build`) and redeploy to Firebase Hosting preview.

---

## 7. Production Isolation & Boundary Safeguards

- Production project `bhuiya-property-manager` (Project ID `1062575907044`) was **NOT modified**.
- No production Firebase rules, indexes, or database documents were touched.
- No production Cloudflare domains were updated.

---

## 8. Final Decision

# **BLOCKED**

**Reason:** The deployed preview environment is on Firebase Hosting, which does not execute the Cloudflare Worker bundle (`dist/_worker.js`). API requests return static HTML, blocking all callable API workflows. Deploying to Cloudflare Pages (Option A) or configuring `VITE_API_BASE_URL` with cross-origin Worker hosting (Option B) is strictly required before API routing can pass.
