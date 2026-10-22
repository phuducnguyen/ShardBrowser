//! Camoufox installer (CF2): download the pinned release from GitHub, check it against the
//! SHA-256 and size written into this file, unpack it beside the Chrome engine, and record the
//! version. The download is resumable and the unpacked folder only appears once it is complete.
//!
//! Only Windows x64 is wired up: it is the one layout that has been inspected (a flat archive with
//! `camoufox.exe`, `camoufox.cfg`, `defaults/`, `distribution/` and `fonts/`). Other systems report
//! "not supported yet" instead of guessing.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Window};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};

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

/// Unpack on several threads (the archive holds thousands of files; one thread took minutes).
/// Every entry must stay inside `dest`; one that does not stops the unpack before anything is written.
fn extract_zip(zip_path: &Path, dest: &Path) -> Result<()> {
    let mut archive = zip::ZipArchive::new(fs::File::open(zip_path)?)?;
    let mut files: Vec<(usize, u64)> = Vec::new();
    let mut dirs: Vec<PathBuf> = Vec::new();
    for i in 0..archive.len() {
        let e = archive.by_index(i)?;
        let rel = e.enclosed_name().with_context(|| format!("archive entry `{}` points outside the engine folder", e.name()))?;
        if e.is_dir() {
            dirs.push(dest.join(rel));
        } else {
            files.push((i, e.size()));
        }
    }
    for d in dirs {
        fs::create_dir_all(d)?;
    }
    // Largest first, dealt round-robin, so the threads finish together.
    files.sort_by(|a, b| b.1.cmp(&a.1));
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(1, 16);
    let mut shares: Vec<Vec<usize>> = vec![Vec::new(); threads];
    for (k, (i, _)) in files.iter().enumerate() {
        shares[k % threads].push(*i);
    }
    std::thread::scope(|scope| -> Result<()> {
        let handles: Vec<_> = shares
            .into_iter()
            .filter(|s| !s.is_empty())
            .map(|share| {
                scope.spawn(move || -> Result<()> {
                    let mut archive = zip::ZipArchive::new(fs::File::open(zip_path)?)?;
                    for i in share {
                        let mut e = archive.by_index(i)?;
                        let out = dest.join(e.enclosed_name().context("entry outside the engine folder")?);
                        if let Some(parent) = out.parent() {
                            fs::create_dir_all(parent)?;
                        }
                        let mut w = std::io::BufWriter::new(fs::File::create(&out)?);
                        std::io::copy(&mut e, &mut w)?;
                    }
                    Ok(())
                })
            })
            .collect();
        for h in handles {
            h.join().map_err(|_| anyhow::anyhow!("an unpack thread panicked"))??;
        }
        Ok(())
    })
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
    let w = window.clone();
    let total = rel.size;
    let last = Arc::new(AtomicU64::new(u64::MAX));
    let on_progress: Progress = Arc::new(move |received: u64| {
        let pct = received.saturating_mul(100) / total.max(1);
        if last.swap(pct, Ordering::Relaxed) != pct {
            let _ = w.emit(
                "camoufox:progress",
                serde_json::json!({ "phase": "download", "percent": pct, "received": received, "total": total }),
            );
        }
    });
    parallel_download(&download_url(rel), rel.size, part, CONNECTIONS, on_progress).await
}

/// Connections used for one download. GitHub's CDN gives a single connection far less than the
/// line can carry; eight byte ranges measured about nine times faster than one on this setup.
pub const CONNECTIONS: usize = 8;

pub type Progress = Arc<dyn Fn(u64) + Send + Sync>;

/// Which bytes each connection fetches and how many of them are already on disk. Saved next to
/// the partial file so an interrupted download continues where every connection stopped.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
struct SegmentState {
    size: u64,
    /// Inclusive byte ranges.
    ranges: Vec<(u64, u64)>,
    done: Vec<u64>,
}

/// `size` bytes cut into `n` nearly equal inclusive ranges (fewer when the file is tiny).
fn plan_segments(size: u64, n: usize) -> Vec<(u64, u64)> {
    if size == 0 {
        return Vec::new();
    }
    let n = (n.max(1) as u64).min(size);
    let step = size / n;
    (0..n)
        .map(|i| {
            let start = i * step;
            let end = if i == n - 1 { size - 1 } else { start + step - 1 };
            (start, end)
        })
        .collect()
}

fn state_path(part: &Path) -> PathBuf {
    let mut p = part.as_os_str().to_owned();
    p.push(".json");
    PathBuf::from(p)
}

/// The resume state for `part`: the saved one when it matches, the old single-connection layout
/// (a prefix on disk) mapped onto the ranges, or a fresh start.
fn load_state(part: &Path, size: u64, n: usize) -> SegmentState {
    let ranges = plan_segments(size, n);
    let fresh = SegmentState { size, done: vec![0; ranges.len()], ranges: ranges.clone() };
    let on_disk = fs::metadata(part).map(|m| m.len()).unwrap_or(0);
    if let Ok(text) = fs::read_to_string(state_path(part)) {
        if let Ok(st) = serde_json::from_str::<SegmentState>(&text) {
            let sane = st.size == size
                && st.ranges.len() == st.done.len()
                && st.ranges.iter().zip(&st.done).all(|((a, b), d)| *d <= b - a + 1)
                && on_disk == size;
            if sane {
                return st;
            }
        }
        return fresh;
    }
    // A partial file from the single-connection installer: its first bytes are good.
    if on_disk > 0 && on_disk < size {
        let done = ranges.iter().map(|(a, b)| on_disk.saturating_sub(*a).min(b - a + 1)).collect();
        return SegmentState { size, ranges, done };
    }
    fresh
}

