# Project Audit

## Scope and environment

- Stack verified from `package.json`: React 19, TypeScript, Vite 8, Tailwind CSS 4, Firebase, and AWS S3-compatible storage integration for Cloudflare R2.
- Offline modules and a sync-status component exist under `src/lib/` and `src/components/ui/`.
- The default Firebase CLI project is now `bhuiya-property-staging`. Staging R2 bucket: `bhuiya-property-manager-staging`.
- No production deployment, Firebase write, rules deployment, or live upload was performed.
- `docs/ui-ux/DESIGN-RULES.md` exists; a separate UI/UX Master Guide / blueprint v2.1 was not found.

## Findings

| ID | Severity | Area | Evidence | Impact | Fix | Status | Verified-by |
|---|---|---|---|---|---|---|---|
| FIN-01 | HIGH | Money summaries | Independent calculations in `src/components/AdminDashboard.tsx`, `src/components/distribution/DistributionManagementView.tsx`, and `src/services/reportService.ts` used different month filters and ordinary floating-point sums. | Home, Reserve/Distribution, and Reports could show inconsistent financial totals, especially for older records without `billingMonth`. | Use `src/services/financialSummary.ts` as the shared monthly selector and `src/utils/money.ts` for integer-poisha arithmetic. Keep persisted document schemas unchanged. | Fixed in code; actual staging-data reconciliation pending. | `npm run test:financial`; TypeScript; lint; staging build; local regressions |
| CFG-01 | HIGH | Environment safety | `.firebaserc` previously defaulted to `bhuiya-property-manager`; `.env.production` is ignored local configuration. | An unqualified Firebase CLI operation could target production. | Default `.firebaserc` to staging; do not run deploy, rules, or live-data commands without an explicit staging/emulator target. | Fixed for CLI default; production configuration still exists and is not used. | Read `.firebaserc`; no Firebase CLI operation executed |
| DEP-01 | HIGH | Dependencies | `npm audit --json`: 8 high, 22 moderate, 0 critical advisories. | Dependency vulnerabilities require triage; blanket upgrades could introduce regressions. | Review affected dependency paths and propose scoped upgrades; do not run `npm audit fix` or major upgrades without approval. | Open. | `npm audit --json` |
| QA-01 | MEDIUM | Test infrastructure | No Vitest/Playwright config or standard test files were found; existing checks are standalone Node scripts. | Required browser-size, runtime, and Lighthouse gates are not reproducible from the configured project scripts. | Add/restore a supported test harness in a separate, scoped change; retain existing local suites. | Open. | Repository file discovery and `package.json` |
| STG-01 | HIGH | R2 verification | `docs/storage-r2-staging.md` says mocked tests do not replace an authenticated R2 upload/download test; no test file has been uploaded. | Upload health, private access, and completion flows remain unverified end-to-end. | Run a harmless authenticated staging-only test after staging credentials/session are available. | Open; not run. | Staging setup documentation |
| PERF-01 | MEDIUM | Firestore reads | Expense Management and Distribution now load workspace records without a month filter so the shared selector can include legacy records missing `billingMonth`. | Larger historical workspaces may incur more reads and client work. | Measure staging data volume; consider an approved summary/index strategy if needed without dropping legacy records. | Monitor in staging. | Code review; no live data accessed |
| PAY-01 | HIGH | Rent payment integrity | `api/_lib/handlers/rent.ts:162-210` and `functions/index.js:746-794` atomically create the payment row and update its bill, but do not consume idempotency keys; `src/services/rentService.ts:389-414` persists the offline bill, payment, and queue item sequentially. | Retry after an ambiguous response can duplicate a payment; local partial persistence can leave cached balances inconsistent. | Add stable request idempotency across callable handlers and an atomic local persistence operation; cover retries and partial failures. | Open; audit only. | Source inspection; no staging payment submitted |

## Known manual findings

- K6’s reported numeric mismatch could not be reproduced because no live/staging financial dataset was accessed. The code-level selector/filter inconsistency was confirmed and consolidated as FIN-01.
- K1-K5 and K7-K12 have not yet been audited against the current UI in this pass.
- Rent writes were traced: the cloud payment row and bill update are already in one Firestore transaction, but end-to-end idempotency and offline local atomicity are not implemented.

## Security and secret scan

- Local `.env` files were scanned without printing values. No configured private-key, AWS access-key, R2 secret, Cloudflare token, or JWT patterns were found.
- `.env` files are ignored; only example env files are tracked.
- Git-history keyword matches were limited to key-marker/test patterns and runtime-generated test keys; no credential values were printed or confirmed as live credentials.
- `gitleaks` is not installed. This was a targeted pattern scan, not a comprehensive third-party secret-scanner result.

## Baseline risks

- `npm install` completed but reported 30 dependency advisories; its install policy also blocked the `esbuild` postinstall script. The staging build nevertheless completed successfully.
- Firestore emulator role/workspace tests, live staging upload checks, browser E2E, console/runtime checks, and Lighthouse PWA checks were not run.
- Do not deploy the existing Firestore rules or use production configuration without the required explicit approval.
