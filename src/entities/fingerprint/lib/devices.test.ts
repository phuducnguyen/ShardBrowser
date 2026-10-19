import { describe, expect, it } from "vitest";
import { deviceInfo, devicesFor, filterOptions, parseAngleRenderer } from "./devices";
import type { FingerprintEntry } from "../model/types";

const android = (id: string, model: string, w: number, h: number, dpr = 2.75): FingerprintEntry => ({
  id, label: id, platform: "Android", chrome: "152", gpu: "Adreno (TM) 740", tag_color: "#fb923c", builtin: false,
  payload: {
    navigator: { platform: "Android", hardware_concurrency: 8, device_memory: 8, max_touch_points: 5 },
    client_hints: { model, brand_version: "152" },
    screen: { width: w, height: h, device_pixel_ratio: dpr },
    webgl: { renderer: "Adreno (TM) 740" },
  },
});
const windows = (id: string, renderer: string, w = 1920, h = 1080): FingerprintEntry => ({
  id, label: id, platform: "Windows", chrome: "152", gpu: renderer, tag_color: "#5dade2", builtin: false,
  payload: {
    navigator: { platform: "Windows", hardware_concurrency: 12, device_memory: 16, max_touch_points: 0 },
    client_hints: { brand_version: "152" },
    screen: { width: w, height: h, device_pixel_ratio: 1 },
    webgl: { renderer },
  },
});

describe("parseAngleRenderer", () => {
  it("reads the maker and the card name out of an ANGLE string", () => {
    expect(parseAngleRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)"))
      .toEqual({ maker: "NVIDIA", name: "NVIDIA GeForce RTX 3060" });
    expect(parseAngleRenderer("ANGLE (AMD, AMD Radeon(TM) 680M Direct3D11 vs_5_0 ps_5_0, D3D11)"))
      .toEqual({ maker: "AMD", name: "AMD Radeon(TM) 680M" });
    expect(parseAngleRenderer("ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E9B) Direct3D11 vs_5_0 ps_5_0, D3D11)"))
      .toEqual({ maker: "Intel", name: "Intel(R) UHD Graphics 630" });
  });

  it("keeps a string it does not know, as the name", () => {
    expect(parseAngleRenderer("Adreno (TM) 613")).toEqual({ maker: "Other", name: "Adreno (TM) 613" });
  });
});

describe("deviceInfo", () => {
  it("names an Android device by brand and model, without repeating the brand", () => {
    expect(deviceInfo(android("android-oneplus-nord-5", "Nord 5", 412, 915)).label).toBe("OnePlus Nord 5");
    expect(deviceInfo(android("android-samsung-galaxy-s25", "SM-S931B", 360, 780)).label).toBe("Samsung SM-S931B");
    expect(deviceInfo(android("android-motorola-moto-g85-5g", "motorola moto g85 5G", 412, 915)).label).toBe("motorola moto g85 5G");
    expect(deviceInfo(android("android-oneplus-nord-5", "Nord 5", 412, 915)).brand).toBe("OnePlus");
  });

  it("tells a tablet from a phone and tidies the pixel ratio", () => {
    expect(deviceInfo(android("android-lenovo-tab", "TB311FU", 800, 1280, 2)).kind).toBe("tablet");
    const phone = deviceInfo(android("android-vivo-y28", "V2347", 360, 800, 2.549999952316284));
    expect(phone.kind).toBe("phone");
    expect(phone.dpr).toBe(2.55);
  });

  it("names a Windows device by its graphics card and screen", () => {
    const d = deviceInfo(windows("win-nv-1", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)", 2560, 1440));
    expect(d.os).toBe("Windows");
    expect(d.gpuMaker).toBe("NVIDIA");
    expect(d.label).toBe("NVIDIA GeForce RTX 3060 · 2560×1440");
    expect(d).toMatchObject({ cores: 12, memory: 16, touch: 0, chrome: "152", kind: "desktop" });
  });

  it("copes with a payload that has almost nothing in it", () => {
    const d = deviceInfo({ id: "x", label: "Bare", platform: "Windows", chrome: "", gpu: "", tag_color: "", builtin: false, payload: {} });
    expect(d).toMatchObject({ cores: 0, memory: 0, screenW: 0 });
  });
});

describe("filters", () => {
  const all = [
    android("android-samsung-a", "SM-A1", 360, 800),
    android("android-samsung-b", "SM-B2", 360, 800),
    android("android-vivo-c", "V1", 360, 800),
    windows("win-1", "ANGLE (AMD, AMD Radeon RX 6600 (0x000073FF) Direct3D11 vs_5_0 ps_5_0, D3D11)"),
    windows("win-2", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 (0x00001F82) Direct3D11 vs_5_0 ps_5_0, D3D11)"),
  ].map(deviceInfo);

  it("offers brands for Android and GPU makers for Windows", () => {
    expect(filterOptions(all, "Android")).toEqual(["Samsung", "vivo"]);
    expect(filterOptions(all, "Windows")).toEqual(["AMD", "NVIDIA"]);
    expect(filterOptions(all, "macOS")).toEqual([]);
  });

  it("lists the devices of an OS, narrowed by the filter", () => {
    expect(devicesFor(all, "Android", "").map((d) => d.label)).toEqual(["Samsung SM-A1", "Samsung SM-B2", "vivo V1"]);
    expect(devicesFor(all, "Android", "vivo").map((d) => d.id)).toEqual(["android-vivo-c"]);
    expect(devicesFor(all, "Windows", "NVIDIA").map((d) => d.id)).toEqual(["win-2"]);
  });
});
