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

## Alternative tested: fingerprint-chromium (2026-10-22)
`adryfish/fingerprint-chromium`, BSD-3-Clause, built on ungoogled-chromium; release `150.0.7871.186` Windows ZIP, SHA-256 checked against the digest GitHub publishes. Run on this machine with throw-away profiles, direct connection, `--fingerprint=<seed> --fingerprint-platform=windows --fingerprint-brand=Chrome --timezone=Asia/Bangkok --lang=vi-VN`.

| Check | Result |
|---|---|
| Seed changes the identity | Yes: cores, memory and GPU model change per seed (host 64 cores / GT 730 became 24 cores / RTX 3060 with seed 12345, 28 cores / RTX 3050 Laptop with 777); GPU maker stays the host's; screen is not spoofed; `navigator.languages` gains extra languages (`fr-FR`, `en-US`) |
| **Canvas spoofing** | **Crashes the page** (renderer crash, `Crashpad_NotConnectedToHandler`) on CreepJS and on scanbrowser.net, every run; `--disable-spoofing=canvas` avoids it |
| CreepJS (canvas spoofing off) | 0 lies, 0 trash, 0% headless, 0% stealth, 19% like-headless; platform estimate Windows |
| scanbrowser.net, no seed | Browser **anomaly** (shows "Chromium" and "Google License: No", a tell of ungoogled builds), Software normal, Hardware normal, Network **anomaly** |
| scanbrowser.net, seed 12345 | Browser **anomaly**, Software **anomaly**, Hardware normal, Network **anomaly** |
| Proxy | `--proxy-server` without login (HeroV's local relay would supply the login) |

Verdict: not ready to replace the ShardX engine. The canvas crash is a blocker (a crashing tab is itself a tell), and three of four scanbrowser categories fail. Watch later releases; re-test when the canvas crash is fixed.
