# A.D lifecycle intelligence — audit and implementation plan

Audit performed against the checked-out `work` branch, 2026-10-26. This file is the living record of what the code can prove; the product brief is not treated as an implementation inventory.

## Phase 0 — verified architecture

| Area | Observed implementation | Lifecycle implication |
|---|---|---|
| App | React 19 + TypeScript + Vite; server routes under `server/`, Vercel entrypoints under `api/`; no job queue or scheduled lifecycle worker. | Add a manually invoked owner-only dry-run route; no automatic scheduling. |
| Identity | GitHub OAuth requests `read:user`, then accepts only the configured owner ID (`340639438`). Google is a linked alternative identity, not a separate account. No registration or multi-tenant account creation. | `user_signed_up` and user-level signup age do not exist. No email address is retrieved or verified. |
| Persistence | Neon-backed `ad_records`, `ad_saver`, and Radar tables. `ad_records` is owner-namespaced by application code; the dedicated Scout DB role has narrow RLS policies for OAuth token namespaces. | Use the existing private store and add no production schema migration. Events/drafts must use a new namespace inaccessible to Scout. |
| Saver | `/api/saver` authenticates the owner, validates a reference, persists it, reads it back and verifies its fingerprint. Remote capture is demonstrably durable. `src/storage.ts` separately stores the main Workspace in origin-scoped `localStorage`. | Instrument only the verified remote save. Do not count local-only references as server-observed lifecycle activity. |
| Taste | `server/taste.ts` exposes owner-authenticated context and explicit taste material; it is not signup/onboarding analytics. | No preference or professional profile is inferred from saves or likes. |
| Radar | Owner-authenticated Neon repository; `qualifyFinding` computes explicit qualification and source validity. Review decisions and stage/outcome evidence are stored in `ad_market_feedback`. Manual scan is feature-gated; AI is currently off. | Use qualified, source-backed findings for weekly drafts. A Radar candidate is not a verified opportunity or commercial result. |
| Explorer | Reads saved source material and allows user-authored interpretation; no independent lifecycle event store. | Do not infer product usage from extraction or model activity. |
| Projects | Local Workspace records only; no server-side project/task persistence except a Radar-to-project association. | A full project, unfinished task, or local downstream use cannot be included in server lifecycle messages. |
| Analytics | No product analytics SDK or canonical event model found. `ad_audit` is security/tool auditing, not user engagement analytics. | Add a minimal first-party, owner-scoped event log in the existing record store. |
| Email / consent | No lifecycle email provider, templates, queue, worker, durable marketing preference, global opt-out, bounce or complaint handler. Studio inquiry `marketing_opt_in` is specific to its form and is not account consent. | No external provider calls or outbound sending. All actual owner evaluations default to suppression until an address, verification, and lawful consent exist. |
| Billing | No subscription, payment, cancellation or billing-event integration found. | Subscriber and cancellation segments remain unavailable. |
| Sync risk | The main Workspace remains origin-scoped local storage. The optional snapshot route is feature-gated and the first transfer is user initiated; the beta flags are not enabled in code. Saver is a distinct cloud store. | Cross-device project/taste history cannot be used by this server engine. No sync claim is made. |
| Tests/deploy | Vitest + PGlite integration tests, Playwright browser tests, `npm run build`; Vercel configuration exists. | Verify unit/integration/build locally. No production deployment or sender activation. |

### Reference repository review

Read-only review, no skill installation and no dependencies added. Each SHA below is the exact main-branch commit whose docs were inspected.

