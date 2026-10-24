# A.D V3 / DATA FOUNDATION — Release plan

Private owner workspace only. Implements the first cloud continuity seam without changing existing local-first semantics or granting Saver/MCP gateway access.

## Included
- `sql/009-v3-workspace-sync.sql`: additive owner-scoped cloud snapshot head and immutable revisions history. NOT applied to production as part of GitHub commit.
- `GET/POST /api/workspace/snapshot`: owner session required; CSRF + exact origin on writes, validated v1 Workspace JSON, 8 MB limit, quota, atomic compare-and-swap, immutable history and read-back check.
- Explicit, opt-in cloud upload/restore UI in Account Settings, gated by `VITE_AD_WORKSPACE_SYNC_UI=1`. Server route gated by `AD_WORKSPACE_SYNC_ENABLED=1`. Both OFF by default.
- No automatic upload, no cloud-to-local overwrite without prior backup and confirmation. Empty dataset blocked from replacing an existing snapshot. Existing Saver cloud data untouched.
- PGlite tests for first write, cross-device stale write refusal, immutable versions, credentials/CSRF/Origin, empty-wipe and feature gate.

## Release order / rollback
1. Preserve the existing local JSON and Neon backup; confirm user can download and re-import, and note their exact workspace revision.
2. Run full tests and isolated database migration. Apply additive migration to a verified Neon branch; inspect table privileges and read-back.
3. Set server flag ON, then UI flag ON for authenticated private origin, no public Studio exposure.
4. Test iPhone > upload > download JSON > second device cloud GET > explicit restore > verify ID/versions; attempt stale update from first device and require 409.
5. On error disable both flags; server history remains intact. Never automatically replace local data. Periodic automatic sync not yet implemented.

## Why this is deliberately narrow
Manual cloud backup is the safe prerequisite to full multi-device synchronization; it is not itself automatic background synchronization. The next PR links a sourced Radar opportunity to a local dossier and its evidence, before moving cross-device automation into production.
