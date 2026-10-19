# Spec — Profile defaults and Create profile (device-first)

Date 2026-10-19 · Status: **draft for owner review** · Scope of the first build: **Windows and Android, engine Chrome**
Related: `plans/261019-herov-gap-roadmap/`, `docs/design-guidelines.md`

## 1. Problem
An operator running many accounts on one machine needs each profile to look like a different, real device, and each profile's identity to stay the same for its whole life. Today HeroV exposes the fingerprint as separate fields spread over tabs, has no place to set what a *new* profile starts from, and shows device names such as `win-amd-00001114` or `android-anyreal-note56-x`.

## 2. Goals / non-goals
Goals
1. One device-first flow: **engine → OS → device → what sites will see**.
2. A **Profile defaults** page that decides how every new profile is built (OS, how the device is chosen, protections, WebRTC, language, time zone).
3. Friendly device names and filters (Android by brand, Windows by GPU maker) so diversity is easy to use.
4. A visible split between **locked identity** (never changes after creation) and **adjustable** settings.

Non-goals (this build): macOS, Linux, iOS profiles in the new flow (planned, section 8); a second engine (Camoufox); any change in `src-tauri/`; new fingerprint data (section 6 plans it).

## 3. Evidence
### 3.1 What the reference product does (observed in its Settings → New profile default, v3.1.11)
OS (Windows, MacOS, Linux, Android, iOS, Device OS) → device (two selects: family, model) → firmware → browser (+version) → six hardware masks (media devices, canvas, client rects, audio context, WebGL image, WebGL metadata) → vendor ("Random All") → WebRTC (Altered, Disabled, Real + fill public IP) → language (+auto from IP) → screen resolution → bookmarks → restore session / tab sync / cloud sync → tags → start URLs. Nothing in it separates locked from adjustable fields.

### 3.2 What HeroV's library holds today (script audit of 220 files in the data folder)
| | Windows | Android | macOS | Linux |
|---|---|---|---|---|
| Entries | 120 | 50 | 31 | 19 |
| Engine version in all | Chrome 152 | Chrome 152 | Chrome 152 | Chrome 152 |

Strengths: Windows has 115 distinct GPU strings and 27 screen/scale combinations; Android UA is Chrome's reduced form (`Android 10; K`) with the real model and OS version in client hints, which is correct, not a defect.

Weaknesses found:
- **Android hardware is flat:** all 50 entries report 8 cores; RAM is 4 GB (18) or 8 GB (31), one 2 GB. Real handsets also report 6 cores and others.
- **Android is thin:** 12 brands, 50 models, 27 on Android 16, 7 tablet-class screens; GPUs are Adreno, Mali and ANGLE only.
- **Labels are not human:** Windows entries are named by id (`win-amd-00001114`); Android by slug. The UI cannot offer brand/model filters until a label is derived.
- Cosmetic: some pixel ratios carry float noise (`2.549999952316284`).

No claim is made about detection resistance: that needs the manual check in section 9.

