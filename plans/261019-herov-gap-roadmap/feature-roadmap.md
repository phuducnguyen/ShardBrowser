# HeroV — feature build roadmap (0.2.0 → 0.7.0)

Date 2026-10-19 · Status: **proposed** · Companion of [release-plan.md](release-plan.md) (versions, gates, schedule) and [gap-analysis.md](gap-analysis.md) (why each item exists).
This file is the build breakdown: for every work package (WP) the backend commands, the UI, the tests and the acceptance check. Sizes are S ≤ 2 days, M ≤ 1 week, L ≤ 2 weeks, for one developer.

Rules for every WP
- Backend changes (`src-tauri/`) are listed explicitly and approved one by one; the owner approved the Profile-defaults file in 0.1.0-ui.1, nothing else yet.
- A WP is done when its tests exist and pass, the i18n keys are en+zh+vi, light and dark screenshots are reviewed, and the release gates in `release-plan.md` section 3 hold.
- New dependencies are named here and need approval before install (marked **dep?**).

## 0.2.0 — Profile workflow
| WP | What | Backend | UI | Tests / acceptance | Size |
|---|---|---|---|---|---|
| 2.1 | **Tags** | `ProfileMeta.tags: Vec<String>` (serde default, old files load), `profile_set_tags(ids, add, remove)`, tags in `profile_list` | Tag chips on Overview and quick edit; tag filter in Filters; tag column; `#tag` in search | Old profile without tags loads; add/remove on 100 profiles in one call; filter and search by tag | M |
| 2.2 | **Create N profiles** | none (loop of `profile_save`) | "New profile" split button → "Create several": count (1–500), name pattern `{prefix}-{nn}`, folder, proxy mode, device from Profile defaults, optional cookie file per profile | 200 created, names unique, each device differs inside the filter, cancel mid-run keeps what exists | M |
| 2.3 | **Task centre** | none | Store `useTasks` (queue, progress, per-item error, cancel, retry) + panel from the rail; bulk launch, stop, check proxies, import, create-N report through it | Cancel stops new items; failed items listed with the reason and retryable; a closed panel keeps running | M |
| 2.4 | **Bulk cookie import** | none (`cookies_import` per profile) | Choose many files; match by file name = profile name or id; preview table; apply | 20 files → 20 profiles; unmatched files listed; running profile refused with the existing message | S |
| 2.5 | **Proxy assignment and lists** | none | Distribute dialog gets "in listed order / random"; copy IDs (row menu and bulk bar); search by id, folder, tag; column chooser (saved per user in local storage); export proxy list | Order preserved; export round-trips through import; hidden columns persist | M |
| 2.6 | **Activity history** | Append-only `activity/<profile-id>.jsonl` written by `launch`/`stop`; `profile_activity(id, limit)` (**core edit**: `launch.rs`, `process.rs`) | "History" sheet per profile: launch, stop, proxy changes, folder moves, with IP at launch | Entry per launch/stop; file rotates at 1 MB; missing file reads as empty | M |
| 2.7 | **Backup and restore** | `profile_backup(id)` (zip of the profile folder without caches into `backups/`), `profile_backups(id)`, `profile_restore(id, file)` (stopped profile only) | "Backups" sheet: create, list with size/date, restore with confirm; auto backup before delete optional | Restore is byte-identical for kept files; restoring a running profile is refused; restore leaves a safety copy | L |
| 2.8 | **Undo** | none | Toast with Undo for: move to trash (calls `trash_restore`), remove from folder, unassign proxy, tag change | Undo within 10 s restores; after that the toast just disappears | S |
| 2.9 | **Bookmarks and misc** | `write_text_file(path, text)` (small, path from a save dialog) for exports | Bookmarks HTML import (parse in UI, save through `bookmark_save`), duplicate a bookmark set, force close (uses `process_kill`) with confirm | Chrome-style bookmarks HTML with folders imports; duplicate keeps order | M |
| 2.10 | **Engine switches check** | Research first, then maybe `extra_args` presets | Verify in the engine which switches exist for start URLs, restore session, mute audio, hide images, clear cache on exit; only then add toggles to Profile defaults | A switch is added only if the engine honours it, shown by a test launch | S (research) |
Order: 2.3 → 2.8 → 2.1 → 2.2 → 2.5 → 2.4 → 2.9 → 2.6 → 2.7 → 2.10. Dependencies: 2.2 and 2.4 report through 2.3.

