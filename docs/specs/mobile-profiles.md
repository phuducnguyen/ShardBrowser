# Mobile profiles (Android, iOS, phone window): investigation and ADR

Status: **draft 1, awaiting owner decisions (section 5)** · 2026-10-21 · Inputs: owner's brief "nâng cấp Mobile / Android / iOS theo ManyFaces", the existing Chrome and Camoufox engines, `docs/references/creepjs-findings.md`.

## 1. How the investigation was done, and two limits
- **Source read directly.** `chentaymane/ManyFaces` is plain Python on GitHub, so every claim below cites the file and lines read on 2026-10-21 (`main`, last push 2026-10-08). The REA toolkit (`morluto/rea`, MIT) is for binaries and apps without source; it installs an MCP server and edits the agent's configuration (`npx rea-agents setup`), so it was **not** installed. Same evidence standard, no install. Say so if you want it anyway.
- **ManyFaces has no licence file** (GitHub reports none). Without one nothing may be copied. This document keeps to ideas; HeroV's device table is built from its own data (the 220-device Chrome library) and public specifications, never from ManyFaces's tables.

## 2. Evidence: what ManyFaces does
| Question | Finding | Where |
|---|---|---|
| Engines per profile | `Engine = Literal["camoufox","chromium","android"]`, default `camoufox`; phone and desktop share one fingerprint model | `models.py:14-19,99,139-144` |
| Where are presets, and their shape | Two hand-written tables of tuples. Android: name, CSS width, CSS height, DPR, Android version, GPU vendor, GPU renderer, cores (12 phones: Pixel 6-9, Galaxy S21-S24, OnePlus 11-12, Xiaomi 13-14). iOS: name, width, height, DPR, iOS version, cores (9 iPhones) | `fingerprint.py:98-127` |
| What a phone identity carries | `is_mobile`, `device_name`, UA, `appVersion`, `platform` ("Linux armv8l" / "iPhone"), `oscpu`, screen in CSS px, DPR, `max_touch_points=5`, GPU strings, cores, memory, battery, cameras/mics, fonts, WebRTC local IP | `fingerprint.py:323-345,572-684` |
| Android UA and iOS UA | Android: Firefox-for-Android UA (`Android N; Mobile; rv:X`). iOS: Safari UA with `iPhone`, `Version/`, `Mobile/15E148`; `oscpu` left empty because real iOS Safari has none | `fingerprint.py:578-594,638-656` |
| Stable per profile | `random.Random(seed)` and a device name pin the result; `normalize(fp, seed=profile.id)` repairs stored values (Apple Silicon cores and colour depth, no touch on a Mac, DPR allowed per OS) and is run on load | `fingerprint.py:508-544,693-715`, `db.py:95-106` |
| iOS honesty | Comment says Gecko under an iOS UA is detectable by an engine-level probe; iOS is kept **out of the Random pool** and only produced on request | `fingerprint.py:90-95,687-690` |
| Phone on Firefox/Camoufox | Real window sized to the phone, only the phone's fonts (`custom_fonts_only`), and prefs for touch events, meta-viewport, zoom and `pointer: coarse` / `hover: none`; Playwright's own viewport is off because Juggler rejects `isMobile` | `browser.py:239-282` |
| Phone on Chromium | Playwright `viewport`, `screen`, `device_scale_factor`, `is_mobile`, `has_touch`; a **synthesised Chrome-for-Android UA** (Chrome UA from Chromium's major); iOS keeps the Safari UA; Chromium "app mode" (`--app=about:blank`, `--window-size=w,h`) gives a chromeless phone-shaped window | `browser.py:392-423,533-550` |
| Phone start page | Blank is a black screen in a window with no address bar, so a phone lands on a built-in start page (clock, search, links) | `browser.py:63-79`, `web/mobile_start.html` |
| Real Android | AVD per profile, headless emulator mirrored by scrcpy, quickboot snapshot, `-accel-check` to explain a black screen, hardware virtualization required (WHPX, KVM, Hypervisor.framework), about 4-5 GB per device | `android.py:198-214,614-652`, `README.md:67-74,170-172` |
| Android proxy limit | Emulator takes only an unauthenticated HTTP proxy on its command line; SOCKS and logins are unsupported (listed as future work via a local forwarder) | `android.py:634-637`, `README.md:73-74,297-298` |
| Error surface | Missing engine messages tell the person the action ("Download engine", `playwright install chromium`) | `browser.py:578-580,652-660` |

## 3. What HeroV already has, and what is missing
| Area | HeroV today | Gap |
|---|---|---|
| Engine per profile | `Engine` is `chrome` or `camoufox`, fixed at creation, UI to pick | No `android` variant |
| Phones on the Chrome engine | The ShardX engine spoofs natively (C++); 50 Android devices in the library; CreepJS flags all 50 on WebGL parameters (our own measurement) | No phone-shaped window or start page; the WebGL flag needs real captures |
| Phones on Camoufox | None: the 113 recorded presets are desktop | Android presets, touch and layout prefs, phone window, fonts |
| iOS | None | Spoof only, with a visible limitation |
| Real Android (AVD) | None | Optional, heavy |
| Migration | Missing fields default; profile files are verbatim | A repair step for stored Camoufox presets |

## 4. ADR (adapted to Rust/Tauri; no Python, Pydantic or Playwright)
1. **Engine enum gains `android`**, behind a Cargo feature (`android-engine`, off by default). `chrome` and `camoufox` keep working unchanged; files without the field stay Chrome.
2. **One phone registry**, `devices.json` in the repo: id, brand, model, `os` (`android`|`ios`), OS version, CSS width and height, DPR, cores, memory, GPU strings, UA templates. Built from HeroV's own library and public specifications. The Chrome engine keeps using its library payloads; the registry feeds Camoufox and iOS.
3. **Coherence rules live in tests**, one assertion per rule: `Linux armv8l` for Android, `iPhone` for iOS with no `oscpu`, touch points 5, portrait screen, DPR from the table, no desktop fonts.
4. **Stable identity**: seed is the profile id, as in `camoufox::config`; same device and id give the same config on every launch.
5. **Launch per engine.** Camoufox phone: identity config, touch and viewport prefs, window sized to the phone, phone fonts only. Chrome phone: existing path plus an optional chromeless `--app` window if the engine accepts it (to be tested). iOS: Safari UA on either engine, with a limitation notice shown in the editor and on launch.
6. **Migration**: a stored Camoufox preset id that no longer exists is remapped deterministically from the profile id, and the result is saved once.
7. **Errors**: typed, each with a short message and an action ("Install the engine", "Enable virtualization (WHPX/KVM)", "Install the Android components").
8. **Android real engine** stays a separate package: SDK, emulator and scrcpy installed on request (several GB), accel check first, and the local relay extended with an HTTP front so the emulator can use authenticated proxies.

## 5. Work packages, and decisions needed
| WP | Scope | Acceptance |
|---|---|---|
| MP1 | Phone registry and Android identity on Camoufox | Real engine reports `Linux armv8l`, touch 5, portrait phone screen, `pointer: coarse`; same result on a second launch |
| MP2 | Phone window and start page (Camoufox first, Chrome if `--app` works) | Window has the phone's size; no tabs; the page lands somewhere visible |
| MP3 | iOS spoof with the limitation notice | UA, platform and screen read back as iPhone; notice shown |
| MP4 | One-click "New phone" in the interface | Pick a device, profile created with the right engine, launched |
| MP5 | Migration and error taxonomy | Old profiles launch; each missing component gives its message |
| MP6 | Real Android engine (optional, feature-flagged) | A device boots, mirrors, and closes cleanly on a virtualization-capable machine |

Known limit to keep in view: on a Windows PC any phone profile still reports **the PC's real graphics card** through WebGL (Camoufox) or invented parameters (Chrome engine, flagged by CreepJS). Only a real emulator or a real device removes that; the registry cannot.

Decisions for the owner: (1) install REA or not (recommended: no); (2) start with MP1 to MP3 on Camoufox, then MP4; (3) whether MP6 is wanted at all this quarter.

## MP1 status (2026-10-21): identity built, checker verdict not yet clean

Built: 12 Android phones (`src-tauri/src/camoufox/data/phones.json`, tuples from the ManyFaces reference) as `cf-and-N` presets next to the desktop ones; user agent, `Linux armv8l`, 5 touch points, CSS-pixel portrait screen, pixel ratio, phone-sized window, phone font list, the model's GPU name, touch prefs. Rust tests: 45 pass (coherence of every phone, every key known to the pinned Camoufox).

Checked on the real engine (non-headless window): user agent, platform, `ontouchstart`, `maxTouchPoints` 5, pixel ratio 2.625, screen and inner size 412×915, a responsive layout on scanbrowser.net.

**scanbrowser.net on a phone profile:** Browser normal, Network normal, **Software: anomaly, Hardware: anomaly**, headline "not trustworthy". The same site on a Windows profile: Hardware and Network normal. The exact rows that trip it are not shown by the site's summary; candidates:
- `pointer: coarse` is **false** and `hover: hover` is true; the `ui.primaryPointerCapabilities` pref has no effect on this build (also tried through `user.js`);
- WebGL 1.0 only is reported, `deviceMemory` is empty;
- the GPU name is a phone's but the parameters behind it are the engine's own (no real phone recording exists);
- phone font list gives a fingerprint of its own and the page text renders in an odd fallback font.

Next: isolate each candidate one at a time against scanbrowser, starting with pointer capability (needs a different mechanism than the pref) and WebGL.

### MP1 update (2026-10-21, later)
Hardware now passes on scanbrowser.net for the phone profile (cause: window narrower than Firefox's minimum width; fixed with a profile stylesheet). Platform is `Linux armv81` and the renderer ends with `, or similar`, as in real Firefox-on-Android captures. **Software still flags** the phone (a recorded desktop profile passes it); likely the font fingerprint, which needs a real-device capture. Details and the generator plan: `docs/references/antidetect-generator-research.md`.
