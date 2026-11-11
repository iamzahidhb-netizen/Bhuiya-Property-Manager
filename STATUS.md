# Project Status

Updated: 2026-11-11

## Done

- Safety checkpoint created on `agent/2026-11-11` (`8a280c8`).
- Firebase CLI default redirected to staging; no cloud deploy/write performed.
- Unified monthly, rent-bill, and held-deposit totals through shared selectors and integer-poisha money helpers.
- Made offline cached rent bill, payment, and sync-queue writes atomic in one IndexedDB transaction.
- Routed legacy Bengali currency/month formatting exports through one canonical formatter.
- Hardened PWA cache updates to be app-scoped and avoid deleting IndexedDB or taking over old tabs during upgrades.
- Local TypeScript, lint, focused financial, offline, worker, remediation, and staging build checks passed.
- Rebuilt the web app and Worker in staging mode; Capacitor Android assets/plugins synced successfully.
- Baseline and audit findings recorded in the project reports.
- Full-workspace subscriptions are used where necessary to include legacy records; monitor Firestore read volume during staging validation.

## In progress

- Phase 1 audit: offline sync retry behavior, storage health/status, and upload queue separation.
- Android APK rebuild and phone installation.
- Staging-data reconciliation of K6; no staging user data was accessed.
- Dependency advisory triage.
- Remaining financial labels still using direct `toLocaleString` need conversion to honor user digit preferences consistently.

## Next 3 tasks

1. Implement stable rent-payment idempotency in every active server handler; cover ambiguous response/retry behavior.
2. Audit offline retries, R2 health/status, and upload queue separation; use mock/emulator or authorized staging only.
3. Finish formatting/UI audit for K1-K12 and add repeatable browser/device/PWA checks.

## Blocked / approvals

- `android/gradlew.bat assembleDebug` — NOT RUN TO COMPLETION: sandbox denied access to the Gradle wrapper lock under the user `.gradle` cache. An APK exists but predates this build attempt; it was not installed. `adb devices` could not start the ADB daemon, so no connected phone was verified.
- Mobile Web/PWA, tablet, desktop, Android runtime, browser history, keyboard/safe-area, and visual dark-mode checks are NOT RUN because no browser/device test session is available.
- Authenticated staging upload/download check is not run; a staging user session is unavailable.
- Before any schema/data migration, auth/role/claims change, Firestore rule deployment, or production operation, stop and obtain the required explicit approval.
- Production configuration still exists but was not used. Do not invoke production targets.
