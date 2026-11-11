# Implementation Log

## 2026-11-11 — Safety baseline and financial total consistency

- Preserved the pre-existing staged work on branch `agent/2026-11-11` in checkpoint commit `8a280c8` (`chore(checkpoint): preserve existing staged work`).
- Changed `.firebaserc` default from the production project to `bhuiya-property-staging`; no deployment or remote Firebase operation was performed.
- Added `src/utils/money.ts` for integer-poisha sums, subtraction, proportional allocation, and averaging.
- Added `src/services/financialSummary.ts` as the shared monthly operating selector. It resolves legacy date-only expense records and Dhaka-time payment dates when `billingMonth` is missing.
- Routed Home, Expense Management, Reserve/Distribution, monthly and yearly Reports through the shared selector. Specialized reports now use the same integer money utility for totals.
- Kept existing Firestore document schemas unchanged.
- Added `poc/phase-10-2a/test-financial-integrity.mjs` and `npm run test:financial`.
- No Firestore rules, authentication/role logic, schema, existing user data, or cloud resources were changed by this implementation.

## 2026-11-11 — Staging Android build attempt

- `npm.cmd run build` — passed; builds the web app in staging mode and packages the Worker (732,416 bytes).
- `npx.cmd cap sync android` — passed; copied the staging web assets and synced the two Capacitor Android plugins.
- `android/gradlew.bat assembleDebug` — blocked: sandbox denied access to the Gradle wrapper lock file under `C:\Users\Onty's zZz\.gradle\wrapper\dists\...`.
- `adb devices` — failed to start the ADB daemon (`could not read ok from ADB Server`); no phone connection was verified.
- An existing `android/app/build/outputs/apk/debug/app-debug.apk` (13,509,363 bytes; last written 2026-11-11 12:53 +06:00) predates this build attempt. It was not treated as the newly built APK and was not installed.
- No APK install, phone data change, deployment, or live backend operation was performed.

## 2026-11-11 — Shared Hisab, offline local atomicity, and PWA cache lifecycle

- Extended `src/services/financialSummary.ts` with shared rent-bill, held-deposit, and cached rent-payment balance calculations. Rent management, tenant history, tenant deposits, and offline payment reconciliation now use these selectors and integer-poisha utilities.
- Added `saveItemsAtomically` to IndexedDB and let the sync engine enqueue related records in the same transaction. An offline rent payment now persists its cached bill update, payment row, and sync queue row atomically.
- Consolidated the legacy `banglaFormat.ts` API to delegate currency/month/digit formatting to `uiFormatters.ts`, preserving existing callers.
- Updated `public/sw.js` to keep updates waiting until old controlled tabs close, scope cleanup to this app's cache prefix, refresh navigations network-first, cache fingerprinted assets, and leave IndexedDB untouched.
- Added `npm run test:pwa-cache` alongside extended financial integrity checks.
- `npm.cmd run test:financial` — passed, 19/19.
- `npm.cmd run test:pwa-cache` — passed, 12/12 mocked Service Worker checks.
- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run lint` — passed.
- `node poc/phase-10-2a/run-poc-tests.mjs` — passed, 101 assertions.
- `node poc/phase-10-2a/test-offline-architecture.mjs` — passed, 8/8.
- `node poc/phase-10-2a/run-remediation-tests.mjs` — passed, 62/62.
- `npm.cmd run build` — passed in staging mode; Worker bundle 732,416 bytes.
- `npx.cmd cap sync android` — passed with latest staging assets; native app ID, signing, permissions, and project structure were not modified.
- Browser/device PWA verification, full user-interface visual testing, authenticated staging flows, and Android APK rebuild/install remain NOT RUN (environment/harness access unavailable).
- Server-side idempotency remains open; no cloud calls or deployments were performed.

### Baseline commands and results

- `npm.cmd install` — passed; 30 advisories reported (22 moderate, 8 high); `esbuild` install script was blocked by the repository install-script allowlist.
- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run lint` — passed.
- `node poc/phase-10-2a/run-poc-tests.mjs` — passed, 101/101 assertions.
- `node poc/phase-10-2a/test-offline-architecture.mjs` — passed, 8/8 checks.
- `node poc/phase-10-2a/run-remediation-tests.mjs` — passed, 62/62 checks.
- `npm.cmd run build` — passed with staging mode; Worker bundle 732,416 bytes, under the 1 MiB check.
- `npm.cmd audit --json` — exited 1 because advisories were found: 0 critical, 8 high, 22 moderate.

### Post-change regression commands and results

- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run test:financial` — passed, 12/12 checks.
- `node poc/phase-10-2a/run-poc-tests.mjs` — passed, 101/101 assertions.
- `node poc/phase-10-2a/test-offline-architecture.mjs` — passed, 8/8 checks.
- `npm.cmd run build` — passed with staging mode.
- `node poc/phase-10-2a/run-remediation-tests.mjs` — passed, 62/62 checks.
- `git diff --check` — passed.

### Not run

- Authenticated staging R2 upload/download/delete test: no authenticated staging user session was available; no live service was contacted.
- Firestore emulator role tests: no emulator test harness was configured or run.
- Playwright at 360x800 / 412x915, browser runtime console checks, offline airplane-mode UI check, and Lighthouse PWA audit: no configured browser test harness was found.
