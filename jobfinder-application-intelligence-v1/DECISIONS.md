# DECISIONS | Application Intelligence

2026-11-15 — User approved a five-stage, voice-friendly, application-specific workflow: one opportunity → tailored CV → researched HR and hiring manager → relevant portfolio → cold outreach.

2026-11-15 — Deliver an initial functional private Vercel release without requiring external paid API keys. Keep official recruitment data and verified professional address rules. No guesses, automated sending or third-party LinkedIn scraping.

2026-11-15 — Selected projects are shared through a URL on the separate public portfolio with a strictly validated `selected` query parameter. The employer-specific CV, notes and contact research remain private.

2026-11-15 — Multi-application browser storage implemented as MVP; server sync and email/CRM connectors are subsequent phases rather than falsely presented as active.

2026-11-15 — Remote QA patch v1.1: prevent duplicate empty-draft IDs; retain immutable record IDs when editing; suppress unsupported CV preselection; preserve user-supplied job relevance line; classify source-page emails as published rather than verified persons; migrate legacy records; reject private IPs and off-domain redirects; check robots.txt before parsing visible text and mailto links.