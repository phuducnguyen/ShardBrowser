# HeroV Browser — release plan (0.1 → 1.0 and after)

Date 2026-10-19 · Status: **proposed** · Owner: solo developer
Builds on: [plan.md](plan.md) (phases), [gap-analysis.md](gap-analysis.md) (feature gaps), `docs/specs/profile-defaults-and-create-profile.md`, `docs/references/fingerprint-reference-projects.md`.
Durations are estimates for one developer working steadily; each version ships when its exit criteria hold, not on a date.

## 1. How the reference product ships (from its public release notes)
- **Two kinds of release.** A *browser/engine release* (new Chrome-based build every few weeks, listed first in each note) and a *feature release* (a few items per version). Many notes are only an engine bump plus fixes.
- **Cadence.** About 2 notes a month in 2025–2026; engine versions follow Chrome stable (Chrome 152 → 153 within about 2 weeks of the Chrome release).
- **Content mix.** Fingerprint/device additions (new Android models, macOS and iOS versions, MAC address, GPU choice), then workflow features (bulk stop, quick-profile counts, import/export, proxy permissions), then team and account items. UI redesign landed as its own version (3.0.82 "New UI/UX", 3.0.76 dark mode).
- **Notes format.** Date, version, short bullet list, "minor bug fixes" implied.
HeroV copies the *shape* (engine train plus themed feature versions), not their content.

## 2. Versioning and channels
| Item | Rule |
|---|---|
| Product version | `MAJOR.MINOR.PATCH`. `0.x` until 1.0. **Minor** = a themed feature release. **Patch** = engine bump, fixes, fingerprint data. |
| Engine train | Follows Chrome stable. A patch release per Chrome major, shipped within about 2 weeks, after the CreepJS and library checks pass. The engine version is shown in the app and in the notes (`Engine 152.0.7977.65`). |
| Channels | `nightly` (every merge to main, internal), `beta` (a minor in testing, opt-in), `stable` (default). |
| Update feed | Static JSON and installers on the Dokploy VPS; the app checks on start (`launcher_update_check` exists) and shows an update dialog with the notes. |
| Notes | `docs/releases/X.Y.Z.md` in the HMA shape (date, version, bullets) plus *Upgrade notes* and *Known issues*; also feeds the in-app Patch log. |
| Rollback | The previous installer stays on the feed for 2 releases; profile data format changes are forward-only and announced in the notes. |
| Data safety | A release that changes a stored format ships a migration and a backup of the old file, and has a test with an old fixture. |

## 3. Release gates (every version)
1. `tsc`, `check:i18n` (en, zh, vi), `npm test`, `vite build`, `cargo check` and Rust tests (module tests run in an isolated crate until the Tauri test-binary DLL problem is fixed).
2. `npm run check:fingerprints` has **0 errors**.
3. `node scripts/creep-check.mjs` on a fixed sample (3 Windows, 3 Android once captured): **CLEAN** (0 lies, empty trash, no headless/stealth flags). Recorded in the release notes.
4. Manual run of one Windows and one Android profile on two more public checkers; results attached to the release issue.
5. Light and dark screenshots of every changed window reviewed.
6. Installer smoke test on a clean Windows user; upgrade test from the previous release.
7. Release notes written; version bumped in `package.json`, `Cargo.toml`, `tauri.conf.json`.

## 4. Versions
### 0.1.0 — Foundation (≈ 2 weeks)
*Goal: the app is HeroV from first launch to quit, and builds in CI.*
- Port or hide the last legacy surfaces: ProxyShard page hidden from the rail (owner decision), Automation left on its current UI with a visible "legacy" tag, helper/traffic/live panels checked on the new frame, title bar restyled.
- `vi.json`, language switch without restart, HeroV icon set (`tauri icon`), About dialog with engine and app versions.
- CI workflow: `tsc`, i18n, tests, build, `cargo check`.
- Decisions closed: `identifier`, data folder name, code signing, star prompt (remove when private).
- Installer (NSIS/MSI) with HeroV name and icon.
*Exit:* clean install on a fresh Windows account works; all gates in section 3 except 3–4 pass.
*HMA analog:* 3.0 baseline (new UI/UX, dark mode).

