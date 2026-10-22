# CloakBrowser as a Chrome-side engine: evaluation

Read 2026-10-21 from public sources only: https://cloakbrowser.dev, the GitHub repository `CloakHQ/CloakBrowser` (README, `BINARY-LICENSE.md` v1.3 July 2026, `LICENSE`). Test results quoted below are the vendor's own and were not reproduced here.

## What it is
- A patched Chromium (on ungoogled-chromium) with 87 source-level fingerprint patches: canvas, WebGL, audio, fonts, GPU, screen, WebRTC, network timing, automation signals.
- Shipped as a closed binary (~200 MB) that a thin MIT-licensed Python/JS/.NET wrapper downloads. The wrapper launches it through Playwright/Puppeteer; the binary also runs on its own with flags.
- Platforms: Windows x64, Linux x64/ARM64, macOS. Latest build Chromium 155; free older build v146 on GitHub Releases.
- Vendor test table: reCAPTCHA v3 0.9, Cloudflare Turnstile pass, FingerprintJS pass, BrowserScan 4/4 normal, deviceandbrowserinfo 0 flags.

## How the identity is set
One seed (`--fingerprint=<n>`) derives GPU, cores, memory, screen and the canvas/WebGL/audio noise as one package; explicit flags override single values: `--fingerprint-platform=windows|macos|linux`, `--fingerprint-gpu-vendor=NVIDIA|Intel`, screen width/height, hardware concurrency, device memory, brand and brand version (Chrome, Edge, Opera, Vivaldi), platform version, time zone, locale, WebRTC IP, storage quota, taskbar height. Proxies: HTTP and SOCKS5 with login, natively.

What it does **not** offer: Android or iOS personas (desktop platforms only), choice of a specific GPU model, a library of recorded devices.

## Licence: the deciding point
- Wrapper: MIT. **Binary: proprietary** (`BINARY-LICENSE.md`).
- Allowed without a separate licence: personal, commercial and internal business use where you control the browsing; listing CloakBrowser as a dependency while end users download the binary themselves from official channels.
- Needs a separate **OEM/SaaS licence**: when the binary is "bundled, embedded, exposed through an API, or used to provide browser functionality to third-party customers, including … as part of a product". A public profile manager that launches it for its users falls under this wording.
- Forbidden: redistribution, repackaging, modification, reverse engineering.
- The latest major version needs a paid subscription; the free key gives **one concurrent session**. Paid: 5 / 20 / 200 / 2,000 concurrent sessions ($19 to $499 a month at promo prices). The binary reports concurrently open sessions for licence checks. The older free v146 stays usable under the same licence; no session limit is stated for it, but it is behind on patches.

## Fit with HeroV's requirements
| Requirement | CloakBrowser |
|---|---|
| Unlimited profiles | Yes (profiles are just data folders) |
| Unlimited parallel sessions | **No** on the current build: 1 free, then paid tiers; possible on the old v146 only |
| Public, free, open-source HeroV | **Not without an OEM licence** from CloakHQ |
| Android phone profiles | No |
| Owner's own personal use | Allowed (internal use), within the session limit of the key |

## Recommendation
Do not build it in as a shipped engine. If the owner wants it, ask CloakHQ (info@cloakbrowser.dev) for written permission or an OEM quote for a free open-source launcher, and decide after the answer; it is the same situation as Wayfern. Meanwhile HeroV already gives unlimited profiles and unlimited parallel sessions with its two engines (no limit in the launcher code; the practical limit is the computer's memory).
