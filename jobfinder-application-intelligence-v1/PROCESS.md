# PROCESS | Build and release

1. Read INDEX.md, REGLES.md, DECISIONS.md. Confirm the target `creative-job-finder` project and existing production ID before changing settings.
2. Run the pinned `jobfinder-intelligence-v1` installer on the original deployment source; it materialises `app/lib/careerEvidence.js` and `app/lib/fitEngine.js`.
3. Run this package's `install.cjs`. It fails closed on unknown layout, RadarBridge or entrypoint anchors. It creates `/intelligence` stages, contact and offer research routes, and upgrades Radar handoff.
4. Run `node tests/application-intelligence.test.mjs && node tests/application-regressions.test.mjs && node tests/contact-source.test.mjs && npm run build`.
5. Deploy as a preview, inspect Vercel logs, test all five page routes, verify SSO protection and negative HTTP cases. Do not treat deployed routes as proof of all interactions without browser testing.
6. Confirm the independently deployed public portfolio implements `?selected=` before telling the user their curated links work.
7. Deploy/promote the validated release to production. Check alias and recent errors. Keep the prior deployment for rollback.
8. Verify with real job and source-proven contact information before any external outreach.