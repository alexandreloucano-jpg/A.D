# Vercel, private Saver and Grok Scout

This extends the existing `codex/ad-rebuild` frontend. It does not replace the frontend, deploy to Sites, or import historical Sites records.

## Implemented

- `vercel.json`: Vite, `npm run build`, `dist`, private `/api/*` routes.
- `vercel-gateway.json`: a separate Vercel project with only the gateway handler. Use `--local-config vercel-gateway.json`; never relink the app project as the gateway.
- PostgreSQL Saver uses the existing reference schema. UUIDs survive migration, conflicting UUIDs are rejected, and inserts are read back. SQL is in `sql/001-private-saver.sql`; `npm run db:migrate` applies it to an independent Neon database only.
- GitHub owner login is pinned to the repository owner's numeric account ID `340639438`. No global GitHub CLI or Sites token is reused for application login. Sessions are opaque, hashed at rest, expire, use Secure/HttpOnly host cookies, and mutations require an origin-bound CSRF token.
- The application can view and write server references after login, while retaining local projects, signals and references. Migration first downloads a local backup and copies in batches, preserving UUIDs and refusing conflicts. No local data is deleted. A pending reference receipt survives page reload so an uncertain server response can be retried with the same UUID.
- Gateway tools are exactly `get_saved_inspiration`, `get_saver_capture`, `save_inspiration_reference`, `save_reference_batch`. URL fetches, tasks, projects and global MCP are not exposed. Writes require explicit `owner_approved: true`; batch max 20. Grok-origin receipts are read back from the same database as the private application API.
- OAuth authorization code, S256 PKCE, confidential per-client credentials, exact registered/allowlisted HTTPS callbacks, explicit owner consent, strict resource binding to `<gateway-origin>/mcp`, expiring one-use codes, opaque expiring access tokens, token and client revocation. No dynamic client registration, wildcard callbacks, token passthrough or broad MCP access.
- Rate limits and audit metadata are PostgreSQL records, not process memory. Audit rows exclude content, tokens, credentials and source URLs.

## Provisioning requirements (not silently substituted)

Vercel CLI must first be authenticated to an authorized account/scope. The attached Vercel plugin being installed is not proof that CLI credentials exist. At inspection time no `VERCEL_TOKEN`, CLI login, accessible Vercel tool or local linked project was available. The device authorization attempt expired without approval. GitHub repository access and branch were verified. GitHub deployments list was empty; the integration denied access to repository Actions secrets and hooks (403). Those APIs are not required for source pushes or CLI deployment and their permissions were not widened.

Create two independent Vercel projects from `alexandreloucano-jpg/A.D`, branch `codex/ad-rebuild`, leaving ChatGPT Sites unchanged. Reserve stable HTTPS origins, provision an independent Neon PostgreSQL database, and set server-only configuration through the deployment secret store:

- Both: `DATABASE_URL`, `APP_ORIGIN`, `GATEWAY_ORIGIN`, `AD_SERVICE_ROLE` (`app` or `gateway`). Origins must be HTTPS origins with no trailing slash or path.
- App: dedicated `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`; callback is `<APP_ORIGIN>/api/auth/callback`. The owner must consent to this application login.
- Both: `SCOUT_REDIRECT_URIS` with the exact OAuth callback displayed by the real Grok configuration. Do not infer callbacks from example domains in tests.

No secret belongs in `VITE_*`, source control or chat. `.env.example` contains names only. Missing configuration fails closed (503), with local data retained. No database connection, production OAuth client or Grok client has been claimed provisioned by this change.

After owner login, use Settings → Saver privé → Grok Scout to create the dedicated client and see its credentials in the private browser only. Set the real MCP endpoint in Grok, complete owner consent, then save an explicitly approved reference from Grok. Verify its returned UUID with `get_saver_capture` and the app receipt. A manually invoked ChatGPT connector or isolated test UUID is not a Grok-origin end-to-end proof.

## Validation

`npm test` includes SQL-backed PgLite integration tests for owner isolation, wrong-resource tokens, PKCE, replay, expiration, consent, allowlists, tool denial, durable quotas, revocation, conflicts, partial migration and uncertain read-back. These use isolated synthetic data, not a deployed database.

The existing Chromium suite verifies the four real frontend views at 390 and 1440px, plus compact widths, keyboard, history, LATER/NOW/KILL, drafts and screenshots. Additional browser contract tests cover private Saver read-back and retry after reload with an unchanged UUID; their API responses are explicit fixtures, not live service or Grok evidence.

A successful build or local browser run does not prove Vercel deployment, production authentication, historical import or a Grok connection. Those require actual provider access and returned deployment/UUID receipts.
