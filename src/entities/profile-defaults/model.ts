import { AUTO_LANG, AUTO_TZ, LOCALES, TIMEZONES } from "../../shared/constants";
import type { NoiseMode, ProfileForm, WebRtcMode } from "../profile";

/// What a new profile starts from. Applies to profiles created afterwards; existing ones are untouched.
export type DefaultOs = "Windows" | "Android";
export type DeviceMode = "random" | "pinned";

export type ProfileDefaults = {
  v: 1;
  engine: "chrome";
  os: DefaultOs;
  mode: DeviceMode;
  /// Android brand or Windows GPU maker; "" = any.
  filter: string;
  /// Library fingerprint id, used when `mode` is "pinned".
  pinnedId: string;
  noise: {
    canvas: NoiseMode;
    webgl: NoiseMode;
    audio: NoiseMode;
    client_rects: NoiseMode;
    fonts: NoiseMode;
    sensors: NoiseMode;
  };
  webrtc: WebRtcMode;
  language: string;
  timezone: string;
};

export const STORAGE_KEY = "herov.profile-defaults.v1";

export const factoryDefaults = (): ProfileDefaults => ({
  v: 1,
  engine: "chrome",
  os: "Windows",
  mode: "random",
  filter: "",
  pinnedId: "",
  noise: { canvas: "auto", webgl: "auto", audio: "auto", client_rects: "real", fonts: "real", sensors: "real" },
  webrtc: "auto",
  language: AUTO_LANG,
  timezone: AUTO_TZ,
});

const NOISE: NoiseMode[] = ["real", "auto"];
const WEBRTC: WebRtcMode[] = ["auto", "tcp_only", "block"];

/// Reads whatever was stored and returns a complete, valid object: any field that is missing or
/// wrong falls back to its factory value, so old or hand-edited data can never break creation.
export function sanitizeDefaults(raw: unknown): ProfileDefaults {
  const base = factoryDefaults();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const n = (r.noise && typeof r.noise === "object" ? r.noise : {}) as Record<string, unknown>;
  const noise = (k: keyof ProfileDefaults["noise"]): NoiseMode =>
    NOISE.includes(n[k] as NoiseMode) ? (n[k] as NoiseMode) : base.noise[k];
  return {
    v: 1,
    engine: "chrome",
    os: r.os === "Android" ? "Android" : "Windows",
    mode: r.mode === "pinned" ? "pinned" : "random",
    filter: typeof r.filter === "string" ? r.filter : "",
    pinnedId: typeof r.pinnedId === "string" ? r.pinnedId : "",
    noise: {
      canvas: noise("canvas"), webgl: noise("webgl"), audio: noise("audio"),
      client_rects: noise("client_rects"), fonts: noise("fonts"), sensors: noise("sensors"),
    },
    webrtc: WEBRTC.includes(r.webrtc as WebRtcMode) ? (r.webrtc as WebRtcMode) : base.webrtc,
    language: LOCALES.some((l) => l.code === r.language) ? (r.language as string) : base.language,
    timezone: TIMEZONES.includes(r.timezone as string) ? (r.timezone as string) : base.timezone,
  };
}

/// The protections, WebRTC, language and time zone of a new profile. The device is chosen by the editor.
export function applyDefaults(form: ProfileForm, d: ProfileDefaults): ProfileForm {
  return {
    ...form,
    noise_canvas: d.noise.canvas,
    noise_webgl: d.noise.webgl,
    noise_audio: d.noise.audio,
    noise_client_rects: d.noise.client_rects,
    noise_fonts: d.noise.fonts,
    noise_sensors: d.noise.sensors,
    webrtc: d.webrtc,
    language: d.language,
    timezone: d.timezone,
  };
}
