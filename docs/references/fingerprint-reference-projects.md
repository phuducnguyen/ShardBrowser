# Reference projects — fingerprints, device profiles, anti-detect

Kept for later study (added 2026-10-19). **Read, learn ideas, do not copy.** Check each licence before any reuse; the rows below say what the page showed, not legal advice. Summaries come from the public GitHub pages; claims such as benchmark scores are the projects' own and were not verified here.

## 1. Added by the owner

### Damru — https://github.com/akwin1234/damru
- **What:** "Undetected Playwright for Android". Runs a real Android 14 in Docker (Redroid) and drives Chrome on it through Playwright and CDP. Beta; Redroid is the only supported environment, physical devices are unsupported.
- **How it spoofs (as described):** at OS, binary and protocol level, with no JavaScript injection: system properties through `resetprop`, `wm size/density`, patched Vulkan/GLES driver strings so the GPU reads as a mobile GPU, an `LD_PRELOAD` library that fakes RAM/CPU counts, CDP overrides for cores and touch points, iptables rules against WebRTC leaks, about 184 randomised TLS (JA3) variants, `sec-ch-ua` Client Hints aligned to the Chrome version, timezone and locale taken from the proxy exit.
- **Data worth studying:** **155 Android device profiles** (Samsung, Pixel, Xiaomi, OnePlus…), with a "premium subset" used for random picks; how a profile ties model, screen, density, GPU, cores and RAM together.
- **Stack:** Python 3.10+, Playwright, CDP, Docker, Redroid, ADB, C hooks (`vulkan_layer.c`, `libfakemem.c`), curl_cffi.
- **Licence: PolyForm Noncommercial 1.0.0.** Commercial use needs a separate licence. HeroV is meant to be sold or run as a service, so **no code, no device data, no binaries** from it go into HeroV; ideas and public facts only.
- **Useful for HeroV:** what a coherent Android profile has to contain; the idea of picking from a weighted "premium" subset; Client Hints alignment; TLS variety.

### ManyFaces — https://github.com/chentaymane/ManyFaces
- **What:** self-hosted anti-detect browser manager. FastAPI server plus a vanilla-JS dashboard (or a native window). Each profile has its own storage, cookies, fingerprint and proxy.
- **Engines per profile:** Camoufox (patched Firefox), Chromium (Playwright), or a real Android device in the Android Emulator.
- **Fingerprint approach (as described):** generated to be internally consistent (OS, user agent, GPU, screen, DPR, cores, time zone, locale) and **pinned per profile across launches**; Camoufox spoofs at the native C++ level; phone profiles use device presets (Pixel, Galaxy, OnePlus, Xiaomi, iPhone).
- **Other features:** proxy pool (manual, random, round-robin) with GeoIP locale/time zone matching; cookie import/export; profile import/export as JSON; Python API to launch the same profiles from scripts.
- **Stack:** Python, FastAPI, SQLite, Camoufox 0.5.x, Playwright, pywebview, PyInstaller, Android SDK/emulator, scrcpy.
- **Licence: not stated on the page.** Treat as all rights reserved until a licence file is found.
- **Useful for HeroV:** the "pinned per profile" rule (same as the *locked identity* in `docs/specs/profile-defaults-and-create-profile.md`); how a manager lists three engines side by side (our Camoufox plan, spec section 8); the proxy-pool modes.

## 2. Found while researching (same rules)
| Project | Why it matters | Licence on the page |
|---|---|---|
| [Apify fingerprint-suite](https://github.com/apify/fingerprint-suite) | Bayesian-network sampling of real browser/OS/device combinations, with constraints | not confirmed |
| [BrowserForge](https://github.com/daijro/browserforge) | Python port of the same idea; used by Camoufox | not confirmed |
| [Donut Browser](https://github.com/zhom/donutbrowser) | Open-source anti-detect manager, Chromium via Wayfern, sync and local API | AGPL-3.0 (copying code would force HeroV open) |
| Google Play supported-devices catalog | Authoritative Android model/RAM/SoC/GPU/screen list, exported from your own Play Console | your account's terms |
| [AOSP `devices.xml`](https://android.googlesource.com/platform/sdk/+/refs/heads/main/files/devices.xml) | Screen sizes and densities of reference devices | Apache-2.0 (AOSP) |

## 3. How these feed the plan
- Android device library: use Damru's *structure* (what a complete profile holds, a weighted premium subset) as a checklist for new entries; fill the values from your own devices or the Play Console export.
- Engine list: ManyFaces shows Camoufox, Chromium and Android side by side, which matches spec section 8; a second engine is still a backend RFC.
- Isolation and pinning: both projects pin identity per profile, which HeroV's *locked identity* already requires.
- Anything that needs a Docker/Redroid Android emulator is a different product shape from HeroV's desktop engine and is out of scope unless the owner asks.

## 4. Identity generator research

See [antidetect-generator-research.md](antidetect-generator-research.md): Apify fingerprint-suite data, Firefox-on-Android facts, scanbrowser results.
