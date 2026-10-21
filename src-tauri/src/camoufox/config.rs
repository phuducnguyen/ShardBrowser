//! CF3: turn a recorded Firefox fingerprint into the configuration Camoufox reads at start-up.
//!
//! Camoufox takes its identity from the environment variables `CAMOU_CONFIG_1..N` (the JSON config
//! cut into pieces) and extra Firefox prefs from `CAMOU_PREFS_1..N`. This module builds both. The
//! property names are Camoufox's own; a test checks every key written here against the property
//! list of the Camoufox build the launcher installs (`data/known-keys.txt`).
//!
//! Source data (`data/`) is from the Camoufox Python package (MIT), see `data/NOTICE.md`.
//!
//! WebGL is masked with recorded identities (`data/webgl-devices.json`, from the fpgen model,
//! Apache-2.0, extracted by `tools/camoufox/extract-webgl.py`): vendor, renderer, every parameter,
//! the extension list and the shader precisions of a real device, for WebGL 1 and 2. A GPU name on
//! its own contradicts the parameters behind it; a recorded set does not. The set follows the
//! preset's own GPU when one was recorded for the claimed OS, otherwise a likely device of that OS.
//! There are no recordings for phones, so Android and iOS profiles cannot be masked this way.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::net::IpAddr;
use std::sync::OnceLock;

/// Firefox major version of the pinned Camoufox build; recorded user agents are moved to it.
pub const FIREFOX_MAJOR: u32 = 158;

