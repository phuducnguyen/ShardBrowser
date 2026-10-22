# Changelog

All notable changes to HeroV Browser. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions: [Semantic Versioning](https://semver.org/spec/v2.0.0.html). How releases are made: [docs/releasing.md](docs/releasing.md).

## [Unreleased]

## [0.2.0-beta.1] - 2026-10-22

### Added
- Version you can see: the rail shows `v0.2.0-beta.1` under the logo (amber on test builds), the title bar and tray tooltip carry it, and **Settings → About** shows version, channel, build date and commit, checks for updates and copies a one-line build summary for bug reports.
- Release policy: SemVer, stable and test channels, release checklist (`docs/releasing.md`); `npm run version:set` keeps the three version fields equal.

### Changed
- New HeroV logo (shield with a V, on the brand gradient) for the app icon, installer, taskbar, rail and favicon. The app icon was still the inherited one.
- The app reports HeroV's own version (`0.2.0-beta.1`) instead of the upstream `2.0.3`; the engine feed keeps receiving `2.0.3` as its compatibility number.
- The update check looks at HeroV's own releases and compares by SemVer; test builds are offered test releases, stable builds only stable ones.
- Camoufox engine download uses eight connections at once and continues from where it stopped after an interruption; unpacking uses several threads.

### Fixed
- "Configuration Error" when starting a Camoufox profile after the engine was reinstalled while in use: the engine folder is now replaced by renaming (all or nothing), and a folder that lost a file counts as not installed so the app offers to install it again.
- The "What's new" page no longer opens on unrelated engine notes after a HeroV update.

## [0.1.0-camoufox.1] - 2026-10-21

Pre-release (read as a 0.2.0 pre-release). Camoufox (Firefox) as a second engine with recorded devices, WebGL masking and a proxy relay; 114 Android phone profiles with class and GPU filters. Notes: [docs/releases/0.1.0-camoufox.1.md](docs/releases/0.1.0-camoufox.1.md).

## [0.1.0-ui.1] - 2026-10-19

Pre-release. New HeroV interface, device-first profile creation, profile defaults, Vietnamese. Notes: [docs/releases/0.1.0-ui.1.md](docs/releases/0.1.0-ui.1.md).

[Unreleased]: https://github.com/phuducnguyen/ShardBrowser/compare/v0.2.0-beta.1...HEAD
[0.2.0-beta.1]: https://github.com/phuducnguyen/ShardBrowser/releases/tag/v0.2.0-beta.1
[0.1.0-camoufox.1]: https://github.com/phuducnguyen/ShardBrowser/releases/tag/v0.1.0-camoufox.1
[0.1.0-ui.1]: https://github.com/phuducnguyen/ShardBrowser/releases/tag/v0.1.0-ui.1
