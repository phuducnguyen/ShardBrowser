// Sets HeroV's version in the three places that carry it, so they never drift apart:
// package.json, src-tauri/tauri.conf.json and src-tauri/Cargo.toml ([package] version).
//   npm run version:set -- 0.2.0-beta.1
//   npm run version:set -- --check        (fails when the three disagree or are not SemVer)
// Release policy: docs/releasing.md.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

const files = {
  pkg: join(root, "package.json"),
  tauri: join(root, "src-tauri", "tauri.conf.json"),
  cargo: join(root, "src-tauri", "Cargo.toml"),
};
const read = (f) => readFileSync(f, "utf8");
const cargoVersion = (text) => /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(text)?.[1];

function current() {
  return {
    "package.json": JSON.parse(read(files.pkg)).version,
    "tauri.conf.json": JSON.parse(read(files.tauri)).version,
    "Cargo.toml": cargoVersion(read(files.cargo)),
  };
}

const arg = process.argv[2];
if (!arg || arg === "--check") {
  const v = current();
  const values = [...new Set(Object.values(v))];
  const ok = values.length === 1 && SEMVER.test(values[0]);
  console.log(Object.entries(v).map(([k, x]) => `${k}: ${x}`).join("\n"));
  if (!ok) {
    console.error(values.length > 1 ? "versions disagree" : `not SemVer: ${values[0]}`);
    process.exit(1);
  }
  console.log(`ok: ${values[0]}`);
  process.exit(0);
}

const next = arg.replace(/^v/, "");
if (!SEMVER.test(next)) {
  console.error(`not a SemVer version: ${arg} (e.g. 0.2.0, 0.2.0-beta.1)`);
  process.exit(1);
}
// Keep each file's own line endings and indentation.
const setJson = (f) => writeFileSync(f, read(f).replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`));
setJson(files.pkg);
setJson(files.tauri);
writeFileSync(files.cargo, read(files.cargo).replace(/^(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m, `$1${next}$2`));
console.log(`version set to ${next}`);
console.log(Object.entries(current()).map(([k, x]) => `${k}: ${x}`).join("\n"));
