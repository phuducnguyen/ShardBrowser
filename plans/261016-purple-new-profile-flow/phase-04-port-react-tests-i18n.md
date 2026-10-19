# Phase 04 — Port to React, tests, i18n

## Context links
- [plan.md](plan.md) · `docs/design-guidelines.md` §10 · `package.json`, `vitest.config.ts`, `scripts/build-herov-css.mjs`, `scripts/check-i18n.mjs`, `src/shared/i18n/*`

## Overview
Date 2026-10-16 · Priority high · Status: **in progress — shell + Proxies done and verified; Profiles next**

## Done (verified 2026-10-16)
- **Harness:** Vitest 2 + jsdom + Testing Library (dev deps approved by the request to port). `npm test` → 65 tests, 4 files: proxy logic (parser, status, filters, range-select), `AppRail`, and the Proxies window end to end (list, filters, search, selection, bulk bar, delete flow, row menu keyboard, Get-proxies sheet: ProxyShard / Import / Manual). IPC is faked in `src/test/tauri.ts`; jsdom gaps (modal `<dialog>`, Node 25 `localStorage`) are patched in `src/test/setup.ts`.
- **Design system → app:** `npm run build:herov-css` generates `src/app/styles/herov.generated.css` (scoped `.hv`); Figtree is bundled (`@fontsource-variable/figtree`).
- **Shell:** `widgets/AppRail` replaces `Sidebar` (order Profiles, Proxies, Fingerprints, Extensions, Bookmarks, Automation, Trash · API, Settings, What's new, Theme). The API/MCP/docs card that lived in the sidebar is now the rail's API dialog. `ConfirmHost` and `ToastHost` are HeroV-styled for the whole app.
- **Proxies window:** `pages/proxies`, `widgets/ProxyTable`, `features/manage-proxies` (sheet, bulk bar). Store gained type/status filters and sheet state; search now matches the country name.
- **Branding strings (user-approved `src-tauri/` edit):** `tauri.conf.json` productName/title, `lib.rs` window titles + tray tooltip, `runtime.rs` error text, `index.html`, `en/zh` app-name keys. `identifier` and the data folder are unchanged on purpose.
- **Gates now green:** `tsc`, `npm run check:i18n` (1515 keys; also fixed for Windows), `npm test`, `npm run build`.

## Remaining
1. ~~Profiles window~~ **done (2026-10-16, 93 tests total):** folder panel with drop targets, status chips, filters popover, row menu, bulk bar, uptime tick, shift-range select. The old metrics strip (profile/running/proxy/fingerprint counts) was dropped: counts now live on the folder panel and status chips. Editing still opens the legacy ui-kit form on its own screen (`ProfileEditorScreen`).
2. ~~New / Edit profile~~ **done (2026-10-16, 123 tests total):** `features/manage-profiles/ui/editor/` (Template B, 8 tabs: Overview, Proxy, Extensions, Language & time, Privacy, Location, Advanced, Cookies; the prototype's Bookmarks tab has no field in the form and is left out). Same data layer (`draft`/`saveDraft`), GPU/OS logic moved to `lib/useGpuPicker`. A name is now required. Fixed on the way: setting screen width and height together used to keep only the height. Quick-edit, folder and template dialogs are restyled too (2026-10-18, 133 tests): new `shared/ui/hv/FormDialog` (native `<dialog>`, own `.hv` root), classes `.dialog.form/.wide`, `.pick-*`, `.tpl-*`, `.or-rule`, `.chip-warn`; the template cards show a "GPU mismatch" chip instead of the clickable ui-kit badge. Still to restyle: the GPU-warning modal (`IncompatibleWarningModal`) and the badge's explainer modal. Note: `npm run build` runs `npm --prefix ui-kit ci`, which adds a second React; `vitest.config.ts` now dedupes it.
3. ~~Restyle `ProxyEditor`, `ProxyInfoPopover`, `ProxyDistributeModal`~~ **done (2026-10-18, 146 tests):** editor and distribute dialog sit on `FormDialog` (native selects, `.row2` layout, host-required error is inline instead of a toast, distribute uses the `Chips` radio group and `.dist-*` lists); the info popover is a `.info-pop` panel (definition list, `.status` pills, Esc and outside-click close). New classes in `components.css` v3.5, `IP` added to the i18n checker's keep-list, 13 tests in `manage-proxies/ui/ProxyDialogs.test.tsx`. The Proxies window now has no ui-kit surface left.
4. Remaining legacy pages one by one; add each to `HEROV_WINDOWS` in `App.tsx` when ported. **Done (2026-10-18, 183 tests):** the GPU-mismatch badge, explainer and warning dialogs (`FormDialog` gained `mid`, `danger`, `extra`); Fingerprints (platform panel + card grid), Extensions, Bookmarks, Trash, Settings (Template B, four tabs, hv `CopyField`, `DataRootCard`), Patch log; `Window` gained `single`. The i18n checker now skips `*.test.*` files, and `IP` joined its keep-list. First-run splash and star prompt ported 2026-10-19 (188 tests; `.splash` in components.css v3.8; tests in `widgets/Gates.test.tsx`). Owner decision 2026-10-19: ProxyShard page is skipped (no API wiring) and Automation stays as is. **Still legacy:** ProxyShard page (+ `features/proxyshard`, `widgets/ProxyShard`), Automation (+ `ProjectEditor`, `StepDetails`, `BlockCanvas`, `ModulesCard`, `BlockPicker`), FirstRunGate, StarModal, WhatsNewGate, HelperPanel, TrafficPanel, LiveView, FleetMonitor, SyncPanel, TitleBar.
5. `vi.json` (the app has `en` and `zh` only; `Lang` in `shared/i18n/index.ts` and the checker need a third locale), then CI workflow running tsc + check:i18n + test.
6. HeroV icon set (`tauri icon`), then decide `identifier` and code signing (phase 05).

## Requirements
- Core logic frozen: UI calls existing commands only; no new Rust commands.
- Every ported window ships tests for its primary flow and keyboard paths; `tsc`, `check:i18n`, `npm test`, `npm run build` pass before it counts as done.

## Risks
- Profiles is the app's busiest screen (launch/stop lifecycle, polling, drag and drop); port it behind the same store, change markup only, and keep the legacy file until the new one passes its tests.
- Two token sets coexist (`.hv` and ui-kit) until the last page is ported; do not mix ui-kit components into `.hv` trees.
- First `cargo` build is long and large; VS Build Tools must finish installing first.

## Security considerations
Dev-only dependency additions; Figtree is bundled (no runtime font loading); API key stays in the existing secure settings path; proxy passwords are never logged or rendered.

## Next steps
Port Profiles (list) first, then New profile.