/// Length of one `CAMOU_CONFIG_n` piece. Windows reads the environment through the ANSI code page
/// and caps a value at 2047 characters; elsewhere 32767.
pub fn chunk_size() -> usize {
    if cfg!(windows) { 2047 } else { 32767 }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TargetOs {
    Windows,
    Macos,
    Linux,
    /// A phone on Firefox for Android's terms (touch, CSS-pixel screen, phone fonts).
    Android,
}

impl TargetOs {
    pub fn from_platform(platform: &str) -> Self {
        if platform == "Win32" {
            TargetOs::Windows
        } else if platform.to_ascii_lowercase().contains("linux") {
            TargetOs::Linux
        } else {
            TargetOs::Macos
        }
    }

    /// The OS name used in `data/webgl-devices.json`.
    fn data_key(self) -> &'static str {
        match self {
            TargetOs::Windows => "windows",
            TargetOs::Macos => "macos",
            TargetOs::Linux => "linux",
            TargetOs::Android => "android",
        }
    }

    fn short(self) -> &'static str {
        match self {
            TargetOs::Windows => "win",
            TargetOs::Macos => "mac",
            TargetOs::Linux => "lin",
            TargetOs::Android => "and",
        }
    }

    fn label(self) -> &'static str {
        match self {
            TargetOs::Windows => "Windows",
            TargetOs::Macos => "macOS",
            TargetOs::Linux => "Linux",
            TargetOs::Android => "Android",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Nav {
    pub user_agent: String,
    pub platform: String,
    pub hardware_concurrency: Option<u32>,
    pub max_touch_points: Option<u32>,
    pub oscpu: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenSpec {
    pub width: u32,
    pub height: u32,
    pub color_depth: Option<u32>,
    pub avail_width: Option<u32>,
    pub avail_height: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebglSpec {
    pub unmasked_vendor: Option<String>,
    pub unmasked_renderer: Option<String>,
}

/// What a phone adds to a preset: its pixel ratio and the GPU a phone of that model reports.
#[derive(Debug, Clone, Deserialize)]
pub struct Phone {
    pub name: String,
    pub dpr: f64,
    pub gpu_vendor: String,
    pub gpu_renderer: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Preset {
    #[serde(default)]
    pub phone: Option<Phone>,
    pub navigator: Nav,
    pub screen: ScreenSpec,
    #[serde(default)]
    pub webgl: Option<WebglSpec>,
    #[serde(default, rename = "speechVoices")]
    pub speech_voices: Vec<String>,
}

#[derive(Deserialize)]
struct PresetFile {
    presets: PresetGroups,
}

#[derive(Deserialize)]
struct PresetGroups {
    windows: Vec<Preset>,
    macos: Vec<Preset>,
    linux: Vec<Preset>,
}

const PRESETS_JSON: &str = include_str!("data/fingerprint-presets.json");
const FONT_BASES_JSON: &str = include_str!("data/font-bases.json");
const PHONES_JSON: &str = include_str!("data/phones.json");

/// The Android phones of `data/phones.json` as presets (Firefox for Android's user agent).
fn android_presets() -> Vec<Preset> {
    let root: Value = serde_json::from_str(PHONES_JSON).expect("bundled phones parse");
    // The named phones first, then the generated ones (ids follow this order, so it must not change).
    let named = root["android"].as_array().expect("android array");
    let generated = root["generated"].as_array().map(|a| a.as_slice()).unwrap_or(&[]);
    named
        .iter()
        .chain(generated.iter())
        .map(|d| {
            let (w, h) = (d["width"].as_u64().unwrap_or(360) as u32, d["height"].as_u64().unwrap_or(780) as u32);
            let ver = d["version"].as_str().unwrap_or("14");
            Preset {
                phone: Some(Phone {
                    name: d["name"].as_str().unwrap_or_default().to_string(),
                    dpr: d["dpr"].as_f64().unwrap_or(2.0),
                    gpu_vendor: d["gpuVendor"].as_str().unwrap_or_default().to_string(),
                    gpu_renderer: d["gpuRenderer"].as_str().unwrap_or_default().to_string(),
                }),
                navigator: Nav {
                    user_agent: format!("Mozilla/5.0 (Android {ver}; Mobile; rv:{FIREFOX_MAJOR}.0) Gecko/{FIREFOX_MAJOR}.0 Firefox/{FIREFOX_MAJOR}.0"),
                    platform: "Linux armv81".into(),
                    hardware_concurrency: d["cores"].as_u64().map(|c| c as u32),
                    max_touch_points: Some(5),
                    oscpu: Some("Linux armv81".into()),
                },
                screen: ScreenSpec { width: w, height: h, color_depth: Some(24), avail_width: Some(w), avail_height: Some(h) },
                webgl: None,
                speech_voices: Vec::new(),
            }
        })
        .collect()
}

fn android_fonts() -> Vec<String> {
    let root: Value = serde_json::from_str(PHONES_JSON).expect("bundled phones parse");
    root["androidFonts"].as_array().map(|a| a.iter().filter_map(|s| s.as_str().map(String::from)).collect()).unwrap_or_default()
}

fn all_presets() -> &'static Vec<(String, TargetOs, Preset)> {
    static CELL: OnceLock<Vec<(String, TargetOs, Preset)>> = OnceLock::new();
    CELL.get_or_init(|| {
        let file: PresetFile = serde_json::from_str(PRESETS_JSON).expect("bundled presets parse");
        let mut out = Vec::new();
        for (os, list) in [
            (TargetOs::Windows, file.presets.windows),
            (TargetOs::Macos, file.presets.macos),
            (TargetOs::Linux, file.presets.linux),
        ] {
            for (i, p) in list.into_iter().enumerate() {
                out.push((format!("cf-{}-{i}", os.short()), os, p));
            }
        }
        for (i, p) in android_presets().into_iter().enumerate() {
            out.push((format!("cf-{}-{i}", TargetOs::Android.short()), TargetOs::Android, p));
        }
        out
    })
}

/// A phone as the picker sees it.
#[derive(Debug, Clone, Serialize)]
pub struct PhoneInfo {
    pub name: String,
    pub dpr: f64,
    /// The Android version in the preset's user agent.
    pub android: u32,
    /// Versions this phone's GPU class could really run (the preset's own is always inside).
    pub android_min: u32,
    pub android_max: u32,
    pub gpu_vendor: String,
    /// "high", "mid" or "low", from the GPU.
    pub tier: &'static str,
}

/// Phone class from the GPU name: flagship, mid-range or entry-level.
pub fn phone_tier(renderer: &str) -> &'static str {
    let digits = |s: &str| s.chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse::<u32>().ok();
    if let Some(n) = renderer.split("Adreno (TM) ").nth(1).and_then(digits) {
        return if n < 615 { "low" } else if n < 700 { "mid" } else { "high" };
    }
    if let Some(rest) = renderer.strip_prefix("Mali-") {
        if rest.starts_with('T') {
            return "low";
        }
        if let Some(n) = rest.trim_start_matches('G').split(|c: char| !c.is_ascii_digit()).next().and_then(|x| x.parse::<u32>().ok()) {
            return if n <= 52 { "low" } else if n <= 78 { "mid" } else { "high" };
        }
    }
    "low"
}

/// Android versions a phone class could really run.
fn tier_versions(tier: &str) -> (u32, u32) {
    match tier {
        "high" => (13, 16),
        "mid" => (11, 15),
        _ => (10, 13),
    }
}

/// "Android 14" in a user agent -> 14.
fn android_version_of(ua: &str) -> Option<u32> {
    ua.split("Android ").nth(1).and_then(|r| r.split(|c: char| !c.is_ascii_digit()).next()).and_then(|v| v.parse().ok())
}

/// The versions the picker may offer for a phone preset: its class's range, widened to hold its own.
pub fn phone_version_range(preset: &Preset) -> Option<(u32, u32)> {
    let ph = preset.phone.as_ref()?;
    let own = android_version_of(&preset.navigator.user_agent)?;
    let (lo, hi) = tier_versions(phone_tier(&ph.gpu_renderer));
    Some((lo.min(own), hi.max(own)))
}

/// One recorded device as the interface lists it.
#[derive(Debug, Clone, Serialize)]
pub struct LibraryEntry {
    /// Set for phones: what the picker needs to filter and constrain them.
    pub phone: Option<PhoneInfo>,
    pub id: String,
    pub os: TargetOs,
    pub label: String,
    pub screen: (u32, u32),
    pub cores: Option<u32>,
    pub gpu: String,
}

/// "ANGLE (Intel, Intel(R) HD Graphics 400 Direct3D11 vs_5_0 ps_5_0), or similar" -> "Intel(R) HD Graphics 400".
pub fn short_gpu(renderer: &str) -> String {
    let s = renderer.trim();
    let s = s.strip_suffix(", or similar").unwrap_or(s);
    if let Some(inner) = s.strip_prefix("ANGLE (").and_then(|x| x.strip_suffix(')')) {
        // "Vendor, Model Direct3D11 vs_5_0 ps_5_0" (the model itself may contain parentheses)
        let model = inner.split_once(", ").map(|(_, m)| m).unwrap_or(inner);
        let cut = [" Direct3D", " vs_", " OpenGL"].iter().filter_map(|m| model.find(m)).min().unwrap_or(model.len());
        let name = model[..cut].trim();
        if !name.is_empty() {
            return name.to_string();
        }
    }
    s.to_string()
}

/// A software rasteriser (no real GPU) is a tell of its own, so such a recorded device is not offered.
/// Its index is kept, so ids of profiles that already name one do not move.
fn is_software_gpu(renderer: &str) -> bool {
    let r = renderer.to_ascii_lowercase();
    ["microsoft basic render", "llvmpipe", "softpipe", "swiftshader", "software"].iter().any(|m| r.contains(m))
}

fn preset_is_software(p: &Preset) -> bool {
    p.webgl.as_ref().and_then(|w| w.unmasked_renderer.as_deref()).map(is_software_gpu).unwrap_or(false)
}

pub fn library() -> Vec<LibraryEntry> {
    all_presets()
        .iter()
        .filter(|(_, _, p)| !preset_is_software(p))
        .map(|(id, os, p)| {
            let gpu = p
                .webgl
                .as_ref()
                .and_then(|w| w.unmasked_renderer.as_deref())
                .map(short_gpu)
                .or_else(|| p.phone.as_ref().map(|ph| ph.gpu_renderer.clone()))
                .unwrap_or_default();
            let phone = p.phone.as_ref().and_then(|ph| {
                let own = android_version_of(&p.navigator.user_agent)?;
                let (lo, hi) = phone_version_range(p)?;
                Some(PhoneInfo {
                    name: ph.name.clone(),
                    dpr: ph.dpr,
                    android: own,
                    android_min: lo,
                    android_max: hi,
                    gpu_vendor: ph.gpu_vendor.clone(),
                    tier: phone_tier(&ph.gpu_renderer),
                })
            });
            LibraryEntry {
                phone,
                id: id.clone(),
                os: *os,
                label: match &p.phone {
                    Some(ph) => format!("{} · {} · {}×{}", os.label(), ph.name, p.screen.width, p.screen.height),
                    None => format!("{} · {}×{} · {}", os.label(), p.screen.width, p.screen.height, if gpu.is_empty() { "unknown GPU" } else { &gpu }),
                },
                screen: (p.screen.width, p.screen.height),
                cores: p.navigator.hardware_concurrency,
                gpu,
            }
        })
        .collect()
}

pub fn preset(id: &str) -> Option<(&'static Preset, TargetOs)> {
    all_presets().iter().find(|(i, _, _)| i == id).map(|(_, os, p)| (p, *os))
}

/// What the launcher knows about the profile's surroundings when it starts it.
#[derive(Debug, Clone, Default)]
pub struct Context<'a> {
    /// Keeps the per-profile draws (audio seed, font base) the same on every launch.
    pub profile_id: &'a str,
    /// BCP-47 language of the proxy's country, e.g. "pt-BR".
    pub locale: Option<&'a str>,
    /// IANA zone of the proxy's location.
    pub timezone: Option<&'a str>,
    pub geolocation: Option<(f64, f64)>,
    /// The address pages will see; WebRTC is told to report it.
    pub public_ip: Option<IpAddr>,
    /// Port of the local relay in front of the profile's proxy; `None` means no proxy.
    pub proxy_relay_port: Option<u16>,
    /// A phone: touch input and a viewport that scales like a phone's.
    pub mobile: bool,
    /// The Android version the profile asks for; used only if the phone's class could run it.
    pub android_version: Option<u32>,
}

pub fn fnv64(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

/// Replace the version in `Firefox/NNN.0` and `rv:NNN.0` so the user agent names the build that runs.
pub fn patch_version(ua: &str, major: u32) -> String {
    let mut out = ua.to_string();
    for marker in ["Firefox/", "rv:"] {
        if let Some(at) = out.find(marker) {
            let start = at + marker.len();
            let digits = out[start..].chars().take_while(|c| c.is_ascii_digit()).count();
            if digits > 0 {
                out.replace_range(start..start + digits, &major.to_string());
            }
        }
    }
    out
}

/// The `navigator.appVersion` Firefox reports for a user agent: "5.0 (<OS tokens>)", without the
/// architecture, the Gecko revision or the Windows build.
pub fn app_version(ua: &str) -> Option<String> {
    let rest = ua.strip_prefix("Mozilla/5.0 (")?;
    let block = &rest[..rest.find(')')?];
    let kept: Vec<String> = block
        .split(';')
        .map(str::trim)
        .filter(|t| !(t.starts_with("rv:") || matches!(*t, "Win64" | "x64" | "Mobile" | "Tablet") || t.starts_with("Linux ") || t.starts_with("Intel Mac OS X")))
        .map(|t| if t.starts_with("Windows") { "Windows".to_string() } else { t.to_string() })
        .collect();
    if kept.is_empty() { None } else { Some(format!("5.0 ({})", kept.join("; "))) }
}

fn oscpu_for(platform: &str, os: TargetOs) -> Option<&'static str> {
    if platform == "MacIntel" {
        return Some("Intel Mac OS X 10.15");
    }
    match os {
        TargetOs::Windows => Some("Windows NT 10.0; Win64; x64"),
        TargetOs::Linux => Some("Linux x86_64"),
        TargetOs::Macos => None,
        TargetOs::Android => Some("Linux armv81"),
    }
}

fn voice_uri(os: TargetOs, name: &str, lang: &str) -> String {
    match os {
        TargetOs::Windows => format!("urn:moz-tts:sapi:{name}?{lang}"),
        TargetOs::Linux => {
            let mut esc = String::new();
            for ch in name.chars() {
                if ch == ' ' {
                    esc.push_str("%20");
                } else if ch.is_ascii() {
                    esc.push(ch);
                } else {
                    let mut buf = [0u8; 4];
                    for b in ch.encode_utf8(&mut buf).bytes() {
                        esc.push_str(&format!("%{b:02X}"));
                    }
                }
            }
            format!("urn:moz-tts:speechd:{esc}?{lang}")
        }
        // Approximate: the real identifiers come from a catalogue of stock macOS that is not bundled.
        TargetOs::Android => format!("urn:moz-tts:android:{name}?{lang}"),
        TargetOs::Macos => {
            let ascii: String = name.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
            format!("urn:moz-tts:osx:com.apple.voice.compact.{lang}.{ascii}")
        }
    }
}

/// Recorded voices are "Name:lang:local|remote" strings; Camoufox wants objects.
pub fn voices(entries: &[String], os: TargetOs) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();
    for e in entries {
        let Some(last) = e.rfind(':') else { continue };
        let (before, kind) = (&e[..last], &e[last + 1..]);
        let Some(sep) = before.rfind(':') else { continue };
        let (name, lang) = (&before[..sep], &before[sep + 1..]);
        if name.is_empty() || lang.is_empty() {
            continue;
        }
        out.push(json!({
            "name": name,
            "lang": lang,
            "voiceUri": voice_uri(os, name, lang),
            "isDefault": false,
            "isLocalService": kind == "local",
        }));
    }
    if let Some(first) = out.first_mut() {
        first["isDefault"] = Value::Bool(true);
    }
    out
}

