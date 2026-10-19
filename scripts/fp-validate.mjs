// Consistency check for fingerprint library files (Windows and Android).
//   node scripts/fp-validate.mjs [dir]        default dir: the launcher's fingerprints folder
// Read-only. ERROR = contradicts itself or the platform (a page can see it); WARN = unusual or
// unverified. Exit code 1 when any ERROR is found. A passing file is not proof it evades a
// detector: that needs a real run of the engine against public checkers.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? join(process.env.APPDATA ?? "", "shardx-launcher", "fingerprints");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

const MOBILE_GPU = /Adreno|Mali|PowerVR|Xclipse|Immortalis/i;
const DESKTOP_GPU = /Direct3D|D3D11|NVIDIA|GeForce|Radeon|Intel\(R\)|\bUHD\b|\bIris\b/i;
const ANDROID_MEMORY = new Set([1, 2, 3, 4, 6, 8, 12, 16]);
const WIN_PLATFORM_VERSIONS = new Set(["10.0.0", "13.0.0", "14.0.0", "15.0.0", "19.0.0", "20.0.0"]);

const findings = []; // { id, level, rule, detail }
const add = (id, level, rule, detail = "") => findings.push({ id, level, rule, detail });
const rows = [];
let skipped = 0; // macOS and Linux: not covered yet