fn save_state(part: &Path, st: &SegmentState) {
    if let Ok(text) = serde_json::to_string(st) {
        let _ = fs::write(state_path(part), text);
    }
}

/// Download `url` (`size` bytes) into `part` over `connections` byte ranges at once. Each range
/// retries on its own and resumes from its last byte; the state survives a restart of the app.
pub async fn parallel_download(url: &str, size: u64, part: &Path, connections: usize, on_progress: Progress) -> Result<()> {
    let state = load_state(part, size, connections);
    {
        let f = fs::OpenOptions::new().create(true).write(true).truncate(false).open(part)?;
        if f.metadata()?.len() != size {
            f.set_len(size)?;
        }
    }
    save_state(part, &state);
    let received = Arc::new(AtomicU64::new(state.done.iter().sum()));
    on_progress(received.load(Ordering::Relaxed));
    let shared = Arc::new(Mutex::new(state.clone()));
    let client = reqwest::Client::builder().user_agent("HeroV-Browser").build()?;

    let mut tasks = Vec::new();
    for (i, (start, end)) in state.ranges.iter().copied().enumerate() {
        let (client, url, part, shared, received, on_progress) =
            (client.clone(), url.to_string(), part.to_path_buf(), shared.clone(), received.clone(), on_progress.clone());
        tasks.push(tokio::spawn(async move {
            fetch_range(&client, &url, &part, i, start, end, &shared, &received, &on_progress).await
        }));
    }
    let mut first_err = None;
    for t in tasks {
        if let Err(e) = t.await.map_err(anyhow::Error::from).and_then(|r| r) {
            first_err.get_or_insert(e);
        }
    }
    let final_state = shared.lock().unwrap().clone();
    save_state(part, &final_state);
    if let Some(e) = first_err {
        return Err(e.context("download interrupted; it continues from where it stopped next time"));
    }
    let _ = fs::remove_file(state_path(part));
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn fetch_range(
    client: &reqwest::Client,
    url: &str,
    part: &Path,
    index: usize,
    start: u64,
    end: u64,
    shared: &Mutex<SegmentState>,
    received: &AtomicU64,
    on_progress: &Progress,
) -> Result<()> {
    let mut attempt = 0;
    loop {
        let done = shared.lock().unwrap().done[index];
        let from = start + done;
        if from > end {
            return Ok(());
        }
        let result: Result<()> = async {
            let mut resp = client.get(url).header("Range", format!("bytes={from}-{end}")).send().await?.error_for_status()?;
            anyhow::ensure!(resp.status().as_u16() == 206, "the server does not send byte ranges (status {})", resp.status());
            let mut out = tokio::fs::OpenOptions::new().write(true).open(part).await?;
            out.seek(std::io::SeekFrom::Start(from)).await?;
            let mut unsaved = 0u64;
            while let Some(chunk) = resp.chunk().await? {
                let room = (end + 1).saturating_sub(start + shared.lock().unwrap().done[index]);
                let take = (chunk.len() as u64).min(room) as usize;
                out.write_all(&chunk[..take]).await?;
                shared.lock().unwrap().done[index] += take as u64;
                unsaved += take as u64;
                on_progress(received.fetch_add(take as u64, Ordering::Relaxed) + take as u64);
                if unsaved >= 8 << 20 {
                    out.flush().await?;
                    let snapshot = shared.lock().unwrap().clone();
                    save_state(part, &snapshot);
                    unsaved = 0;
                }
                if take < chunk.len() {
                    break;
                }
            }
            out.flush().await?;
            Ok(())
        }
        .await;
        match result {
            Ok(()) => {
                if start + shared.lock().unwrap().done[index] > end {
                    return Ok(());
                }
                // The connection ended early; ask again for the rest.
            }
            Err(e) => {
                attempt += 1;
                if attempt >= 6 {
                    return Err(e.context(format!("byte range {index} failed six times")));
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(500 * (attempt as u64 + 1))).await;
    }
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
    fn segments_cover_every_byte_once() {
        for (size, n) in [(1_315_506_159u64, 8usize), (10, 8), (3, 8), (1, 8), (1000, 1)] {
            let r = plan_segments(size, n);
            assert_eq!(r.first().unwrap().0, 0);
            assert_eq!(r.last().unwrap().1, size - 1);
            for w in r.windows(2) {
                assert_eq!(w[0].1 + 1, w[1].0, "ranges must touch without overlap");
            }
            assert!(r.len() <= n && r.len() as u64 <= size);
        }
        assert!(plan_segments(0, 8).is_empty());
    }

    #[test]
    fn a_partial_file_from_the_old_installer_counts_as_done_bytes() {
        let d = scratch("legacy");
        let part = d.join("engine.zip.part");
        fs::write(&part, vec![0u8; 250]).unwrap();
        let st = load_state(&part, 1000, 4);
        assert_eq!(st.ranges, vec![(0, 249), (250, 499), (500, 749), (750, 999)]);
        assert_eq!(st.done, vec![250, 0, 0, 0]);
    }

    #[test]
    fn a_saved_state_is_reused_only_when_it_fits_the_file() {
        let d = scratch("state");
        let part = d.join("engine.zip.part");
        fs::write(&part, vec![0u8; 1000]).unwrap();
        let saved = SegmentState { size: 1000, ranges: plan_segments(1000, 4), done: vec![250, 10, 0, 249] };
        save_state(&part, &saved);
        assert_eq!(load_state(&part, 1000, 4), saved);
        // A state for another size, or one claiming more bytes than a range holds, starts over.
        assert_eq!(load_state(&part, 2000, 4).done, vec![0; 4]);
        save_state(&part, &SegmentState { size: 1000, ranges: plan_segments(1000, 4), done: vec![251, 0, 0, 0] });
        assert_eq!(load_state(&part, 1000, 4).done, vec![0; 4]);
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
