// Runs the real engine with library fingerprints against CreepJS and prints the objective signals
// its trust score is built from: lies, trash (anomalies), and the headless / stealth tells.
//   node scripts/creep-check.mjs [--headed] [--wait=40] [--tz=America/New_York] [--lang=en-US] <fingerprint.json>...
// Needs the engine installed by the launcher and internet access. Nothing is written to launcher data:
// each run uses a throw-away profile folder under the system temp directory.
// Not covered: CreepJS's "crowd-blending" percentage, which it computes from its own server data.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const opts = { headed: false, wait: 40, tz: "America/New_York", lang: "en-US" };
const files = [];
for (const a of process.argv.slice(2)) {
  if (a === "--headed") opts.headed = true;
  else if (a.startsWith("--wait=")) opts.wait = Number(a.slice(7));
  else if (a.startsWith("--tz=")) opts.tz = a.slice(5);
  else if (a.startsWith("--lang=")) opts.lang = a.slice(7);
  else files.push(a);
}
if (files.length === 0) { console.error("usage: node scripts/creep-check.mjs [options] <fingerprint.json>..."); process.exit(2); }

const chrome = join(process.env.APPDATA ?? "", "shardx-launcher", "runtime", "ShardX-Windows", "chrome.exe");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/// What the launcher's resolve_auto_fields writes once the country is known.
function prepare(payload) {
  const p = { ...(payload.payload ?? payload) };
  delete p._meta;
  const base = opts.lang.split("-")[0];
  p.timezone = opts.tz;
  p.navigator = {
    ...(p.navigator ?? {}),
    language: opts.lang,
    accept_language: opts.lang === "en-US" ? "en-US,en;q=0.9" : `${opts.lang},${base};q=0.9,en-US;q=0.8,en;q=0.7`,
    languages: opts.lang === "en-US" ? ["en-US", "en"] : [opts.lang, base, "en-US", "en"],
  };
  p.icu_locale = opts.lang;
  return p;
}

const PROBE = `(() => {
  const f = window.Fingerprint || {};
  const keys = (o) => Object.entries(o || {}).filter(([, v]) => v === true).map(([k]) => k);
  const h = f.headless || {};
  return JSON.stringify({
    ready: !!f.lies,
    lies: f.lies ? f.lies.totalLies : null,
    liesIn: Object.keys((f.lies && f.lies.data) || {}),
    trash: ((f.trash && f.trash.trashBin) || []).map((t) => t.name + ': ' + t.value),
    likeHeadless: keys(h.likeHeadless), headless: keys(h.headless), stealth: keys(h.stealth),
    langs: f.navigator && f.navigator.language,
  });
})()`;

async function run(file) {
  const label = basename(file, ".json");
  const work = mkdtempSync(join(tmpdir(), "creep-"));
  const fp = join(work, "fingerprint.json");
  writeFileSync(fp, JSON.stringify(prepare(JSON.parse(readFileSync(file, "utf8")))));
  mkdirSync(join(work, "udd"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chrome, [
    `--fingerprint-profile=${fp}`, `--user-data-dir=${join(work, "udd")}`, "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, "--remote-allow-origins=*", "--shardx-automation",
    ...(opts.headed ? [] : ["--headless=new"]), "about:blank",
  ], { stdio: "ignore" });
  try {
    const get = async (path, init) => (await fetch(`http://127.0.0.1:${port}${path}`, init)).json();
    let up = false;
    for (let i = 0; i < 40 && !up; i++) { try { await get("/json/version"); up = true; } catch { await sleep(500); } }
    if (!up) return { label, error: "engine did not open its debugging port" };
    const tab = await get(`/json/new?${encodeURIComponent("https://abrahamjuliot.github.io/creepjs/")}`, { method: "PUT" });
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const waiters = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiters.has(d.id)) { waiters.get(d.id)(d); waiters.delete(d.id); } };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiters.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    let result = null;
    for (let t = 0; t < opts.wait; t += 2) {
      await sleep(2000);
      const v = (await send("Runtime.evaluate", { expression: PROBE, returnByValue: true })).result?.result?.value;
      if (v) { const r = JSON.parse(v); if (r.ready) { result = r; break; } }
    }
    ws.close();
    return result ? { label, ...result } : { label, error: `CreepJS did not finish in ${opts.wait}s` };
  } catch (e) {
    return { label, error: e.message };
  } finally {
    proc.kill();
    // The engine may still hold files for a moment; the folder is in the temp directory, so a failed clean-up is harmless.
    setTimeout(() => { try { rmSync(work, { recursive: true, force: true }); } catch { /* left for the system's temp clean-up */ } }, 4000).unref();
  }
}

let bad = 0;
for (const f of files) {
  const r = await run(f);
  if (r.error) { bad += 1; console.log(`${r.label}: ERROR ${r.error}`); continue; }
  const clean = r.lies === 0 && r.trash.length === 0 && r.headless.length === 0 && r.stealth.length === 0;
  if (!clean) bad += 1;
  console.log(`${r.label}: ${clean ? "CLEAN" : "FLAGGED"}  lies=${r.lies}${r.liesIn.length ? ` (${r.liesIn.join(",")})` : ""}  trash=[${r.trash.join("; ")}]  headless=[${r.headless.join(",")}]  stealth=[${r.stealth.join(",")}]`);
}
process.exit(bad ? 1 : 0);
