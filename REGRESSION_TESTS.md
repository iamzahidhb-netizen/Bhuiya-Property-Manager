# Regression Tests

## Financial integrity

- `npm.cmd run test:financial` — 12/12 passed. Covers decimal addition/subtraction, rounding to poisha, proportional allocation, average calculations, invalid amounts, Dhaka month boundary, legacy dates, reversals, inactive expenses, and monthly selector totals.
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
