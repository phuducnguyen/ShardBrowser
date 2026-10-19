# Phase 05 — Proxies window & shipping as a desktop app

## Context links
- [plan.md](plan.md) · `docs/design-guidelines.md` · prototype `docs/design-prototypes/proxies/index.html`
- Existing UI to restyle/port: `src/pages/proxies/index.tsx`, `src/features/manage-proxies/ui/*`, `src/features/proxyshard/ui/*` (PsApiKeyCard, PsOrdersCard, PsImportModal, PsBuyCard)

## Overview
Date 2026-10-16 · Priority high · Status: **Proxies design done (prototype, 46/46 behavior checks)**; release steps below pending Phase 04.

## Key insights
- Template A (list window) held up for a second window: only new components were tabs, sheet/dialog, bulk bar, stepper, latency meter, note, list rows — all added to the design system.
- "Get proxies" is the single primary action; four sources in one sheet: **Free**, **ProxyShard** (API key → orders → import), **Import** (paste list, live valid/invalid report), **Manual** (quick add).
- Bulk actions and delete always confirm; the dialog warns when profiles use the proxy.
- Real bug found by testing: `.sr-only` (position:absolute) escaped scroll containers and stretched the page → scroll containers are now `position: relative` (rule documented).

## Requirements (port)
- Map to existing commands/API only (no `src-tauri` logic change): list/add/delete proxies, bulk import, ProxyShard key + orders + import, proxy check.
- All strings in `en` first, then `vi`; tests: parser, filters, selection, bulk bar, delete confirm, each sheet tab, keyboard paths.

## Shipping as a window app (findings from this repo, 2026-10-16)
- The launcher already is a Tauri 2 desktop app (`src-tauri/tauri.conf.json`, 1280×800 window, WebView2 on Windows). Releasing = port UI (Phase 04) → rebrand → build installer. The HTML prototype itself is not shipped.
- This machine: Node 25 OK; **no Rust toolchain** (`cargo`/`rustc` missing); `node_modules` not installed; WebView2 present. Needs: rustup (stable) + Visual Studio Build Tools (C++), then `npm ci`, `npm run tauri dev` (preview) and `npm run tauri build` (installer in `src-tauri/target/release/bundle/`).
- CI: `.github/workflows/release.yml` builds mac-arm64 / linux-x64 / win-x64 on a `v*` tag and attaches bundles; Windows/macOS builds are unsigned unless certificates/secrets are added (SmartScreen / Gatekeeper warnings).
- User data lives in `dirs::data_dir()/shardx-launcher` (`runtime.rs`), independent of product name → renaming the product does **not** orphan existing profiles. Do not rename that folder without a migration.
- The browser engine is still ShardX (`ShardX.exe`, `--shardx-*` flags, `runtime.json` archives): keep internal names; user-facing branding only.

## Rebrand checklist (UI-facing, no core logic)
1. `tauri.conf.json`: `productName` "HeroV Browser", window `title`, `identifier` (e.g. `com.herov.browser`; changes single-instance/updater identity — decide once), bundle icons.
2. Icons: draw HeroV icon master (1024 px) → `npm run tauri icon <file>` → png/ico/icns.
3. Rust strings that show branding: `lib.rs` window titles "ShardX Fleet" (≈882), "ShardX Sync" (≈1466), tray tooltip (≈2266), first-run/settings text. These are display strings, not logic, but touch `src-tauri/` → needs your OK.
4. `package.json`/`Cargo.toml` name & description, `README.md`, release notes template, `release.yml` names.
5. Keep upstream `LICENSE` + copyright notice (MIT).

## Implementation steps
1. Approve Phase 04 deps → test harness. 2. Port tokens/components/shell → ui-kit + `src/`. 3. Port Profiles, then Proxies. 4. Rebrand checklist. 5. Install Rust + MSVC; `tauri dev` visual check vs prototypes. 6. `tauri build`; test install on a clean Windows. 7. Tag `v*` for CI release.

## Todo
- [x] Proxies prototype + tests  - [ ] Phase 04 port  - [ ] Install toolchain  - [ ] Icons  - [ ] Rebrand strings (needs OK for `src-tauri/`)  - [ ] First installer  - [ ] Code signing decision

## Success criteria
App launches from the installer with HeroV name/icon/theme; Profiles and Proxies windows match the prototypes in both themes; existing profiles still load; `tsc`, `check:i18n`, `vitest`, `npm run build`, `tauri build` all green.

## Risks
Changing `identifier` may reset single-instance/permissions/updater state; unsigned installers trigger OS warnings; first Rust build is slow (tens of minutes) and large on disk.

## Security considerations
Never commit signing certificates or API keys; proxy credentials masked and never logged; the ProxyShard API key stays in the existing secure settings path (no localStorage).

## Next steps
Decide: start Phase 04 now, or first install the toolchain and run the current app with `tauri dev` to see the baseline.
