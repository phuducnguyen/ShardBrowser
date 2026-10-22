# Versioning and releases

How HeroV is numbered, which builds go to whom, and the checklist every release passes. Owner: the product lead (today the repository owner). Last reviewed 2026-10-22.

## 1. Version numbers: Semantic Versioning 2.0

`MAJOR.MINOR.PATCH[-PRERELEASE]`, e.g. `0.2.0`, `0.2.1`, `0.3.0-beta.2`.

| Part | Raised when | Example |
|---|---|---|
| MAJOR | 1.0.0 marks the first release we promise to keep compatible (profiles, API, data folder). Until then it stays 0. | `1.0.0` |
| MINOR | New features or a visible change in behaviour. While MAJOR is 0, a MINOR may also change data or API, and the release notes say so under "Upgrade notes". | `0.2.0` (Camoufox engine and phones) |
| PATCH | Fixes only, no new feature, no data change. | `0.2.1` |
| PRERELEASE | A build for testers before the version is final: `alpha.N` (incomplete, for the owner), `beta.N` (feature-complete, for testers), `rc.N` (release candidate, no known blockers). | `0.2.0-beta.1` |

SemVer precedence decides what is "newer": `0.2.0-beta.1 < 0.2.0-beta.2 < 0.2.0-rc.1 < 0.2.0 < 0.2.1`.

**One source of truth.** The version lives in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, and is only ever changed with:

```
npm run version:set -- 0.2.0-beta.2     # writes all three
npm run version:set -- --check          # fails if they disagree or are not SemVer
```

**What the app shows.** The rail shows `vX.Y.Z[-pre]` under the logo (amber for test builds); the title bar and tray tooltip say `HeroV Browser X.Y.Z`; Settings → About shows version, channel, build date, commit (`+dirty` if built from uncommitted changes) and a "Copy build info" line for bug reports.

**Engine contract is separate.** The ShardX engine feed checks a `min_launcher_version` written for the upstream launcher's numbering (2.x). HeroV answers it with `ENGINE_FEED_COMPAT` (`src-tauri/src/version.rs`, today `2.0.3`), never with its own version. Raise it only when the engine-side code is brought in line with a newer upstream launcher.

## 2. Channels

| Channel | Tag | GitHub release | Who gets an update prompt |
|---|---|---|---|
| Stable | `v0.2.0` | normal release | everyone |
| Test (beta, rc, alpha) | `v0.2.0-beta.1` | **pre-release** | only people already on a test build |

The update check (`launcher_update_check`) reads the releases of `phuducnguyen/ShardBrowser`: a stable build is only offered stable releases; a test build is offered the newest of both.

## 3. Release checklist (definition of done)

A release is not published until every box is ticked; the notes say which checks were not run.

1. **Scope frozen**: the CHANGELOG `[Unreleased]` section lists every user-visible change.
2. **Version set**: `npm run version:set -- X.Y.Z[-pre]`; `--check` passes.
3. **Quality gates**:
   - `npx tsc --noEmit`, `node scripts/check-i18n.mjs` (en, zh and vi complete), `npx vitest run`
   - `cargo test --lib` (with `HEROV_TEST_MANIFEST=1` on Windows)
   - real-engine checks that the change touches (ignored tests, run by hand)
4. **Changelog**: move `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`; write `docs/releases/X.Y.Z.md` (What is new, Known issues, Upgrade notes, Checks at release).
5. **Commit** `chore(release): X.Y.Z` on `main`, push.
6. **Build** `npx tauri build --bundles nsis`; rename to `HeroV-Browser-X.Y.Z-x64-setup.exe`; record its SHA-256.
7. **Smoke test** the installer: install over the previous version, start, see the right version in the rail and About, open one Chrome and one Camoufox profile. Say in the notes if it was not done on a clean machine.
8. **Publish** `gh release create vX.Y.Z <installer> --target main [--prerelease] --title "HeroV Browser X.Y.Z" --notes-file <notes with checksum>`.
9. **Announce** the link and what to test; open issues for every known issue left in the notes.

## 4. Hotfix

Branch from the release tag only if `main` already holds unreleased features; otherwise fix on `main`. Raise PATCH (`0.2.0` → `0.2.1`), run the full checklist (step 7 can be shortened to the affected flow), publish as a normal release.

## 5. History before this policy

| Old tag | What it was | Read as |
|---|---|---|
| `v0.1.0-ui.1` | new interface | 0.1.0 pre-release |
| `v0.1.0-camoufox.1` | Camoufox engine, phones | 0.2.0 pre-release (feature work beyond 0.1.0) |

The app reported `2.0.3` (the upstream number) in both; from `0.2.0-beta.1` on it reports its own version.
