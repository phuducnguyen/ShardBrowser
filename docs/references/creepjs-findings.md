# CreepJS findings (2026-10-19)

How the HeroV engine and the fingerprint library score on CreepJS, why, and what follows. Reproduce with `node scripts/creep-check.mjs <fingerprint.json>...` (real engine, headless by default, launcher-style language fields) and `npm run check:fingerprints`.

## 1. What was measured
CreepJS exposes its own result object (`window.Fingerprint`). Its trust score is built from objective signals plus a "crowd-blending" percentage computed from its server data. We can read the objective part only:
- **lies**: API results that contradict each other or the engine (`lies.totalLies`).
- **trash**: values that cannot come from a real browser (`trash.trashBin`).
- **headless / likeHeadless / stealth** tells.
A run is **CLEAN** when lies = 0, trash is empty and no headless or stealth flag is set.

## 2. Results
| Set | Tested | CLEAN | Flagged | Flag |
|---|---|---|---|---|
| Windows (`win-arc`, one NVIDIA, one AMD) | 3 | 3 | 0 | none |
| Android (library) | 50 of 50 | 0 | 50 | `WebGLRenderingContext.getParameter: suspicious gpu` and `suspicious capabilities`, identical in every case |

Notes
- Lies were 0 and the headless/stealth tells were all false in every run, Android included. Language, time zone and `Intl` agree once the launcher's fields (`languages`, `accept_language`, `icu_locale`) are set; a first harness without them produced an `Intl` red flag, which was the harness, not the engine.
- The flag does not depend on the GPU string format: bare strings (`Mali-G57`, `Adreno (TM) 613`) and ANGLE-wrapped strings (`ANGLE (ARM, Mali-G57, OpenGL ES 3.2)`) are flagged alike, across Adreno and Mali families.
- Windows runs show `ram: 8` in CreepJS for entries that may carry larger values in the file; check whether the engine caps `deviceMemory` before trusting the 16/32 GB entries.

## 3. Why Android is flagged (read from CreepJS's public source)
CreepJS keeps two fixed allow-lists of about 300 values each:
1. `brandCapabilities`: a hash of `[GPU brand, the sorted set of numeric WebGL parameter values]`.
2. `capabilities`: a checksum of that same numeric parameter set.

If the profile's WebGL parameter set is not in the list, it records `suspicious gpu` and `suspicious capabilities` and marks WebGL as low-entropy. The lists come from devices CreepJS has seen, so a set passes only if it equals the set of a real device.

**Consequence:** a generator that invents or mixes WebGL parameters cannot pass this check, however consistent the rest is. Windows entries pass because they are real captures; the Android entries are not (or not of a device CreepJS knows, or from a driver generation newer than its list).

## 4. What the reference projects do (and do not) tell us
- **Camoufox / ManyFaces:** no dataset, but they do not synthesise WebGL parameters either. They rely on the engine's own (real) values and generate only the identity fields (OS, UA, screen, DPR, cores, locale) from small hand-written tables, a seeded random generator, coherence rules, and a "repair on load" step. The identity is pinned per profile.
- **Damru:** runs an Android OS in Docker (Redroid) on an x86 PC and **patches the GPU strings** at driver level; the GPU underneath is not a phone GPU. Its own research report (`research/android-virtualization-alternatives.md`) is frank about the limit, in its words: "no solution provides true mobile GPU hardware emulation" and "the mobile GPU fingerprint problem is unsolvable on x86_64 architecture". It reports that string patching leaves the WebGL extension count at 30 against about 43 on a real Adreno, passes only the shallow detection level, and gives 44% "likeHeadless" on CreepJS for that setup (author's own figures, method not given). It lists real ARM64 hardware (phones or phone farms) as the only route to a real mobile GPU. Its README's higher CreepJS claim is self-reported and sits uneasily with that report.

Damru therefore confirms the finding above from the other side: faking the strings is not enough, and the only real fix is real mobile GPU output. Our library has the same weakness (50/50 flagged).

## 5. What can be generated, and what must be captured
| Part | Source |
|---|---|
| Identity (model, UA, client hints, screen, DPR, cores, RAM, Android version, locale, time zone, battery, connection) | Can be generated from hand-written tables with a per-profile seed and coherence rules (the validator is the rule set). |
| **WebGL parameter set, extensions, WebGPU limits, GPU strings** | **Must come from a real device** (or the engine's own real GPU). Not generated. |
| Noise seeds (canvas, audio, rects, fonts) | Generated per profile and pinned. |

So the work for Android is a **capture pipeline**, not a larger generator: a collector page run on real phones that records exactly the WebGL set, a converter into a library entry, and `creep-check` as the acceptance test.

## 6. Limits of this evidence
- CreepJS is one detector. A CLEAN run says nothing about other detectors or a site's own checks.
- The crowd-blending percentage was not measured.
- Headless mode was used; the headed result may differ slightly (not compared yet).
- Runs used the machine's real IP (no proxy), so IP-based checks were not exercised.

## 7. Options when no phone is available (owner does not capture on Android devices)
| Option | Gives real mobile GPU params? | Notes |
|---|---|---|
| Rent real phones remotely (device farms such as Firebase Test Lab, BrowserStack, AWS Device Farm) and open the collector page in their Chrome | Yes | Pay or use free quota per minute; check each service's terms for automated page loads. Best fit for "no devices owned". |
| Ask people who already own phones to open the collector link | Yes | Slow, but free; needs consent and a link that stores nothing but the capture. |
| Emulator or Redroid with string patching (Damru's method) | No | Damru's own report says it fails the deeper checks. |
| Android Studio emulator with host GPU | No | Exposes the PC's GPU. |
| Windows-first product, Android labelled experimental | n/a | Honest default until one of the first two exists. |
**Recommendation:** ship Windows as the strong path, mark every current Android entry as "experimental: WebGL not CreepJS-clean" in the app, and build the collector so remote real phones can feed it.

## 8. Next steps
1. Build the collector page and converter (release 0.3.0 in `plans/261019-herov-gap-roadmap/release-plan.md`).
2. Capture 10+ real phones (own, borrowed or rented remotely) across the main GPU families; accept an entry only if `creep-check` is CLEAN.
3. Re-test Windows memory values against the engine.
4. Add `creep-check` on a fixed sample to the release gates.
