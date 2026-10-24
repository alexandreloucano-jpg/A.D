# A.D CREATE — Creative Canvas (Ophelia-inspired product principles)
Revision: 2026-10-24. Feature branch only. No production deployment.

## Purpose
Reuse existing Project dossiers and Saver sources to compose, iterate, approve and export two original creative treatments. Do not copy third-party proprietary interface assets, nor pretend these drafts are real client instructions.

## Delivered implementation
- Projects: editable CREATE section with brief, genuine saved references, two directions (thesis, visual grammar, production), source dates and image thumbnails only for direct saved media links.
- Structured offline creative templates are clearly labelled non-AI. Two original directions are manually editable and never approved automatically.
- Authenticated GET/POST /api/creative/draft (existing provider and quota only), owner session, CSRF for POST, bounded prompt and strict response validation. Opt-in checkbox required before posting confidential briefs and notes.
- Human saves append revisions to an optional creativeBoards field in the existing local v1 Workspace format; old backups remain readable. Explicit choice A/B appends another revision and preserves history.
- Export Markdown treatment with exact source URLs, unknowns, content provenance and actual human approval state.
- Any third-party generated media is imported via Saver with ownership/usage-rights checks. No external publication, financial commitment or secret keys in frontend.

## Important restrictions
- Board versions are LOCAL on the current device, NOT cloud-synced or multi-tenant. The existing Backup/Restore includes these boards. Back up before changing device.
- No new paid external AI/media provider. If AD_AI_ENABLED and a provider are not configured, the button is disabled and the editor still works. Provider costs are bounded by existing quota when enabled.
- This is not a Figma canvas, drag/drop graph or video editor. It does not itself prove DA quality.
- Do not expose confidential client data to a third-party model without explicit rights, client approval and user opt-in.
- This is a draft composition feature, not a signed client agreement.

## Tests and acceptance
1. Backward-compatible workspace schema, full backup/import with versioned boards.
2. Dossier → Saver source → select → A/B treatments → save v1 → refresh → approve direction → export v2.
3. Real browser screenshots at 390 and 1440 px, no horizontal overflow.
4. Disconnected AI must show unavailable, not pretend a model generated output.
5. No source fabrication, auto-email, contract signature or unapproved publication.

## Next paid-client milestone
Attach board to an owner-authorized server Deal Room with audit, source rights, real-cost model routing and staged publication approval. Only after recurring creative production demonstrates value, consider media-provider APIs and structured delivery into Figma.