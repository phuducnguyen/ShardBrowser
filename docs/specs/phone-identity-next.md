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

## Done 2026-10-21: the pool is in the picker
Create profile → Camoufox → Android now shows a segment filter (flagship, mid-range, entry-level) and a GPU family filter, both with counts so a chip never leads to an empty list; a device list grouped by class; an Android version list limited to what that class of phone could run (stored as `camoufox.android_version`, applied to the user agent and `appVersion` only if inside the class range); and a card of what sites will see. A new profile gets a random phone on its own; Random device never repeats the current one; a filter that excludes the current phone moves to one that fits. Every automatic or chosen change raises a toast. Tests: `PhonePicker.test.tsx` (9), Rust `a_phone_class_decides_which_android_versions_are_offered`.

## Software flag on phones: what was ruled out (2026-10-21)
Measured with the real engine on scanbrowser.net, one change at a time on the same phone, Hardware stays OK in every run:

| Change | Software verdict |
|---|---|
| Time zone: host is Mountain Standard Time; page reads `Asia/Bangkok`, offset -420 in the main thread, a worker and an iframe, and `Date` strings agree | still anomaly (and the Windows and macOS profiles pass with the same zone) |
| Time zone set to `Asia/Ho_Chi_Minh` | still anomaly |
| Fonts: phone list (9), empty list, `Roboto` only, Linux recorded base, engine default | still anomaly each time; the site's client id does not even change with fonts or zone |
| Touch events switched off | still anomaly |

So the host time zone is **not** leaking (it is hidden in every context tested) and neither fonts, zone nor touch decide this verdict. What differs from the recorded desktop profiles that pass is only that a phone has no recorded device behind it. Item 1 of the table above is therefore parked until real device data exists; items 4 (audio), 2 (WebGL) and 3 (pointer) do not depend on it.