| Repository | Reviewed commit | License / install / use |
|---|---|---|
| `coreyhaines31/marketingskills` | `468e60ff60046106c084cdfe56499f87e1be55ff` | MIT; selectively reviewed `emails` v2.1.4 (current name; not the older `email-sequence`), `onboarding` v2.0.2, `churn-prevention` v2.0.3, `analytics` v2.2.1, and `product-marketing` v2.2.0. README installation uses the Agent Skills installer; no package or scripts installed. |
| `CosmoBlk/email-marketing-bible` | `962648c1b147652244c4e4953e96c65421a79e70` | MIT, v2.8.2; selective docs reviewed for flows, compliance, copy, design, and deliverability. README recommends plugin or `npx skills add`; installation and clone methods were not run to avoid duplicate agent-skill installs. |
| `theAIhomegirl/ghl-mcp-server` | `74027fa39c1fc8361e5eb1ae5738782872db4ba1` | MIT; research only. It requires Node/npm and a HighLevel Private Integration Token with explicit scopes. README warns read tools can export broad contact/conversation data and `GHL_MODULES` is not a security boundary. No install, token, or connection. |

## Implementation sequence

1. Add allowlisted, append-only lifecycle events only at verified owner save/review/decision/dossier/outcome writes; retain source IDs and server timestamps, deduplicate by event key, and omit content.
2. Implement deterministic segment, trigger, precedence, consent, suppression, freshness, and frequency rules. Keep unsupported events and unavailable local data explicitly unavailable.
3. Render five restrained A.D email drafts with HTML and plaintext from validated data contracts. Persist dry-run evaluations/drafts in owner-scoped `ad_records`; do not add a provider or send code path.
4. Add synthetic-profile tests for first-value and monthly reports, all other flows, overlapping states, missing evidence, consent, invalid addresses, duplicate events, account isolation, retry safety, and sending disabled.
5. Run tests, typecheck, build, and available browser checks; report actual command outcomes and release blockers.

## Operational boundary

`DRY_RUN = true`, `OUTBOUND_SENDING = false`, and `CAMPAIGN_AUTOMATION = false` are enforced in code. The only execution path is an authenticated, CSRF-protected owner request. There is no provider adapter that can transmit mail, no schedule or bulk recipient query, and no route to production sending. No live sender is configured or authorized.

## Implemented event contract

Events are append-only rows in the existing `ad_records` table, in namespace `lifecycle-event:<owner>`. The owner is present in both the namespace and validated event data. `key` is the idempotency key; `occurredAt` and `recordedAt` are separate ISO timestamps; `sourceType` and `sourceId` point to the persisted product record. Event data intentionally excludes reference text, titles, source excerpts, decision reasons, email addresses, and outcome amounts. This namespace is outside the Scout gateway's existing RLS allowlist.

| Event | Verified source and meaning |
|---|---|
| `reference_saved` | New row inserted into `ad_saver`, then read back and fingerprint-verified through the first-party owner app. One event per owner/reference UUID; internal QA rows are excluded. |
| `first_reference_saved` | The first non-QA first-party Saver insert for an owner, guarded by a unique owner-level key. |
| `opportunity_reviewed` | A changed, owner-authenticated Radar `reviewState` write persisted with feedback. A suggestion remains only a suggestion. |
| `decision_confirmed` | The owner explicitly saves or rejects a Radar signal; snooze/reopen are reviews but not final decisions. |
| `work_dossier_linked` | The owner confirms and the server persists the Radar-to-local-project ID association. Project contents remain local and are not asserted as cloud-backed. |
| `measurable_outcome_recorded` | A Radar stage is explicitly set to `won` with evidence and a value that the route requires to be confirmed. Only the count is exposed to the report; no amount is copied into the lifecycle event. |

Not implemented or not treated as events: signup (no registration/account-created timestamp), reference revisits (a backend GET is not proof of a human revisit), `signal_qualified` (a derived current Radar state, not a user action), `opportunity_created` (Radar suggestions are not verified commercial opportunities), unsubscribed/open/click/delivery events (no email provider), lost/no-value outcomes (not measurable), subscriptions/cancellations (no billing source). The dedicated MCP/Scout role cannot write the new namespace under its least-privilege RLS policy, so MCP-approved Saver captures are intentionally excluded rather than widening database privileges; they remain in its security audit. The weekly rule reads current Radar findings only when the Radar feature is enabled and accepts only current, actionable, source-confirmed/corroborated signals seen in the previous seven days.

