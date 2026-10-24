# A.D INDEX / 04 — Art direction reset

**Release status:** private beta candidate, not a billing or public-access launch.

## Creative rationale
A.D is a creative intelligence instrument. Its identity must express *credibility, decisions, provenance and ownership*, not a collection of generic AI cards.

This is a new visual system, not a restyle of the A.D V2 theme. The runtime no longer imports `src/design-system/ad-v2.css` or the previously used Bodoni/Inter font bundles. Old CSS remains in git only for emergency rollback; no old graphic assets or gradients are displayed in the private workspace.

## New visual grammar
- **INDEX / 04:** deep blue-black left research rail (#0f1c23) with stacked navigation and clear owner tools. On iPhone this becomes a fixed four-destination bottom dock, without duplicating routes.
- **Workspace:** pale mineral canvas (#e8ebea), dense ruled data separators, asymmetric spacious primary decision area, light sheet surfaces (#f5f6f2).
- **Typography:** system grotesk with strongly differentiated scale; monospaced provenance and dates. No serif headline or stock UI gradients.
- **Action signal:** restrained oxidized-copper (#db613f) only for validated primary actions, active states and significant cues.
- **IA and content:** source-first Radar tables, verifiable time line, Saver mosaic with actual saved media only, CREATE revision controls; no fabricated examples populated in user space.
- **Public Studio:** matching original typographic dark introduction, offer index and differentiated confidential brief; the existing legal/Turnstile gates and fallbacks are unchanged.

## Implementation notes
- New canonical stylesheets: `src/design-system/ad-index-v4.css` and `src/design-system/ad-studio-index.css`. Private UI reuses business components intentionally, **not** their original visual skin.
- Existing React views, owner auth, Neon, historical opportunities, local projects, Saver receipts, server APIs, Studio intake toggles and experimental workspace-cloud flags are untouched.
- No new NPM dependencies, stock images, font downloads, added AI calls or new background processing.
- Design must stay readable and responsive at 390×640, 390×844, 1440×900; keyboard, reduced motion and focus cues required.

## Release checks
1. Confirm `npm test`, `npm run build`, full INDEX browser suite on current commit green.
2. Review screenshots from actual browser at 390/1440 for geometric overlap, clipped action buttons and navigation.
3. Deploy to **staging** on the existing backend-configured Vercel project; do not replace the stable alias before acceptance QA.
4. Verify real `/studio`, `/`, Google login redirect and Radar backend status.
5. Promote existing alias only when stable; rollback to previous known-good deployment if necessary.
