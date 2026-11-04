# A.D / Launch Thesis

Status: implemented on an isolated review branch only. Private creative project workflow, not a public marketing or publishing feature.

## Purpose

Research and assemble a product launch narrative from five independently editable layers:
1. Audience, tension and provable differentiation.
2. Demonstration and a claimed proof URL, which must be verified by a human.
3. Five alternative opening hooks, not an automated posting queue.
4. Relevant connections for manual, consensual outreach. No scraping or mass-message automation.
5. One conversion criterion specified before launch and actual results entered afterwards.

This is an **editorial checklist**, not a scientific formula for virality. A filled-out document is ready for review, not validated for publication. Thunder, Phoenix and SimClusters are names of retrieval/ranking components in the public X algorithm code, not a measurable guarantee that a post will be recommended.

## Implementation

- src/creative/launch.ts: schema, default, editorial checklist, Markdown export.
- src/creative/LaunchPlanner.tsx and launch.css: collapsible module inside the existing Projects workspace.
- src/views/ProjectsView.tsx: project context, no extra navigation page.
- src/domain.ts: optional launchPlans attached to one project UUID, uniqueness and referential integrity enforced by the existing Zod workspace. Old backups remain readable and new backups include the plans.
- tests/launch-planner.test.ts: schema, malicious URLs, gate behavior, backup roundtrip, orphan and duplicate protection.

**Safety and operating constraints:** no third-party API, artificial engagement, automatic messaging, auto-posting, payment, metrics invention, unverifiable success claims or live X API connection. The draft only persists in the current browser workspace and its explicit JSON backup. It is not automatically synchronized across devices.

## Source and limitations

User supplied a November 2026 screenshot titled "A Unified Framework for Engineered Virality of Product Launches on X". Its formulas and 90%/30,000-view claim are **not demonstrated scientific results**. Treat the framework as a hypothesis to test using truthful claims and observed outcomes.

Reference code for X recommendation retrieval: https://github.com/xai-org/x-algorithm.

## Validation

In isolated development checkout: 29 targeted unit tests passed (launch, domain, creative); TypeScript and Vite production build passed. Full preexisting unit suite had two environment failures due missing Chromium binary, unrelated to this feature. Browser screenshots at 390px and 1440px are **not yet verified**. No change to live A.D. beta alias was made.
