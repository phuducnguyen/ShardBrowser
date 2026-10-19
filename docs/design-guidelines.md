# HeroV Browser — design guidelines

Status: v3 (2026-10-16) · Source of truth for look & feel until the system is ported to `ui-kit/` · Owner: solo
Files: [`design-system/tokens.css`](design-system/tokens.css) · [`design-system/components.css`](design-system/components.css) · [`design-system/tools/gen-palette.mjs`](design-system/tools/gen-palette.mjs)
Reference windows: [`design-prototypes/new-profile-flow/`](design-prototypes/new-profile-flow/index.html) (Profiles list + New profile)

## 1. Brand
- **Name:** HeroV Browser (write it exactly like that; short form "HeroV"). Vietnamese UI keeps the name untranslated.
- **Mark:** shield with a cut-out "V" (symbol `#i-herov` in the prototype `index.html`). Brand blue fill, V cut in the rail color. Minimum 24 px, clear space = half the V height. Never recolor outside the brand blue / white.
- **Color seed:** `#535efd` — the ShardX primary from `ui-kit/src/styles/tokens.css` (`--color-primary-base`). Tonal ramps are generated from it (HCT hue 283, chroma 74).
- **Upstream:** the launcher and engine derive from ShardX (MIT). Keep the upstream `LICENSE` and copyright notice; HeroV branding, UI and design system are ours. No third-party UI assets (e.g. screenshots, logos, mascots from reference products) may ship.

## 2. Principles
1. **Calm, fast, premium:** tonal surfaces and soft depth, one strong action color, motion that explains (never decorates).
2. **One primary action per window**, always reachable (e.g. **Create** stays visible across all tabs).
3. **Show options, don't hide them:** ≤ 5 choices → chips/segmented, not dropdowns.
4. **Safe by default:** destructive actions are never the first menu item and always confirm; secrets are masked.
5. **Consistent skeleton:** every window uses the same frame so new windows cost hours, not days.

## 3. Foundations
### Color (use roles, never raw hex)
| Role | Token | Light / Dark note |
|---|---|---|
| Action fill | `--primary` (= `--brand` `#535efd`), hover `--primary-hover` | same in both themes, white text |
| Brand text / icons / links | `--primary-text` | `#3c47e8` light, `#bec2ff` dark (AA on surfaces) |
| Selected / tint | `--tint`, `--tint-strong`, text `--on-tint` | mixed from brand + surface, auto per theme |
| Page / cards | `--canvas`, `--surface` | cool neutral-variant tonal steps |
| Sunken / fields | `--surface-low`, `--surface-mid`, `--surface-high`, `--surface-highest` | elevation by tone |
| Text | `--on-surface`, `--on-surface-2`, `--on-surface-3` | 3 = hints/placeholders (≥ 4.5:1) |
| Borders | `--outline` (inputs), `--outline-variant` (dividers) | |
| Status | `--success`, `--error`, `--warning` + `-container` | pair text with its container |
| Accent | `--sky` | tiny highlights only |
State layers: hover `--hover` (8%), pressed `--press` (12%) — applied as overlays, never as new colors.
Regenerate/extend the ramp with `tools/gen-palette.mjs` (usage in the file header).

### Type — Figtree (bundle locally in the app; the prototype loads Google Fonts)
Title 28/36 · 700 · −0.015em (sentence case, never ALL CAPS) · Body 15/22 · Table 14 · Label 13 · Section overline 13 · 700 · `--primary-text` · Micro 11 (rail labels). Inputs 15, min height 48.

