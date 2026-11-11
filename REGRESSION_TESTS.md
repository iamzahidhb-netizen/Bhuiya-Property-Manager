# Regression Tests

## Financial integrity

- `npm.cmd run test:financial` — 19/19 passed. Covers integer-poisha arithmetic, proportional/average calculations, invalid amounts, Dhaka month boundary, legacy dates, reversals, inactive expenses, monthly totals, multi-bill totals, held-deposit totals, partial/full/oversized cached payment calculations, and shared Bengali currency formatting.
- Existing broad suite financial fixtures — partial/final payment, duplicate payment rejection, overpayment rejection, liability classification, reserve withdrawals/overdraft, and reversal audit behavior passed in `node poc/phase-10-2a/run-poc-tests.mjs` (synthetic fixtures).

## PWA and platform compatibility

- `npm.cmd run test:pwa-cache` — 12/12 passed using mocked Service Worker/Cache Storage. Verifies app-only cache cleanup, update lifecycle policy, navigation shell refresh/offline fallback, hashed-asset caching, and no IndexedDB access.
- `npx.cmd cap sync android` — passed; latest staging web output and the existing two Capacitor plugins synchronized to the Android project. No application ID, signing, permissions, or native project structure changes.
- Web build is staging-only: `npm.cmd run build` — passed; Vite assets and Cloudflare Worker bundle generated.
- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed; builds in staging mode and packages the Cloudflare Worker.

## Existing local regression suites

- `node poc/phase-10-2a/run-poc-tests.mjs` — 101/101 passed; isolated synthetic fixtures.
- `node poc/phase-10-2a/test-offline-architecture.mjs` — 8/8 passed; in-memory mock IndexedDB scenarios.
- `node poc/phase-10-2a/run-remediation-tests.mjs` — 62/62 passed; mocked worker and build checks.

## Not run

- Vitest: no Vitest dependency/configuration exists.
- Playwright browser E2E at 360x800 and 412x915: no Playwright setup exists.
- Firebase emulator role/workspace suite: not configured or run.
- Authenticated staging R2 upload/download/delete: not run.
- Browser console/runtime, real airplane-mode flow, and Lighthouse PWA checks: not run.
- Mobile Web/PWA, tablet, desktop, Android APK runtime, hardware back, keyboard/safe-area, browser back/forward, and dark-mode visual checks: not run (no browser/device test session).
- `android/gradlew.bat assembleDebug` and Wi-Fi ADB install: not completed; sandbox denied Gradle cache access and ADB daemon startup.
