# Architecture Decisions

## ADR-001 — Use shared integer-based operating totals without changing stored schemas

- **Status:** Accepted, 2026-11-11
- **Context:** Home, Reserve/Distribution, Expense Management, and Reports independently filtered and summed operating data. Existing records store monetary amounts as BDT numbers, and modifying persisted documents would cross the schema/data-migration approval gate.
- **Decision:** Route monthly operating totals through `src/services/financialSummary.ts`. Perform money addition, subtraction, proportional allocation, and averaging via integer poisha in `src/utils/money.ts`, converting back only at existing API boundaries. Keep Firestore document shapes and stored amounts unchanged.
- **Consequences:** Legacy expense dates and payment timestamps are resolved consistently, with timestamps interpreted in `Asia/Dhaka`. Exact reconciliation against staging data remains pending.
- **Rollback:** Revert the financial selector and consumer changes; no stored data migration is needed.

## ADR-002 — Default Firebase CLI target to staging

- **Status:** Accepted, 2026-11-11
- **Context:** `.firebaserc` defaulted to the production Firebase project despite the requirement to operate only on staging/emulators.
- **Decision:** Change the local repository default to `bhuiya-property-staging`. No Firebase CLI deployment, rules operation, or live-data command was run.
- **Consequences:** Unqualified Firebase CLI commands now resolve to staging, but production settings remain in separate production configuration files. Always verify the target before any remote operation.
- **Rollback:** Restore the prior `.firebaserc` default only when explicitly changing deployment policy; production operations still require the approval gate.
