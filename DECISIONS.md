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

## ADR-003 — Keep rent bill summaries and offline payment persistence shared

- **Status:** Accepted, 2026-11-11
- **Context:** Rent summary screens and the offline payment path independently calculated bill totals. Offline payment persistence wrote the optimistic bill, payment entry, and sync queue in separate IndexedDB transactions.
- **Decision:** Route bill/deposit totals and cached payment-balance calculations through `src/services/financialSummary.ts` and integer money helpers. Add a multi-object-store IndexedDB transaction and enqueue the rent bill, payment, and queue item atomically.
- **Consequences:** No Firestore schema changes; local offline state cannot partially persist those three records. Server-side idempotency across retries remains an open follow-up.
- **Rollback:** Revert the shared selectors and related-write support; no persisted data migration is needed.

## ADR-004 — Use scoped, lifecycle-safe PWA cache updates

- **Status:** Accepted, 2026-11-11
- **Context:** The service worker deleted all origin caches and immediately took control of existing tabs, which could disrupt a page still requesting old hashed chunks.
- **Decision:** Use an app-prefixed versioned cache, delete only obsolete app-owned caches, and let an update activate only after old controlled tabs close. Refresh HTML network-first, cache fingerprinted JS/CSS by URL, and never access IndexedDB from the service worker.
- **Consequences:** Open tabs continue on their current version until closed/reloaded; browser user-data/financial stores are not touched by cache updates.
- **Rollback:** Restore the prior worker and cache version; no IndexedDB migration or data deletion is required.
