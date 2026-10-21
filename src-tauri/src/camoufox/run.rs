//! CF4: start and stop a Camoufox profile.
//!
//! The launcher starts `camoufox.exe -profile <dir> -no-remote` with the identity in the
//! `CAMOU_CONFIG_n` / `CAMOU_PREFS_n` environment variables (see `config`). The process goes
//! through the same tracker as Chrome profiles, so Start, Stop, the running state and the
//! runtime counter work unchanged.
//!
//! A profile with a proxy starts behind a local relay (see `relay`) that logs in to the proxy, and
//! takes its time zone, language and position from where the proxy is. If the relay cannot be
//! started, or the plan would leave the browser without it, the profile does not start at all:
//! the alternative is traffic leaving on the user's own connection while the profile claims a proxy.

use super::{config, install, relay};
use crate::launch::LaunchOutcome;
use crate::process::Tracker;
use crate::profile::{self, StoredProfile};
use crate::proxy::{self, ProxyEntry};
use anyhow::{Context as _, Result};
use std::net::IpAddr;
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

/// The proxy a profile is bound to. A binding that points at a proxy that no longer exists is an
/// error, never a silent fall-back to the user's own connection.
pub fn bound_proxy(stored: &StoredProfile) -> Result<Option<ProxyEntry>> {
    if let Some(id) = stored.meta.proxy_id.as_deref() {
        let p = proxy::get(id)?.with_context(|| format!("the proxy bound to this profile ({id}) no longer exists; choose another or remove it"))?;
        return Ok(Some(p));
    }
    Ok(stored.meta.inline_proxy.clone())
}

fn has_proxy(stored: &StoredProfile) -> bool {
    stored.meta.proxy_id.is_some() || stored.meta.inline_proxy.is_some()
}

/// Where the proxy puts the profile, as far as a site can tell.
#[derive(Debug, Clone, PartialEq)]
pub struct Place {
    pub ip: Option<IpAddr>,
    pub timezone: String,
    pub locale: String,
    pub geolocation: Option<(f64, f64)>,
}

pub fn place_from_geo(g: &proxy::GeoInfo) -> Place {
    let timezone = if !g.timezone.is_empty() { g.timezone.clone() } else { proxy::country_to_timezone(&g.country_code).to_string() };
    Place {
        ip: g.ip.parse().ok(),
        timezone,
        locale: proxy::country_to_locale(&g.country_code).to_string(),
        geolocation: (g.latitude != 0.0 && g.longitude != 0.0).then_some((g.latitude, g.longitude)),
    }
}

/// When the proxy's location cannot be read it is still never this computer's clock: UTC and English
/// say nothing about where the operator is.
pub fn place_unknown() -> Place {
    Place { ip: None, timezone: "UTC".into(), locale: "en-US".into(), geolocation: None }
}

/// Where this computer's own address is, or `None` when it cannot be read (the browser then keeps
/// the computer's own settings, which is what a direct connection would show anyway).
async fn place_direct() -> Option<Place> {
    match proxy::geo_check_via(None, None).await {
        Ok(g) => Some(place_from_geo(&g)),
        Err(e) => {
            eprintln!("[camoufox] could not read this computer's location: {e:#}; leaving the time zone alone");
            None
        }
    }
}

/// Live answer through the proxy, else the last test of it, else its country tag, else unknown.
async fn place_of(p: &ProxyEntry) -> Place {
    match proxy::geo_check_via(Some(p), None).await {
        Ok(g) => return place_from_geo(&g),
        Err(e) => eprintln!("[camoufox] proxy geo failed: {e:#}; trying the last test"),
    }
    if let Some(s) = proxy::latest_test(&p.id).filter(|s| !s.country_code.is_empty() || !s.timezone.is_empty()) {
        return place_from_geo(&proxy::GeoInfo {
            ip: s.ip, country: s.country, country_code: s.country_code, region: s.region, city: s.city,
            isp: s.isp, timezone: s.timezone, latitude: s.latitude, longitude: s.longitude, provider: s.provider,
        });
    }
    if !p.country.is_empty() {
        return place_from_geo(&proxy::GeoInfo {
            ip: String::new(), country: String::new(), country_code: p.country.clone(), region: String::new(), city: String::new(),
            isp: String::new(), timezone: String::new(), latitude: 0.0, longitude: 0.0, provider: String::new(),
        });
    }
    crate::notify_warning(
        "Could not read the proxy's location. The profile starts on UTC and English instead of this \
         computer's own time zone. Test the proxy again to give it a place.",
    );
    place_unknown()
}

