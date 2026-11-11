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
