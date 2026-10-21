# Phone identity: what is left and in what order

Status 2026-10-21. Owner decisions: real-device capture is **not needed now**; the Software flag on phones is accepted for the time being and optimised later. Evidence and numbers: `docs/references/antidetect-generator-research.md`.

## Open items

| # | Item | Symptom | Idea | Check |
|---|---|---|---|---|
| 1 | Font fingerprint (Software flag) | scanbrowser.net reports Software "anomaly" on phones; recorded desktop profiles pass | Isolate by trying font sets one at a time: Roboto only; Roboto + Noto Sans + Noto Serif; the Android set plus Droid Sans Fallback; the Linux recorded base filtered to what Android ships. Keep the one that flips the verdict. Also check the Camoufox bundled fonts folder (Roboto, Noto, DejaVu are there) | scanbrowser Software card, CreepJS Fonts |
| 2 | WebGL hash is red in CreepJS | phone GPU name over the engine's own parameters | Choose, per GPU tier, the recorded desktop device whose parameter set is closest to a phone GPU and trim the parameters that a phone cannot have (very large texture sizes, extra extensions); no real phone data needed | CreepJS WebGL hash colour |
| 3 | `pointer: coarse` / `hover: none` | engine ignores `ui.*PointerCapabilities` | Look for another switch (touch override flag in the browsing context) or an engine patch; check whether any checker actually reads it first | `matchMedia` in the probe test |
| 4 | Audio hash partly red | noise injection | Compare with a Windows profile first; if equal, it is engine-wide and not phone-specific | CreepJS Audio |
| 5 | Trust score and lie count | not captured | Find how to reach the top of the CreepJS page in a narrow window (or read its result through a loopback report) | CreepJS header |
| 6 | Pool quality | generated phones have a made-up Android version inside a range | Tighten ranges with release dates of each GPU; add models by name where a screen and GPU pair maps to a known device | coherence tests |

## Order
1 (cheap, one scanbrowser run per font set) → 5 → 4 → 2 → 3 → 6. After each change: Rust tests, then scanbrowser and CreepJS on one generated phone and one named phone, results appended to the research doc.

## Tools already in the repo (ignored tests in `src-tauri/src/camoufox/run.rs`)
`real_window_on_url` opens a URL in a real window (`HEROV_URL`, `HEROV_PRESET`, `HEROV_SECONDS`, `HEROV_CFG_JSON` to override config keys, null removes one); `real_phone_window_reports_a_phone` prints navigator, screen and pointer values from inside the page.
