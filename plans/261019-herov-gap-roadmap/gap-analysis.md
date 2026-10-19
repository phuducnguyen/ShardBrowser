# Gap analysis — HeroV vs HideMyAcc release notes (2021-08 → 2026-10)

Source: https://hidemyacc.com/release-notes (public). Only what the notes say is used; nothing about HideMyAcc's internals.
"HeroV has" comes from the command list in `src-tauri/src` and `ProfileForm`; **phase 0 re-checks every row in the running app** before anything is built.

Legend: UI = frontend only, existing commands · BE = needs a backend (`src-tauri`) change, frozen until approved · CLOUD = needs the planned server · N/A = does not apply to HeroV

## 1. Profiles
| HideMyAcc feature (version) | HeroV today | Gap | Needs |
|---|---|---|---|
| Folders, color labels, pin, sort, notes | yes | none | – |
| Profile **tags** (3.0.64) | no field in `ProfileMeta` | missing | BE |
| Quick create / quick rename (3.0.62) | templates, inline rename? | check | UI |
| **Create N profiles at once**, random params (2.1.3, 3.0.93) | no | missing | UI (loop `profile_save`) |
| Import cookies while creating many (3.0.66), bulk cookie import to existing (3.0.67) | `cookies_import` per profile | bulk missing | UI |
| Choose folder on import (3.0.75) | `profile_import` | check | UI |
| Duplicate profile (3.0.19) | `profile_clone` | none | – |
| Shift-click multi-select, copy many IDs (3.0.47) | shift-range yes | copy IDs missing | UI |
| Search by ID / folder name (3.0.63, 3.0.75) | name + notes | add ID, folder, tag | UI |
| Column selector (2.0.0) | fixed columns | missing | UI |
| Usage / activity history (3.0.67) | `last_launched_at`, `total_runtime_ms` only | per-launch log missing | BE |
| Backup / restore profile (3.0.72), 24 h trash (2.1.10) | trash with restore | backup missing | BE |
| Bulk browser-version update (3.0.74) | engine is one runtime | partly N/A | BE |
| Move profile storage to another drive (3.0.67) | `data_root_migrate` | none | – |
| New-profile defaults (3.0.30, 3.0.89 WebRTC, 3.1.9 vendor) | none | missing | UI + settings |
| Startup URLs (3.0.30) | none | missing | BE (engine args) |
| Force close / bulk stop (3.0.95, 3.1.6) | `process_kill`, stop | check bulk | UI |
| Show/bring browser window (3.0.56, 3.1.6) | `helper_show`, `automation_display` | check | UI |

## 2. Fingerprint & engine
| Feature | HeroV today | Gap | Needs |
|---|---|---|---|
| Custom UA, screen, timezone, language, WebRTC, geo, noise, media devices, GPU | yes (`ProfileForm`) | none | – |
| MAC address (3.1.4) | no | missing | BE + engine |
| Custom DNS (2.0.84) | no | missing | BE + engine |
| Mute audio, hide images (2.0.50, 3.0.36) | no | missing | BE + engine |
| Restore last session, clear cache on close (3.0.38) | no | missing | BE + engine |
| Language/timezone from IP (3.0.64) | `auto` modes | check | – |
| New devices: Android, iPhone, Mac M3/M4, Win 11, Ubuntu (many) | fingerprint library | content, not UI | data |
| Chrome/Edge/Brave/Opera/Yandex builds, "Marco" versions | one ShardX engine | N/A | – |
| Safari / iOS fingerprints | engine-bound | N/A for now | – |

## 3. Proxy
| Feature | HeroV today | Gap | Needs |
|---|---|---|---|
| Proxy manager, bulk import, check, geo, history, pin | yes | none | – |
| Batch assign list top-to-bottom, one proxy to all (2.0.92) | `ProxyDistributeModal` | check strictness/errors | UI |
| Sequential proxy on Quick launch (3.0.95) | none | missing | UI |
| Extra IP info in bulk check (3.0.94) | partial | check | UI |
| Export proxy list (3.0.64) | no | missing | UI (needs a file-save command) |
| SSH proxy (3.0.40) | check | check | BE? |
| Proxy store, free proxy, TM/Tinsoft | ProxyShard only | **decision: skipped** | – |

## 4. Extensions & bookmarks
| Feature | HeroV today | Gap |
|---|---|---|
| Extension library, add by link (3.0.82), folder import | yes | none |
| Bookmark sets, duplicate sets (3.0.50) | folders + editor | duplicate set missing (UI) |
| Import bookmarks from HTML (3.0.59) | no | missing (UI parse + `bookmark_save`) |

## 5. Automation (**held by owner decision 2026-10-19**)
Schedule (3.0.71), record real actions (3.0.49), templates (3.0.45), if/loop/while/variables/slice (3.0.58), read spreadsheet (3.0.88), multi-export (3.0.84), script descriptions (3.0.82), test-run on a chosen profile (3.0.77), mouse/keyboard emulator (3.0.45), paste-as-human-typing hotkey (2.0.86). HeroV has blocks, modules, run, fleet, export/import. Compare after the hold is lifted.

## 6. Sync
Synchronizer between profiles (3.0.63), window layout (3.0.82), real-time status (3.0.41), cookie sync (3.0.68). HeroV has `sync_*` (launch, arrange, pause, exclude). Compare in the app.

## 7. Team, account, cloud (**CLOUD**)
Team members and sub-accounts, folder/profile sharing, transfer ownership (2.0.84), admin permissions, force-stop shared profiles (3.1.4), proxy permissions per sub-account (3.0.94), 2FA, login-device management, activity log. None exist; they need the VPS service.

## 8. Not planned
Payments (cards, USDT, Bitcoin, VietQR, Appota), plans/licences/promo codes/affiliate/loyalty/Coin, live chat, in-app proxy store. HeroV is not sold through the app.

## 9. UI/UX bar of a commercial product (the part HeroV lacks most)
Items below are common to commercial desktop tools; each is a deliverable in phase 1.
- Command palette (Ctrl+K) and a documented shortcut set; context menus everywhere a row exists.
- Task centre for bulk work: progress, cancel, per-item errors, retry (launch 200 profiles, import 5,000 proxies, check all).
- Notification centre (update available, engine updated, long job finished, proxy dead) replacing transient toasts for important events.
- Undo on destructive actions instead of only confirm dialogs (move to trash, remove from folder, unassign proxy).
- Virtualised tables (10,000 profiles stay at 60 fps), saved views/filters, column chooser and resize, density toggle.
- Skeletons and honest empty states with one primary action; offline and error states per window.
- Onboarding checklist (engine ready → first profile → first proxy → first launch) and inline help links.
- Settings: search box, per-section reset, unsaved-changes guard.
- Accessibility: keyboard-only pass, focus order, contrast AA both themes, reduced motion, screen-reader names.
- Reliability polish: error boundary with "copy diagnostics", window size/position memory, crash-safe drafts for the profile editor.
- Consistency: HeroV icon set instead of mixed icons, one spacing/typography scale, no ui-kit left on screen.
- Language: `vi.json` complete, language switch without restart.
