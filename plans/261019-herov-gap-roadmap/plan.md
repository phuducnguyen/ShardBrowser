# HeroV gap roadmap — features and commercial-grade UI/UX

Date 2026-10-19 · Owner: solo dev · Status: **proposed, awaiting approval of order and the backend question**
Detail and sources: [gap-analysis.md](gap-analysis.md) · Related: `plans/261016-purple-new-profile-flow/` (port, phase 04), `docs/design-guidelines.md`

## Goal
Close the functional gaps that matter to MMO / social account operators and lift the interface to the level of a paid desktop product, without copying anyone's code or assets. Reference is the **public** release notes and the app used as an ordinary user.

## Standing constraints
- `src-tauri/` is frozen. A phase marked BE needs a one-line approval per item before any Rust is touched.
- English strings first, then `vi.json`; UI tests mandatory; `tsc`, `check:i18n`, `npm test`, build green per window.
- Decisions already taken: ProxyShard page skipped; Automation held; star prompt points at `phuducnguyen/ShardBrowser` (to be removed when the repo goes private).
- Never reverse-engineer a third-party binary; spec features from public notes and observation.

## Phases (order = recommendation)
| # | Phase | Type | Size | Exit criteria |
|---|---|---|---|---|
| 0 | Audit and baseline | UI | 1 d | Every "check" row in gap-analysis verified in the app; screenshots of all windows stored; perf test with 5,000 fake profiles recorded |
| 1 | UI/UX professional baseline (section 9 of gap-analysis) | UI | 2–3 wk | Palette, shortcuts, task centre, notification centre, undo, virtualised tables, column chooser, saved views, onboarding, a11y pass, `vi.json`, HeroV icons; visual-regression tests for every window |
| 2 | Profile workflow gaps with existing commands | UI | 1–2 wk | Create N profiles, bulk cookie import, sequential proxy assignment, copy IDs, search by ID/folder, new-profile defaults, import to folder, proxy list export, bookmarks HTML import, duplicate bookmark set, bulk stop / force close |
| 3 | Backend-gated features (one RFC each) | BE | per item | Tags, activity log, backup/restore snapshots, startup URLs, then engine flags: MAC, DNS, mute, hide images, restore session, clear cache. Each needs engine support confirmed first |
| 4 | Automation parity | UI+BE | later | Starts only when the hold is lifted; list in gap-analysis section 5 |
| 5 | Cloud and team | CLOUD | program | Own spec/plan (RIPER): accounts, 2FA, devices, sub-accounts, sharing, transfer, force-stop, activity log, real-time status, E2E-encrypted profile sync on the Dokploy VPS |
| 6 | Distribution and trust | ops | 1 wk | `identifier` decided, code signing, auto-update flow, crash reporting (opt-in), CI (tsc + i18n + tests + build), installer, docs site |

## Why this order
1. Phase 1 raises perceived quality on every screen and unblocks `vi.json`, which every later string depends on.
2. Phase 2 delivers the biggest day-to-day gains with zero backend risk.
3. Phase 3 is decided item by item, because each touches the frozen core and the engine.
4. Phase 5 is the largest and the least reversible; it gets its own spec before any code.

## Definition of done (every phase)
`tsc` clean · `check:i18n` en+zh+vi parity · `npm test` green with new tests for each flow and keyboard path · `vite build` green · light and dark screenshots reviewed · docs and guidelines updated · nothing committed without an explicit request.

## Risks
- Gap table's "HeroV has" column is inferred from code names: phase 0 exists to correct it.
- Engine flags (MAC, DNS, etc.) may not exist in the ShardX engine; verify before planning UI for them.
- Virtualising the profile table touches selection, drag-and-drop and shift-range logic: keep behind the existing tests.
- Cloud sync of browser profiles is security-sensitive (cookies, tokens): E2E encryption and key handling decided in the phase 5 spec, not during build.
- Scope creep: each phase ships on its own; no phase starts before the previous exit criteria are met.

## Progress
- 2026-10-19: first-run splash and star prompt ported; **device-first Create profile and Settings → Profile defaults built** (Windows and Android, engine Chrome; spec `docs/specs/profile-defaults-and-create-profile.md`; 217 tests). Defaults are kept in local storage until the backend is open (item BE-1). macOS, Linux, iOS and Camoufox are planned in the spec (section 8).

## Open questions for the owner
1. Approve the order, or move cloud/team earlier?
2. Backend: may phase 3 start with tags, activity log, backup/restore (all data-only, no engine change)?
3. Is the first customer a team (needs phase 5 early) or a single operator (phase 1–3 suffice)?
4. Remove the star prompt and the patch-log star lock now, or when the repo turns private?
