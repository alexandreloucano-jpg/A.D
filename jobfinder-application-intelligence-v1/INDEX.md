# INDEX.md | Job Finder — Application Intelligence

**Status:** current implementation specification, 2026-11-15. **Scope:** the private `creative-job-finder` app; public curated portfolio is an independently deployed dependency. Read referenced files directly before making changes.

## Source map
| File | When to consult | Priority | Status |
|---|---|---|---|
| `REGLES.md` | Data, outreach, source verification and privacy constraints | P0 | Current |
| `DECISIONS.md` | Accepted product choices and open limitations | P1 | Current |
| `PROCESS.md` | Update, testing, release and rollback instructions | P1 | Current |
| `engine.mjs` | Evidence-neutral portfolio matching, offer/record identity, outreach templates | P0 for engine behaviour | Current |
| `ApplicationIntelligence.jsx` | Actual iOS-style 5-screen UI and browser-only draft persistence | P0 for UI | Current |
| `api/contacts-route.js` | Official-site contact extraction; SSRF restrictions; robots checks | P0 for server contact workflow | Current |
| `api/offer-route.js` | Importing offer descriptions only from supported ATS domains | P1 | Current |
| `routes/*.jsx` | Actual Next.js routes and step navigation | P1 | Current |
| `application-intelligence.css` | Monochrome responsive styling and A4 CV print stylesheet | P1 | Current |
| `install.cjs` | Build-time injection into the existing production app | P0 for deployment | Current |
| `tests.mjs` | Regression checks for matching/link/copy/contact verification | P1 | Current |
| Existing `app/lib/careerEvidence.js` | Canonical user CV as extracted from existing app; do not overwrite | P0 for biographical facts | Provided by upstream installer |
| Existing `app/lib/fitEngine.js` | Conservative job-fit scoring; never an ATS probability | P0 for diagnostic | Provided by upstream installer |
| Public Portfolio `app/page.jsx` | Query-param based `?selected=` curation. Separate Vercel project | P1 | Requires separate deployment |

## Required instructions for an AI collaborator

> Consulte `INDEX.md` pour identifier les documents pertinents selon ma demande. Vérifie ensuite les informations directement dans ces documents. Si une source manque ou que deux documents se contredisent, signale-le. Mets à jour cet index à chaque ajout, modification ou suppression de documents.

## Known limitations
- The CV is based on recorded declarations, not independent verification.
- The portfolio has no approved photographs yet. Do not invent them.
- No Gmail, LinkedIn or CRM sending integration: emails are drafts and links open the local email client only after the professional address is sourced.
- Browser `localStorage` is device-local. No cross-device sync or backend CRM is claimed.
- Speech Recognition depends on browser support and may not work on iOS.
- Contact research only extracts published professional addresses from the specified public official employer website. It cannot reliably identify a named recruiter without a public source; manual verification remains required.
- User must check relevance and legal basis for professional outreach; no automated LinkedIn scraping or email guessing.