### 0.2.0 — Profile workflow (≈ 3 weeks)
*Goal: daily profile work is as fast as the reference.*
- Create N profiles at once (random from Profile defaults), quick profile, bulk cookie import, sequential proxy assignment, copy IDs, search by ID/folder, column chooser, import into a folder, export proxy list, bookmarks HTML import, duplicate bookmark set, bulk stop and force close.
- **Tags** (backend, data-only), **activity history** per profile (backend log), **backup and restore** of a profile (backend).
- Task centre for bulk jobs (progress, cancel, per-item errors), undo for destructive actions.
- Profile defaults gains screen resolution mode, start URLs (needs engine arg check), restore-session toggle (engine check).
*Exit:* 500 profiles created in one run without UI stalls; every bulk action has a test; backups restore byte-identical.
*HMA analog:* 3.0.62–3.0.67 (quick create, multiple profiles, tags, history, bulk cookies, storage drive).

### 0.3.0 — Fingerprint quality (≈ 3–4 weeks, depends on real devices)
*Goal: devices that survive the public checkers, and a way to prove it.*
- **Real captures.** A collector page run on real phones, a converter into library entries, and the consistency validator as a gate. Target: 40+ Android devices across 12+ brands, with 6- and 8-core mixes, 4/6/8/12 GB, Android 13–16, tablets. See `docs/references/creepjs-findings.md`: CreepJS flags any WebGL parameter set that is not a known real device, so Android entries must come from real hardware.
- Windows set re-weighted to the real market (1920×1080, 1366×768, 1536×864 dominant); verify the 16/32 GB memory values against the engine.
- Friendly labels written into the library files; float noise removed from pixel ratios.
- Re-roll identity (confirmed action) and a fingerprint health badge on each profile (consistency check result).
- Engine train automation: a script that, per Chrome stable, updates the engine, rebuilds UA/client-hint versions in the library and runs gates 2–4.
*Exit:* `creep-check` CLEAN on ≥ 10 Android and ≥ 10 Windows entries; library validator 0 errors; the engine-update procedure documented and used once.
*HMA analog:* 3.0.65–3.0.95 (custom UA, resolution, GPU choice, new devices, random parameters), 3.1.4 (MAC address, if the engine supports it).

### 0.4.0 — Professional UX (≈ 3 weeks)
*Goal: it feels like a paid product.*
- Command palette (Ctrl+K), shortcut sheet, notification centre, virtualised tables (10,000 profiles), saved views, density toggle, onboarding checklist, honest empty/error/offline states, settings search.
- Accessibility pass (keyboard-only, focus order, AA contrast both themes, reduced motion), visual-regression tests for every window.
- Auto-update dialog with notes, opt-in crash report with "copy diagnostics", window size/position memory.
*Exit:* keyboard-only walkthrough of create → launch → stop → delete recorded; 10,000-profile list scrolls at 60 fps on the dev machine; screenshot suite green.
*HMA analog:* 3.0.82 (new UI/UX), 3.0.76 (dark mode), 3.0.56 (notifications).

### 0.5.0 — Automation (≈ 4 weeks, starts when the hold is lifted)
*Goal: reach the reference's automation surface.*
- Port the Automation page to the HeroV frame (project list, block canvas, step details, modules).
- Schedule, recorder, templates, variables, if/loop/while, read-spreadsheet, multi-export, script descriptions, test-run on a chosen profile.
- Synchronizer: window layout, status in real time, cookie sync between profiles.
*Exit:* a recorded script replays on 20 profiles; schedule survives restart; export/import round-trips.
*HMA analog:* 3.0.44–3.0.88.

### 0.6.0 — Cloud alpha (≈ 4 weeks)
*Goal: one operator, several machines.*
- Own spec and plan (RIPER) before code. Accounts and login, device list, 2FA, end-to-end-encrypted sync of profile data on the Dokploy VPS (Postgres + API + WebSocket), conflict handling, offline mode.
- Profile storage on the cloud is opt-in per profile ("Sync browser data to the cloud" toggle in Profile defaults).
*Exit:* two machines edit the same profile set; lost-network and conflict tests pass; the server can be rebuilt from backup.
*HMA analog:* 3.0.19 (accounts, 2FA, device management), 3.0.41 (real-time status).

