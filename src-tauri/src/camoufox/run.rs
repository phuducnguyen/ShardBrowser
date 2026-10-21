//! CF4: start and stop a Camoufox profile.
//!
//! The launcher starts `camoufox.exe -profile <dir> -no-remote` with the identity in the
//! `CAMOU_CONFIG_n` / `CAMOU_PREFS_n` environment variables (see `config`). The process goes
//! through the same tracker as Chrome profiles, so Start, Stop, the running state and the
//! runtime counter work unchanged.
//!
//! Until the local proxy relay exists (CF5) a profile with a proxy is refused: starting it would
//! send traffic straight out of the user's own connection while the profile claims a proxy.

use super::{config, install};
use crate::launch::LaunchOutcome;
use crate::process::Tracker;
use crate::profile::{self, StoredProfile};
use anyhow::{Context as _, Result};
use std::path::{Path, PathBuf};
use std::process::Stdio;

/// What to run: arguments and environment, decided without touching the disk or the network.
#[derive(Debug, Clone)]
pub struct Plan {
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

/// The device a profile wears: the one it names, else a stable pick for the host's OS.
pub fn chosen_preset(stored: &StoredProfile, profile_id: &str) -> Result<(&'static config::Preset, config::TargetOs)> {
    if let Some(id) = stored
        .config
        .get("camoufox")
        .and_then(|c| c.get("preset"))
        .and_then(|v| v.as_str())
    {
        return config::preset(id).with_context(|| format!("this profile names the device `{id}`, which is not in the Camoufox library"));
    }
    let host = if cfg!(windows) {
        config::TargetOs::Windows
    } else if cfg!(target_os = "macos") {
        config::TargetOs::Macos
    } else {
        config::TargetOs::Linux
    };
    let candidates: Vec<_> = config::library().into_iter().filter(|e| e.os == host).collect();
    anyhow::ensure!(!candidates.is_empty(), "no Camoufox device is recorded for this system");
    let pick = &candidates[(config::fnv64(profile_id) as usize) % candidates.len()];
    config::preset(&pick.id).context("library entry vanished")
}

/// A Camoufox profile with a proxy must not start before the relay exists.
pub fn refuse_proxy(stored: &StoredProfile) -> Result<()> {
    if stored.meta.proxy_id.is_some() || stored.meta.inline_proxy.is_some() {
        anyhow::bail!(
            "This Camoufox profile has a proxy. Proxies for Camoufox are not supported yet, and \
             starting it would use your own connection instead. Remove the proxy to start it, or wait for the next update."
        );
    }
    Ok(())
}

pub fn plan(profile_id: &str, stored: &StoredProfile, firefox_dir: &Path, headless: bool) -> Result<Plan> {
    refuse_proxy(stored)?;
    let (preset, os) = chosen_preset(stored, profile_id)?;
    let ctx = config::Context { profile_id, ..Default::default() };
    let cfg = config::build_config(preset, os, &ctx);
    let prefs = config::build_prefs(&ctx);
    // `-wait-for-browser`: on Windows Firefox starts through a launcher process that hands over to
    // the real browser and exits. With this flag it stays until the browser closes, so the process
    // the tracker holds is the one whose end means the profile has stopped.
    let mut args = vec![
        "-profile".to_string(),
        firefox_dir.display().to_string(),
        "-no-remote".to_string(),
        "-wait-for-browser".to_string(),
    ];
    if headless {
        args.push("-headless".into());
    }
    Ok(Plan { args, env: config::env_vars(&cfg, &prefs) })
}

/// `<user-data>/<id>/firefox`, created on first use. Chrome's folder for the same profile id
/// is its parent, so the two engines never write into each other's files.
pub fn firefox_dir(profile_id: &str) -> Result<PathBuf> {
    let d = profile::user_data_dir(profile_id)?.join("firefox");
    std::fs::create_dir_all(&d)?;
    Ok(d)
}

/// How Stop asks a Camoufox profile to close: on Windows by messaging the windows of the whole
/// process tree (see `winclose`); elsewhere the tracker's own signal is enough.
fn closer() -> Option<crate::process::Closer> {
    #[cfg(windows)]
    {
        Some(std::sync::Arc::new(|pid| {
            let n = super::winclose::close_tree(pid);
            eprintln!("[camoufox] asked {n} window(s) of process tree {pid} to close");
        }))
    }
    #[cfg(not(windows))]
    {
        None
    }
}

pub async fn launch(profile_id: &str, enable_cdp: bool, headless: bool) -> Result<LaunchOutcome> {
    let status = install::status();
    anyhow::ensure!(status.installed, "The Camoufox engine is not installed. Install it from Settings first.");
    let bin = status.binary_path.context("Camoufox binary path unknown")?;
    let stored = profile::load_raw(profile_id)?;
    let dir = firefox_dir(profile_id)?;
    let plan = plan(profile_id, &stored, &dir, headless)?;

    let mut cmd = tokio::process::Command::new(&bin);
    cmd.args(&plan.args);
    for (k, v) in &plan.env {
        cmd.env(k, v);
    }
    cmd.stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: no console flash when the GUI launcher starts the engine.
        cmd.creation_flags(0x08000000);
    }
    let child = cmd.spawn().context("start Camoufox")?;
    let pid = Tracker::shared().track_with(profile_id.to_string(), child, stored.meta.temporary, closer());
    profile::touch_launched(profile_id, None)?;