### Shape, elevation, motion, spacing
- Radius: controls 12 (`--r-md`), chips 12, buttons/pills full (`--r-full`), cards & panels 28 (`--r-xl`), menus 12.
- Elevation: tonal surface first, then `--e1` (cards) · `--e2` (hover) · `--e3` (menus, toasts). Primary buttons add `--glow`.
- Motion: standard `--ease` 150–250 ms for state changes, `--ease-out` 180–400 ms for entrances (menus, panels, toasts). Respect `prefers-reduced-motion` (already global).
- Spacing: 4-px base (`--sp-1…6`); page gutters 28, card padding 24–28, gaps 12/16.
- Icons: 22 px, 1.8 stroke, round caps; active rail icon 2.2. Inline SVG sprite; no icon fonts.

## 4. Window anatomy (every window)
```
.app
 ├─ nav.rail          80 px · logo · "+" split button · 7 destinations (Profiles, Proxies, Automation, Scripts, Sync, Team, Logs) · Settings · Theme
 └─ .main
     ├─ header.topbar  title (h1) · .grow · actions (pill / avatar)
     └─ section.view   grid: 208 px .panel (secondary nav)  |  content (.card or .stack)
```
Rail order is fixed: **Profiles, Proxies**, then the rest. Add new destinations after Proxies; keep ≤ 7 + bottom pair.

### Template A — list window (Profiles, Proxies, Extensions…)
`.view > aside.panel (folders/filters)` + `.card.stack > .toolbar (icon tools + .search) + .table-wrap > table`.
Row = checkbox · # · name · attributes · `.status` · primary action (`.btn-run`) · ⋮ `.menu`. Header sticky; the table scrolls inside its card, never the page.

### Template B — tabbed form window (New/Edit profile, Settings)
`.view > aside.panel [role=tablist vertical]` + `.stack > .card.formbar (name · folder · primary **Create**) + .card > .tabpanel`.
Tabs: arrow keys/Home/End; one `tabpanel` rendered at a time; form state lives outside the panel so tabs never lose input.

## 5. Components (class → use)
| Class | Use |
|---|---|
| `.rail-btn` (+`.pillbox`, `.is-active`) | rail destination with label and active pill |
| `.btn.btn-primary / .btn-secondary / .btn-danger` | pill buttons (one primary per window) |
| `.btn-run` | row-level "launch" action (green, semantic) |
| `.icon-btn`, `.tool-btn`, `.pill` | icon actions, toolbar actions, topbar chips |
| `.field`, `.field-dashed` (name bar), `.select` | outlined inputs, 48 px, error via `aria-invalid="true"` |
| `.seg` (radio group of chips) | 2–5 mutually exclusive options; check icon animates in |
| `.toggle` | switch with title + description |
| `.table-wrap > table`, `.status(.is-warn/.is-error)`, `.flag`, `.mono` | data tables |
| `.menu` (+`.danger`) | ⋮ action menu (Esc closes, arrows move, focus returns) |
| `.nav-item`, `.panel`, `.card`, `.stack`, `.group`, `.sect`, `.label`, `.hint` | structure and form layout |
| `.toast` | one-line confirmation (`role="status"`) |
| `.tabs` > `.tab` | horizontal tabs inside sheets/dialogs (arrows/Home/End, `aria-selected`) |
| `dialog.sheet` (+`.sheet-head/-body/-foot`) | right-hand task sheet for multi-source flows (e.g. **Get proxies**); native `<dialog>` → focus trap + Esc for free |
| `dialog.dialog` (+`.actions`) | confirmations; destructive ones state the consequence (e.g. "3 profiles will switch to direct") |
| `.bulkbar` | floating bar after row selection (count, actions, clear); destructive action last, in error color |
| `.stepper`, `.meter`, `.note(.warn)`, `.list/.list-row`, `.invalid` | quantity input, latency/quality bar, inline info/warning, order lists, parse errors |
| `.btn-sm`, `.btn-text`, `.btn-danger` | compact primary (topbar/sheet foot), low-emphasis, destructive |
| `.toast-stack` > `.toast(.is-error)` | several toasts at once, bottom centre, each dismissable (the app raises them from stores) |
| `.menu.up`, `.rail-btn .badge-dot` | row menu that flips upward near the bottom edge; update marker on a rail item |
| `.dim`, `.text-ok`, `.text-err`, `.hint.is-error`, `.loc`, `.actions-cell` | text/layout helpers so components need no inline styles |
React primitives for these: `shared/ui/hv` → `Window`, `Sheet`, `Tabs`, `Chips`, `KebabMenu`, `Icon`, `HeroVMark`.

