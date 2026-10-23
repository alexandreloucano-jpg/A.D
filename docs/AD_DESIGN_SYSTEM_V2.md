# A.D / DESIGN SYSTEM 2.0 — EDITORIAL WORKSPACE
Revision: 2026-10-23
Status: implemented as opt-in visual layer in src/design-system/ad-v2.css; pending code review and responsive screenshot sign-off. No private business data or algorithms changed.

## Art direction
Proposition: a private creative intelligence desk with the editorial restraint of an independent fashion publication and the legibility of professional financial software.

Do not imitate Bloomberg, AD Magazine, Vogue, Revolut or Apple directly. Borrow principles: clarity, density by context, generous blank space, precise grids, quiet states, and a single primary action. Avoid AI-appearing decorative gradients, faux luxury textures, stock hero assets, excessive status badges and generic motivational copy.

## Tokens
Paper #F7F6F2, Ink #191919, Muted #6B6964, Rule #D8D6D1, Hover #EFEDE7, White surface #FFFEFA.
No gradients in the private workspace. Use semantic warning/success accents only when required by a real status.
Bodoni Moda (already installed locally) for editorial headings and the wordmark. Inter (already installed locally) for operational text, financial values, controls and body.
General scale: body 15px/1.7, nav 12px/1.4, label 10-11px/1.5, editorial title 50-82px desktop (if space allows), 49-69px compact. Never set input text below 16px on iOS.
Desktop horizontal margins: 64px on large screens (via responsive clamp), tablet 25px, mobile 20px. Content max width and line length enforced by content components. Regular 1px separators. Inputs/buttons predominantly 3px radius, not pill-everywhere. Minimum target 44px.

## Priority designs
TODAY / Accueil: ONE stored user-approved NOW action or an honest empty state. Main visible action opens existing project. Counts from real browser workspace data, never fake revenue, funding or "live AI". Sidebar shows actual recent projects and latest reference, a link opens the existing Radar. If backend Radar is disabled, do not show an invented signal.
RADAR / Explorer: source + event date + commercial meaning. Prefer ledger-like findings over floating cards. Preserve verification and "unknown" labels. Make it clear when the scanner is disabled.
PROJECTS / Dossiers: a typographic list (ledger), exact action status NOW/LATER/KILL preserved; no pseudo-value metrics.
SAVER / TASTE: the only genuinely image-rich collection, because images are source materials; do not fabricate thumbnails for pages without accessible images. Keep capture, reading and provenance functioning.

## Figma handoff
Create one Figma page for Foundations, one for Components and one for Screens. Design frames: 1440×900 and 390×844. Include a third 390×640 compact validation state; source snapshot fallback with 0 data; populated with two actual test fixtures on a private QA instance only.
Components: navigation current, primary/secondary action, project list row, evidence row, reference/media card, decision title, source-status line, content header, form input, modal, toast, empty/loading/error/offline, mobile bottom nav. All focus and keyboard variants.
Design is complete when a user can identify the next action in under 5 seconds AND interpret evidence/source/unknown without opening a tooltip.

## Interaction rules
Never cover primary CTA with mobile fixed navigation; preserve safe-area inset and scrolling. 44px touch area, 2px focus outline. Avoid hover-dependent discovery. Respect prefers-reduced-motion. Don't alter localStorage keys or backend policy for a visual design task. Source status, workflow approvals and missing finances have their own explicit labels.

## Shipping acceptance
- npm test and npm run build must succeed.
- Playwright 390, 390×640 and 1440: no horizontal overflow, nav reachable, one H1 per screen, dialogs open/close, capture/save persists, Radar provenance remains accessible.
- No screenshot from a QA fixture presented as live customer data.
- Reviewer compares rendered frames against these tokens; only then merge and promote preview/production under owner approval.
- Rollback: revert the stylesheet import in src/main.tsx and the associated HomeView change. No data migration.