## Lifecycle rules and message contracts

`POST /api/lifecycle/dry-run` requires the current owner session, exact origin, CSRF token, and a per-owner quota. It reads only that owner's lifecycle records and (when enabled) the existing Radar repository. It returns five decisions with trigger, source IDs, source event IDs, exclusions, selected template, draft, evaluation time, and window key. Each evaluation is upserted under a per-owner namespace with a 180-day expiry. Retries on the same window are idempotent. At most one campaign draft is selected in an evaluation; activation outranks reactivation, then weekly intelligence, monthly report, and saved-but-unused. A prior generated draft in another window suppresses a new draft for seven days. This is a draft-cadence guard, not evidence of delivery or a deliverability frequency-cap implementation.

| Workflow | Trigger and blocking rules in this beta |
|---|---|
| First value | Requires a verified account-created timestamp, 24 hours elapsed, and no `first_reference_saved`. Current authentication has no durable signup time, so real owner run is blocked. |
| Saved but unused | Requires verified Saver saves and reference-level downstream-use provenance. Current app does not attach the Saver reference ID to later work, so it is blocked rather than guessing from a save count. |
| Weekly intelligence | At least one recent actionable, source-backed Radar signal. No qualifying signal means blocked; a draft never includes a private reference or opportunity title, source URL, budget, or contact. |
| Reactivation | Fourteen days since meaningful server activity and verified cross-device Workspace continuity. Current Workspace history is browser-local, so the real owner run is blocked. |
| Monthly value | Month-end in `Europe/Paris`; only non-empty, event-backed counts are included. Missing categories are omitted. Counts distinguish saves, signal reviews, explicit decisions, local dossier associations, and value-confirmed outcomes; no revenue is inferred or emailed. |

All five use the same preference gate: valid address, verified address, explicit A.D marketing consent, no durable unsubscribe, no bounce, no complaint. There is currently no verified account email, consent store/UI, unsubscribe endpoint, or provider webhook, so production data cannot pass this gate. Tests use synthetic, explicitly marked communication states. The saved-but-unused template is defined, but the current real-data rule cannot produce it until downstream reference provenance exists.

The HTML template is a standalone, single-column 600px layout with Arial/Helvetica and Georgia fallbacks, a 44px minimum CTA, black/white/neutral colors, text-first content, and an equivalent plaintext version. It contains no custom font assets, analytics pixels, or magic login link. Links point to the configured authenticated A.D origin. Templates never include private research by default.

## Segment and metric boundaries

Segments are derived from observed events only: first-save completion, active collecting, active intelligence use, and explicit Radar-to-project association. A registered/not-activated segment requires a signup timestamp; at-risk inactivity requires complete Workspace continuity plus a meaningful activity history. Paying/cancellation segments are absent because billing is absent. No professional profile or sensitive attribute is inferred.

`monthlyMetrics` is the single counting implementation. It deduplicates event IDs and groups by Paris calendar month. A metric exists only when its source event exists; zero is not reported as a factual value when event coverage is absent. Reference revisits are unavailable. No language model calculates counts, generates activity claims, or is called by the lifecycle engine.

## Verification boundaries and release blockers

Automated tests use synthetic profiles and PGlite, not production data or a live mail provider. They exercise rules, templates, route auth/CSRF, owner isolation, event insertion, event idempotency, suppression, window boundaries, campaign precedence, and dry-run persistence. No external network, email provider, billing system, real account, production Neon database, or iPhone/Mac restore was exercised. The engine is not a production email automation system. Before any outbound release, A.D needs a verified identity email flow, explicit consent and durable preference/opt-out records, deliverability setup and sender approval, delivery/bounce/complaint ingestion, lawful-basis review, complete cloud Workspace continuity, and separate operational authorization. No production migration is required for this increment.
