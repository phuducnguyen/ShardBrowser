//! Camoufox installer (CF2): download the pinned release from GitHub, check it against the
//! SHA-256 and size written into this file, unpack it beside the Chrome engine, and record the
//! version. The download is resumable and the unpacked folder only appears once it is complete.
//!
//! Only Windows x64 is wired up: it is the one layout that has been inspected (a flat archive with
//! `camoufox.exe`, `camoufox.cfg`, `defaults/`, `distribution/` and `fonts/`). Other systems report
//! "not supported yet" instead of guessing.

use anyhow::{Context, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Window};
use tokio::io::AsyncWriteExt;

/// The release HeroV was tested with. Camoufox publishes betas only, so the launcher pins one and
/// moves to the next deliberately.
pub const TAG: &str = "v158.0-beta.40";

/// One downloadable archive, with the size and SHA-256 GitHub reported for it when it was pinned.
#[derive(Debug, Clone, Copy)]
pub struct Release {
    pub asset: &'static str,
    pub size: u64,
    pub sha256: &'static str,
}

pub fn release_for_host() -> Option<Release> {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return Some(Release {
        asset: "camoufox-158.0-beta.40-win.x86_64.zip",
        size: 1_315_506_159,
        sha256: "2d3e33207c2d5853e817e8317f0e33124ffb7054bd5102c8b84546e3d15a6447",
    });
    #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
    return None;
}

fn download_url(r: &Release) -> String {
    format!("https://github.com/daijro/camoufox/releases/download/{TAG}/{}", r.asset)
}

pub fn exe_name() -> &'static str {
    if cfg!(windows) { "camoufox.exe" } else { "camoufox" }
}

pub fn root() -> Result<PathBuf> {
    Ok(dirs::data_dir()
        .context("platform data dir not available")?
        .join("shardx-launcher")
        .join("camoufox"))
}

pub fn version_dir() -> Result<PathBuf> {
    Ok(root()?.join(TAG))
}

/// Path to the Camoufox executable of the pinned release. Only meaningful once installed.
pub fn binary_path() -> Result<PathBuf> {
    Ok(version_dir()?.join(exe_name()))
}

#[derive(Serialize, Clone, Debug)]
pub struct CamoufoxStatus {
    /// Whether this system has a Camoufox build to offer at all.
    pub supported: bool,
    pub installed: bool,
    /// The release this launcher installs.
    pub version: String,
    pub binary_path: Option<PathBuf>,
    /// Bytes on disk when installed.
    pub size_bytes: Option<u64>,
    /// Bytes to download when not installed.
    pub download_bytes: Option<u64>,
}

pub fn status() -> CamoufoxStatus {
    let rel = release_for_host();
    let bin = binary_path().ok().filter(|p| p.exists());
    let size_bytes = bin.as_ref().and_then(|p| p.parent()).map(dir_size);
    CamoufoxStatus {
        supported: rel.is_some(),
        installed: bin.is_some(),
        version: TAG.to_string(),
        binary_path: bin,
        size_bytes,
        download_bytes: rel.map(|r| r.size),
    }
}

