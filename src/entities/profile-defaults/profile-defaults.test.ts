import { beforeEach, describe, expect, it } from "vitest";
import { defaultForm } from "../profile";
import { STORAGE_KEY, applyDefaults, factoryDefaults, sanitizeDefaults } from "./model";
import { useProfileDefaults } from "./store";
import { backend } from "../../test/tauri";

describe("profile defaults model", () => {
  it("starts from the factory values", () => {
    expect(factoryDefaults()).toMatchObject({
      os: "Windows", mode: "random", filter: "", webrtc: "auto", language: "auto", timezone: "auto",
      noise: { canvas: "auto", webgl: "auto", audio: "auto", client_rects: "real", fonts: "real", sensors: "real" },
    });
  });

  it("falls back to the factory value for anything missing or wrong", () => {
    expect(sanitizeDefaults(null)).toEqual(factoryDefaults());
    expect(sanitizeDefaults("nonsense")).toEqual(factoryDefaults());
    const odd = sanitizeDefaults({ os: "BeOS", mode: 5, webrtc: "leak", language: "xx-XX", timezone: "Mars/Base", noise: { canvas: "maybe", fonts: "auto" } });
    expect(odd.os).toBe("Windows");
    expect(odd.mode).toBe("random");
    expect(odd.webrtc).toBe("auto");
    expect(odd.language).toBe("auto");
    expect(odd.timezone).toBe("auto");
    expect(odd.noise.canvas).toBe("auto");
    expect(odd.noise.fonts).toBe("auto");
  });

  it("keeps valid values", () => {
    const d = sanitizeDefaults({ os: "Android", mode: "pinned", filter: "OnePlus", pinnedId: "android-oneplus-nord-5", webrtc: "block", language: "en-GB", timezone: "Europe/London" });
    expect(d).toMatchObject({ os: "Android", mode: "pinned", filter: "OnePlus", pinnedId: "android-oneplus-nord-5", webrtc: "block", language: "en-GB", timezone: "Europe/London" });
  });

  it("puts protections, WebRTC, language and time zone on a new profile form", () => {
    const d = { ...factoryDefaults(), webrtc: "block" as const, language: "en-GB", timezone: "Europe/London", noise: { ...factoryDefaults().noise, fonts: "auto" as const, canvas: "real" as const } };
    const f = applyDefaults(defaultForm(), d);
    expect(f).toMatchObject({ webrtc: "block", language: "en-GB", timezone: "Europe/London", noise_fonts: "auto", noise_canvas: "real", noise_webgl: "auto" });
    expect(f.name).toBe("");
  });
});

describe("profile defaults store", () => {
  beforeEach(async () => {
    backend.reset({ profile_defaults_get: () => null, profile_defaults_set: () => null });
    await useProfileDefaults.getState().reset();
    localStorage.clear();
    backend.reset({ profile_defaults_get: () => null, profile_defaults_set: () => null });
  });

  it("saves to the backend file and to the local cache, with the cleaned values", async () => {
    await useProfileDefaults.getState().save({ ...factoryDefaults(), os: "Android", filter: "vivo" });
    expect(useProfileDefaults.getState().defaults).toMatchObject({ os: "Android", filter: "vivo" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toMatchObject({ v: 1, os: "Android", filter: "vivo" });
    expect(backend.argsOf("profile_defaults_set")).toEqual([{ value: expect.objectContaining({ v: 1, os: "Android", filter: "vivo" }) }]);
  });

  it("resets to the factory values", async () => {
    await useProfileDefaults.getState().save({ ...factoryDefaults(), os: "Android" });
    await useProfileDefaults.getState().reset();
    expect(useProfileDefaults.getState().defaults).toEqual(factoryDefaults());
  });

  it("rejects when the file cannot be written, but the app already uses the new values", async () => {
    backend.handlers.profile_defaults_set = () => { throw "disk full"; };
    await expect(useProfileDefaults.getState().save({ ...factoryDefaults(), os: "Android" })).rejects.toBe("disk full");
    expect(useProfileDefaults.getState().defaults.os).toBe("Android");
  });

  it("hydrate takes the backend file over the cache, cleaning it", async () => {
    backend.handlers.profile_defaults_get = () => ({ v: 1, os: "Android", webrtc: "leak", filter: "OnePlus" });
    await useProfileDefaults.getState().hydrate();
    expect(useProfileDefaults.getState().defaults).toMatchObject({ os: "Android", filter: "OnePlus", webrtc: "auto" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toMatchObject({ os: "Android" });
  });

  it("hydrate moves what an earlier build kept in the cache to the backend, once", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...factoryDefaults(), os: "Android" }));
    await useProfileDefaults.getState().hydrate();
    expect(backend.argsOf("profile_defaults_set")).toEqual([{ value: expect.objectContaining({ os: "Android" }) }]);
  });

  it("hydrate leaves things alone when there is neither file nor cache", async () => {
    await useProfileDefaults.getState().hydrate();
    expect(backend.argsOf("profile_defaults_set")).toHaveLength(0);
    expect(useProfileDefaults.getState().defaults).toEqual(factoryDefaults());
  });
});