## 6. Content & i18n
- English first (`en`), then Vietnamese (`vi`). Sentence case everywhere; verbs for actions ("Create", "Check proxy").
- Never concatenate translated fragments; keep placeholders explicit. Product name stays "HeroV Browser".
- Errors say what to do ("Enter a valid host and port first."). Simulated/placeholder behavior must be labeled in prototypes.

## 7. Accessibility checklist (per window)
- All controls reachable by keyboard with visible focus (`:focus-visible` ring uses `--primary-text`).
- Roles: `tablist/tab/tabpanel`, `radiogroup`, `menu/menuitem`, `status`/`alert` for feedback; icon-only buttons have `aria-label`.
- Contrast ≥ 4.5:1 text, ≥ 3:1 controls, in **both** themes. Never convey state by color alone (status pills carry text).
- Motion off under `prefers-reduced-motion`.

## 8. Testing rules
- Prototype windows: headless-Chrome behavior harness (keyboard, validation, filtering, menus, theme, no-XSS, no page-level scroll) + screenshots in both themes at 1280×800.
- React port: Vitest + Testing Library, behavior not snapshots; every window ships tests for its primary flow and keyboard paths. `tsc`, `npm run check:i18n`, tests must pass before merge.

## 9. Build a new window — checklist
1. Pick Template A or B; link `tokens.css` then `components.css`; no new colors.
2. Add the rail destination after Proxies; set `aria-current` on the active one.
3. Reuse components from §5; if something new is needed, add it to `components.css` + this file first.
4. Write strings in `en` (then `vi`); no ALL CAPS.
5. Verify light + dark, 1280×800, long lists (internal scroll), keyboard-only pass, then port.
Prototype windows done: **Profiles + New profile**, **Proxies** (Template A + "Get proxies" sheet). **Ported to React (shell + Proxies):** `AppRail`, Proxies window with a *ProxyShard / Import / Manual* sheet. The prototype's **Free** tab has no backend command, so it is not in the app. **Ported since (2026-10-18):** Profiles, New/Edit profile, Fingerprints, Extensions, Bookmarks, Trash, Settings (Template B, four tabs), Patch log, and every dialog of those windows including the GPU-mismatch dialogs. Next: ProxyShard page → Automation → first-run, star and what's-new gates.
Layout gotchas learned: keep ≤ 6 table columns at 1280 px (put secondary facts on a `.sub` line) · cells are `nowrap` · every scroll container is `position: relative` (otherwise `.sr-only` escapes the clip and stretches the page) · `color-scheme` is set per theme so native scrollbars match · rail items must not shrink (`flex: none`), the rail scrolls instead · `<dialog>` needs `margin: auto` (Tailwind preflight zeroes it) · a bar that inverts the surface (`.bulkbar`) needs its own error colour per theme.

