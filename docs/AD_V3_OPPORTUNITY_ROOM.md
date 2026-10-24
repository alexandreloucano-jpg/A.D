# A.D V3 — Opportunity Room / source-to-action chain

Implementation status: release candidate; do not claim multi-device or automated outreach.

## Journey
1. Owner signs in, loads Radar and examines one sourced commercial opportunity.
2. Owner explicitly marks opportunity `saved` in Radar. Unsupported opportunities remain non-actionable.
3. Detailed opportunity GET returns the actual evidence rows (IDs, URLs, publisher, supported claim, published date). The UI Zod-validates them; no stock imagery or AI-generated facts.
4. Owner presses `Créer un dossier depuis cette opportunité`. A.D creates a local project, an immutable evidence receipt, explicit unknowns, and a `PENDING` link in a single local verified write.
5. The owner-authenticated market API saves `projectId`. If already assigned to another project, it rejects 409 rather than overwriting it. Same-id retries are idempotent.
6. A.D independently GETs the opportunity and confirms its projectId. Only then is local link marked `LINKED`. If any phase fails, the local project remains with PENDING status and may be safely retried.
7. WORK shows the original cited fact and timestamped evidence above CREATE, whose drafts remain editable and separately human-approved.

## Data safety
- `src/opportunity/model.ts` validates the immutable evidence receipt. The optional `opportunityLinks` field in Workspace v1 remains backward-compatible with saved JSON.
- No implicit NOW task, no cold outreach, no budget invention, no images unless genuinely captured.
- If Radar links to a project missing from the local device, A.D refuses to create a duplicate and asks for cloud restore.
- The owner must approve the upstream Radar opportunity first.
- Feature only creates a local Opportunity Room, with optional manual cloud snapshot from PR01 once enabled. Full server-native Work still pending.

## QA
- Vitest: provenance, pending, idempotence, orphan protection, explicit linkedAt, schema compatibility.
- Browser: full source-to-dossier handoff and second click (no duplicate) at 390px and 1440px; screenshots saved from Playwright.
- Production safety: no new server schema in PR02, no production DB changes required. Server `/api/market/.../project` existing route gains safe no-reassignment rule.

## Next: beyond PR02
- Snapshot full projects/creative decisions on server with verified data migrations when the owner approves.
- Case-specific recommendations with source ratings and source freshness.
- Creative moodboard visual manipulation and downstream deal outcomes.
