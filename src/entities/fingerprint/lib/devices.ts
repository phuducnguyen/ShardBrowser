import type { FingerprintEntry } from "../model/types";

/// A library fingerprint read as a device a person can recognise. The files carry ids such as
/// `android-oneplus-nord-5` or `win-amd-00001114`; the UI shows a brand and model, or a GPU name.
export type DeviceInfo = {
  id: string;
  os: "Windows" | "Android" | "macOS" | "Linux" | "Other";
  /// Android brand, e.g. "OnePlus"; empty elsewhere.
  brand: string;
  /// Windows GPU maker (NVIDIA, AMD, Intel) or "Other"; empty on Android.
  gpuMaker: string;
  label: string;
  gpuName: string;
  screenW: number;
  screenH: number;
  dpr: number;
  cores: number;
  memory: number;
  touch: number;
  chrome: string;
  kind: "phone" | "tablet" | "desktop";
};

const BRANDS: Record<string, string> = {
  oneplus: "OnePlus", poco: "POCO", oppo: "OPPO", vivo: "vivo", realme: "realme", redmi: "Redmi",
  samsung: "Samsung", motorola: "Motorola", lenovo: "Lenovo", nothing: "Nothing", xiaomi: "Xiaomi",
  google: "Google", huawei: "Huawei", honor: "HONOR", sony: "Sony", asus: "ASUS", infinix: "Infinix",
  tecno: "TECNO", itel: "itel", zte: "ZTE", nokia: "Nokia",
};

const pretty = (slug: string) => BRANDS[slug] ?? (slug ? slug[0].toUpperCase() + slug.slice(1) : "");

/// "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)" → name and maker.
export function parseAngleRenderer(renderer: string): { maker: string; name: string } {
  const m = /^ANGLE \(([^,]+), (.+)\)$/.exec(renderer.trim());
  if (!m) return { maker: "Other", name: renderer.trim() };
  const body = m[2]
    .replace(/,\s*D3D11\s*$/i, "")
    .replace(/\s*Direct3D\S*(?:\s+vs_\S+)?(?:\s+ps_\S+)?\s*$/i, "")
    .replace(/\s*\(0x[0-9a-f]+\)\s*/i, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const raw = m[1].trim();
  const maker = /nvidia/i.test(raw) ? "NVIDIA" : /amd|ati/i.test(raw) ? "AMD" : /intel/i.test(raw) ? "Intel" : "Other";
  return { maker, name: body || raw };
}

/// One fingerprint as a device. Tolerant of partial payloads: anything missing reads as empty or 0.
export function deviceInfo(fp: FingerprintEntry): DeviceInfo {
  const p = fp.payload ?? {};
  const nav = p.navigator ?? {};
  const hints = p.client_hints ?? {};
  const screen = p.screen ?? {};
  const gl = p.webgl ?? {};
  const platform = String(fp.platform ?? nav.platform ?? "");
  const lower = platform.toLowerCase();
  const os: DeviceInfo["os"] =
    lower.startsWith("android") || lower.startsWith("linux arm") ? "Android"
    : lower === "windows" ? "Windows"
    : lower === "macos" ? "macOS"
    : lower.startsWith("linux") ? "Linux" : "Other";

  const screenW = Number(screen.width) || 0;
  const screenH = Number(screen.height) || 0;
  const rawDpr = Number(screen.device_pixel_ratio) || 1;
  // 2.549999952316284 is a float32 artefact; a handset's real ratio has at most three decimals.
  const dpr = Math.round(rawDpr * 1000) / 1000;
  const renderer = String(gl.renderer ?? fp.gpu ?? "");

  let brand = "";
  let gpuMaker = "";
  let label = fp.label;
  let gpuName = renderer;
  let kind: DeviceInfo["kind"] = "desktop";

  if (os === "Android") {
    // Ids read `android-<brand>-<model>`; the model proper is in the client hints.
    brand = pretty(fp.id.split("-")[1] ?? "");
    const model = String(hints.model ?? "").trim();
    const starts = model.toLowerCase().startsWith(brand.toLowerCase());
    label = model ? (starts || !brand ? model : `${brand} ${model}`) : fp.label;
    kind = Math.min(screenW, screenH) >= 600 ? "tablet" : "phone";
  } else if (os === "Windows") {
    const g = parseAngleRenderer(renderer);
    gpuMaker = g.maker;
    gpuName = g.name;
    label = screenW && screenH ? `${g.name} · ${screenW}×${screenH}` : g.name;
  }

  return {
    id: fp.id,
    os,
    brand,
    gpuMaker,
    label,
    gpuName,
    screenW,
    screenH,
    dpr,
    cores: Number(nav.hardware_concurrency) || 0,
    memory: Number(nav.device_memory) || 0,
    touch: Number(nav.max_touch_points) || 0,
    chrome: String(hints.brand_version ?? fp.chrome ?? ""),
    kind,
  };
}

/// Filters offered for an OS: Android by brand, Windows by GPU maker. Empty list = no filter row.
export function filterOptions(devices: DeviceInfo[], os: string): string[] {
  const pick = os === "Android" ? (d: DeviceInfo) => d.brand : os === "Windows" ? (d: DeviceInfo) => d.gpuMaker : null;
  if (!pick) return [];
  return [...new Set(devices.filter((d) => d.os === os).map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/// The devices of one OS that pass the filter (empty filter = any).
export function devicesFor(devices: DeviceInfo[], os: string, filter: string): DeviceInfo[] {
  return devices
    .filter((d) => d.os === os && (!filter || (os === "Android" ? d.brand === filter : d.gpuMaker === filter)))
    .sort((a, b) => a.label.localeCompare(b.label));
}