### 0.7.0 — Team (≈ 4 weeks)
*Goal: a small team shares profiles safely.*
- Team members and sub-accounts, folder and profile sharing, roles and permissions (including proxy permissions), transfer ownership, owner can force-stop a shared profile, activity log, multi-profile access for sub-accounts.
*Exit:* permission matrix test (role × action) passes; an audit log entry exists for every sharing change.
*HMA analog:* 3.0.19, 3.0.43, 3.0.54, 3.0.82, 3.1.4, 3.0.94.

### 0.9.0 — Release candidate (≈ 4 weeks)
- Performance and memory budgets, security review (secrets, token storage, auto-update signature), data-migration tests from every earlier 0.x, installer and uninstaller tests, docs site and in-app help, support channel and bug-report flow, licence/billing decision implemented or consciously deferred.
*Exit:* two weeks with no data-loss bug; upgrade from 0.2 → 0.9 tested.

### 1.0.0 — General availability
- All gates green on the same commit; signed installers; notes; migration guide from the ShardX launcher; public docs.

## 5. After 1.0
| Version | Theme | Condition |
|---|---|---|
| 1.1 | **Second engine (Camoufox)** and engine picker enabled | Backend RFC approved; fingerprint format and updates solved |
| 1.2 | macOS and Linux profiles in Profile defaults (device-first) | Real captures, a Mac to test on |
| 1.3 | iOS research | Only if the engine can behave like WebKit; otherwise not shipped |
| 1.x | Marketplace-style items (templates, extension sets), loyalty and payments | Only if HeroV is sold through the app |

## 6. Schedule (estimate, solo)
| Version | Weeks | Cumulative | Target (from 2026-10-26) |
|---|---|---|---|
| 0.1.0 | 2 | 2 | mid Nov 2026 |
| 0.2.0 | 3 | 5 | early Dec 2026 |
| 0.3.0 | 3–4 | 9 | early Jan 2027 |
| 0.4.0 | 3 | 12 | late Jan 2027 |
| 0.5.0 | 4 | 16 | late Feb 2027 |
| 0.6.0 | 4 | 20 | late Mar 2027 |
| 0.7.0 | 4 | 24 | late Apr 2027 |
| 0.9.0 | 4 | 28 | late May 2027 |
| 1.0.0 | 1–2 | 30 | mid Jun 2027 |

Engine patch releases run alongside (about one every 4 weeks) and are not counted above. The 0.3.0 line moves most with device access; 0.6/0.7 move most with the scope of the cloud service.

## 7. Dependencies and risks
- **Real Android GPU output** (0.3.0). Without it the Android set stays flagged by CreepJS; Damru's own research report reaches the same conclusion for emulated Android. The owner will not capture on devices, so the options are remote real phones (device farms) or contacts who open a capture link; until then Android is labelled experimental in the app and Windows is the strong path. The Play Console catalogue helps with names only.
- **Backend approvals.** Each backend item (tags, history, backup, start URLs, engine flags, cloud client) is approved one by one; 0.2.0 and 0.6.0 depend on it.
- **Engine support.** MAC address, DNS, mute, restore session, clear cache need engine flags; verify before promising them in notes.
- **Solo capacity.** Cloud (0.6/0.7) is the largest unknown; if it slips, ship 0.9 without team and keep team for 1.1.
- **Licence hygiene.** No code or data from non-commercial or AGPL projects; recorded in `docs/references/`.
- **Detection is a moving target.** A clean CreepJS run is a gate, not a guarantee; other detectors and site-specific checks exist, so release notes say what was tested.

## 8. Open decisions for the owner
1. Approve the order, or swap 0.5 (Automation) and 0.6 (Cloud)?
2. Is the first paying user a team (then 0.6/0.7 move before 0.5) or a single operator?
3. How will HeroV be sold: licence key, subscription, or self-hosted only (decides 0.9 work)?
4. Android capture without owned phones: rent remote real devices (a device farm), ask contacts to open a capture link, or keep Android experimental and ship Windows first?
