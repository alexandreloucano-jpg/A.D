# A.D V3 / DATA FOUNDATION — Release plan

Private owner workspace only. Adds cross-device continuity for personal workspace data without granting Saver/MCP gateway access.

## Included
- `sql/009-v3-workspace-sync.sql`: additive owner-scoped cloud snapshot head and immutable revisions history.
- `GET/POST /api/workspace/snapshot`: owner session required; CSRF + exact origin on writes, validated v1 Workspace JSON, 8 MB limit, quota, atomic compare-and-swap, immutable history and read-back check.
- Explicit first upload/restore UI in Account Settings, gated by `VITE_AD_WORKSPACE_SYNC_UI=1`. Server route gated by `AD_WORKSPACE_SYNC_ENABLED=1`. Both remain OFF until an additive migration is validated and a current backup exists.
- After a verified first upload or explicit restore, later edits from that browser upload automatically with compare-and-swap and independent read-back. A changed cloud revision stops sync and preserves both copies; another device must explicitly restore first. No automatic cloud-to-local overwrite. Empty datasets cannot replace existing snapshots. Saver cloud data remains independent.
- PGlite tests cover first write, cross-device stale write refusal, immutable versions, credentials/CSRF/Origin, empty-wipe and feature gate.

## Release order / rollback
1. Export a local JSON backup and preserve a current Neon backup; note the workspace revision.
2. Run full tests and isolated database migration. Inspect privileges and read-back. Do not apply to production until a verified current backup exists.
3. Set the server flag ON, then the UI flag ON for the authenticated private origin. Keep the public Studio outside this route.
4. Test iPhone upload, JSON export, an automatic edit upload, and explicit restore on a second device. Verify IDs and versions; stale writes must return 409.
5. On error, disable both flags. Server history remains intact. Never overwrite local data automatically.

The first cloud copy is a deliberate owner action because the browser's local data is not available to the server until transferred. Continuous sync starts after its server read-back is confirmed.
