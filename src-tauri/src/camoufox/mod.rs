//! Camoufox (patched Firefox) as the second engine, next to Chrome.
//!
//! A profile picks its engine once, when it is created (`profile::Engine`). Everything
//! engine-specific lives under this module; `launch::launch_profile_synced` hands a
//! Camoufox profile to `launch` and the Chrome path stays as it was.
//!
//! Spec: docs/specs/second-engine-camoufox.md (work packages CF1 to CF7).

pub mod config;
pub mod install;
pub mod run;
pub mod winclose;

use crate::launch::LaunchOutcome;
use anyhow::Result;
use tauri::Window;

/// Whether the engine is installed, which release, and how big it is.
#[tauri::command]
pub async fn camoufox_status() -> Result<install::CamoufoxStatus, String> {
    Ok(install::status())
}

/// The recorded Firefox devices a Camoufox profile can wear.
#[tauri::command]
pub async fn camoufox_library() -> Result<Vec<config::LibraryEntry>, String> {
    Ok(config::library())
}

/// Download and install the pinned release (resumable). Progress arrives as `camoufox:progress`.
#[tauri::command]
pub async fn camoufox_install(window: Window, force: bool) -> Result<install::CamoufoxStatus, String> {
    install::install(&window, force).await.map_err(|e| format!("{e:#}"))?;
    Ok(install::status())
}

/// Start a Camoufox profile (see `run`).
pub async fn launch(profile_id: &str, enable_cdp: bool, headless: bool) -> Result<LaunchOutcome> {
    run::launch(profile_id, enable_cdp, headless).await
}

