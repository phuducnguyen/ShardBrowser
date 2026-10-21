# Second engine: Camoufox next to Chrome

Status: **draft 1, awaiting owner approval of the backend module** · Date 2026-10-20 · Owner request: "two engines running in parallel in this browser".

## 1. Goal
Every profile picks an engine when it is created: **Chrome** (the ShardX Chromium engine, today's behaviour) or **Camoufox** (patched Firefox). Both kinds of profile can run at the same time, each with its own data folder, proxy and fingerprint. The engine picker already exists in the interface (Create profile and Settings → Profile defaults) with Camoufox disabled; this spec turns it on.

## 2. What was verified (2026-10-20, public sources only)
| Fact | Source |
|---|---|
| The Camoufox browser is **MPL-2.0**; its Python and TypeScript libraries are **MIT**. Commercial use is allowed; unmodified binaries may be downloaded and run, and a notice plus a link to the source must accompany anything HeroV distributes. | `LICENSE`, `python/LICENSE` in `daijro/camoufox` |
| Official builds are published as GitHub releases (all marked pre-release): `camoufox-<ver>-win.x86_64.zip` plus `manifest.json`; GitHub shows a SHA-256 digest per file. Newest seen: `v158.0-beta.40`. The Windows archive is **1.3 GB**. | `repos/daijro/camoufox/releases` |
| The browser takes its fingerprint from environment variables `CAMOU_CONFIG_1..N` (the JSON config cut into 2047-character pieces on Windows) and extra Firefox prefs from `CAMOU_PREFS_1..N`. A launcher does not need Python or Playwright for this. | `python/src/camoufox/utils.py` (`get_env_vars`, `get_pref_env_vars`) |
| The Python package ships **113 real Firefox fingerprints** (Windows 71, macOS 25, Linux 17): navigator, screen, WebGL vendor and renderer, speech voices. | `python/src/camoufox/fingerprint-presets.json` |

Not used: Wayfern (its terms forbid running its binaries outside Donut Browser without written permission).

## 3. Design
- **Engine per profile.** `_meta.engine` is `"chrome"` (default when absent, so every existing profile keeps working) or `"camoufox"`. It is fixed at creation.
- **One new backend module**, `src-tauri/src/camoufox/` (`install`, `config`, `launch`), plus a single dispatch at the top of `launch_profile_synced`: a Camoufox profile goes to `camoufox::launch`, anything else follows the existing path unchanged.
- **Install** into `%APPDATA%\shardx-launcher\camoufox\<version>\`: download the pinned release from GitHub, verify the SHA-256, unzip, record the version. Resumable, with progress events like the Chrome engine. The version is pinned by the launcher (tested), not "latest", because releases are betas.
- **Data**: the Firefox profile lives in `<profile dir>/firefox/`; Chrome data is untouched. Two engines never share a folder.
- **Launch**: `camoufox.exe -profile <dir> -no-remote`, with `CAMOU_CONFIG_n` (fingerprint) and `CAMOU_PREFS_n` (proxy, language, start page). The process is tracked by pid in the existing tracker, so Start, Stop and the "Running" state work as today.
- **Fingerprint library**: the 113 presets become library entries tagged `engine: camoufox` (credit in NOTICE). The Create profile device list filters by engine; Android is hidden for Camoufox. Time zone, locale and geolocation come from the proxy's geo result, as for Chrome.
- **Proxy**: Firefox cannot do SOCKS5 with a user name and password on its own. HeroV runs a small local relay per profile (127.0.0.1, random port, no auth) that logs in to the real proxy; Firefox is pointed at the relay. The same relay serves HTTP(S) proxies with credentials.

## 4. Feature support in the first Camoufox release
| Area | Camoufox v1 |
|---|---|
| Create, start, stop, running state, folders, notes, pin, trash | Yes (engine-independent) |
| Proxy (HTTP, HTTPS, SOCKS5, with login) | Yes, through the local relay |
| Fingerprint from the 113 presets, locked per profile | Yes |
| Extensions, bookmarks, cookie import/export, Automation, Traffic panel, local API start with CDP | **No**, shown disabled with the reason ("Chrome profiles only"). Firefox needs its own add-on, bookmark and remote-control paths (Playwright's Juggler); a later package. |
| Android profiles | No (Chrome only) |
| Cloud sync of profile data | Later: the Firefox folder is a different blob type |

## 5. Work packages (one commit per package, tests with each)
| WP | Scope | Done when |
|---|---|---|
| CF1 | `engine` field in profile meta, dispatch point, engine shown in the profile list | Chrome profiles behave exactly as before (existing tests green); a Camoufox profile can be saved |
| CF2 | Installer: GitHub release, digest check, unzip, resume, status command | Installs the pinned version; a corrupt download is rejected |
| CF3 | Fingerprint presets imported, config builder (`CAMOU_CONFIG`) | Config for 3 OSes validates against Camoufox's key names; unit tests on chunking at 2047 |
| CF4 | Launch and stop, pid tracking, user data dir | A Camoufox window opens with the preset's navigator and screen; Stop closes it |
| CF5 | Local proxy relay, geo to time zone, locale, geolocation | `browserleaks` shows the proxy IP and matching time zone; SOCKS5 with login works |
| CF6 | Interface: engine chip enabled when installed, engine manager in Settings, badges, disabled-feature reasons, en, vi and zh | Engine switch filters devices; install progress shown |
| CF7 | Verification: CreepJS and BrowserScan on a Camoufox profile; a Chrome and a Camoufox profile running together for an hour with no shared state | Results written to `docs/references/`, honest about flags |

## 6. Risks
- **Beta engine.** Releases are pre-releases; pin one, test it, update deliberately.
- **Size.** 1.3 GB download. Offer it on demand from Settings, never at first run.
- **Key names.** The exact `CAMOU_CONFIG` keys are confirmed from the Camoufox config reference at CF3, not from memory.
- **Different detection surface.** Firefox profiles are judged by different checks than Chrome; CF7 reports what passes and what does not.
- **Memory.** Two engines at once cost more RAM; the Settings page shows each engine's size and version.

## 7. Decisions needed from the owner
1. Approve the new module `src-tauri/src/camoufox/` and the one dispatch line in `launch.rs` (the backend is otherwise frozen).
2. Approve the local relay for proxy login (adds a small network component to the launcher).
3. Order: Camoufox (CF1 to CF7) before, or after, the Cloud work (C1).
