# Saver integration — 15 October 2026

## Verified source of truth

The authenticated Sandro `get_saver_social_status` returned X configured=false, connected=false and imports=[]. Its recovered code includes direct PKCE and a separate optional Nango transport. None is active for this owner. Existing Sandro Sites/D1/R2 data, secrets, services and audience are unchanged.

New beta references, collections, annotations and X connection state use the existing beta Neon database. No second database or historical import is created. The app remains the existing React/Vite checkout on codex/ad-rebuild.

## X

Routes: /api/x/status, connect, callback, sync, automatic and disconnect. Official authorization origin x.com; fixed API origin api.x.com. Only bookmark.read, tweet.read, users.read, offline.access. PKCE S256, one-use encrypted state bound to the owner session and browser, AES-256-GCM tokens bound to the owner. Account ID comes from /2/users/me. Secrets never enter the frontend.

Sync always checks the newest page, independently resumes an outstanding historical cursor and processes at most two pages/100 posts. It uses persistent leases, backoff, quotas, token refresh and verified source/UUID readback. Stable IDs and canonical X status matching preserve existing captures. Source snapshots are separate from human content; manual groups and annotations are untouched. Post time is not bookmark time. Removing a bookmark never deletes a Saver reference.

The optional foreground synchronization runs while Saver is open after explicit enablement, at most once per 30 minutes. There is no deployed background scheduler. No API budget or account plan is changed. Without developer credentials and owner consent, status explicitly reports unavailable. The owner confirmed having no developer X access, so real X authorization/import was not possible.

## MCP

The historical Sites gateway returned an authenticated internal error; its Worker logs showed HTTP 502. Its version was inspected, but its source archive could not be downloaded through the available file tool. It remains unchanged and connected to historical Sites, not beta Neon.

The dedicated gateway uses the existing server/service.ts and the same beta database through a separate PostgreSQL role. RLS excludes project references, QA, other owners, sessions, X tokens, collections, document originals, annotations and Taste. The app remains the table owner. The role can access only the dedicated resource's client/code/token records, limited Saver records, quota counters and permitted audit writes. It cannot delete references or read other tables.

Only four tools are exposed. OAuth is resource bound, PKCE required, client secret hashed, tokens opaque and hashed, persistent limits/audits, revocation checked per request. Global tools are rejected. The owner explicitly authorized removing Vercel SSO only from the dedicated gateway project; application SSO remains unchanged. No global MCP credentials are reused.

/api/scout/check/start is an owner/CSRF protected diagnostic. It creates an encrypted temporary client, requires explicit browser OAuth consent, exchanges the code through the actual remote gateway, checks tools/read/global denial, then removes the token and revokes the client. It creates no references. The result explicitly states grokConnected=false. A real consumer Grok connection still requires its actual registered callback and consent; no callback is guessed.

## Reader and AI

HTTPS article/plain-text/PDF extraction is explicit and owner authenticated. Every DNS result must be public; the selected address is pinned to the TLS request, with hostname validation retained. Redirects are revalidated. No cookies, provider login, HTML scripts or external subresources are executed. Total download/DNS deadlines, 5 MB, 60,000 HTML elements, 50 PDF pages and 200,000 characters are bounded. Protected sources and image-only PDFs remain explicit errors. No OCR is invented.

Original bytes/hash/URL are immutable owner-only sidecars. Extracted text goes through the existing document version/CAS model. Previous text snapshots and exact human anchors are retained. Historical versions and originals are accessible only to the owner. Source X text and annotation words participate in Saver search.

Configured AI requires AD_AI_ENABLED=1, AD_AI_PROVIDER and the corresponding server key plus explicit model. There is no default or fallback provider. Calls happen on explicit user request, with persistent daily/minute limits and no tool execution. Reader answers require exact citations to supplied paragraphs; unverified citations are rejected. Grounded classification proposals require quoted sources and rationale, and never create groups until human approval. Provider/model/time provenance is retained. Taste exposes source, human annotations and AI interpretations separately and never updates confirmed preferences or creates tasks. This is beta reference context, not an import or synchronization of historical Taste.

No AI provider was configured in the inspected beta. Provider tests use fixtures and are not claims of real model output. Gloss at 54b13b8882d8a109132c5b2045acd6b45628563d had no established license in the inspected tree; no Gloss code/assets were copied. Extraction uses separately licensed Mozilla Readability, LinkeDOM and PDF.js packages.

## Deployment and rollback

Application project: ad-saver-reader-beta. Gateway service: ad-saver-scout-gateway. Both use the existing beta database; only the app has its owner credentials. scripts/stage-scout.mjs is packaging of the existing repository, not another frontend. Do not deploy the app vercel.json as the gateway configuration.

sql/003-scout-least-privilege.sql is isolated-beta only, additive access control; no historical Sites migrations. scripts/provision-scout-beta.mjs refuses another project or existing role/key rotation. Ignored .env.scout-provisioned.local is private recovery material and must never be published. Keep the existing app database owner connection for rollback; changing the app to the restricted role would break owner operations. Revoke the gateway login/project if needed without deleting Saver data.

See tests/x.test.ts, extraction.test.ts, ai.test.ts, scout-role.test.ts, scout-check.test.ts and browser reader-integration tests. Distinguish provider fixtures, real Neon verification, public deployed boundary checks and uncompleted external X/Grok consent.
