A.D — Editorial frontend refinement
Source: codex/ad-rebuild @ 8947a4b59f656d1e3a3e03ee58b109a2d8cb5482

Extract the ZIP and open index.html for the screenshot gallery.
Open AD-preview.html for the actual interactive production bundle (no installation).
The preview starts empty; screenshots use isolated QA inputs, not historical Sites data.
If your browser restricts local HTML, serve this folder over HTTP locally.
The same standalone artifact was validated over local HTTP: four views and save offline after loading, UUID readback after reload. Direct file:// opening was blocked by cloud browser policy and remains unverified.

18 Vitest tests; 22 Playwright scenarios; TypeScript and production build passed.
Final affected visual scenarios rerun after project-ledger width correction.
Screenshots: all four views 390x844 / 1440x900, NOW/project detail, compact 390x640, empty/loading/error states.
Media preview uses only saved direct image URLs. QA successful media loads the original provided architectural SVG; 404 cases are isolated test responses.
Storage schema, URL/history and LATER/NOW/KILL contracts preserved. Grok disconnected; Sites V66 untouched.
