# HeroV version plan

Owner: product lead · Written 2026-10-22 · Reviewed at every release. Version rules and the release checklist: `docs/releasing.md`.

Principles: every release has **one theme**; a version ships when its exit criteria are met, not on a date; anything that does not fit moves to the next version instead of delaying this one. Test builds (`-beta.N`) go out as soon as a slice is usable; the stable `.0` follows when the beta has run without new blockers.

## Now

| Version | Theme | Contents | Exit criteria (stable) |
|---|---|---|---|
| **0.2.0** (beta.1 out) | Two engines, visible versions | Camoufox engine and phones (done); version under the logo, About, SemVer (done); faster engine install (done); **Check IP** (exit IP from several sources, country/time-zone mismatch, datacenter IP, IPv4/IPv6 split) | Installer tested on a clean Windows; Camoufox install from scratch on a slow line; no open "blocker" issue for two weeks of beta |

## Next

| Version | Theme | Contents |
|---|---|---|
| **0.3.0** | Daily work with many profiles | **Numbered windows**: each running profile gets a number (and its colour) on its window title and taskbar icon, so ten open profiles can be told apart; reopen the tabs a profile had; cookie import/export for Camoufox (Cookie-Editor JSON, Netscape); profile table states that differ in shape, not only colour; filter by engine |
| **0.4.0** | Moving and sharing profiles | Profile export/import as ZIP (with or without browser data); bulk create; "Connect AI (MCP)" dialog that writes the config for Claude, Cursor and others |
| **0.5.0** | Phone profiles out of experimental | Phone WebGL from real recordings, pointer and pixel-ratio checks, scanbrowser and CreepJS clean on phones; iOS decision (offer or drop) |
| **0.6.0** | Cloud alpha | Self-hosted sync of profiles between two machines (spec: `docs/specs/cloud-sync.md`); decision gate before starting: still wanted? |

## Toward 1.0.0

1.0.0 is a promise, not a feature list: profile format, data folder, local API and settings stay compatible across 1.x. Before it: signed installer, in-app update (download and install), crash reporting the owner opts into, a migration test from every 0.x, documentation for users in Vietnamese and English.

## Parked (not scheduled)

- Third engine on an open Chromium build: needs a build machine (about 150 GB free disk) and re-patching every four weeks; revisit when that exists.
- Commercial edition: not planned; HeroV stays free.

## How a version is planned

1. Pick the theme from "Next"; write the contents as user-visible outcomes.
2. Split into slices that can ship as `beta.N` (each slice: code, tests, CHANGELOG line, What's new entry).
3. Review this file at each release: move what slipped, add what was learned.