/// `relay_port` is the local relay in front of the profile's proxy. A profile that has a proxy
/// cannot be planned without it.
pub fn plan(profile_id: &str, stored: &StoredProfile, firefox_dir: &Path, headless: bool, place: Option<&Place>, relay_port: Option<u16>) -> Result<Plan> {
    anyhow::ensure!(
        !has_proxy(stored) || relay_port.is_some(),
        "this profile has a proxy but no relay is in front of it; refusing to start on your own connection"
    );
    let (preset, os) = chosen_preset(stored, profile_id)?;
    let ctx = config::Context {
        profile_id,
        locale: place.map(|p| p.locale.as_str()),
        timezone: place.map(|p| p.timezone.as_str()),
        geolocation: place.and_then(|p| p.geolocation),
        public_ip: place.and_then(|p| p.ip),
        proxy_relay_port: relay_port,
        mobile: preset.phone.is_some(),
        android_version: stored.config.get("camoufox").and_then(|c| c.get("android_version")).and_then(|v| v.as_str()).and_then(|v| v.parse().ok()),
    };
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

/// Files the profile folder needs before start: a phone's window stylesheet, or none (a profile that
/// was a phone and is not any more must not keep it).
pub fn prepare_profile_dir(dir: &Path, phone: bool) -> Result<()> {
    let chrome = dir.join("chrome");
    for (name, body) in [("userChrome.css", config::PHONE_CHROME_CSS), ("userContent.css", config::PHONE_CONTENT_CSS)] {
        let file = chrome.join(name);
        if phone {
            std::fs::create_dir_all(&chrome).context("create chrome folder")?;
            std::fs::write(&file, body).with_context(|| format!("write phone {name}"))?;
        } else if file.exists() {
            std::fs::remove_file(&file).ok();
        }
    }
    Ok(())
}

pub async fn launch(profile_id: &str, enable_cdp: bool, headless: bool) -> Result<LaunchOutcome> {
    let status = install::status();
    anyhow::ensure!(status.installed, "The Camoufox engine is not installed. Install it from Settings first.");
    let bin = status.binary_path.context("Camoufox binary path unknown")?;
    let stored = profile::load_raw(profile_id)?;
    let dir = firefox_dir(profile_id)?;

    // Behind a proxy: a local relay that logs in, and the place the proxy puts the profile.
    let proxy_entry = bound_proxy(&stored)?;
    let (relay, place) = match &proxy_entry {
        Some(p) => {
            let r = relay::start(p.clone()).await?;
            (Some(r), Some(place_of(p).await))
        }
        // No proxy: the profile is at this computer's own address, so its clock and language follow
        // that address, not whatever zone Windows happens to be set to (a mismatch a checker flags).
        None => (None, place_direct().await),
    };
    let plan = plan(profile_id, &stored, &dir, headless, place.as_ref(), relay.as_ref().map(|r| r.port))?;
    prepare_profile_dir(&dir, chosen_preset(&stored, profile_id)?.0.phone.is_some())?;

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

    // The relay serves the browser for as long as it runs, then goes with it.
    if let Some(relay) = relay {
        let id = profile_id.to_string();
        tokio::spawn(async move {
            while Tracker::shared().is_running(&id) {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
            drop(relay);
        });
    }

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
        let p = plan("id-1", &s, Path::new("C:\\data\\firefox"), false, None, None).unwrap();
        assert_eq!(p.args, vec!["-profile", "C:\\data\\firefox", "-no-remote", "-wait-for-browser"]);
        assert!(p.env.iter().any(|(k, _)| k == "CAMOU_CONFIG_1"));
        assert!(p.env.iter().any(|(k, _)| k == "CAMOU_PREFS_1"));
        let joined: String = p.env.iter().filter(|(k, _)| k.starts_with("CAMOU_CONFIG_")).map(|(_, v)| v.as_str()).collect();
        let cfg: serde_json::Value = serde_json::from_str(&joined).unwrap();
        assert!(cfg["navigator.userAgent"].as_str().unwrap().contains("Firefox/158.0"));
        let headless = plan("id-1", &s, Path::new("x"), true, None, None).unwrap();
        assert!(headless.args.contains(&"-headless".to_string()));
    }

    fn inline_proxy() -> crate::proxy::ProxyEntry {
        crate::proxy::ProxyEntry {
            id: String::new(), name: "x".into(), kind: crate::proxy::ProxyKind::Http, host: "203.0.113.1".into(),
            port: 8080, username: String::new(), password: String::new(), country: String::new(), notes: String::new(),
        }
    }

    fn joined(env: &[(String, String)], prefix: &str) -> serde_json::Value {
        let text: String = env.iter().filter(|(k, _)| k.starts_with(prefix)).map(|(_, v)| v.as_str()).collect();
        serde_json::from_str(&text).unwrap()
    }

    #[test]
    fn a_phone_gets_its_window_stylesheet_and_a_desktop_loses_it() {
        let dir = std::env::temp_dir().join(format!("herov-cf-css-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        prepare_profile_dir(&dir, true).unwrap();
        let css = dir.join("chrome").join("userChrome.css");
        let content = dir.join("chrome").join("userContent.css");
        assert!(std::fs::read_to_string(&css).unwrap().contains("min-width:0"));
        assert!(std::fs::read_to_string(&content).unwrap().contains("scrollbar-width:none"));
        prepare_profile_dir(&dir, false).unwrap();
        assert!(!css.exists() && !content.exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_profile_with_a_proxy_cannot_be_planned_without_the_relay() {
        let mut s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        s.meta.proxy_id = Some("p1".into());
        let err = plan("id-1", &s, Path::new("x"), false, None, None).unwrap_err();
        assert!(err.to_string().contains("relay"), "{err}");
        let mut inline = stored(json!({}));
        inline.meta.inline_proxy = Some(inline_proxy());
        assert!(plan("id-1", &inline, Path::new("x"), false, None, None).is_err(), "an inline proxy needs the relay too");
    }

    #[test]
    fn behind_the_relay_the_browser_is_pointed_at_it_and_placed_where_the_proxy_is() {
        let mut s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        s.meta.inline_proxy = Some(inline_proxy());
        let place = Place { ip: Some("198.51.100.9".parse().unwrap()), timezone: "Europe/Berlin".into(), locale: "de-DE".into(), geolocation: Some((52.5, 13.4)) };
        let p = plan("id-1", &s, Path::new("x"), false, Some(&place), Some(40555)).unwrap();
        let prefs = joined(&p.env, "CAMOU_PREFS_");
        assert_eq!(prefs["network.proxy.socks_port"], 40555);
        assert_eq!(prefs["network.proxy.failover_direct"], false);
        assert_eq!(prefs["intl.locale.requested"], "de-DE");
        let cfg = joined(&p.env, "CAMOU_CONFIG_");
        assert_eq!(cfg["timezone"], "Europe/Berlin");
        assert_eq!(cfg["locale:language"], "de");
        assert_eq!(cfg["navigator.language"], "de-DE");
        assert_eq!(cfg["webrtc:ipv4"], "198.51.100.9");
        assert_eq!(cfg["geolocation:latitude"], 52.5);
    }

    #[test]
    fn a_direct_profile_can_take_its_place_from_its_own_address() {
        let s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        let place = Place { ip: Some("203.0.113.5".parse().unwrap()), timezone: "Asia/Ho_Chi_Minh".into(), locale: "vi-VN".into(), geolocation: None };
        let p = plan("id-1", &s, Path::new("x"), false, Some(&place), None).unwrap();
        let cfg = joined(&p.env, "CAMOU_CONFIG_");
        assert_eq!(cfg["timezone"], "Asia/Ho_Chi_Minh");
        assert_eq!(cfg["navigator.language"], "vi-VN");
        assert_eq!(cfg["webrtc:ipv4"], "203.0.113.5");
        assert!(joined(&p.env, "CAMOU_PREFS_").get("network.proxy.type").is_none(), "no proxy is configured");
    }

    #[test]
    fn the_place_comes_from_the_proxys_location_and_falls_back_to_the_country() {
        let geo = proxy::GeoInfo {
            ip: "203.0.113.5".into(), country: "Brazil".into(), country_code: "BR".into(), region: String::new(), city: String::new(),
            isp: String::new(), timezone: "America/Sao_Paulo".into(), latitude: -23.5, longitude: -46.6, provider: String::new(),
        };
        let p = place_from_geo(&geo);
        assert_eq!((p.timezone.as_str(), p.locale.as_str()), ("America/Sao_Paulo", "pt-BR"));
        assert_eq!(p.geolocation, Some((-23.5, -46.6)));
        assert_eq!(p.ip, Some("203.0.113.5".parse().unwrap()));
        // No zone from the provider: the country's own zone is used, and a 0,0 position is not a position.
        let bare = place_from_geo(&proxy::GeoInfo { timezone: String::new(), latitude: 0.0, longitude: 0.0, ip: String::new(), ..geo });
        assert!(!bare.timezone.is_empty());
        assert_eq!(bare.geolocation, None);
        assert_eq!(bare.ip, None);
    }

    #[test]
    fn an_unknown_place_is_never_this_computers_clock() {
        let u = place_unknown();
        assert_eq!((u.timezone.as_str(), u.locale.as_str()), ("UTC", "en-US"));
        assert_eq!(u.geolocation, None);
    }

    #[test]
    fn a_proxy_bound_by_id_that_no_longer_exists_is_an_error_not_a_direct_connection() {
        let mut s = stored(json!({}));
        s.meta.proxy_id = Some("no-such-proxy-for-this-test".into());
        assert!(bound_proxy(&s).is_err());
        let mut inline = stored(json!({}));
        inline.meta.inline_proxy = Some(inline_proxy());
        assert!(bound_proxy(&inline).unwrap().is_some());
        assert!(bound_proxy(&stored(json!({}))).unwrap().is_none());
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

    /// Opens the URL in HEROV_URL in a real Camoufox window (direct connection, device cf-win-0) and
    /// keeps it open for HEROV_SECONDS (default 40) so it can be photographed, then closes it.
    ///   HEROV_URL=https://... HEROV_TEST_MANIFEST=1 cargo test --lib real_window_on_url -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_window_on_url() {
        let url = std::env::var("HEROV_URL").expect("set HEROV_URL");
        let secs: u64 = std::env::var("HEROV_SECONDS").ok().and_then(|s| s.parse().ok()).unwrap_or(40);
        let preset = std::env::var("HEROV_PRESET").unwrap_or_else(|_| "cf-win-0".into());
        let bin = install::status().binary_path.expect("install Camoufox first");
        let fx = std::env::temp_dir().join(format!("herov-cf-url-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&fx).unwrap();
        let s = stored(json!({"camoufox": {"preset": preset}}));
        // As in production: a direct profile takes its time zone and language from its own address.
        let place = tokio::runtime::Runtime::new().unwrap().block_on(place_direct());
        println!("place from this address: {place:?}");
        let mut p = plan("real-url", &s, &fx, false, place.as_ref(), None).unwrap();
        prepare_profile_dir(&fx, chosen_preset(&s, "real-url").unwrap().0.phone.is_some()).unwrap();
        if let Ok(extra) = std::env::var("HEROV_PREFS_JSON") {
            // Try other pref values without rebuilding.
            let mut prefs = joined(&p.env, "CAMOU_PREFS_").as_object().cloned().unwrap();
            for (k, v) in serde_json::from_str::<serde_json::Value>(&extra).unwrap().as_object().unwrap() { prefs.insert(k.clone(), v.clone()); }
            p.env.retain(|(k, _)| !k.starts_with("CAMOU_PREFS_"));
            p.env.extend(config::chunked_env("CAMOU_PREFS", &serde_json::Value::Object(prefs), config::chunk_size()));
        }
        if let Ok(extra) = std::env::var("HEROV_CFG_JSON") {
            // Try config changes without rebuilding; a null removes the key.
            let mut cfg = joined(&p.env, "CAMOU_CONFIG_").as_object().cloned().unwrap();
            for (k, v) in serde_json::from_str::<serde_json::Value>(&extra).unwrap().as_object().unwrap() {
                if v.is_null() { cfg.remove(k); } else { cfg.insert(k.clone(), v.clone()); }
            }
            p.env.retain(|(k, _)| !k.starts_with("CAMOU_CONFIG_"));
            p.env.extend(config::chunked_env("CAMOU_CONFIG", &serde_json::Value::Object(cfg), config::chunk_size()));
        }
        let mut cmd = std::process::Command::new(&bin);
        cmd.args(&p.args).arg(&url);
        for (k, v) in &p.env { cmd.env(k, v); }
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
        let mut child = cmd.spawn().expect("start camoufox");
        println!("opened {url}; open for {secs} s (pid {})", child.id());
        std::thread::sleep(std::time::Duration::from_secs(secs));
        crate::camoufox::winclose::close_tree(child.id());
        for _ in 0..20 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if child.try_wait().unwrap().is_some() { return; }
        }
        let _ = child.kill();
    }

    /// Camoufox behind the relay and a proxy that wants a login, reaching a site whose name exists
    /// nowhere but in the proxy: proves login, remote DNS, and the place taken from the proxy.
    ///   HEROV_TEST_MANIFEST=1 cargo test --lib real_proxy -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn real_engine_reaches_a_site_through_the_relay_and_a_proxy_with_login() {
        use std::sync::{Arc, Mutex};
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::{TcpListener, TcpStream};
        let bin = install::status().binary_path.expect("install Camoufox first");

        // The "website": answers any request with a page that prints what the browser reports.
        let web = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let web_port = web.local_addr().unwrap().port();
        let hosts = Arc::new(Mutex::new(Vec::<String>::new()));
        let hosts2 = hosts.clone();
        tokio::spawn(async move {
            while let Ok((mut s, _)) = web.accept().await {
                let hosts = hosts2.clone();
                tokio::spawn(async move {
                    let mut req = Vec::new();
                    let mut b = [0u8; 1];
                    while !req.ends_with(b"\r\n\r\n") {
                        if s.read_exact(&mut b).await.is_err() { return; }
                        req.push(b[0]);
                    }
                    let text = String::from_utf8_lossy(&req).to_string();
                    if let Some(h) = text.lines().find(|l| l.to_ascii_lowercase().starts_with("host:")) { hosts.lock().unwrap().push(h.to_string()); }
                    let body = r#"<!doctype html><meta charset=utf-8><body style="font:22px monospace"><h1>REACHED THROUGH THE PROXY</h1><pre id=o></pre><script>
document.getElementById('o').textContent=['tz: '+Intl.DateTimeFormat().resolvedOptions().timeZone,'lang: '+navigator.language,'UA: '+navigator.userAgent].join('\n');</script>"#;
                    let _ = s.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).as_bytes()).await;
                });
            }
        });

        // The upstream proxy: wants Basic bob:pw, maps example.test:80 to the website.
        let seen = Arc::new(Mutex::new(Vec::<String>::new()));
        let seen2 = seen.clone();
        let up = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let up_port = up.local_addr().unwrap().port();
        tokio::spawn(async move {
            while let Ok((mut c, _)) = up.accept().await {
                let seen = seen2.clone();
                tokio::spawn(async move {
                    let mut head = Vec::new();
                    let mut b = [0u8; 1];
                    while !head.ends_with(b"\r\n\r\n") {
                        if c.read_exact(&mut b).await.is_err() { return; }
                        head.push(b[0]);
                    }
                    let text = String::from_utf8_lossy(&head).to_string();
                    seen.lock().unwrap().push(text.lines().next().unwrap_or("").to_string());
                    let tok = base64_std("bob:pw");
                    if !text.contains(&format!("Proxy-Authorization: Basic {tok}")) {
                        let _ = c.write_all(b"HTTP/1.1 407 Proxy Authentication Required\r\n\r\n").await;
                        return;
                    }
                    if text.starts_with("CONNECT example.test:80 ") {
                        if let Ok(mut w) = TcpStream::connect(("127.0.0.1", web_port)).await {
                            let _ = c.write_all(b"HTTP/1.1 200 Connection established\r\n\r\n").await;
                            let _ = tokio::io::copy_bidirectional(&mut c, &mut w).await;
                            return;
                        }
                    }
                    let _ = c.write_all(b"HTTP/1.1 502 Bad Gateway\r\n\r\n").await;
                });
            }
        });

        let entry = crate::proxy::ProxyEntry {
            id: String::new(), name: "mock".into(), kind: crate::proxy::ProxyKind::Http, host: "127.0.0.1".into(),
            port: up_port, username: "bob".into(), password: "pw".into(), country: "DE".into(), notes: String::new(),
        };
        let relay = relay::start(entry.clone()).await.unwrap();
        let mut s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        s.meta.inline_proxy = Some(entry);
        let place = Place { ip: Some("198.51.100.9".parse().unwrap()), timezone: "Europe/Berlin".into(), locale: "de-DE".into(), geolocation: None };
        let tmp = std::env::temp_dir().join(format!("herov-cf-proxy-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(tmp.join("fx")).unwrap();
        let p = plan("real-proxy", &s, &tmp.join("fx"), true, Some(&place), Some(relay.port)).unwrap();
        let shot = tmp.join("proxy.png");
        let (bin2, shot2) = (bin.clone(), shot.clone());
        let status = tokio::task::spawn_blocking(move || {
            let mut cmd = std::process::Command::new(bin2);
            cmd.args(&p.args).arg("--screenshot").arg(&shot2).arg("http://example.test/");
            for (k, v) in &p.env { cmd.env(k, v); }
            cmd.stdout(Stdio::null()).stderr(Stdio::null()).status().unwrap()
        }).await.unwrap();
        println!("exit: {status:?}\nshot: {}\nupstream saw: {:?}\nwebsite saw: {:?}", shot.display(), seen.lock().unwrap(), hosts.lock().unwrap());
        assert!(shot.exists(), "no screenshot");
        assert!(seen.lock().unwrap().iter().any(|l| l.starts_with("CONNECT example.test:80")), "the name must reach the proxy unresolved");
        assert!(hosts.lock().unwrap().iter().any(|h| h.to_ascii_lowercase().contains("example.test")), "the site never got the request");
    }

    /// The guard that matters most: with the relay gone the page must fail, not go out directly.
    /// The site is on this computer (127.0.0.1) and the loopback exemption is switched off for the
    /// test, so reaching it at all would mean the browser bypassed the proxy.
    ///   HEROV_TEST_MANIFEST=1 cargo test --lib real_engine_does_not_go -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn real_engine_does_not_go_direct_when_the_relay_is_down() {
        use tokio::io::AsyncWriteExt;
        use tokio::net::TcpListener;
        let bin = install::status().binary_path.expect("install Camoufox first");
        let web = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let web_port = web.local_addr().unwrap().port();
        let hit = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let hit2 = hit.clone();
        tokio::spawn(async move {
            while let Ok((mut s, _)) = web.accept().await {
                hit2.store(true, std::sync::atomic::Ordering::SeqCst);
                let _ = s.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 11\r\nConnection: close\r\n\r\nWENT DIRECT").await;
            }
        });
        // A port nothing listens on: the relay is "down".
        let dead = { let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap(); l.local_addr().unwrap().port() };
        let mut s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        s.meta.inline_proxy = Some(crate::proxy::ProxyEntry {
            id: String::new(), name: "x".into(), kind: crate::proxy::ProxyKind::Http, host: "127.0.0.1".into(),
            port: 9, username: String::new(), password: String::new(), country: String::new(), notes: String::new(),
        });
        let p = plan("real-leak", &s, &std::env::temp_dir().join(format!("herov-cf-leak-{}", uuid::Uuid::new_v4())), true, None, Some(dead)).unwrap();
        // Same prefs, plus: do not exempt loopback from the proxy.
        let ctx = config::Context { profile_id: "real-leak", proxy_relay_port: Some(dead), ..Default::default() };
        let mut prefs = config::build_prefs(&ctx);
        prefs.insert("network.proxy.no_proxies_on".into(), json!(""));
        // Firefox never proxies loopback unless told it may, whatever the exemption list says.
        prefs.insert("network.proxy.allow_hijacking_localhost".into(), json!(true));
        let mut env: Vec<(String, String)> = p.env.iter().filter(|(k, _)| !k.starts_with("CAMOU_PREFS_")).cloned().collect();
        env.extend(config::chunked_env("CAMOU_PREFS", &serde_json::Value::Object(prefs), config::chunk_size()));
        let dir = std::path::PathBuf::from(&p.args[1]);
        std::fs::create_dir_all(&dir).unwrap();
        let shot = dir.join("leak.png");
        let (bin2, shot2, args) = (bin, shot.clone(), p.args.clone());
        tokio::task::spawn_blocking(move || {
            let mut cmd = std::process::Command::new(bin2);
            cmd.args(&args).arg("--screenshot").arg(&shot2).arg(format!("http://127.0.0.1:{web_port}/"));
            for (k, v) in &env { cmd.env(k, v); }
            let mut child = cmd.stdout(Stdio::null()).stderr(Stdio::null()).spawn().unwrap();
            // A page that cannot load may never finish; 25 s is plenty to have reached the site if it could.
            for _ in 0..50 {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if child.try_wait().unwrap().is_some() { return; }
            }
            let _ = std::process::Command::new("taskkill").args(["/PID", &child.id().to_string(), "/T", "/F"]).output();
            let _ = child.kill();
        }).await.unwrap();
        println!("shot: {}\nwebsite was contacted directly: {}", shot.display(), hit.load(std::sync::atomic::Ordering::SeqCst));
        assert!(!hit.load(std::sync::atomic::Ordering::SeqCst), "the browser reached the site without the relay: a leak");
    }

    fn base64_std(s: &str) -> String {
        use base64::Engine as _;
        base64::engine::general_purpose::STANDARD.encode(s)
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
        let p = plan("real-window", &s, &fx, false, None, None).unwrap();
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
'tz: '+Intl.DateTimeFormat().resolvedOptions().timeZone,'lang: '+n.language,'fonts: '+fonts,
...(function(){try{const out=[];for(const t of ['webgl','webgl2']){const gl=document.createElement('canvas').getContext(t);if(!gl){out.push(t+': NO CONTEXT');continue}
const e=gl.getExtension('WEBGL_debug_renderer_info');out.push(t+': '+(e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL)+' | '+gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'no debug info'));
out.push('  vendor='+gl.getParameter(gl.VENDOR)+' renderer='+gl.getParameter(gl.RENDERER)+' ver='+gl.getParameter(gl.VERSION));
out.push('  maxTex='+gl.getParameter(gl.MAX_TEXTURE_SIZE)+' maxVertAttribs='+gl.getParameter(gl.MAX_VERTEX_ATTRIBS)+' maxViewport='+Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS))+' ext='+gl.getSupportedExtensions().length)}return out}catch(x){return ['webgl error: '+x]}})()].join('\n');
</script>"#).unwrap();
        let s = stored(json!({"camoufox": {"preset": "cf-win-0"}}));
        let p = plan("real-test", &s, &tmp.join("fx"), true, None, None).unwrap();
        std::fs::create_dir_all(tmp.join("fx")).unwrap();
        let shot = tmp.join("probe.png");
        let mut cmd = std::process::Command::new(&bin);
        cmd.args(&p.args).arg("--screenshot").arg(&shot).arg(format!("file:///{}", page.display().to_string().replace('\\', "/")));
        for (k, v) in &p.env { cmd.env(k, v); }
        let out = cmd.output().expect("run camoufox");
        println!("exit: {:?}\nshot: {}\nstderr: {}", out.status.code(), shot.display(), String::from_utf8_lossy(&out.stderr).lines().take(8).collect::<Vec<_>>().join("\n"));
        assert!(shot.exists(), "no screenshot was written");
    }

    /// A phone profile seen from a page: touch, pointer type, pixel ratio and viewport. Writes a
    /// screenshot to read the values from.
    #[test]
    #[ignore]
    fn real_phone_reports_a_phone() {
        let status = install::status();
        assert!(status.installed, "install Camoufox first");
        let bin = status.binary_path.unwrap();
        let tmp = std::env::temp_dir().join(format!("herov-cf-phone-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(tmp.join("fx")).unwrap();
        let page = tmp.join("probe.html");
        std::fs::write(&page, r#"<!doctype html><meta charset=utf-8><body style="font:14px 'Roboto Mono','Noto Sans Mono','Noto Sans';background:#fff;color:#000"><pre id=o></pre><script>
const n=navigator,s=screen,m=q=>matchMedia(q).matches;
try{document.getElementById('o').textContent=[
'UA: '+n.userAgent,'platform: '+n.platform+' oscpu: '+n.oscpu,'appVersion: '+n.appVersion,
'touchPoints: '+n.maxTouchPoints+' ontouchstart: '+('ontouchstart' in window)+' TouchEvent: '+(typeof TouchEvent),
'pointer coarse: '+m('(pointer: coarse)')+' fine: '+m('(pointer: fine)')+' hover: '+m('(hover: hover)')+' any-pointer coarse: '+m('(any-pointer: coarse)'),
'dpr: '+devicePixelRatio+' screen: '+s.width+'x'+s.height+' avail '+s.availWidth+'x'+s.availHeight,
'inner: '+innerWidth+'x'+innerHeight+' outer: '+outerWidth+'x'+outerHeight,
'cores: '+n.hardwareConcurrency,
(function(){try{const gl=document.createElement('canvas').getContext('webgl');const e=gl.getExtension('WEBGL_debug_renderer_info');return 'gl: '+gl.getParameter(e.UNMASKED_VENDOR_WEBGL)+' | '+gl.getParameter(e.UNMASKED_RENDERER_WEBGL)}catch(x){return 'gl error '+x}})()].join('\n')}catch(e){document.getElementById('o').textContent='ERR '+e}
</script>"#).unwrap();
        let preset_id = std::env::var("HEROV_PHONE_PRESET").unwrap_or_else(|_| "cf-and-0".into());
        let s = stored(json!({"camoufox": {"preset": preset_id}}));
        let p = plan("real-phone", &s, &tmp.join("fx"), true, None, None).unwrap();
        let shot = tmp.join("probe.png");
        let mut cmd = std::process::Command::new(&bin);
        cmd.args(&p.args).arg("--screenshot").arg(&shot).arg(format!("file:///{}", page.display().to_string().replace('\\', "/")));
        for (k, v) in &p.env {
            if std::env::var("HEROV_NO_PREFS").is_ok() && k.starts_with("CAMOU_PREFS") { continue; }
            cmd.env(k, v);
        }
        let out = cmd.output().expect("run camoufox");
        println!("exit: {:?}\nshot: {}", out.status.code(), shot.display());
        assert!(shot.exists(), "no screenshot was written");
    }

    /// The same phone in a real (not headless) window: the page reports what it sees to a loopback
    /// listener, which prints it. Headless mode has its own pointer and window values.
    #[test]
    #[ignore]
    fn real_phone_window_reports_a_phone() {
        use std::io::{Read, Write};
        let status = install::status();
        assert!(status.installed, "install Camoufox first");
        let bin = status.binary_path.unwrap();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let tmp = std::env::temp_dir().join(format!("herov-cf-phonewin-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(tmp.join("fx")).unwrap();
        let page = tmp.join("probe.html");
        std::fs::write(&page, format!(r#"<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body><div style="height:3000px">tall</div><script>
const n=navigator,s=screen,m=q=>matchMedia(q).matches;
setTimeout(async()=>{{let t;const tzs=()=>Intl.DateTimeFormat().resolvedOptions().timeZone+' off='+new Date().getTimezoneOffset()+' '+new Date(2026,6,1,12).toString().slice(16,40);
const wk=await new Promise(r=>{{try{{const w=new Worker(URL.createObjectURL(new Blob(['postMessage(Intl.DateTimeFormat().resolvedOptions().timeZone+" off="+new Date().getTimezoneOffset()+" "+new Date(2026,6,1,12).toString().slice(16,40))'])));w.onmessage=e=>r(e.data);setTimeout(()=>r('timeout'),2500)}}catch(x){{r('ERR '+x)}}}});
const fr=document.createElement('iframe');document.body.appendChild(fr);const ifr=fr.contentWindow.Intl.DateTimeFormat().resolvedOptions().timeZone+' off='+fr.contentWindow.Date.prototype.getTimezoneOffset.call(new fr.contentWindow.Date());
try{{t=['TZ main='+tzs(),'TZ worker='+wk,'TZ iframe='+ifr,
'UA='+n.userAgent,'platform='+n.platform,'touchPoints='+n.maxTouchPoints,'ontouchstart='+('ontouchstart' in window),
'coarse='+m('(pointer: coarse)')+' fine='+m('(pointer: fine)')+' hover='+m('(hover: hover)')+' anyCoarse='+m('(any-pointer: coarse)')+' anyFine='+m('(any-pointer: fine)'),
'dpr='+devicePixelRatio+' resMatch='+matchMedia('(resolution: '+devicePixelRatio+'dppx)').matches+' res1='+matchMedia('(resolution: 1dppx)').matches,'screen='+s.width+'x'+s.height+' avail='+s.availWidth+'x'+s.availHeight,
'inner='+innerWidth+'x'+innerHeight+' outer='+outerWidth+'x'+outerHeight+' screenXY='+screenX+','+screenY,
'vv='+(window.visualViewport?visualViewport.width+'x'+visualViewport.height+' scale '+visualViewport.scale:'none'),
'docW='+document.documentElement.clientWidth].join(' | ')}}catch(e){{t='ERR '+e}}
new Image().src='http://127.0.0.1:{port}/?'+encodeURIComponent(t)}},1500);
</script>"#)).unwrap();
        let preset_id = std::env::var("HEROV_PHONE_PRESET").unwrap_or_else(|_| "cf-and-0".into());
        let s = stored(json!({"camoufox": {"preset": preset_id}}));
        let place = Place { ip: None, timezone: "Asia/Bangkok".into(), locale: "vi-VN".into(), geolocation: None };
        println!("host zone: {}", String::from_utf8_lossy(&std::process::Command::new("tzutil").arg("/g").output().map(|o| o.stdout).unwrap_or_default()).trim());
        let mut p = plan("real-phone-win", &s, &tmp.join("fx"), false, Some(&place), None).unwrap();
        prepare_profile_dir(&tmp.join("fx"), chosen_preset(&s, "real-phone-win").unwrap().0.phone.is_some()).unwrap();
        if let Ok(extra) = std::env::var("HEROV_PREFS_JSON") {
            // Try other pref values without rebuilding.
            let mut prefs = joined(&p.env, "CAMOU_PREFS_").as_object().cloned().unwrap();
            for (k, v) in serde_json::from_str::<serde_json::Value>(&extra).unwrap().as_object().unwrap() { prefs.insert(k.clone(), v.clone()); }
            p.env.retain(|(k, _)| !k.starts_with("CAMOU_PREFS_"));
            p.env.extend(config::chunked_env("CAMOU_PREFS", &serde_json::Value::Object(prefs), config::chunk_size()));
        }
        if let Ok(js) = std::env::var("HEROV_USER_JS") { std::fs::write(tmp.join("fx").join("user.js"), js).unwrap(); }
        if let Ok(extra) = std::env::var("HEROV_CFG_JSON") {
            let mut cfg = joined(&p.env, "CAMOU_CONFIG_").as_object().cloned().unwrap();
            for (k, v) in serde_json::from_str::<serde_json::Value>(&extra).unwrap().as_object().unwrap() {
                if v.is_null() { cfg.remove(k); } else { cfg.insert(k.clone(), v.clone()); }
            }
            p.env.retain(|(k, _)| !k.starts_with("CAMOU_CONFIG_"));
            p.env.extend(config::chunked_env("CAMOU_CONFIG", &serde_json::Value::Object(cfg), config::chunk_size()));
        }
        let mut cmd = std::process::Command::new(&bin);
        cmd.args(&p.args);
        if let Ok(extra) = std::env::var("HEROV_EXTRA_ARGS") { cmd.args(extra.split_whitespace()); }
        cmd.arg(format!("file:///{}", page.display().to_string().replace(char::from(92), "/")));
        for (k, v) in &p.env { cmd.env(k, v); }
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
        let mut child = cmd.spawn().expect("start camoufox");
        listener.set_nonblocking(true).unwrap();
        let start = std::time::Instant::now();
        let mut got = None;
        while start.elapsed().as_secs() < 60 && got.is_none() {
            if let Ok((mut sock, _)) = listener.accept() {
                sock.set_nonblocking(false).ok();
                let mut buf = [0u8; 4096];
                let n = sock.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                let _ = sock.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n");
                if let Some(q) = req.lines().next().and_then(|l| l.split(' ').nth(1)).and_then(|u| u.strip_prefix("/?")) {
                    got = Some(q.replace("%20", " ").replace("%7C", "|").replace("%3D", "=").replace("%3A", ":").replace("%2C", ",").replace("%28", "(").replace("%29", ")").replace("%2F", "/").replace("%3B", ";"));
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
        crate::camoufox::winclose::close_tree(child.id());
        for _ in 0..20 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if child.try_wait().unwrap().is_some() { break; }
        }
        let _ = child.kill();
        println!("REPORT: {}", got.as_deref().unwrap_or("none"));
        assert!(got.is_some(), "the page never reported");
    }
}