/// The OS font base for this profile: one of the recorded sets, picked by weight from the profile id.
fn font_base(os: TargetOs, profile_id: &str) -> Vec<String> {
    static BASES: OnceLock<Value> = OnceLock::new();
    let bases = BASES.get_or_init(|| serde_json::from_str(FONT_BASES_JSON).expect("bundled font bases parse"));
    let Some(list) = bases.get(os.short()).and_then(|v| v.as_array()) else { return Vec::new() };
    let total: f64 = list.iter().map(|b| b.get("weight").and_then(|w| w.as_f64()).unwrap_or(1.0)).sum();
    if list.is_empty() || total <= 0.0 {
        return Vec::new();
    }
    let mut roll = (fnv64(&format!("{profile_id}::fonts")) % 1_000_000) as f64 / 1_000_000.0 * total;
    let mut pick = &list[0];
    for b in list {
        let w = b.get("weight").and_then(|w| w.as_f64()).unwrap_or(1.0);
        if roll < w {
            pick = b;
            break;
        }
        roll -= w;
    }
    pick.get("fonts")
        .and_then(|f| f.as_array())
        .map(|a| a.iter().filter_map(|s| s.as_str().map(String::from)).collect())
        .unwrap_or_default()
}

struct WebglDevice {
    os: String,
    vendor: String,
    renderer: String,
    weight: f64,
    config: Map<String, Value>,
}

