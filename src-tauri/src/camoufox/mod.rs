//! Camoufox (patched Firefox) as the second engine, next to Chrome.
//!
//! A profile picks its engine once, when it is created (`profile::Engine`). Everything
//! engine-specific lives under this module; `launch::launch_profile_synced` hands a
//! Camoufox profile to `launch` and the Chrome path stays as it was.
//!
//! Spec: docs/specs/second-engine-camoufox.md (work packages CF1 to CF7).

use crate::launch::LaunchOutcome;
use anyhow::Result;

/// Start a Camoufox profile. Not available until the engine can be installed (CF2)
/// and launched (CF4); until then a Camoufox profile can be saved but not started.
pub async fn launch(profile_id: &str, _headless: bool) -> Result<LaunchOutcome> {
    anyhow::bail!(
        "Camoufox engine is not available yet, so profile {profile_id} cannot start. \
         It can be created and edited meanwhile."
    )
}
