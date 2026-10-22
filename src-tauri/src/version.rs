//! HeroV's own version (Semantic Versioning, from `Cargo.toml` / `tauri.conf.json` / `package.json`,
//! kept equal by `npm run version:set`) and the build it came from.
//!
//! The ShardX engine feed checks a launcher against a `min_launcher_version` written for the
//! upstream launcher's numbering (2.x). HeroV numbers its own releases from 0.x, so that check uses
//! `ENGINE_FEED_COMPAT`, the upstream version whose engine contract this launcher implements, never
//! HeroV's product version.

use serde::Serialize;

/// The upstream launcher version whose engine-feed contract this launcher keeps. Raise it only when
/// the engine-side code is brought in line with a newer upstream launcher.
pub const ENGINE_FEED_COMPAT: &str = "2.0.3";

/// HeroV's product version, e.g. `0.2.0-beta.1`.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Serialize, Clone, Debug)]
pub struct BuildInfo {
    pub version: String,
    /// Short commit hash; `+dirty` when built from uncommitted changes.
    pub commit: String,
    /// Build time, seconds since 1970-01-01 UTC.
    pub built_unix: u64,
    /// `stable`, `beta`, `alpha` or `rc`, from the pre-release part of the version.
    pub channel: String,
    pub engine_compat: String,
}

pub fn channel_of(version: &str) -> String {
    match semver::Version::parse(version.trim_start_matches('v')) {
        Ok(v) if v.pre.is_empty() => "stable".into(),
        Ok(v) => v.pre.as_str().split('.').next().unwrap_or("pre").to_string(),
        Err(_) => "unknown".into(),
    }
}

pub fn info() -> BuildInfo {
    BuildInfo {
        version: VERSION.to_string(),
        commit: option_env!("HEROV_COMMIT").unwrap_or("unknown").to_string(),
        built_unix: option_env!("HEROV_BUILT_UNIX").and_then(|s| s.parse().ok()).unwrap_or(0),
        channel: channel_of(VERSION),
        engine_compat: ENGINE_FEED_COMPAT.to_string(),
    }
}

#[tauri::command]
pub fn app_build_info() -> BuildInfo {
    info()
}

/// Whether release `latest` (a tag such as `v0.2.0`) is newer than `current`, by SemVer precedence:
/// `0.2.0-beta.1 < 0.2.0-beta.2 < 0.2.0 < 0.2.1`. Anything that does not parse is never "newer".
pub fn is_newer(latest: &str, current: &str) -> bool {
    match (semver::Version::parse(latest.trim_start_matches('v')), semver::Version::parse(current.trim_start_matches('v'))) {
        (Ok(l), Ok(c)) => l > c,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_product_version_is_valid_semver() {
        assert!(semver::Version::parse(VERSION).is_ok(), "{VERSION}");
        assert!(semver::Version::parse(ENGINE_FEED_COMPAT).is_ok());
    }

    #[test]
    fn precedence_follows_semver() {
        assert!(is_newer("v0.2.0", "0.2.0-beta.3"));
        assert!(is_newer("0.2.0-beta.2", "0.2.0-beta.1"));
        assert!(is_newer("v0.2.1", "0.2.0"));
        assert!(!is_newer("v0.2.0", "0.2.0"));
        assert!(!is_newer("v0.1.9", "0.2.0-beta.1"));
        assert!(!is_newer("not-a-version", "0.2.0"));
    }

    #[test]
    fn channels_come_from_the_pre_release_part() {
        assert_eq!(channel_of("0.2.0"), "stable");
        assert_eq!(channel_of("0.2.0-beta.1"), "beta");
        assert_eq!(channel_of("v1.0.0-rc.2"), "rc");
    }
}
