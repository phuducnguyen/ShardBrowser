# HeroV Cloud — sync service and client (spec, draft 1)

Date 2026-10-20 · Status: **draft for owner review, no code yet** · Release: 0.2.0 (self-host alpha) → 0.3.0 (Community) → 0.4.0 (Team). Context: `plans/261019-herov-gap-roadmap/editions-and-cloud-first.md`.

## 1. Goal and non-goals
Goal: an operator runs `herov-server` on their own VPS (Docker, Dokploy compose provided); several launchers sign in, and profiles, folders, proxies, bookmarks and settings follow the account, including the browser data of each profile, with the server unable to read the secrets inside it.

Non-goals for 0.2.0: real-time co-browsing, SSO, billing portal, hosted multi-tenant cloud (0.4.0+), automation sync, mobile clients.

## 2. Threat model (decides the design)
| Asset | Who must not read it | Consequence |
|---|---|---|
| Cookies, local storage, saved logins inside profile data | Server operator, anyone with the database | Encrypt on the client; server stores ciphertext |
| Proxy credentials | Same | Encrypted on the client |
| Profile config (fingerprint, names, notes) | Lower sensitivity | Encrypted too in v1 (one rule, simpler); server keeps only the plaintext fields needed for routing and filtering (section 4) |
| Account password | Server operator | argon2id hash; never the encryption key |
Assume: a stolen database dump, a curious operator, a network attacker. Out of scope: a compromised client machine.

## 3. Architecture
- **Service:** Rust, axum, tokio, sqlx (Postgres), `argon2`, `totp-rs`, `tower-http`, tracing. One binary, one Postgres, one S3-compatible bucket (MinIO in the compose file).
- **Client:** a Rust module in the launcher (`src-tauri/src/cloud/`: `client.rs` HTTP, `crypto.rs`, `sync.rs`, `queue.rs`) plus a Cloud tab in Settings. The frozen-core rule is lifted for this module only (Cloud program approved by the owner); existing modules change only to emit change events.
- **Transport:** HTTPS (JSON for metadata, signed upload/download URLs for blobs) and one WebSocket for "something changed" nudges; clients still pull deltas over HTTP.
- **Dependencies need approval at install time** (`axum`, `sqlx`, `argon2`, `chacha20poly1305`, `reqwest`, …); none installed yet.

## 4. Data model (server)
```
accounts(id uuid, email, pw_hash, totp_secret_enc, created_at)
devices(id, account_id, name, platform, pubkey, last_seen, revoked_at)
orgs(id, name, edition, seat_limit, profile_limit, license_claim)
members(org_id, account_id, role)            -- roles from 0.4.0; owner only in 0.2.0
records(org_id, kind, id, rev bigint, deleted bool,
        folder_id, tag_ids[],                 -- plaintext routing fields only
        blob bytea /* ciphertext, small */, updated_by device, updated_at)
blobs(org_id, profile_id, rev, size, sha256, s3_key)   -- profile data archives
changes(org_id, seq bigserial, kind, id, rev)          -- delta feed
audit(org_id, ts, actor, action, target)               -- fuller in 0.4.0
```
`kind` is one of: profile, folder, proxy, bookmark_set, setting, extension_ref, tag. Plaintext fields are limited to what filtering and permissions need (folder, tags); names, notes and configs sit inside `blob`.

## 5. Client-side encryption
- On first sign-in the client creates a random 256-bit **account key**. It is wrapped twice: with a key derived from the user's **passphrase** (argon2id, per-account salt) and with a **recovery code** shown once. The server stores only the wrapped copies.
- Each record: XChaCha20-Poly1305, random nonce, associated data `org_id|kind|id|rev` (binds ciphertext to its slot, blocks swapping).
- New device: sign in with password and TOTP, then enter the passphrase to unwrap the key. Losing both passphrase and recovery code loses the data; the UI states this before cloud is enabled.
- Org sharing (0.4.0): a per-org key wrapped per member with the member's device public key (X25519 sealed box). Designed now, built later; the record format carries a `key_id` from the start.
- Removing a member rotates the org key and marks old records for lazy re-encryption.

