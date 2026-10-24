# A.D — Reuse gate / anti-rebuild protocol
Status: public, technical-only companion to `AGENTS.md` and `docs/CODEX_HANDOFF_MASTER_2026-10-24.md`. Verified file existence 2026-10-24. **Existence in source code is not evidence of production activation.**

## Zero-rebuild rule
Before proposing a new component, migration, service, workflow or redesign, Codex must inspect the current checkout and prove the capability is missing, defective or materially inadequate. No reimplementation based solely on an old conversation or a stale handoff. Do not load the whole private conversation archive into model context: retrieve only pertinent passages and immutable source references.

## Existing implementations to inspect before writing code

| Capability | Primary existing implementation | Important qualification |
|---|---|---|
| App orchestration and routing | `src/App.tsx`, `src/hooks/useWorkspaceNavigation.ts` | Check actual current routes and states |
| Core types/validation | `src/domain.ts` | Preserve stable IDs and schemas |
| Browser workspace persistence | `src/storage.ts` | localStorage is origin/device-scoped; not cloud sync |
| Home/TODAY | `src/views/HomeView.tsx` | Check real workflow rather than add dashboard |
| Radar collection/jobs | `server/market/jobs.ts`, `server/market/repository.ts` | Verify sources, jobs, real database rows and scan freshness |
| Radar dated timeline | `src/scout-market/MarketTimeline.tsx` | Code exists; inspect UI integration and deployed SHA |
| Saver UX | `src/views/SaverView.tsx`, `src/remote-saver.tsx` | Existing capture, collections and server features; verify activation |
| Command palette | `src/ui/CommandPalette.tsx` | No need to recreate keyboard search |
| Evidence → Opportunity Room | `src/opportunity/open.ts` | Existing staged/link workflow; verify server round-trip |
| Creative treatments | `src/creative/CreativeCanvas.tsx` | Existing creative functionality is not a freeform visual canvas |
| Brand Thesis / Brand World / Creative Office | `src/marketing/StudioLanding.tsx` | Already represented in code; public commercial rollout remains on hold |
| Server-side cloud snapshot | `server/workspace-sync.ts`, `sql/009-v3-workspace-sync.sql` | Code exists; migration/flags must be verified, not assumed enabled |

Also read `docs/RECOVERY_INVENTORY.md`, `docs/SCOUT_LOOKALIKE_SOLO_DA_PLAYBOOK.md` and the master handoff before making decisions. These paths were present in the GitHub repository on 2026-10-24; re-check in each task.

## Mandatory pre-build proof (read-only first)
For each requested feature, report in at most 15 lines:
1. **User intent:** what outcome is needed, not the literal historical prompt.
2. **Existing code:** file/function/route and current commit SHA.
3. **Existing coverage:** matching tests and what they actually assert.
4. **Runtime:** shipped/deployed? identify matching deployment SHA, feature flags and known errors; otherwise say unverified.
5. **Gap:** one reproducible failure or a precise missing capability.
6. **Minimal change:** smallest additive patch preserving existing state.
7. **Risk:** source of data loss, conflict, secret exposure or duplicate behavior.
8. **Cost:** targeted file reads/tests and estimated code churn; do not process archives or run full E2E without reason.

If the gap is not supported, **stop and recommend reuse**.

## Decision and context priority
1. Current explicit owner request and confirmed decisions.
2. Live code, current database schema and deployed state (each with provenance).
3. Latest accepted product canon and dated decision ledger in owner-controlled **private** knowledge vault if accessible.
4. Earlier accepted briefs, archives and conversation exports.
5. Ideas, design mockups, historical marketing plans or AI outputs (**not authorizations**).

Do not use a past public/offering plan to override the current internal-first product boundary. A.D's lookalike Radar must find new qualified prospects, not automatically treat seed businesses as active leads. A technical merge is not aesthetic approval.

## Token and continuity budget
- Use `git status`, `git log -1`, `rg` on named files and a short diff before opening huge files.
- Read `AGENTS.md`, master handoff and this protocol; then fetch only task-relevant canon or sessions from the private vault.
- Prefer deterministic parsing, schema checks and small targeted tests to indiscriminate reasoning or broad rewrites.
- Cache/reuse verified citations and hashes in a session handoff rather than repeating analysis.
- Avoid re-reading unchanged sources; identify hashes and changes since last checkpoint.
- End each authorized task with a short changelog: starting/final SHA, files changed, tests actually run, remaining unknowns and ONE next step.
- Never claim a private vault was read unless accessible in that session. Never commit private conversation files, source exports, screenshots containing user data, access tokens or secrets to this PUBLIC repo.

## Open migration blockers (do not invent completion)
Full ChatGPT conversation export, Codex session export, legacy Sites data, device/origin-local workspaces, private GitHub knowledge-vault connection and cross-environment updates are **not yet verified as complete**. A Neon snapshot has been created, but this is not proof of tested restoration or that local workspaces are backed up. Do not enable cloud sync flags, migrate production or change Vercel aliases under this documentation task.