const WEBGL_JSON: &str = include_str!("data/webgl-devices.json");

fn webgl_devices() -> &'static Vec<WebglDevice> {
    static CELL: OnceLock<Vec<WebglDevice>> = OnceLock::new();
    CELL.get_or_init(|| {
        let root: Value = serde_json::from_str(WEBGL_JSON).expect("bundled WebGL devices parse");
        root["devices"]
            .as_array()
            .expect("devices array")
            .iter()
            .map(|d| WebglDevice {
                os: d["os"].as_str().unwrap_or_default().to_string(),
                vendor: d["vendor"].as_str().unwrap_or_default().to_string(),
                renderer: d["renderer"].as_str().unwrap_or_default().to_string(),
                weight: d["weight"].as_f64().unwrap_or(0.0),
                config: d["config"].as_object().cloned().unwrap_or_default(),
            })
            .collect()
    })
}

/// The recorded WebGL identity for a preset: the device recorded behind its own GPU when there is
/// one on this OS, otherwise a likely device of the OS. Chosen by weight from the profile id, so the
/// same profile always gets the same one.
fn pick_webgl(os: TargetOs, preset: &Preset, profile_id: &str) -> Option<&'static WebglDevice> {
    let on_os: Vec<&WebglDevice> = webgl_devices().iter().filter(|d| d.os == os.data_key()).collect();
    let own = preset.webgl.as_ref();
    let exact: Vec<&WebglDevice> = on_os
        .iter()
        .copied()
        .filter(|d| {
            own.map(|w| w.unmasked_vendor.as_deref() == Some(d.vendor.as_str()) && w.unmasked_renderer.as_deref() == Some(d.renderer.as_str()))
                .unwrap_or(false)
        })
        .collect();
    let pool = if exact.is_empty() { on_os } else { exact };
    let total: f64 = pool.iter().map(|d| d.weight).sum();
    if pool.is_empty() || total <= 0.0 {
        return pool.first().copied();
    }
    let mut roll = (fnv64(&format!("{profile_id}::webgl")) % 1_000_000) as f64 / 1_000_000.0 * total;
    for d in &pool {
        if roll < d.weight {
            return Some(d);
        }
        roll -= d.weight;
    }
    pool.last().copied()
}

/// Split "pt-BR" or "zh-Hans-CN" into (language, script, region).
fn split_locale(tag: &str) -> (String, Option<String>, Option<String>) {
    let mut language = String::new();
    let (mut script, mut region) = (None, None);
    for (i, part) in tag.split(['-', '_']).enumerate() {
        if i == 0 {
            language = part.to_ascii_lowercase();
        } else if part.len() == 4 && part.chars().all(|c| c.is_ascii_alphabetic()) {
            let mut c = part.chars();
            script = c.next().map(|f| f.to_ascii_uppercase().to_string() + &c.as_str().to_ascii_lowercase());
        } else if part.len() == 2 || (part.len() == 3 && part.chars().all(|c| c.is_ascii_digit())) {
            region = Some(part.to_ascii_uppercase());
        }
    }
    (language, script, region)
}

