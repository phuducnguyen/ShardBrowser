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
    tauri_build::build()
}