## 6. Sync protocol
- **Revision model:** the launcher already bumps `_meta.rev` on every profile write (`src-tauri/src/profile.rs`: a save landing on someone else's is refused). Cloud reuses it. A push carries `base_rev`; the server accepts only if it equals the current `rev`, else answers 409 with the server copy.
- **Pull:** `GET /v1/changes?since=<seq>` returns changed records (paged); the client applies them and advances its cursor.
- **Push:** `POST /v1/records/batch`, up to 100 records, per-record result `ok | conflict | gone`.
- **Conflicts:** no field-level merge in 0.2.0. A conflicted record keeps the local copy aside and appears in a **Conflicts** list (keep mine / keep theirs / duplicate). Delete versus edit asks for confirmation.
- **Offline queue:** append-only local queue persisted on disk, retried with backoff, survives restart.
- **Delete:** tombstone kept 30 days, then purged.

## 7. Profile data (browser state) sync
- Travels: the profile's user-data directory minus caches (cookies database, local and session storage, IndexedDB, extension state). Excluded: cache, GPU cache, crash dumps, lock files. The exact list is verified against the engine before build (open item V1).
- Packaging: tar + zstd, split into 4 MiB chunks, each chunk encrypted, uploaded to object storage with a manifest record (`blobs`). Delta upload by chunk hash so a small cookie change does not resend everything.
- **Single-writer lease:** a profile opens on one device at a time. Launch asks the server for a lease (`POST /v1/profiles/{id}/lease`, 90 s, renewed by heartbeat). Offline, launch is allowed with a warning and the next sync becomes a conflict if another device also wrote. Closing uploads, then releases the lease.
- Never sync while the profile runs; upload after close; download before launch when the server is newer.
- Size guard: warn above 500 MB per profile; storage quota per org from the edition.

## 8. Accounts and security
- Email and password (argon2id, parameters tuned on the server), TOTP optional then recommended, device list with revoke, rotating refresh tokens, 15-minute access tokens.
- Rate limits on login, signup and sync; lockout with backoff; generic error messages.
- Validate all input; request size caps; sqlx bind parameters only; closed CORS (native client); security headers on the admin page.
- Secrets (database URL, signing key, S3 keys) come from the environment, never the repo.
- Audit log of sign-ins and device changes in 0.2.0; full action audit in 0.4.0.

## 9. Editions and licence enforcement
- `orgs.license_claim` is a signed token (Ed25519, issued by a HeroV licence service for Commercial; Community self-host ships a fixed Community claim). It carries edition, profile limit, seat limit, feature flags and expiry.
- The server enforces limits on create; the client checks the claim offline for gating. **Android and iOS profiles need the Pro tier or above.**
- Expired claim: creation locked, data stays readable and exportable, nothing is deleted.
- Community licence: source-available with branding conditions (decision 6); text to be drafted and reviewed by a lawyer before publishing.

## 10. Operations
- `docker-compose.yml` with herov-server, postgres 16, minio and an optional reverse proxy; a Dokploy variant with the environment documented.
- sqlx migrations at start; backups by `pg_dump` plus bucket versioning, with a documented restore drill (part of acceptance).
- `/healthz`, `/metrics` (Prometheus text), structured JSON logs without secrets or ciphertext.
- First-run admin page creates the owner account and shows the recovery instructions.

## 11. Client UX (Settings → Cloud, profile row badges)
Sign in or add server link, passphrase setup with recovery code, device list, sync status (last sync, queue size), Conflicts list, per-profile Sync toggle (Profile defaults already carries the wording), storage use, sign out and "remove local copy". All strings en+zh+vi; tests with the IPC fake for each flow.

## 12. Work breakdown (0.2.0)
| WP | What | Size |
|---|---|---|
| C1 | `herov-server` skeleton: config, health, Postgres, migrations, auth (signup, login, TOTP, refresh, devices) | L |
| C2 | Record store, changes feed, batch push with revision checks; integration tests | L |
| C3 | Client `cloud` module: HTTP client, auth, secure token storage, crypto, key wrap and recovery | L |
| C4 | Sync engine: pull, push, offline queue, conflicts; metadata kinds (profile config, folder, proxy, bookmark, setting) | L |
| C5 | Profile data blobs: pack, chunk, encrypt, upload, download, lease | L |
| C6 | Settings → Cloud UI and conflict screen; tests; vi strings | M |
| C7 | Compose files, docs, backup and restore drill, load test (50 profiles x 3 devices) | M |
Order: C1 → C2 → C3 → C4 → C6 → C5 → C7. Each WP lands as small commits with tests.

## 13. Acceptance for 0.2.0
- Two machines edit the same profile set; an offline edit merges after reconnect; a real conflict shows in the list and resolves.
- Cookies logged in on machine A are present on machine B after A closes the profile.
- A database dump holds no readable cookie, name or proxy credential (a test greps the dump for known strings).
- The server rebuilt from backup; clients resume without data loss.
- A revoked device can no longer pull; a wrong passphrase cannot decrypt.

## 14. Open items
- V1: which files of the profile data directory are safe and needed; confirm with the engine.
- V2: mobile-OS profiles store data the same way (expected yes).
- Hosted Commercial cloud: same binary, multi-tenant `orgs`; choose the provider before 0.4.0.
- Offer a "device-only key" (no recovery) for users who prefer it?
- Licence service: separate tiny service or part of the website backend?