## 10. Port to the React app
How it is done today (v3.2), and why it differs from the first plan:
- **`docs/design-system/` stays the single source.** `npm run build:herov-css` (`scripts/build-herov-css.mjs`) turns `tokens.css` + `components.css` into `src/app/styles/herov.generated.css`. Never edit the generated file; edit the source and regenerate.
- **Everything is scoped under `.hv`.** The launcher still has Tailwind pages, and bare names such as `.group`, `.label`, `.card` collide with them. A HeroV window renders inside `<div class="hv">` (`shared/ui/hv/Window`); app-level hosts that only draw dialogs use `<div class="hv" style="display:contents">`. Keyframes are renamed `hv-*`.
- **No ui-kit components inside `.hv`.** The scope resets `button { color: inherit }`, which would override the ui-kit's colours. Dialogs and popovers render their own `.hv` root (`<div class="hv" style="display:contents">`, as `FormDialog` and `ProxyInfoPopover` do), so they can sit anywhere in the tree. A modal that is still ui-kit must stay outside `.hv` until it is restyled.
- **Same brand, not a new palette.** `--brand` is the same `#535efd` as `--color-primary-base`; the HeroV variables simply live next to the ui-kit's until every page is ported, then they can be merged into `ui-kit/src/styles/tokens.css`.
- **Primitives** live in `src/shared/ui/hv/` (`Icon`, `HeroVMark`, `Window` (`single` = one content column), `Sheet`, `FormDialog` (`wide`/`mid`, `danger` = red confirm that Enter never fires, `extra` = left slot of the button row), `Tabs`, `NavTabs`, `Chips`, `KebabMenu`, `CopyField`); screens stay in Feature-Sliced slices (`widgets/AppRail`, `widgets/ProxyTable`, `features/manage-proxies`…). Windows listed in `HEROV_WINDOWS` (`src/app/App.tsx`) fill the area themselves; other pages keep the padded column.
- **Core logic (`src-tauri/`) is untouched** apart from four display strings (window titles, tray tooltip, one error message) and `tauri.conf.json` names. UI only calls existing commands.
- **i18n:** every string is a key in `en.json` and `zh.json` (`npm run check:i18n` enforces it, and flags keys nothing calls, so delete the keys of any component you replace). `vi` is added after the English text settles.

## 11. Don'ts
No hard-coded hex in components · no dashed inputs · no ALL-CAPS headings · no third-party logos/screenshots · no more than one primary button per view · no page-level scrolling in app windows · no color-only status.

## Changelog
- v1 (2026-10-16) purple prototype · v2 ShardX-blue, Material tonal system · v3 HeroV Browser brand, rail order Profiles → Proxies, design system extracted to `docs/design-system/` · v3.1 Proxies window; tabs, sheet/dialog, bulk bar, stepper, meter, note, list components; scroll-container and color-scheme fixes. v3.2 (2026-10-16) React port of the rail and Proxies: scoped `.hv` build, `.toast-stack`, `.menu.up`, rail badge dot, text helpers (`.dim`, `.text-ok`, `.text-err`, `.hint.is-error`, `.loc`, `.actions-cell`); fixes for rail items shrinking, `<dialog>` centring, bulk-bar contrast in dark; delete-dialog wording no longer claims what happens to bound profiles (the backend leaves them pointing at the deleted proxy). v3.3 (2026-10-16) editor classes (`.formbar`, `.card.grow`, `.tabpanel`, `.field-dashed`). v3.4 form dialogs (`.dialog.form`, `.wide`, `.dialog-body`, `.pick-*`, `.or-rule`, `.tpl-*`, `.chip-warn`). v3.5 proxy dialogs (`.dist-*`, `.callout-warn`, `.info-pop`, `.dialog .select`). v3.6 GPU explainer (`.explain`, `.chip-btn`, `.actions-extra`, `.check-line`, `.dialog.mid`) and fingerprint library (`.fp-*`, `.chip-plain`). v3.7 `.view.single`, `.empty-hero`, `.link-btn`, extension cards (`.ext-*`), `.copy-row`, `.path-box`, `.progress-box`, `.savebar`, `.callout-err` and patch-log classes (`.log-*`). · v3.8 (2026-10-19) first-run `.splash` · v3.9 device-first Create profile (engine → OS → filter → device → read-only "What sites will see" card: `.dev-row`, `.dev-card`), Settings → Profile defaults (`.def-grid`, `.savebar.split`), disabled `Chips` options with a visible `.chip-hint`; spec in `docs/specs/profile-defaults-and-create-profile.md`.
