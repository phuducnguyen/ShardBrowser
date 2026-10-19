# Plan — Purple "New Profile" flow (HideMyAcc-style layout)

Created: 2026-10-16 · Status: in progress · Owner: solo · Scope: **UI only, core logic frozen**

## Goal
Reproduce the Profiles → New Profile → Create flow from `fingerprint.webm` as a purple, original-branded design.
First as a pure HTML/CSS/JS prototype (approval gate), then port to the React launcher (`src/`, `ui-kit/`).

## Ground rules
- Layout/flow follow the video; brand, logo, copy, icons and palette are our own (no HideMyAcc assets).
- English strings first, Vietnamese (`vi.json`) after approval. UI tests mandatory before anything ships.
- No `src-tauri/` changes. Reference stills stay in git-ignored `.reference/`.

## Phases
| # | Phase | Status | Output |
|---|---|---|---|
| 1 | [Design tokens & typography](phase-01-design-tokens.md) | done (prototype) | CSS variables, Figtree, light/dark |
| 2 | [App shell & Profiles list](phase-02-shell-and-profiles-list.md) | done (prototype) | rail, header, folders, table |
| 3 | [New Profile flow](phase-03-new-profile-flow.md) | done (prototype) | Overview, Proxy, tabs, Create |
| 4 | [Port to React + tests + i18n](phase-04-port-react-tests-i18n.md) | **in progress** — shell + Proxies done (65 tests); Profiles next | `src/`, Vitest, en/zh (vi pending) |
| 5 | [Proxies window & shipping as an app](phase-05-proxies-window-and-release.md) | design done · release pending | `docs/design-prototypes/proxies/`, rebrand + installer checklist |

## Research
- [Video analysis](research/video-analysis.md)

## v3 (2026-10-16) — approved direction
Palette approved. Brand is now **HeroV Browser**; rail order **Profiles → Proxies → …**; the design system is extracted to
`docs/design-system/` and documented in `docs/design-guidelines.md` (reference for all future windows). Next window: **Proxies**.

## Deliverables so far
- Prototype: `docs/design-prototypes/new-profile-flow/index.html` (open directly in a browser)
- Design guidelines: `docs/design-guidelines.md` — written only after you approve the prototype

## Open decisions (for review)
1. Palette (v2, 2026-10-16): switched from violet to **ShardX brand blue `#535efd`** (taken from `ui-kit/src/styles/tokens.css`), tonal palette generated with Google's Material Color Utilities (HCT h283/c74). Light rail + labelled pill indicator, filter-chip selectors, M3 switches, pill buttons. Keep, or tune brightness?
2. Keep HMA's "Free proxy / Your proxy / Without proxy" wording or use ProxyShard-oriented copy?
3. Which of the 9 tabs besides Overview/Proxy need real fields in the React port (Timezone, WebRTC, Geolocation first?)
4. Phase 4 prerequisites: approve adding Vitest + Testing Library as dev dependencies.