for (const f of files) {
  const id = f.replace(/\.json$/, "");
  let j;
  try { j = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { add(id, "ERROR", "unparseable JSON"); continue; }
  const p = j.payload ?? j;
  const nav = p.navigator ?? {}, hints = p.client_hints ?? {}, scr = p.screen ?? {}, gl = p.webgl ?? {}, win = p.window ?? {};
  const platform = nav.platform;
  const ua = String(nav.user_agent ?? "");
  const renderer = String(gl.renderer ?? "");
  const chromeUa = /Chrome\/(\d+)/.exec(ua)?.[1];
  const row = { id, platform, cores: nav.hardware_concurrency, mem: nav.device_memory, chrome: hints.brand_version, w: scr.width, h: scr.height, dpr: scr.device_pixel_ratio };
  rows.push(row);

  if (!ua) add(id, "ERROR", "user agent missing");
  if (chromeUa && hints.brand_version && chromeUa !== String(hints.brand_version)) add(id, "ERROR", "Chrome version differs between UA and client hints", `${chromeUa} vs ${hints.brand_version}`);
  if (!(scr.width > 0 && scr.height > 0)) add(id, "ERROR", "screen size missing");
  if (win.inner_width && win.outer_width && win.inner_width > win.outer_width) add(id, "ERROR", "inner window wider than outer");
  if (scr.avail_width > scr.width || scr.avail_height > scr.height) add(id, "ERROR", "available screen larger than screen");
  if (!renderer) add(id, "ERROR", "WebGL renderer missing");

  if (platform === "Android") {
    // Chrome on a phone sends `Mobile` in the UA and mobile=?1; on a tablet neither (mobile=?0).
    const tablet = Math.min(scr.width, scr.height) >= 600;
    if (hints.mobile !== !tablet) add(id, "ERROR", tablet ? "tablet-sized screen but client hints say mobile" : "phone-sized screen but client hints say not mobile");
    if (/ Mobile /.test(ua) === tablet) add(id, "ERROR", tablet ? "tablet user agent carries the Mobile token" : "phone user agent lacks the Mobile token");
    if (!(nav.max_touch_points >= 1)) add(id, "ERROR", "no touch points on a handset");
    if (!/Android/.test(ua) || !/Safari/.test(ua)) add(id, "ERROR", "user agent is not an Android Chrome string");
    if (/Windows|Macintosh|X11/.test(ua)) add(id, "ERROR", "desktop token in an Android user agent");
    if (!hints.model) add(id, "ERROR", "model missing");
    const major = Number(String(hints.platform_version ?? "").split(".")[0]);
    if (!(major >= 8 && major <= 17)) add(id, "ERROR", "Android version outside 8–17", String(hints.platform_version));
    if (!String(nav.platform_value ?? "").startsWith("Linux")) add(id, "ERROR", "navigator.platform is not Linux-based", String(nav.platform_value));
    if (DESKTOP_GPU.test(renderer) && !MOBILE_GPU.test(renderer)) add(id, "ERROR", "desktop GPU on a handset", renderer);
    else if (!MOBILE_GPU.test(renderer)) add(id, "WARN", "GPU name is not a known mobile family", renderer);
    if (!(scr.device_pixel_ratio >= 1 && scr.device_pixel_ratio <= 5)) add(id, "ERROR", "pixel ratio outside 1–5", String(scr.device_pixel_ratio));
    if (Math.min(scr.width, scr.height) > 1100) add(id, "WARN", "screen is bigger than any tablet viewport", `${scr.width}x${scr.height}`);
    if (!ANDROID_MEMORY.has(nav.device_memory)) add(id, "WARN", "unusual memory value", String(nav.device_memory));
    if (![4, 6, 8].includes(nav.hardware_concurrency)) add(id, "WARN", "unusual core count for a handset", String(nav.hardware_concurrency));
    if (tablet && nav.max_touch_points < 5) add(id, "WARN", "tablet with fewer than 5 touch points");
  } else if (platform === "Windows") {
    if (hints.mobile === true) add(id, "ERROR", "client hints say mobile on Windows");
    if (!/Windows NT 10\.0/.test(ua)) add(id, "ERROR", "user agent is not Windows NT 10.0", ua.slice(0, 60));
    if (/Android|iPhone|Macintosh/.test(ua)) add(id, "ERROR", "foreign OS token in a Windows user agent");
    if (!/ANGLE .*Direct3D11/.test(renderer)) add(id, "ERROR", "Windows renderer is not an ANGLE Direct3D11 string", renderer);
    if (MOBILE_GPU.test(renderer)) add(id, "ERROR", "mobile GPU on Windows", renderer);
    if (!WIN_PLATFORM_VERSIONS.has(String(hints.platform_version))) add(id, "WARN", "platform version is not a known Windows 10/11 value", String(hints.platform_version));
    if (!(nav.hardware_concurrency >= 2)) add(id, "ERROR", "fewer than 2 logical cores");
    if (nav.device_memory > 8) add(id, "WARN", "device memory above 8 GB: confirm the engine reports this (browsers may cap it)", String(nav.device_memory));
    if (scr.device_pixel_ratio > 3) add(id, "WARN", "pixel ratio above 3 on Windows");
  } else {
    skipped += 1;
  }
}

// Set-level diversity: a library where every entry looks alike is itself a pattern.
const by = (list, key) => list.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {});
const sets = {};
for (const r of rows) (sets[r.platform] ??= []).push(r);
const setNotes = [];
for (const [platform, list] of Object.entries(sets)) {
  if (list.length < 5) continue;
  const cores = by(list, "cores"), mem = by(list, "mem");
  if (Object.keys(cores).length === 1) setNotes.push(`${platform}: all ${list.length} entries report the same core count (${Object.keys(cores)[0]})`);
  if (Object.keys(mem).length <= 2) setNotes.push(`${platform}: only ${Object.keys(mem).length} memory value(s) across ${list.length} entries (${Object.keys(mem).join(", ")})`);
  const dprs = new Set(list.map((r) => r.dpr));
  if (platform === "Android" && dprs.size < 4) setNotes.push(`Android: only ${dprs.size} distinct pixel ratios`);
}

const errors = findings.filter((x) => x.level === "ERROR");
const warns = findings.filter((x) => x.level === "WARN");
const tally = (list) => Object.entries(list.reduce((m, x) => ((m[x.rule] = (m[x.rule] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(`${files.length} files in ${dir}`);
console.log(`platforms: ${JSON.stringify(by(rows, "platform"))} (${skipped} macOS/Linux files are not checked yet)`);
console.log(`\nERROR: ${errors.length}`);
for (const [rule, n] of tally(errors)) console.log(`  ${n}× ${rule}`);
for (const x of errors.slice(0, 25)) console.log(`    ${x.id}: ${x.rule}${x.detail ? ` (${x.detail})` : ""}`);
console.log(`\nWARN: ${warns.length}`);
for (const [rule, n] of tally(warns)) console.log(`  ${n}× ${rule}`);
console.log(`\nSET NOTES: ${setNotes.length}`);
for (const n of setNotes) console.log(`  ${n}`);
process.exit(errors.length ? 1 : 0);
