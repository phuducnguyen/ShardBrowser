//! Camoufox (patched Firefox) as the second engine, next to Chrome.
//!
//! A profile picks its engine once, when it is created (`profile::Engine`). Everything
//! engine-specific lives under this module; `launch::launch_profile_synced` hands a
//! Camoufox profile to `launch` and the Chrome path stays as it was.
//!
//! Spec: docs/specs/second-engine-camoufox.md (work packages CF1 to CF7).

pub mod install;

use crate::launch::LaunchOutcome;
use anyhow::Result;
use tauri::Window;

/// Whether the engine is installed, which release, and how big it is.
#[tauri::command]
pub async fn camoufox_status() -> Result<install::CamoufoxStatus, String> {
    Ok(install::status())
}

/// Download and install the pinned release (resumable). Progress arrives as `camoufox:progress`.
#[tauri::command]
pub async fn camoufox_install(window: Window, force: bool) -> Result<install::CamoufoxStatus, String> {
    install::install(&window, force).await.map_err(|e| format!("{e:#}"))?;
    Ok(install::status())
}

/// Start a Camoufox profile. Not available until the engine can be launched (CF4); until then a
/// Camoufox profile can be saved but not started.
pub async fn launch(profile_id: &str, _headless: bool) -> Result<LaunchOutcome> {
    if !install::status().installed {
        anyhow::bail!("The Camoufox engine is not installed. Install it from Settings first.");
    }
    anyhow::bail!(
        "Camoufox profiles cannot start yet (profile {profile_id}); launching arrives in the next update."
    )
}