### 3.3 Public sources for better data (searched 2026-10-19; license of each to be read before use)
| Source | Use | Note |
|---|---|---|
| [Apify fingerprint-suite](https://github.com/apify/fingerprint-suite) | Model for sampling realistic combinations: a Bayesian network over browser, OS, device, headers, screen, WebGL, with constraints by OS and device | License not confirmed in this search |
| [BrowserForge](https://github.com/daijro/browserforge) | Python port, "mimics the frequency of browsers, OS and devices found in the wild"; used by Camoufox | License not confirmed |
| Google Play supported-devices catalog (Play Console export) | Authoritative model, RAM, SoC, GPU, screen sizes and densities per Android device | Export comes from your own developer account |
| [AOSP `devices.xml`](https://android.googlesource.com/platform/sdk/+/refs/heads/main/files/devices.xml) | Screen dimensions and density buckets | Old devices only, no GPU |
| [Android distribution dashboards](https://developer.android.com/about/dashboards) | Market weights by screen bucket and OS version | Aggregate only |
| Steam Hardware Survey, StatCounter | Weights for Windows GPU, RAM, cores, resolution | Not searched this session; verify before relying on it |

Rule: use these as **statistical references for weights and coverage**. Real captures from devices you own are the primary source for any new entry; never import a commercial dataset whose terms forbid it.

## 4. Concepts
- **Engine** — Chrome (ShardX engine, available). Camoufox is shown disabled with the reason "engine not installed".
- **OS** — Windows and Android lead the list and are the focus of this build. macOS and Linux stay selectable in Create profile exactly as before (their library entries already work), but are not yet offered in Profile defaults ("planned" there). iOS is disabled everywhere with "planned".
- **Device** — one library fingerprint. Shown as `Brand Model` (Android) or `GPU name` (Windows).
- **Device mode** — *Random in filter* (default) or *Pinned device*.
- **Locked identity** — derived from the device once, at creation: user agent, platform, client hints, GPU strings and limits, screen and pixel ratio, core count, memory, touch points, font and noise seeds. Not editable on an existing profile except by a deliberate, confirmed *re-roll* (later).
- **Adjustable** — proxy, language, time zone, WebRTC mode, geolocation, extensions, cookies, notes, colour.

## 5. Behaviour
### 5.1 Create profile (the New profile window, Overview tab)
1. Rows in order: **Engine** (chips), **OS** (chips), **Filter** (Android: brand select; Windows: GPU maker chips), **Device** (select), **Random device** button, **What sites will see** card.
2. The card lists, read-only: platform, browser version, screen and pixel ratio, cores, memory, touch points, GPU renderer, and a "Locked" note. It updates when the device changes.
3. Changing OS selects a device of that OS (random inside the filter when device mode is random). Changing the filter does the same.
4. A device this machine cannot back (existing GPU compatibility check) still asks before it is applied: unchanged behaviour.
5. A new profile starts from Profile defaults (OS, filter, device mode, protections, WebRTC, language, time zone).
6. Name stays required. No other tab changes in this build.

### 5.2 Profile defaults (Settings → Profile defaults)
Fields: Engine · OS · Device mode (Random in filter / Pinned) · Filter (brand or GPU maker, "Any" default) · Pinned device (when pinned) · Protections: canvas, WebGL, audio, client rects, fonts, sensors (each *Real* or *Noise*) · WebRTC (Auto, Block, TCP only) · Language (auto from proxy or a locale) · Time zone (auto or a zone). A **Save defaults** bar and **Reset to factory** action. Defaults apply to profiles created afterwards; existing profiles are untouched.

Factory values: Chrome · Windows · Random · Any · canvas, WebGL, audio on noise, others real · WebRTC Auto · Language auto · Time zone auto.

### 5.3 Storage
**Done (BE-1, approved by the owner 2026-10-19).** The defaults live in their own backend file, `profile-defaults.json` in the launcher's config folder, behind two commands: `profile_defaults_get` and `profile_defaults_set` (module `src-tauri/src/profile_defaults.rs`: JSON object only, 64 KB cap, temp file plus rename). They are deliberately **not** a field of `settings.json`, because the Settings form rewrites that whole file and a stale form would overwrite them. Local storage (`herov.profile-defaults.v1`) stays as a cache for the first paint and carries an earlier build's values to the file once.

## 6. Data plan (separate from this build)
1. Re-label: derive `Brand Model` and `GPU name` from `client_hints.model`, id prefix and `webgl.renderer` in the UI now; write labels into files when the backend is open.
2. Android diversity: add 6-core and 8-core mixes by SoC tier, 6/8/12 GB RAM, more brands and tablets, current Android 14–16 weights; one entry per real captured device.
3. Windows: keep the 120 set; add weights so common GPUs and 1920×1080 / 1366×768 / 1536×864 dominate as in the real market.
4. Normalise pixel-ratio values.
5. Quality gate per entry before it ships: an internal consistency script (UA, hints, platform, screen, GPU, touch) and a manual check on public checkers with a real run of the engine.

## 7. Accessibility and quality bar
Radio groups for chips, labelled selects, keyboard-only flow, light and dark themes, no ui-kit components, disabled options explain why in visible text (not only a tooltip). Tests for every flow in 5.1 and 5.2.

## 8. Plan for the other OS
| OS | Needs before it can ship | Notes |
|---|---|---|
| macOS | 31 entries exist; add M-series weights (M1–M4) and macOS version in client hints; engine already runs on macOS | Mostly data and a Mac to test on |
| Linux | 19 entries; low market share, useful as a minority profile; Ubuntu/Fedora variants | Low priority |
| iOS | Engine must report Safari-like behaviour (WebKit APIs, no Chrome-only features); Chrome on iOS is WebKit underneath | Needs engine support and its own research; not feasible with the Chromium engine alone |
| Device OS | "Use this machine's real values" | Simple once defaults exist |
| Camoufox | A second engine: download, launch, fingerprint format (BrowserForge-style) | Backend RFC required |

## 9. Acceptance criteria
1. Create profile shows engine and OS chips (Windows, Android, macOS, Linux enabled); iOS and Camoufox are disabled with visible reasons. Profile defaults offers Windows and Android; macOS, Linux and iOS are disabled with "planned".
2. Android shows a brand filter and `Brand Model` names; Windows shows GPU-maker chips and GPU names; no raw ids on screen.
3. "Random device" picks inside the active filter; repeated clicks give different devices when more than one matches.
4. The "What sites will see" card matches the selected device's data.
5. Profile defaults saves and restores across reloads of the page; Reset restores factory values; invalid stored data falls back to factory values.
6. A profile created after changing defaults starts with those values; an existing profile is unchanged.
7. `tsc`, `check:i18n`, `npm test`, `vite build` green; light and dark screenshots reviewed.
8. Manual: launch one Windows and one Android profile and read them on two public checkers; record what they report next to the card.