/// The `CAMOU_CONFIG` map for one profile.
pub fn build_config(preset: &Preset, os: TargetOs, ctx: &Context) -> Map<String, Value> {
    let mut c = Map::new();
    let nav = &preset.navigator;
    let mut ua = patch_version(&nav.user_agent, FIREFOX_MAJOR);
    if let (Some(want), Some((lo, hi)), Some(own)) = (ctx.android_version, phone_version_range(preset), android_version_of(&nav.user_agent)) {
        if (lo..=hi).contains(&want) {
            ua = ua.replacen(&format!("Android {own}"), &format!("Android {want}"), 1);
        }
    }
    c.insert("navigator.userAgent".into(), json!(ua));
    c.insert("navigator.platform".into(), json!(nav.platform));
    if let Some(n) = nav.hardware_concurrency {
        c.insert("navigator.hardwareConcurrency".into(), json!(n));
    }
    if let Some(o) = nav.oscpu.as_deref().or_else(|| oscpu_for(&nav.platform, os)) {
        c.insert("navigator.oscpu".into(), json!(o));
    }
    if let Some(v) = app_version(&ua) {
        c.insert("navigator.appVersion".into(), json!(v));
    }
    if let Some(n) = nav.max_touch_points {
        c.insert("navigator.maxTouchPoints".into(), json!(n));
    }

    let s = &preset.screen;
    c.insert("screen.width".into(), json!(s.width));
    c.insert("screen.height".into(), json!(s.height));
    if let Some(d) = s.color_depth {
        c.insert("screen.colorDepth".into(), json!(d));
        c.insert("screen.pixelDepth".into(), json!(d));
    }
    if let Some(w) = s.avail_width {
        c.insert("screen.availWidth".into(), json!(w));
    }
    if let Some(h) = s.avail_height {
        c.insert("screen.availHeight".into(), json!(h));
    }

    // Per profile and stable across launches (a zero seed would mean "no noise").
    let seed = (fnv64(&format!("{}::audio", ctx.profile_id)) % 4_294_967_295) as u32 + 1;
    c.insert("audio:seed".into(), json!(seed));

    // WebGL: a full recorded identity, so the GPU name, the parameters and the extensions agree.
    // Every recorded device has WebGL 2, so the `webGl2Enabled` switch (a key newer than the pinned
    // Camoufox knows) is not needed and is left out.
    if let Some(dev) = pick_webgl(os, preset, ctx.profile_id) {
        for (k, v) in &dev.config {
            if k != "webGl2Enabled" {
                c.insert(k.clone(), v.clone());
            }
        }
    }

    if let Some(ph) = &preset.phone {
        // A phone's screen is its CSS size and the window fills it; Camoufox is not asked to make
        // room for desktop window chrome.
        for k in ["screen.availTop", "screen.availLeft", "window.screenX", "window.screenY"] {
            c.insert(k.into(), json!(0));
        }
        c.insert("window.devicePixelRatio".into(), json!(ph.dpr));
        for (k, v) in [("innerWidth", s.width), ("outerWidth", s.width), ("innerHeight", s.height), ("outerHeight", s.height)] {
            c.insert(format!("window.{k}"), json!(v));
        }
        c.insert("navigator.appCodeName".into(), json!("Mozilla"));
        // No desktop speech voices: on a Windows host the page would otherwise list this
        // computer's own voices next to an Android user agent.
        c.insert("voices".into(), json!([]));
        c.insert("voices:blockIfNotDefined".into(), json!(true));
        // The GPU a phone of this model reports. Parameters stay the engine's own: there is no
        // recording of a real phone's WebGL to take them from.
        c.insert("webGl:vendor".into(), json!(ph.gpu_vendor));
        // Firefox for Android reports the renderer with the suffix ", or similar" (seen in real captures).
        c.insert("webGl:renderer".into(), json!(format!("{}, or similar", ph.gpu_renderer)));
    }

    let fonts = if os == TargetOs::Android { android_fonts() } else { font_base(os, ctx.profile_id) };
    if !fonts.is_empty() {
        c.insert("fonts".into(), json!(fonts));
    }
    let v = voices(&preset.speech_voices, os);
    if !v.is_empty() {
        c.insert("voices".into(), Value::Array(v));
    }

    if let Some(tz) = ctx.timezone {
        c.insert("timezone".into(), json!(tz));
    }
    if let Some(tag) = ctx.locale {
        let (lang, script, region) = split_locale(tag);
        if !lang.is_empty() {
            c.insert("locale:language".into(), json!(lang));
            if let Some(r) = &region {
                c.insert("locale:region".into(), json!(r));
            }
            if let Some(sc) = &script {
                c.insert("locale:script".into(), json!(sc));
            }
            let nav_lang = match &region {
                Some(r) => format!("{lang}-{r}"),
                None => lang.clone(),
            };
            c.insert("navigator.language".into(), json!(nav_lang));
        }
    }
    if let Some((lat, lon)) = ctx.geolocation {
        c.insert("geolocation:latitude".into(), json!(lat));
        c.insert("geolocation:longitude".into(), json!(lon));
    }
    match ctx.public_ip {
        Some(IpAddr::V4(ip)) => {
            c.insert("webrtc:ipv4".into(), json!(ip.to_string()));
        }
        Some(IpAddr::V6(ip)) => {
            c.insert("webrtc:ipv6".into(), json!(ip.to_string()));
        }
        None => {}
    }
    c
}

/// Firefox will not make a window narrower than about 500 px, so a 412 px phone window would report an
/// outer width wider than its own screen. This stylesheet lifts that minimum.
pub const PHONE_CHROME_CSS: &str = "#main-window,:root{min-width:0!important;min-height:0!important} #navigator-toolbox,#nav-bar,#TabsToolbar{min-width:0!important}
";

/// Prefs Camoufox applies at start-up (through `CAMOU_PREFS_n`).
pub fn build_prefs(ctx: &Context) -> Map<String, Value> {
    let mut p = Map::new();
    // The browser's own UI language follows the spoofed one; empty would follow the host.
    let requested = match ctx.locale {
        Some(tag) => {
            let (lang, script, region) = split_locale(tag);
            [Some(lang), script, region].into_iter().flatten().filter(|s| !s.is_empty()).collect::<Vec<_>>().join("-")
        }
        None => String::new(),
    };
    p.insert("intl.locale.requested".into(), json!(if requested.is_empty() { "en-US".to_string() } else { requested }));
    p.insert("privacy.donottrackheader.enabled".into(), json!(false));
    p.insert("privacy.globalprivacycontrol.enabled".into(), json!(false));
    if ctx.mobile {
        // Lets the profile's `chrome/userChrome.css` (see `PHONE_CHROME_CSS`) take effect.
        p.insert("toolkit.legacyUserProfileCustomizations.stylesheets".into(), json!(true));
        p.insert("dom.w3c_touch_events.enabled".into(), json!(1));
        p.insert("dom.w3c_touch_events.legacy_apis.enabled".into(), json!(true));
        p.insert("dom.meta-viewport.enabled".into(), json!(true));
        p.insert("apz.allow_zooming".into(), json!(true));
        p.insert("ui.primaryPointerCapabilities".into(), json!(1));
        p.insert("ui.allPointerCapabilities".into(), json!(1));
    }
    if ctx.geolocation.is_some() {
        // A position handed out without a prompt must also read as "granted" through the Permissions API.
        p.insert("permissions.default.geo".into(), json!(1));
    }
    if let Some(port) = ctx.proxy_relay_port {
        // Everything goes to the local relay, which logs in to the real proxy.
        p.insert("network.proxy.type".into(), json!(1));
        p.insert("network.proxy.socks".into(), json!("127.0.0.1"));
        p.insert("network.proxy.socks_port".into(), json!(port));
        p.insert("network.proxy.socks_version".into(), json!(5));
        // Names are resolved by the proxy, never on this computer.
        p.insert("network.proxy.socks_remote_dns".into(), json!(true));
        // If the relay or proxy fails, the page must fail, not go out on this connection.
        p.insert("network.proxy.failover_direct".into(), json!(false));
        // No DNS-over-HTTPS lookups that would bypass the proxy.
        p.insert("network.trr.mode".into(), json!(5));
        // WebRTC may only use the proxy (TCP); the address it reports is the spoofed one.
        p.insert("media.peerconnection.ice.proxy_only".into(), json!(true));
    }
    p
}

/// JSON with every non-ASCII character written as `\uXXXX`. Windows reads environment values through
/// the ANSI code page, which would mangle raw UTF-8; the escapes survive it and the browser's
/// `JSON.parse` restores them.
pub fn ascii_json(v: &Value) -> String {
    let raw = serde_json::to_string(v).unwrap_or_default();
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        if ch.is_ascii() {
            out.push(ch);
        } else {
            let mut units = [0u16; 2];
            for u in ch.encode_utf16(&mut units) {
                out.push_str(&format!("\\u{u:04x}"));
            }
        }
    }
    out
}

