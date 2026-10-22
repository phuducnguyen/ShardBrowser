fn main() {
    // `cargo test --lib` builds a test exe that links the same Windows controls as the app and
    // needs a manifest asking for common controls v6 (the app gets its own from tauri-build, so
    // this is opt-in, not always on). Run the tests with HEROV_TEST_MANIFEST=1.
    println!("cargo:rerun-if-env-changed=HEROV_TEST_MANIFEST");
    println!("cargo:rerun-if-changed=windows-test.manifest");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var_os("HEROV_TEST_MANIFEST").is_some()
    {
        let dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{dir}\\windows-test.manifest");
    }
    // Build identity shown in the app (Settings → About, the rail): the commit and the build time.
    println!("cargo:rerun-if-changed=../.git/HEAD");
    println!("cargo:rerun-if-changed=../.git/refs/heads");
    let git = |args: &[&str]| {
        std::process::Command::new("git")
            .args(args)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    };
    let mut commit = git(&["rev-parse", "--short=8", "HEAD"]).unwrap_or_else(|| "unknown".into());
    if git(&["status", "--porcelain", "--untracked-files=no"]).is_some_and(|s| !s.is_empty()) {
        commit.push_str("+dirty");
    }
    let built = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    println!("cargo:rustc-env=HEROV_COMMIT={commit}");
    println!("cargo:rustc-env=HEROV_BUILT_UNIX={built}");
    tauri_build::build()
}
