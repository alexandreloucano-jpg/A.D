# A.D V3 / Lightweight interaction release

## Product purpose
Improve usefulness before launch: one keyboard/mobile search across the existing private workspace, real-media visual Saver browse, and a dated, sourced Radar timeline. Inspired by the interaction patterns of beUI, reimplemented as original components within existing A.D design tokens.

## Implementation
- `src/ui/CommandPalette.tsx`: Ctrl+K / Cmd+K, mobile header action, keyboard-selectable results for existing dossiers, local + authenticated Saver references, manual signals and navigation. Radar searches reuse the existing Radar view. No automated contact, no new backend.
- `src/scout-market/MarketTimeline.tsx`: genuine publication, collection, reported event and human decision times from the selected Radar company. Differentiates reports vs observation vs decisions; accessible source link. Native horizontal swipe, no synthetic dates.
- `src/views/SaverView.tsx`: original CSS column masonry with the existing media renderer and receipts, all sources preserved. User may switch to the original responsive grid. Renders 30 records initially, then 24 more when approaching the bottom, with explicit Load more fallback. No invented thumbnails, no background deletion or sorting changes to stored records.

## Performance and accessibility
No new runtime npm dependencies or animation frameworks. Uses existing fonts and CSS; avoids arbitrary glass/3D motion. Focusable command results, arrow key navigation, ESC close, readable mobile text, reduced-motion CSS and touch scrolling. No network calls added by any interaction.

## Smoke test
1. Open A.D on iPhone and press search icon; find a dossier, reference, and navigate to RADAR. On desktop press Cmd+K/Ctrl+K and use arrows/Enter/ESC.
2. Open Saver, select Mosaïque, verify only actual source imagery appears; switch back to Grille, open a reference, and check its original URL/receipt.
3. Open a Radar company dossier and verify the sequence of real source/collection/event and decision dates. Follow its source URL. Check the absence of fabricated dates.
4. Confirm keyboard focus and horizontal overflow at 390 and 1440 pixels.

## Release
Merge only after both CI `Validate A.D` and `A.D Interaction Suite` pass on the current commit. Deploy to existing backend-configured Vercel project staging first; verify URL and auth then point the existing beta alias. Keep cloud snapshot sync feature flags unchanged OFF and do not touch Neon migrations or user data.