    // Firefox has no DevTools endpoint here; a caller that asked for one is told why it has none.
    let cdp_error = enable_cdp.then(|| "Camoufox profiles have no CDP endpoint; automation is for Chrome profiles".to_string());
    Ok(LaunchOutcome { pid, cdp: None, cdp_error })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn stored(config: serde_json::Value) -> StoredProfile {
        let mut s = StoredProfile::default();
        s.meta.engine = profile::Engine::Camoufox;
        s.config = config.as_object().cloned().unwrap_or_default();
        s
    }

    #[test]
    fn the_plan_opens_its_own_profile_folder_and_carries_the_identity() {
        let s = stored(json!({"name": "Fox", "camoufox": {"preset": "cf-win-0"}}));
        let p = plan("id-1", &s, Path::new("C:\\data\\firefox"), false).unwrap();
        assert_eq!(p.args, vec!["-profile", "C:\\data\\firefox", "-no-remote", "-wait-for-browser"]);
        assert!(p.env.iter().any(|(k, _)| k == "CAMOU_CONFIG_1"));
        assert!(p.env.iter().any(|(k, _)| k == "CAMOU_PREFS_1"));
        let joined: String = p.env.iter().filter(|(k, _)| k.starts_with("CAMOU_CONFIG_")).map(|(_, v)| v.as_str()).collect();
        let cfg: serde_json::Value = serde_json::from_str(&joined).unwrap();
        assert!(cfg["navigator.userAgent"].as_str().unwrap().contains("Firefox/158.0"));
        let headless = plan("id-1", &s, Path::new("x"), true).unwrap();
        assert!(headless.args.contains(&"-headless".to_string()));
    }

    #[test]
    fn a_profile_with_a_proxy_is_refused_rather_than_started_on_the_real_connection() {
        let mut s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        s.meta.proxy_id = Some("p1".into());
        let err = plan("id-1", &s, Path::new("x"), false).unwrap_err();
        assert!(err.to_string().contains("proxy"), "{err}");
        let mut inline = stored(json!({}));
        inline.meta.inline_proxy = Some(crate::proxy::ProxyEntry {
            id: String::new(), name: "x".into(), kind: crate::proxy::ProxyKind::Http, host: "203.0.113.1".into(),
            port: 8080, username: String::new(), password: String::new(), country: String::new(), notes: String::new(),
        });
        assert!(plan("id-1", &inline, Path::new("x"), false).is_err());
    }

    #[test]
    fn without_a_named_device_the_pick_is_stable_per_profile_and_matches_this_system() {
        let s = stored(json!({}));
        let (a, os) = chosen_preset(&s, "profile-a").unwrap();
        let (b, _) = chosen_preset(&s, "profile-a").unwrap();
        assert!(std::ptr::eq(a, b), "the same id must give the same device");
        if cfg!(windows) {
            assert_eq!(os, config::TargetOs::Windows);
        }
    }

    #[test]
    fn a_device_that_is_not_in_the_library_is_an_error_not_a_silent_default() {
        let s = stored(json!({"camoufox": {"preset": "cf-win-9999"}}));
        assert!(chosen_preset(&s, "x").is_err());
    }

