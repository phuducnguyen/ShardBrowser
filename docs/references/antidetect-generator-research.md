# Research for the identity generator (phones and desktop)

Written 2026-10-21 from the two repositories the owner pointed at, plus measurements made on the real Camoufox engine. Everything here was read or measured; where something is a guess it says so.

## 1. What the two sources are

| Source | What it really is | Use for the generator |
|---|---|---|
| `fingerprintjs/fingerprintjs-ios` (MIT, 153 stars) | A **native iOS app library**, not a web one. It reads device model, screen size and scale, CPU count, physical memory, battery, low-power mode, locale, time zone, OS build and kernel version, boot time, mobile carrier codes, biometry type; then hashes them (SHA-256) at three stability levels (`unique`, `optimal`, `stable`). | **Not directly.** A web page in Safari cannot read these. Useful only as the list of what a native app can see, and for the idea of stability levels (which signals change often). Nothing to copy into a browser. |
| `embeddinglayer/awesome-fingerprinting` | A curated link list: libraries, checker sites, research papers, evasion tools. | Map of where real data and detection logic live (section 2). |

## 2. What in the list matters for us

| Item | Why | Licence / note |
|---|---|---|
| **Apify `fingerprint-suite`** (generator) | The only open source with **real captured fingerprints as a statistical model**, including Android and iPhone. See section 3. | Apache-2.0, active (pushed 2026-10-16) |
| CreepJS | Detects lies: a value that contradicts another. Already used (see `creepjs-findings.md`). | MIT |
| BotD (FingerprintJS) | Bot checks; shows what an automation-flagged browser leaks. | MIT |
| TZP / arkenfox | Gecko-specific fingerprint surface; needed because Camoufox is Gecko. | MIT |
| ThumbmarkJS | Open alternative to FingerprintJS; a second view of which signals are hashed. | MIT |
| deviceandbrowserinfo.com, rebrowser bot-detector, EnvTrace, BrowserLeaks, AmIUnique, PixelScan | Checker sites. We use **scanbrowser.net** as the main one (owner's choice: strictest). | Black boxes, no data to download |
| Papers: Picasso (Google), WebGPU fingerprinting, "Fingerprinting Evasive Bots", FP-Stalker style linking | Why GPU, canvas and WebGPU values must agree with each other and with the claimed OS. | Read before building WebGPU support |
| JA3/JA4, HTTP/2 fingerprint (`tls.peet.ws`, uTLS, curl-impersonate) | The network layer also identifies a browser. Gecko's own TLS is fine for a Gecko profile; a phone profile must not use a Chrome-style one. | Out of scope for the engine, relevant for any future HTTP client |

## 3. The Apify dataset (the useful part)

File: `packages/fingerprint-generator/src/data_files/fingerprint-network-definition.zip` (705 KB). A Bayesian network over 25 signals; every other signal is conditioned on the user agent. Values are real captures with probabilities.

Signals: userAgent (235 values: 26 Android, 52 iPhone), userAgentData, appVersion, platform, oscpu, maxTouchPoints, hardwareConcurrency, deviceMemory, vendor, productSub, doNotTrack, screen (4569 combinations incl. outer size and pixel ratio), videoCard (vendor and renderer, 773), fonts, plugins, battery, audio and video codecs, multimedia devices.

**It has no WebGL parameters, no extension lists, no canvas or audio values.** It gives the GPU *name* only. So it fixes names, screens and navigator values, not the deep WebGL surface.

### Android (Chrome entries unless noted)
- `maxTouchPoints`: 5 (88%), 1, 3. `hardwareConcurrency`: 8 (76%). `platform`: `Linux armv81` (57%), `Linux armv8l` (24%), `Linux aarch64`.
- Renderers seen: Adreno 830, 650, 506, 630, 610, 730; Mali-G71, G710, T720, G51 (Chrome writes `ANGLE (ARM, Mali-G51, OpenGL ES 3.2)`).
- Fonts probe on Android: mostly empty or `sans-serif-thin`; desktop fonts are absent.
- Screens: 360×910 @1, 384×854 @2.8125, 412×915 @2.625, 360×800 @3, 393×851 @2.75 and others. Outer size equals screen size on a phone.
- **Noise to filter out:** a few "Android" rows carry desktop GPUs (Intel, AMD under Direct3D11), 1905×896 screens and 96 cores; these are bots or mislabelled and must not be sampled.

### Firefox on Android (only 2 user agents: Android 16 / Firefox 150 and Android 13 / Firefox 136)
- `platform` and `oscpu` are both **`Linux armv81`** (not `armv8l`).
- Renderer carries the suffix **`, or similar`**, e.g. `Adreno (TM) 650, or similar`, vendor `Qualcomm`.
- `maxTouchPoints` 5, 8 cores, **no `deviceMemory`**, no `navigator.vendor`, `productSub` 20100101, `appVersion` `5.0 (Android N)`, `doNotTrack` "1".
- Screens: 384×832 @3.75, 420×933 @3, 378×811 @2.857, 396×880 @2.727. Window outer height is smaller than the screen (system bars): 787 of 832, 824 of 880.
- Fonts probe returns nothing.

### iPhone (Safari)
- GPU `Apple GPU` / vendor `Apple Inc.` (98%), `platform` `iPhone`, 5 touch points, 4 cores (92%), vendor `Apple Computer, Inc.`.
- Screens: 390×844 @3 (26%), 393×852 @3, 430×932 @3, 375×812 @3, 440×956, 402×874, 428×926, 414×896 @2.

### Licence
Apache-2.0: copying data and code is allowed with the notice; keep a `NOTICE` entry like the one for fpgen. The data is statistical, so we can also use it only as a reference and write our own table.

## 4. What the real engine showed (measured today)

Method: a Camoufox window opened on https://scanbrowser.net/ through the launcher (direct connection, Vietnam address), verdict read from the page. Scripts for this are test-only and live in `src-tauri/src/camoufox/run.rs` (ignored tests).

| Profile | Browser | Software | Hardware | Network |
|---|---|---|---|---|
| Windows (recorded device) | OK | OK | OK | OK |
| macOS (recorded device) | OK | OK | not captured | not captured |
| Android phone, first build | OK | anomaly | anomaly | OK |
| Android phone, after the fixes below | OK | **anomaly** | **OK** | OK |

Findings that changed the code:
1. **Window geometry was the Hardware flag.** Firefox will not make a window narrower than about 500 px, so a 412 px phone reported `outerWidth` 516 > `screen.width` 412, impossible on a phone. A profile `chrome/userChrome.css` that lifts the minimum (`min-width:0`) plus the pref `toolkit.legacyUserProfileCustomizations.stylesheets` makes outer = inner = screen = 412×915. Hardware turned OK.
2. Platform and oscpu changed to `Linux armv81` and the renderer gets `, or similar`, matching real Firefox-on-Android captures. (Hardware stayed OK.)
3. `deviceMemory` empty is **correct** for Firefox (it does not implement it); it was never a defect.
4. The GPU name is not what flags the phone (removing it changed nothing).

Still open on phones:
- **Software anomaly.** Not the time zone (changing it to `Asia/Ho_Chi_Minh` changed nothing; the Windows and macOS profiles pass with the same zone) and not the font list alone (an empty list and the phone list both fail). A desktop recorded profile passes, so the remaining difference is data that exists only for desktops: a recorded font set. Best guess: the checker compares the font fingerprint with real Firefox-Android devices. Needs a real capture.
- `pointer: coarse` is false and `hover` true. `ui.primaryPointerCapabilities` and `ui.allPointerCapabilities` exist in the engine but have **no effect** on this build (tried as startup prefs and in `user.js`, values 1 to 4, single-process too). Probably needs an engine patch; not yet seen as a flag.
- WebGL parameters behind a phone GPU name are the engine's own (no phone recordings anywhere public).

## 5. Plan for the generator

1. **Phone registry v2** built from the Apify data (Firefox-on-Android rows first, Chrome rows as the pool of plausible screens and GPUs), filtered of the noise above. Fields: screen, pixel ratio, outer height (screen minus system bars), GPU name, cores, platform string. Keep ManyFaces tuples only where they agree with real captures.
2. **Capture page for real phones** (LAN page, one visit per model): WebGL parameters and extensions, shader precision, canvas and audio probes, fonts, `matchMedia` pointer values, screen and window sizes. Output in the same JSON shape as `webgl-devices.json`. This fixes both the WebGL gap and the font question. Needs 3 to 5 Android models from the owner.
3. **Coherence checks in the generator** (all testable without a browser): outer ≤ screen; touch points match device class; platform and oscpu match the user agent family; renderer string style matches the browser (`, or similar` for Firefox Android, `ANGLE (...)` for Chrome Android); fonts match the OS family; pixel ratio is a value seen for that screen.
4. **Scanbrowser regression run** for one profile per OS family after any generator change; record the four verdicts in this file.
5. iPhone: GPU `Apple GPU`, 4 cores, Safari user agent. Camoufox is Firefox, so it cannot match Safari's JavaScript surface; an iPhone profile must show the limitation notice already planned in MP3.

## 6. Not done / not verified
- The two Firefox-Android rows in the dataset are only two browsers' worth of data; ratios there are weak.
- No access to scanbrowser's rules; its page and API are obfuscated, so only black-box verdicts are used (no replay of its requests).
- WebGPU surface on phone profiles untested.
