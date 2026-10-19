//! What a new profile starts from (the "Profile defaults" page). Kept in its own file, not in
//! `settings.json`: the settings form round-trips that whole struct, and a stale copy of the form
//! would write an old value over these. The shape is owned by the UI; this module only checks that
//! it is a JSON object of sane size and writes it without ever leaving a half-written file.

use crate::store;
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::Path;

/// A defaults object is a few hundred bytes; the cap only stops a runaway caller.
const MAX_BYTES: usize = 64 * 1024;

/// The stored defaults, or None when there is no file or it does not hold a JSON object. A file
/// that does not parse is treated as absent: the UI then shows factory values, and the next save
/// replaces it.
pub fn load() -> Result<Option<Value>> {
    let path = store::profile_defaults_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let body = fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?;
    Ok(parse(&body))
}

fn parse(body: &str) -> Option<Value> {
    serde_json::from_str::<Value>(body.trim_start_matches('\u{feff}'))
        .ok()
        .filter(Value::is_object)
}

/// Text to write for `value`, or why it is refused.
fn render(value: &Value) -> Result<String> {
    if !value.is_object() {
        bail!("profile defaults must be a JSON object");
    }
    let body = serde_json::to_string_pretty(value)?;
    if body.len() > MAX_BYTES {
        bail!("profile defaults are too large ({} bytes, limit {MAX_BYTES})", body.len());
    }
    Ok(body)
}

pub fn save(value: &Value) -> Result<()> {
    let body = render(value)?;
    write_atomic(&store::profile_defaults_path()?, body.as_bytes())
}

/// Temp file plus rename, so a crash mid-write cannot leave a truncated file. The retry is for
/// Windows scanners holding the file for a moment.
fn write_atomic(path: &Path, body: &[u8]) -> Result<()> {
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).with_context(|| format!("create {}", tmp.display()))?;
        f.write_all(body)?;
        f.sync_all()?;
    }
    let mut last = None;
    for attempt in 0..4 {
        match fs::rename(&tmp, path) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last = Some(e);
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
            }
        }
    }
    let _ = fs::remove_file(&tmp);
    Err(last.map(anyhow::Error::from).unwrap_or_else(|| anyhow::anyhow!("rename failed")))
        .with_context(|| format!("replace {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_objects_are_accepted() {
        assert!(render(&json!({"v": 1, "os": "Android"})).is_ok());
        assert!(render(&json!([1, 2])).is_err());
        assert!(render(&json!("text")).is_err());
        assert!(render(&Value::Null).is_err());
    }

    #[test]
    fn a_runaway_object_is_refused() {
        let big = json!({ "filter": "x".repeat(MAX_BYTES) });
        assert!(render(&big).is_err());
    }

    #[test]
    fn unreadable_text_reads_as_absent() {
        assert_eq!(parse("{\"v\":1}"), Some(json!({"v": 1})));
        assert_eq!(parse("\u{feff}{\"v\":1}"), Some(json!({"v": 1})));
        assert_eq!(parse("not json"), None);
        assert_eq!(parse("[1]"), None);
        assert_eq!(parse(""), None);
    }

    #[test]
    fn a_save_replaces_the_file_whole() {
        let dir = std::env::temp_dir().join(format!("herov-pd-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("profile-defaults.json");
        write_atomic(&path, b"{\"v\":1,\"os\":\"Windows\"}").unwrap();
        write_atomic(&path, b"{\"v\":1,\"os\":\"Android\"}").unwrap();
        assert_eq!(parse(&fs::read_to_string(&path).unwrap()), Some(json!({"v": 1, "os": "Android"})));
        assert!(!path.with_extension("json.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