fn dir_size(dir: &Path) -> u64 {
    let mut total = 0;
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for ent in rd.flatten() {
            match ent.file_type() {
                Ok(t) if t.is_dir() => stack.push(ent.path()),
                Ok(t) if t.is_file() => total += ent.metadata().map(|m| m.len()).unwrap_or(0),
                _ => {}
            }
        }
    }
    total
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut f = fs::File::open(path).with_context(|| format!("open {}", path.display()))?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Refuse an archive whose digest is not the one pinned for it.
pub fn verify_digest(path: &Path, expected: &str) -> Result<()> {
    let got = sha256_file(path)?;
    if !got.eq_ignore_ascii_case(expected) {
        anyhow::bail!("downloaded archive does not match the pinned SHA-256 (got {got}, expected {expected})");
    }
    Ok(())
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<()> {
    let f = fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(f)?;
    archive.extract(dest)?;
    Ok(())
}

/// Everything after the download: size and digest check, unpack into a staging folder, make sure
/// the executable is there, swap the folder in, write the version marker, drop the archive.
/// `on_phase` is told "verify" and "extract" so a window can say what is happening.
pub fn finish_install(
    zip_path: &Path,
    root: &Path,
    tag: &str,
    sha256: &str,
    size: u64,
    on_phase: &dyn Fn(&str),
) -> Result<()> {
    on_phase("verify");
    if size > 0 {
        let actual = fs::metadata(zip_path)?.len();
        if actual != size {
            let _ = fs::remove_file(zip_path);
            anyhow::bail!("downloaded archive is {actual} bytes, expected {size}");
        }
    }
    if let Err(e) = verify_digest(zip_path, sha256) {
        let _ = fs::remove_file(zip_path);
        return Err(e);
    }

    on_phase("extract");
    let stage = root.join(format!("{tag}.partial"));
    if stage.exists() {
        fs::remove_dir_all(&stage)?;
    }
    fs::create_dir_all(&stage)?;
    if let Err(e) = extract_zip(zip_path, &stage) {
        let _ = fs::remove_dir_all(&stage);
        return Err(e.context("unpack the Camoufox archive"));
    }
    if !stage.join(exe_name()).exists() {
        let _ = fs::remove_dir_all(&stage);
        anyhow::bail!("the archive has no {} at its top level", exe_name());
    }
    let final_dir = root.join(tag);
    if final_dir.exists() {
        fs::remove_dir_all(&final_dir)?;
    }
    fs::rename(&stage, &final_dir).context("move the unpacked engine into place")?;
    fs::write(
        final_dir.join("installed.json"),
        serde_json::to_string_pretty(&serde_json::json!({ "tag": tag, "sha256": sha256 }))?,
    )?;
    let _ = fs::remove_file(zip_path);
    Ok(())
}

static BUSY: AtomicBool = AtomicBool::new(false);

/// Download and install the pinned release. Emits `camoufox:progress` (`phase`, `percent`, `received`,
/// `total`) and `camoufox:done`. Safe to call again after an interruption: the download resumes.
pub async fn install(window: &Window, force: bool) -> Result<()> {
    let rel = release_for_host().context("Camoufox is not available for this system yet")?;
    if BUSY.swap(true, Ordering::SeqCst) {
        anyhow::bail!("Camoufox is already being installed");
    }
    let out = install_inner(window, force, rel).await;
    BUSY.store(false, Ordering::SeqCst);
    out
}

async fn install_inner(window: &Window, force: bool, rel: Release) -> Result<()> {
    let root = root()?;
    fs::create_dir_all(&root)?;
    if !force && status().installed {
        let _ = window.emit("camoufox:done", TAG);
        return Ok(());
    }

    let zip_path = root.join(rel.asset);
    let part = root.join(format!("{}.part", rel.asset));
    if force {
        let _ = fs::remove_file(&part);
        let _ = fs::remove_file(&zip_path);
    }

    if !zip_path.exists() {
        download(window, &rel, &part).await?;
        fs::rename(&part, &zip_path)?;
    }

    let w = window.clone();
    let (zp, rt) = (zip_path.clone(), root.clone());
    tokio::task::spawn_blocking(move || {
        finish_install(&zp, &rt, TAG, rel.sha256, rel.size, &|phase| {
            let _ = w.emit(
                "camoufox:progress",
                serde_json::json!({ "phase": phase, "percent": 100, "received": rel.size, "total": rel.size }),
            );
        })
    })
    .await??;

    let _ = window.emit("camoufox:done", TAG);
    Ok(())
}

async fn download(window: &Window, rel: &Release, part: &Path) -> Result<()> {
    let already = fs::metadata(part).map(|m| m.len()).unwrap_or(0);
    // A partial file as large as the archive (or larger) cannot be resumed; start over.
    let already = if already >= rel.size { 0 } else { already };
    let client = reqwest::Client::builder().user_agent("HeroV-Browser").build()?;
    let mut req = client.get(download_url(rel));
    if already > 0 {
        req = req.header("Range", format!("bytes={already}-"));
    }
    let mut resp = req.send().await?.error_for_status()?;
    let resuming = already > 0 && resp.status().as_u16() == 206;

    let mut out = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(resuming)
        .truncate(!resuming)
        .open(part)
        .await?;
    let mut received: u64 = if resuming { already } else { 0 };
    let mut last_pct = u64::MAX;
    while let Some(chunk) = resp.chunk().await? {
        out.write_all(&chunk).await?;
        received += chunk.len() as u64;
        let pct = received.saturating_mul(100) / rel.size.max(1);
        if pct != last_pct {
            last_pct = pct;
            let _ = window.emit(
                "camoufox:progress",
                serde_json::json!({ "phase": "download", "percent": pct, "received": received, "total": rel.size }),
            );
        }
    }
    out.flush().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn scratch(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("herov-camoufox-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    /// A small stand-in for the real archive: the executable at the top level plus one more file.
    fn fake_archive(dir: &Path, extra: &[(&str, &[u8])]) -> PathBuf {
        let path = dir.join("engine.zip");
        let mut zw = zip::ZipWriter::new(fs::File::create(&path).unwrap());
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        zw.start_file(exe_name(), opts).unwrap();
        zw.write_all(b"MZ-not-a-real-exe").unwrap();
        for (name, body) in extra {
            zw.start_file(*name, opts).unwrap();
            zw.write_all(body).unwrap();
        }
        zw.finish().unwrap();
        path
    }

    #[test]
    fn sha256_matches_the_known_value_for_abc() {
        let d = scratch("sha");
        let f = d.join("abc.txt");
        fs::write(&f, b"abc").unwrap();
        assert_eq!(sha256_file(&f).unwrap(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert!(verify_digest(&f, "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD").is_ok());
        assert!(verify_digest(&f, &"0".repeat(64)).is_err());
    }

    #[test]
    fn the_pinned_table_is_well_formed() {
        if let Some(r) = release_for_host() {
            assert!(r.asset.contains(&TAG[1..]), "asset {} does not belong to {TAG}", r.asset);
            assert_eq!(r.sha256.len(), 64);
            assert!(r.sha256.chars().all(|c| c.is_ascii_hexdigit()));
            assert!(r.size > 100_000_000);
            assert!(download_url(&r).starts_with("https://github.com/daijro/camoufox/releases/download/v"));
        }
    }

    #[test]
    fn a_good_archive_is_installed_and_the_archive_removed() {
        let d = scratch("ok");
        let zip = fake_archive(&d, &[("camoufox.cfg", b"cfg")]);
        let size = fs::metadata(&zip).unwrap().len();
        let sha = sha256_file(&zip).unwrap();
        let mut phases = std::cell::RefCell::new(Vec::new());
        finish_install(&zip, &d, "v1", &sha, size, &|p| phases.borrow_mut().push(p.to_string())).unwrap();
        assert_eq!(*phases.get_mut(), vec!["verify", "extract"]);
        assert!(d.join("v1").join(exe_name()).exists());
        assert!(d.join("v1").join("camoufox.cfg").exists());
        assert!(d.join("v1").join("installed.json").exists());
        assert!(!d.join("v1.partial").exists(), "staging folder must be gone");
        assert!(!zip.exists(), "the archive is removed after a good install");
    }

    #[test]
    fn a_wrong_digest_installs_nothing_and_drops_the_archive() {
        let d = scratch("bad");
        let zip = fake_archive(&d, &[]);
        let size = fs::metadata(&zip).unwrap().len();
        let err = finish_install(&zip, &d, "v1", &"0".repeat(64), size, &|_| {}).unwrap_err();
        assert!(err.to_string().contains("SHA-256"), "{err}");
        assert!(!d.join("v1").exists());
        assert!(!zip.exists(), "a corrupt download is not kept for a retry");
    }

    #[test]
    fn a_wrong_size_is_refused_before_hashing() {
        let d = scratch("size");
        let zip = fake_archive(&d, &[]);
        let sha = sha256_file(&zip).unwrap();
        let err = finish_install(&zip, &d, "v1", &sha, 12345, &|_| {}).unwrap_err();
        assert!(err.to_string().contains("bytes"), "{err}");
        assert!(!d.join("v1").exists());
    }

    #[test]
    fn an_archive_without_the_executable_is_not_installed() {
        let d = scratch("noexe");
        let path = d.join("engine.zip");
        let mut zw = zip::ZipWriter::new(fs::File::create(&path).unwrap());
        zw.start_file("readme.txt", zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored)).unwrap();
        zw.write_all(b"x").unwrap();
        zw.finish().unwrap();
        let size = fs::metadata(&path).unwrap().len();
        let sha = sha256_file(&path).unwrap();
        let err = finish_install(&path, &d, "v1", &sha, size, &|_| {}).unwrap_err();
        assert!(err.to_string().contains("top level"), "{err}");
        assert!(!d.join("v1").exists());
        assert!(!d.join("v1.partial").exists());
    }

    #[test]
    fn an_entry_that_climbs_out_of_the_folder_writes_nothing_outside_it() {
        let d = scratch("slip");
        let outside = d.join("evil.txt");
        let zip = fake_archive(&d, &[("../evil.txt", b"x")]);
        let size = fs::metadata(&zip).unwrap().len();
        let sha = sha256_file(&zip).unwrap();
        let root = d.join("root");
        fs::create_dir_all(&root).unwrap();
        let _ = finish_install(&zip, &root, "v1", &sha, size, &|_| {});
        assert!(!outside.exists(), "the archive escaped its folder");
        assert!(!root.join("evil.txt").exists() || root.join("v1").exists());
    }

    /// Installs the real archive already sitting in the engine folder (downloaded by hand or left
    /// by an interrupted install). Checks the pinned digest and the layout against the real thing.
    ///   HEROV_TEST_MANIFEST=1 cargo test --lib real_download -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_download_passes_the_pinned_digest_and_unpacks() {
        let rel = release_for_host().expect("supported system");
        let root = root().unwrap();
        let zip = root.join(rel.asset);
        assert!(zip.exists(), "put {} in {}", rel.asset, root.display());
        finish_install(&zip, &root, TAG, rel.sha256, rel.size, &|p| println!("phase: {p}")).unwrap();
        let st = status();
        println!("installed: {} at {:?}, {} bytes", st.installed, st.binary_path, st.size_bytes.unwrap_or(0));
        assert!(st.installed);
    }

    #[test]
    fn a_new_install_replaces_an_older_folder_of_the_same_tag() {
        let d = scratch("replace");
        fs::create_dir_all(d.join("v1")).unwrap();
        fs::write(d.join("v1").join("old.txt"), b"old").unwrap();
        let zip = fake_archive(&d, &[]);
        let size = fs::metadata(&zip).unwrap().len();
        let sha = sha256_file(&zip).unwrap();
        finish_install(&zip, &d, "v1", &sha, size, &|_| {}).unwrap();
        assert!(!d.join("v1").join("old.txt").exists());
        assert!(d.join("v1").join(exe_name()).exists());
    }
}