## 0.3.0 — Fingerprint quality
| WP | What | Backend | UI / tools | Acceptance | Size |
|---|---|---|---|---|---|
| 3.1 | **Collector page** | none | `tools/fingerprint-collector/collect.html`: static page that dumps navigator, client hints, screen, WebGL (parameters, extensions, precision), WebGPU, audio, battery, media devices as JSON in the library's shape; no network, no storage | Runs in current Chrome; output validates with `check:fingerprints` | M |
| 3.2 | **Converter** | none | `scripts/fp-from-capture.mjs`: capture → library entry (UA from engine version, hints, noise skeleton and TLS from a donor of the same platform) with friendly id and label | Entry passes the validator; unknown fields refuse rather than guess | M |
| 3.3 | **Capture source** | none | Decision: rented real devices, contacts via a link, or none (Android stays experimental). A link page needs the VPS (0.6) or a one-off static host | At least 10 distinct real devices captured | L (calendar time) |
| 3.4 | **CI gate** | none | `check:fingerprints` and `creep-check` on a fixed sample run before each release (manual script until the engine can run in CI) | Release notes record the result | S |
| 3.5 | **Library hygiene** | none | Friendly labels written into files, pixel ratios normalised, Android entries tagged `experimental` until CLEAN; health badge on profiles (consistency check at open) | Badge shows for the 50 current Android entries today | M |
| 3.6 | **Re-roll identity** | none (new fingerprint pick + seeds) | "Re-roll device" in the profile menu with a warning that sites will see a new device | Confirm required; cookies kept; device changes | S |
| 3.7 | **Engine train script** | none | `scripts/engine-train.mjs`: new Chrome major → update engine, rewrite UA/hint versions in the library, run validator and creep-check, write notes draft | One full dry run | M |
| 3.8 | **Windows memory check** | none | Verify what the engine reports for 16/32 GB entries; fix the data if capped | Test launch result recorded | S |

## 0.4.0 — Professional UX
| WP | What | Notes |
|---|---|---|
| 4.1 | Command palette (Ctrl+K) | Own component on `FormDialog`; actions registered by each window (new profile, go to, launch selected, theme); fuzzy match; tests for keyboard flow |
| 4.2 | Shortcut registry and sheet (`?`) | One module; no clashes with browser keys; documented in the sheet |
| 4.3 | Notification centre | Store plus panel; replaces toasts for update, engine, long jobs, dead proxies |
| 4.4 | Virtualised tables | **dep?** `@tanstack/react-virtual`; keep selection, shift-range and drag-and-drop tests green; 10,000-row budget test |
| 4.5 | Saved views, density, column widths | Local storage first; moves to the user's cloud settings in 0.6 |
| 4.6 | Onboarding checklist | Engine ready → first profile → first proxy → first launch; dismissible; state kept |
| 4.7 | Accessibility pass | Keyboard-only run of every flow, AA contrast both themes, reduced motion, names for icon buttons |
| 4.8 | Visual regression | Headless-Chrome screenshot suite per window (the preview recipe already works); diff threshold; stored in `tests/visual/` |
| 4.9 | Update dialog, crash report, window memory | Own update feed; opt-in crash report with "copy diagnostics"; window plugin or Rust command for size/position |

## 0.5.0 — Automation (after the hold)
| WP | What | Backend | Size |
|---|---|---|---|
| 5.1 | Port `pages/automation` and widgets to the HeroV frame | none | L |
| 5.2 | Schedule (once, interval, cron) | scheduler in the launcher, persisted file, survives restart | L |
| 5.3 | Recorder (mouse/keyboard speed kept) | CDP recording command | L |
| 5.4 | Templates, variables, if/loop/while, read-spreadsheet, multi-export | extend runner blocks | L |
| 5.5 | Synchronizer panel port, window layout, cookie sync | uses `sync_*` | M |
Acceptance: a recorded script replays on 20 profiles; a schedule survives a restart; export/import round-trips.

## 0.6.0 — Cloud alpha (own spec first)
| Part | Choice to confirm in the spec |
|---|---|
| Service | One API service (Rust axum or Node Fastify, owner's pick), Postgres, S3-compatible object storage for profile bundles, WebSocket for presence; one Dokploy compose file |
| Accounts | Email + password (argon2id), TOTP 2FA, device list with revoke, session tokens with refresh |
| Sync model | Per-record revisions (`rev` already exists on profiles), last-writer-wins with a visible conflict list, deltas by revision, offline queue |
| Privacy | Profile data and cookies encrypted on the client (libsodium secretbox, key derived from a passphrase the server never sees); server stores ciphertext and metadata only |
| Client | Rust module in the launcher (reqwest), a "Cloud" settings tab and per-profile toggle (Profile defaults already has the wording) |
| Ops | Backups of Postgres and storage, restore drill, rate limits, audit log |
Acceptance: two machines edit the same profile set; offline edits merge; the server rebuilds from backup; a stolen database leaks no cookies.

## 0.7.0 — Team
Organisations, members and sub-accounts, roles (owner, admin, member, viewer), folder and profile sharing, transfer ownership, owner force-stop of a shared profile, per-role proxy permissions, activity log, invitations by email.
Acceptance: a role × action matrix test; every sharing change writes an audit entry; revoking access stops a running shared profile.

## Cross-cutting
- **Testing:** UI tests per WP; Rust module tests run in an isolated crate until the Tauri test-binary DLL problem (`STATUS_ENTRYPOINT_NOT_FOUND`) is solved (a manifest for the test target is the likely fix; schedule it in 0.2.0).
- **Docs:** each WP updates `docs/design-guidelines.md` when it adds a component, and the release notes.
- **Backend approvals needed before 0.2.0 starts:** tags (2.1), activity log (2.6), backup/restore (2.7), `write_text_file` (2.9).