/// `PREFIX_1..N` environment variables holding `value` cut into `chunk` characters.
pub fn chunked_env(prefix: &str, value: &Value, chunk: usize) -> Vec<(String, String)> {
    let text = ascii_json(value);
    let bytes = text.as_bytes(); // ASCII only after ascii_json, so bytes are characters
    bytes
        .chunks(chunk.max(1))
        .enumerate()
        .map(|(i, part)| (format!("{prefix}_{}", i + 1), String::from_utf8_lossy(part).into_owned()))
        .collect()
}

/// Everything a Camoufox process needs in its environment for this profile.
pub fn env_vars(config: &Map<String, Value>, prefs: &Map<String, Value>) -> Vec<(String, String)> {
    let mut v = chunked_env("CAMOU_CONFIG", &Value::Object(config.clone()), chunk_size());
    if !prefs.is_empty() {
        v.extend(chunked_env("CAMOU_PREFS", &Value::Object(prefs.clone()), chunk_size()));
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    const KNOWN_KEYS: &str = include_str!("data/known-keys.txt");

    fn known() -> std::collections::HashSet<&'static str> {
        KNOWN_KEYS.lines().filter(|l| !l.is_empty()).collect()
    }

    fn ctx<'a>(id: &'a str) -> Context<'a> {
        Context { profile_id: id, ..Default::default() }
    }

    #[test]
    fn the_library_offers_the_recorded_devices_that_have_a_real_gpu() {
        // 113 are recorded; the 4 that use Microsoft's software renderer are not offered.
        assert_eq!(all_presets().len(), 113 + android_presets().len());
        let lib = library();
        assert_eq!(lib.len(), 109 + android_presets().len());
        let count = |os| lib.iter().filter(|e| e.os == os).count();
        assert_eq!((count(TargetOs::Windows), count(TargetOs::Macos), count(TargetOs::Linux)), (67, 25, 17));
        assert_eq!(count(TargetOs::Android), android_presets().len());
        assert!(count(TargetOs::Android) > 100, "the phone pool is the named phones plus the generated ones");
        assert!(lib.iter().all(|e| !is_software_gpu(&e.gpu)), "a software rasteriser must not be offered");
        // A profile that already names one of the four still resolves it.
        assert!(all_presets().iter().any(|(id, _, p)| preset_is_software(p) && preset(id).is_some()));
        let ids: std::collections::HashSet<_> = lib.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids.len(), lib.len(), "ids are unique");
        assert!(lib.iter().all(|e| preset(&e.id).is_some()));
    }

    #[test]
    fn every_key_written_is_a_property_of_the_installed_camoufox() {
        let known = known();
        assert!(known.len() > 100, "known-keys.txt looks empty");
        let c = Context {
            profile_id: "p", locale: Some("pt-BR"), timezone: Some("America/Sao_Paulo"),
            geolocation: Some((-23.55, -46.63)), public_ip: Some("203.0.113.7".parse().unwrap()), proxy_relay_port: Some(1080), mobile: false, android_version: None,
        };
        for e in library() {
            let (p, os) = preset(&e.id).unwrap();
            for k in build_config(p, os, &c).keys() {
                assert!(known.contains(k.as_str()), "{} writes `{k}`, which Camoufox does not know", e.id);
            }
        }
    }

    #[test]
    fn the_user_agent_names_the_build_that_runs() {
        let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0";
        assert_eq!(
            patch_version(ua, 158),
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0"
        );
        for e in library() {
            let (p, os) = preset(&e.id).unwrap();
            let cfg = build_config(p, os, &ctx("x"));
            let got = cfg["navigator.userAgent"].as_str().unwrap();
            assert!(got.contains("Firefox/158.0") && got.contains("rv:158.0"), "{got}");
        }
    }

    #[test]
    fn app_version_follows_the_user_agent() {
        assert_eq!(app_version("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0").as_deref(), Some("5.0 (Windows)"));
        assert_eq!(app_version("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0").as_deref(), Some("5.0 (X11; Ubuntu)"));
        assert_eq!(app_version("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:158.0) Gecko/20100101 Firefox/158.0").as_deref(), Some("5.0 (Macintosh)"));
        assert_eq!(app_version("not a user agent"), None);
    }

    #[test]
    fn identity_draws_are_stable_per_profile_and_differ_between_profiles() {
        let (p, os) = preset("cf-win-0").unwrap();
        let a1 = build_config(p, os, &ctx("profile-a"));
        let a2 = build_config(p, os, &ctx("profile-a"));
        let b = build_config(p, os, &ctx("profile-b"));
        assert_eq!(a1["audio:seed"], a2["audio:seed"]);
        assert_eq!(a1["fonts"], a2["fonts"]);
        assert_ne!(a1["audio:seed"], b["audio:seed"]);
        assert!(a1["audio:seed"].as_u64().unwrap() >= 1, "0 would switch the noise off");
    }

    #[test]
    fn every_device_wears_a_complete_recorded_webgl_identity_that_matches_its_os() {
        let known = known();
        for e in library().into_iter().filter(|e| e.os != TargetOs::Android) {
            let (p, os) = preset(&e.id).unwrap();
            let c = build_config(p, os, &ctx("x"));
            for k in ["webGl:vendor", "webGl:renderer", "webGl:parameters", "webGl:supportedExtensions", "webGl:shaderPrecisionFormats",
                      "webGl2:parameters", "webGl2:supportedExtensions", "webGl2:shaderPrecisionFormats"] {
                assert!(c.contains_key(k), "{} lacks {k}", e.id);
            }
            assert!(!c.contains_key("webGl2Enabled"), "a key the pinned Camoufox does not know");
            assert!(c.keys().all(|k| known.contains(k.as_str())), "{}", e.id);
            let params = c["webGl:parameters"].as_object().unwrap();
            assert!(params.len() > 40, "{}: only {} WebGL parameters", e.id, params.len());
            // The renderer is the platform's: ANGLE on Windows, Apple or Mesa style elsewhere.
            let r = c["webGl:renderer"].as_str().unwrap();
            match os {
                TargetOs::Windows => assert!(r.starts_with("ANGLE ("), "{r}"),
                TargetOs::Macos => assert!(!r.starts_with("ANGLE ("), "{r}"),
                TargetOs::Linux => assert!(!r.starts_with("ANGLE (Direct3D"), "{r}"),
                TargetOs::Android => unreachable!(),
            }
            assert!(!is_software_gpu(r), "{r}");
        }
    }

    #[test]
    fn the_webgl_identity_follows_the_presets_own_gpu_when_it_was_recorded() {
        let mut followed = 0;
        let desktop: Vec<_> = library().into_iter().filter(|e| e.os != TargetOs::Android).collect();
        for e in &desktop {
            let (p, os) = preset(&e.id).unwrap();
            let own = p.webgl.as_ref().unwrap();
            let c = build_config(p, os, &ctx("any"));
            if c["webGl:renderer"].as_str() == own.unmasked_renderer.as_deref() {
                assert_eq!(c["webGl:vendor"].as_str(), own.unmasked_vendor.as_deref(), "{}", e.id);
                followed += 1;
            }
        }
        assert_eq!(followed, desktop.len(), "every offered preset has a recording behind its own GPU");
    }

    #[test]
    fn the_webgl_identity_is_stable_per_profile_and_the_data_is_sane() {
        let (p, os) = preset("cf-win-0").unwrap();
        let a = build_config(p, os, &ctx("profile-a"));
        assert_eq!(a["webGl:parameters"], build_config(p, os, &ctx("profile-a"))["webGl:parameters"]);
        assert!(webgl_devices().len() >= 30);
        for os in ["windows", "macos", "linux"] {
            assert!(webgl_devices().iter().any(|d| d.os == os), "no recorded device for {os}");
        }
        assert!(webgl_devices().iter().all(|d| d.weight > 0.0 && !d.config.is_empty()));
    }

    #[test]
    fn windows_profiles_get_a_windows_font_base() {
        let (p, os) = preset("cf-win-0").unwrap();
        let fonts = build_config(p, os, &ctx("x"))["fonts"].as_array().unwrap().clone();
        assert!(fonts.iter().any(|f| f == "Arial"));
        assert!(!fonts.iter().any(|f| f == "Helvetica Neue"), "a Mac font on a Windows identity");
    }

    #[test]
    fn recorded_voices_become_objects_with_a_default() {
        let v = voices(&["Microsoft David - English (United States):en-US:local".into(), "Zira:en-US:remote".into()], TargetOs::Windows);
        assert_eq!(v[0]["name"], "Microsoft David - English (United States)");
        assert_eq!(v[0]["voiceUri"], "urn:moz-tts:sapi:Microsoft David - English (United States)?en-US");
        assert_eq!(v[0]["isLocalService"], true);
        assert_eq!(v[0]["isDefault"], true);
        assert_eq!(v[1]["isLocalService"], false);
        assert_eq!(v[1]["isDefault"], false);
        let lin = voices(&["Amélie Voice:fr-CA:local".into()], TargetOs::Linux);
        assert_eq!(lin[0]["voiceUri"], "urn:moz-tts:speechd:Am%C3%A9lie%20Voice?fr-CA");
        assert!(voices(&["broken".into()], TargetOs::Windows).is_empty());
    }

    #[test]
    fn locale_and_location_come_from_the_context() {
        let (p, os) = preset("cf-win-0").unwrap();
        let c = Context { profile_id: "x", locale: Some("pt-BR"), timezone: Some("America/Sao_Paulo"), geolocation: Some((-23.5, -46.6)), public_ip: Some("2001:db8::1".parse().unwrap()), ..Default::default() };
        let cfg = build_config(p, os, &c);
        assert_eq!(cfg["locale:language"], "pt");
        assert_eq!(cfg["locale:region"], "BR");
        assert_eq!(cfg["navigator.language"], "pt-BR");
        assert_eq!(cfg["timezone"], "America/Sao_Paulo");
        assert_eq!(cfg["geolocation:latitude"], -23.5);
        assert_eq!(cfg["webrtc:ipv6"], "2001:db8::1");
        assert!(cfg.get("webrtc:ipv4").is_none());
        let prefs = build_prefs(&c);
        assert_eq!(prefs["intl.locale.requested"], "pt-BR");
        assert_eq!(prefs["permissions.default.geo"], 1);
        // Without a context nothing about place is claimed.
        let bare = build_config(p, os, &ctx("x"));
        assert!(!bare.keys().any(|k| k.starts_with("locale:") || k.starts_with("geolocation:") || k.starts_with("webrtc:") || k == "timezone"));
        assert_eq!(build_prefs(&ctx("x"))["intl.locale.requested"], "en-US");
        assert_eq!(split_locale("zh-Hans-CN"), ("zh".into(), Some("Hans".into()), Some("CN".into())));
        assert_eq!(split_locale("en"), ("en".into(), None, None));
    }

    #[test]
    fn with_a_proxy_the_browser_is_pointed_at_the_relay_and_may_not_go_direct() {
        let c = Context { profile_id: "x", proxy_relay_port: Some(40123), ..Default::default() };
        let p = build_prefs(&c);
        assert_eq!(p["network.proxy.type"], 1);
        assert_eq!(p["network.proxy.socks"], "127.0.0.1");
        assert_eq!(p["network.proxy.socks_port"], 40123);
        assert_eq!(p["network.proxy.socks_remote_dns"], true, "names must be resolved by the proxy");
        assert_eq!(p["network.proxy.failover_direct"], false, "a failing proxy must not fall back to this connection");
        assert_eq!(p["network.trr.mode"], 5, "DNS-over-HTTPS would bypass the proxy");
        assert_eq!(p["media.peerconnection.ice.proxy_only"], true);
        let known = known();
        // The proxy and network prefs are Firefox's, not Camoufox properties; they only travel as prefs.
        assert!(p.keys().all(|k| !known.contains(k.as_str())));
        // Without a proxy none of this is written.
        assert!(!build_prefs(&ctx("x")).keys().any(|k| k.starts_with("network.")));
    }

    #[test]
    fn the_config_is_cut_into_pieces_that_join_back_to_the_same_json() {
        let (p, os) = preset("cf-win-0").unwrap();
        let cfg = Value::Object(build_config(p, os, &ctx("x")));
        for size in [2047usize, 64, 7] {
            let pieces = chunked_env("CAMOU_CONFIG", &cfg, size);
            assert!(pieces.len() > 1 || size > 2047);
            assert!(pieces.iter().all(|(_, s)| s.len() <= size));
            assert_eq!(pieces[0].0, "CAMOU_CONFIG_1");
            let joined: String = pieces.iter().map(|(_, s)| s.as_str()).collect();
            assert_eq!(serde_json::from_str::<Value>(&joined).unwrap(), cfg);
        }
    }

    #[test]
    fn non_ascii_text_is_escaped_and_survives_the_round_trip() {
        let v = json!({"name": "Amélie", "emoji": "🦊", "plain": "abc"});
        let text = ascii_json(&v);
        assert!(text.is_ascii(), "{text}");
        assert!(text.contains("\\u00e9") && text.contains("\\ud83e\\udd8a"), "{text}");
        assert_eq!(serde_json::from_str::<Value>(&text).unwrap(), v);
    }

    #[test]
    fn a_phone_is_coherent_from_user_agent_to_screen_and_prefs() {
        let phones: Vec<_> = library().into_iter().filter(|e| e.os == TargetOs::Android).collect();
        assert_eq!(phones.len(), android_presets().len());
        for e in phones {
            let (p, os) = preset(&e.id).unwrap();
            let ph = p.phone.as_ref().expect("a phone preset carries its model");
            let c = build_config(p, os, &ctx("phone-1"));
            let ua = c["navigator.userAgent"].as_str().unwrap();
            assert!(ua.starts_with("Mozilla/5.0 (Android ") && ua.contains("; Mobile; rv:158.0)") && ua.ends_with("Firefox/158.0"), "{ua}");
            assert!(!ua.contains("Windows") && !ua.contains("X11"), "{ua}");
            assert_eq!(c["navigator.platform"], "Linux armv81");
            assert_eq!(c["navigator.oscpu"], "Linux armv81");
            assert!(c["navigator.appVersion"].as_str().unwrap().starts_with("5.0 (Android "));
            assert_eq!(c["navigator.maxTouchPoints"], 5);
            assert_eq!(c["voices"], json!([]), "the host's own voices must not show on a phone");
            assert_eq!(c["voices:blockIfNotDefined"], true);
            assert_eq!(c["window.devicePixelRatio"], ph.dpr);
            // The window fills the screen, and the screen is the phone's CSS size.
            for (a, b) in [("screen.width", "window.innerWidth"), ("screen.width", "window.outerWidth"), ("screen.height", "window.innerHeight"), ("screen.height", "window.outerHeight"), ("screen.width", "screen.availWidth"), ("screen.height", "screen.availHeight")] {
                assert_eq!(c[a], c[b], "{} {a} vs {b}", e.id);
            }
            assert!(c["screen.width"].as_u64().unwrap() < c["screen.height"].as_u64().unwrap(), "portrait");
            assert_eq!(c["webGl:renderer"], format!("{}, or similar", ph.gpu_renderer).as_str());
            // Only phone fonts: nothing a desktop would add.
            let fonts: Vec<_> = c["fonts"].as_array().unwrap().iter().map(|f| f.as_str().unwrap()).collect();
            assert!(fonts.contains(&"Roboto") && !fonts.contains(&"Arial") && !fonts.contains(&"Segoe UI"), "{fonts:?}");
            // Same profile, same phone values on every launch.
            assert_eq!(c, build_config(p, os, &ctx("phone-1")));
        }
        let prefs = build_prefs(&Context { profile_id: "p", mobile: true, ..Default::default() });
        assert_eq!(prefs["dom.w3c_touch_events.enabled"], 1);
        assert_eq!(prefs["ui.primaryPointerCapabilities"], 1);
        assert!(!build_prefs(&ctx("p")).contains_key("dom.w3c_touch_events.enabled"), "desktop profiles keep desktop input");
    }

    #[test]
    fn a_phone_class_decides_which_android_versions_are_offered() {
        assert_eq!(phone_tier("Adreno (TM) 830"), "high");
        assert_eq!(phone_tier("Adreno (TM) 650"), "mid");
        assert_eq!(phone_tier("Adreno (TM) 506"), "low");
        assert_eq!(phone_tier("Mali-G710"), "high");
        assert_eq!(phone_tier("Mali-G77 MC9"), "mid");
        assert_eq!(phone_tier("Mali-T720"), "low");
        assert_eq!(phone_tier("PowerVR Rogue GE8320"), "low");
        for e in library().into_iter().filter(|e| e.os == TargetOs::Android) {
            let ph = e.phone.as_ref().expect("every phone entry says what it is");
            assert!(ph.android_min <= ph.android && ph.android <= ph.android_max, "{}: own version outside its range", e.id);
            assert!(ph.android_min >= 10 && ph.android_max <= 16, "{}", e.id);
        }
        // A version the class can run is applied to the user agent and appVersion; others are ignored.
        let e = library().into_iter().find(|e| e.os == TargetOs::Android && e.phone.as_ref().map(|p| p.tier) == Some("mid")).unwrap();
        let ph = e.phone.clone().unwrap();
        let (p, os) = preset(&e.id).unwrap();
        let ok = ph.android_max;
        let with = |v| build_config(p, os, &Context { profile_id: "x", android_version: Some(v), ..Default::default() });
        let c = with(ok);
        assert!(c["navigator.userAgent"].as_str().unwrap().contains(&format!("Android {ok};")));
        assert_eq!(c["navigator.appVersion"], format!("5.0 (Android {ok})"));
        let c = with(ph.android_max + 5);
        assert!(c["navigator.userAgent"].as_str().unwrap().contains(&format!("Android {};", ph.android)), "out-of-range version must be ignored");
    }

    #[test]
    fn short_gpu_names_are_readable() {
        assert_eq!(short_gpu("ANGLE (Intel, Intel(R) HD Graphics 400 Direct3D11 vs_5_0 ps_5_0), or similar"), "Intel(R) HD Graphics 400");
        assert_eq!(short_gpu("Intel(R) HD Graphics 400, or similar"), "Intel(R) HD Graphics 400");
        assert!(!library().iter().any(|e| e.gpu.contains("Direct3D") || e.gpu.contains("or similar")));
    }
}