    /// Opens a real window and checks the process the launcher started is the browser itself: if
    /// Windows used a launcher process that hands over and exits, the tracker would think the
    /// profile had stopped. Then closes it the way Stop does.
    ///   HEROV_TEST_MANIFEST=1 cargo test --lib real_window -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_window_stays_open_until_it_is_closed() {
        let bin = install::status().binary_path.expect("install Camoufox first");
        let tmp = std::env::temp_dir().join(format!("herov-cf-win-{}", uuid::Uuid::new_v4()));
        let fx = tmp.join("fx");
        std::fs::create_dir_all(&fx).unwrap();
        let s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        let p = plan("real-window", &s, &fx, false).unwrap();
        let mut cmd = std::process::Command::new(&bin);
        cmd.args(&p.args).arg("about:blank");
        for (k, v) in &p.env { cmd.env(k, v); }
        // As in production: a browser that inherits cargo's pipes would keep the test from ending.
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
        let mut child = cmd.spawn().expect("start camoufox");
        std::thread::sleep(std::time::Duration::from_secs(10));
        let titles = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "(Get-Process camoufox -ErrorAction SilentlyContinue | Where-Object MainWindowTitle | ForEach-Object MainWindowTitle) -join ' | '"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        println!("window titles: [{titles}]");
        let alive = child.try_wait().unwrap().is_none();
        println!("pid {} alive after 10 s: {alive}", child.id());
        // The window belongs to the browser process behind the launcher; ask every window in the tree.
        let sent = crate::camoufox::winclose::close_tree(child.id());
        println!("WM_CLOSE sent to {sent} window(s)");
        let count = || {
            let o = std::process::Command::new("tasklist").args(["/FI", "IMAGENAME eq camoufox.exe", "/NH"]).output().unwrap();
            String::from_utf8_lossy(&o.stdout).lines().filter(|l| l.contains("camoufox.exe")).count()
        };
        let mut closed = false;
        for t in 0..20 {
            std::thread::sleep(std::time::Duration::from_secs(2));
            let gone = child.try_wait().unwrap().is_some();
            println!("t+{}s: launcher gone={gone}, camoufox processes={}", (t + 1) * 2, count());
            if gone { closed = true; break; }
        }
        println!("closed by taskkill (WM_CLOSE) within 40 s: {closed}");
        if !closed { let _ = child.kill(); }
        assert!(alive, "the started process exited by itself: a launcher process is in the way");
        assert!(closed, "a polite close did not end the browser");
    }

    /// Opens the real engine headless on a page that prints what a site could read, and saves a
    /// screenshot. Needs the engine installed. Run:
    ///   HEROV_REAL_CAMOUFOX=1 HEROV_TEST_MANIFEST=1 cargo test --lib real_engine -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_engine_reports_the_configured_identity() {
        let status = install::status();
        assert!(status.installed, "install Camoufox first");
        let bin = status.binary_path.unwrap();
        let tmp = std::env::temp_dir().join(format!("herov-cf-real-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&tmp).unwrap();
        let page = tmp.join("probe.html");
        std::fs::write(&page, r#"<!doctype html><meta charset=utf-8><body style="font:20px monospace;background:#fff;color:#000"><pre id=o></pre><script>
const n=navigator,s=screen;
function has(f){const c=document.createElement('canvas').getContext('2d');const t='mmmmmmmmmmlliWW';for(const b of ['monospace','sans-serif','serif']){c.font='72px '+b;const w0=c.measureText(t).width;c.font='72px "'+f+'",'+b;if(c.measureText(t).width!==w0)return true;}return false;}
const fonts=['Arial','Calibri','Segoe UI','Consolas','Helvetica Neue','Menlo','DejaVu Sans','Ubuntu'].map(f=>f+':'+(has(f)?'y':'n')).join(' ');
document.getElementById('o').textContent=[
'UA: '+n.userAgent,'platform: '+n.platform,'oscpu: '+n.oscpu,'appVersion: '+n.appVersion,'cores: '+n.hardwareConcurrency,
'screen: '+s.width+'x'+s.height+' avail '+s.availWidth+'x'+s.availHeight+' depth '+s.colorDepth,
'tz: '+Intl.DateTimeFormat().resolvedOptions().timeZone,'lang: '+n.language,'fonts: '+fonts].join('\n');
</script>"#).unwrap();
        let s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        let p = plan("real-test", &s, &tmp.join("fx"), true).unwrap();
        std::fs::create_dir_all(tmp.join("fx")).unwrap();
        let shot = tmp.join("probe.png");
        let mut cmd = std::process::Command::new(&bin);
        cmd.args(&p.args).arg("--screenshot").arg(&shot).arg(format!("file:///{}", page.display().to_string().replace('\\', "/")));
        for (k, v) in &p.env { cmd.env(k, v); }
        let out = cmd.output().expect("run camoufox");
        println!("exit: {:?}\nshot: {}\nstderr: {}", out.status.code(), shot.display(), String::from_utf8_lossy(&out.stderr).lines().take(8).collect::<Vec<_>>().join("\n"));
        assert!(shot.exists(), "no screenshot was written");
    }
}
