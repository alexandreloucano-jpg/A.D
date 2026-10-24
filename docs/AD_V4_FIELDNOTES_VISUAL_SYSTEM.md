# A.D / FIELDNOTES V4 — Original art direction

## Intention
A.D is a private creative intelligence instrument, not a landing-page design or a generic AI dashboard. This release intentionally abandons the old ivory+Bodoni editorial style and its top navigation. New visual vocabulary:
- **Mineral graphite (#12262c)** as the navigation chassis; cool mist (#eff2f1) for the working canvas; copper signal (#d85a3c) reserved for active state and decisions
- **Utility typography**: Inter for content, compressed sans titles, monospace for evidence, chronology and data metadata; no Bodoni font loaded
- **Information architecture**: persistent vertical workspaces on desktop, native ergonomic four-destination bottom dock on iPhone, compact dark header for capture/search/settings
- **Decision-first homepage**: dark action module, truthful counters in bounded columns, sourced Radar feed and recent work in distinct space
- **Original UI**: explicit source panels, dense fieldnotes records, readable photos in Saver, clear staged treatments in CREATE; no invented photos, stock dashboards or gradients

## Preserved invariants
- Existing storage keys, backups, project IDs, receipt revisions, market data, OAuth, owner permissions, source URLs, all buttons and API routes remain unchanged.
- No migration or billing activation. Server workspace cloud flag stays OFF until previously documented rollout.
- Public Studio still has disabled intake by default and does not acquire Stripe capabilities.
- All visual changes are CSS plus nonfunctional navigation copy. New visual CSS entirely replaces import of `ad-v2.css`, but functional legacy classnames are deliberately retained for accessibility/test selectors and stable behavior.

## Acceptance
- iPhone 390×844, 390×640 and tablet 768×1024: header and bottom dock stay visible, no horizontal overflow, action module/counters/rail do not overlap, accessible focus, restoring backup still works.
- Desktop 1440×900: permanent left sidebar, right workspace, dense market source information without clipping.
- Keep critical workflows: Saver Reader, live Radar source verification, Opportunity Room, CREATE and public Studio consultation.
- Render and inspect actual screenshots before merge; fix regressions not just snapshot names.

## Technical
- `src/design-system/ad-v4-fieldnotes.css` is a new private language layered over functional base styles; `ad-v2.css` is no longer imported.
- `src/design-system/ad-v4-studio.css` visually harmonizes the public Studio without changing business logic.
- Reuses existing local Inter font distribution; removes Bodoni CSS imports rather than bundling new fonts.
- No new runtime dependency, backend service, API, analytics, or data storage.

## Release
1. Green TypeScript/Vite, Vitest and responsive Playwright QA.
2. Deploy staging in configured Vercel project `ad-saver-reader-beta` with no configuration edits.
3. Verify preview before altering the existing beta alias. No automatic roll-forward when tests fail.
