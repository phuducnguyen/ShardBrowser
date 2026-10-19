import { useMemo } from "react";
import { PortTags } from "../../../../shared/ui/hv";
import {
  CPU_OPTIONS, MEDIA_COUNT_OPTIONS, MEMORY_OPTIONS, REFRESH_RATE_OPTIONS, SCREEN_RESOLUTIONS,
} from "../../../../shared/constants";
import { useT } from "../../../../shared/i18n";
import { claimsMobile, type NoiseMode, type ProfileForm } from "../../../../entities/profile";
import { useHostScreen } from "../../lib/useGpuPicker";
import type { TabProps } from "./types";

type NoiseKey = "noise_canvas" | "noise_webgl" | "noise_audio" | "noise_client_rects" | "noise_sensors" | "noise_fonts";
type NumKey = "hardware_concurrency" | "device_memory" | "refresh_rate" | "media_audio_in" | "media_audio_out" | "media_video_in";

export function AdvancedTab({ f, u, patch, osFilter }: TabProps & { osFilter: string }) {
  const t = useT();
  const hostScreen = useHostScreen();

  // Never larger than this machine's monitor: the window would be clamped to it at launch anyway,
  // and a screen wider than the window that holds it is the kind of disagreement a page gets for free.
  // "" is the template's own.
  const resolutions = useMemo(() => {
    const fits = SCREEN_RESOLUTIONS.filter(([w, h]) => !hostScreen || (w <= hostScreen[0] && h <= hostScreen[1]));
    return ["", ...fits.map(([w, h]) => `${w}x${h}`)];
  }, [hostScreen]);

  const numberSelect = (id: string, key: NumKey, label: string, options: readonly number[], format?: (n: number) => string) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="select" value={f[key]} onChange={(e) => u(key, Number(e.target.value) as ProfileForm[NumKey])}>
        {options.map((n) => <option key={n} value={n}>{format ? format(n) : n}</option>)}
      </select>
    </div>
  );

  const noise: [NoiseKey, string][] = [
    ["noise_canvas", t("inlineEditor.noiseCanvas")],
    ["noise_webgl", t("inlineEditor.noiseWebgl")],
    ["noise_audio", t("inlineEditor.noiseAudio")],
    ["noise_client_rects", t("inlineEditor.noiseClientRects")],
    ["noise_sensors", t("inlineEditor.noiseSensors")],
    ["noise_fonts", t("inlineEditor.noiseFonts")],
  ];

  return (
    <>
      <div className="group">
        <label className="label" htmlFor="pe-ua">{t("inlineEditor.userAgentLabel")}</label>
        <input id="pe-ua" className="field" spellCheck={false} value={f.user_agent} onChange={(e) => u("user_agent", e.target.value)} />
        <p className="hint" style={{ margin: "8px 0 0" }}>{t("profileEditor.userAgentHint")}</p>
      </div>

      <div className="group row2">
        {numberSelect("pe-cpu", "hardware_concurrency", t("inlineEditor.cpuLabel"), CPU_OPTIONS)}
        {numberSelect("pe-mem", "device_memory", t("inlineEditor.memoryLabel"), MEMORY_OPTIONS)}
      </div>

      <div className="group">
        {numberSelect("pe-hz", "refresh_rate", t("inlineEditor.refreshRateLabel"), REFRESH_RATE_OPTIONS, (n) => `${n} Hz`)}
        <p className="hint" style={{ margin: "8px 0 0" }}>{t("inlineEditor.refreshRateHelp")}</p>
      </div>

      {/* Windows and Linux only: on macOS the profile's own screen is kept as it is. */}
      {(osFilter === "Windows" || osFilter === "Linux") && (
        <div className="group">
          <label className="label" htmlFor="pe-res">{t("inlineEditor.resolutionLabel")}</label>
          <select
            id="pe-res"
            className="select"
            value={f.screen_w > 0 ? `${f.screen_w}x${f.screen_h}` : ""}
            onChange={(e) => {
              const [w, h] = e.target.value ? e.target.value.split("x").map(Number) : [0, 0];
              patch({ screen_w: w, screen_h: h });
            }}
          >
            {resolutions.map((r) => <option key={r} value={r}>{r ? r.replace("x", " × ") : t("inlineEditor.resolutionTemplate")}</option>)}
          </select>
          <p className="hint" style={{ margin: "8px 0 0" }}>
            {hostScreen ? t("inlineEditor.resolutionHelp", { w: hostScreen[0], h: hostScreen[1] }) : t("inlineEditor.resolutionHelpNoHost")}
          </p>
        </div>
      )}

      <div className="group">
        <h2 className="sect">{t("inlineEditor.noiseHeading")}</h2>
        <p className="hint">{t("profileEditor.noiseHint")}</p>
        {noise.map(([key, label]) => (
          <label className="toggle" key={key}>
            <input
              type="checkbox"
              checked={f[key] === "auto"}
              onChange={(e) => u(key, (e.target.checked ? "auto" : "real") as NoiseMode)}
            />
            <span><b>{label}</b></span>
          </label>
        ))}
      </div>

      <div className="group">
        <label className="label" htmlFor="pe-ports">{t("inlineEditor.blockedPortsLabel")}</label>
        <PortTags
          id="pe-ports"
          label={t("inlineEditor.blockedPortsLabel")}
          value={f.blocked_ports}
          onChange={(v) => u("blocked_ports", v)}
          placeholder={f.blocked_ports.length === 0 ? t("portList.placeholderEmpty") : t("portList.placeholderAdd")}
          removeLabel={(port) => t("profileEditor.removePort", { port })}
        />
      </div>

      <div className="group">
        <h2 className="sect">{t("inlineEditor.mediaDevicesHeading")}</h2>
        <div className="row3">
          {numberSelect("pe-mic", "media_audio_in", t("inlineEditor.micLabel"), MEDIA_COUNT_OPTIONS)}
          {numberSelect("pe-spk", "media_audio_out", t("inlineEditor.speakersLabel"), MEDIA_COUNT_OPTIONS)}
          {numberSelect("pe-cam", "media_video_in", t("inlineEditor.webcamLabel"), MEDIA_COUNT_OPTIONS)}
        </div>
      </div>

      {claimsMobile(f) && (
        <div className="group">
          <h2 className="sect">{t("inlineEditor.mediaHeading")}</h2>
          <label className="toggle">
            <input type="checkbox" checked={f.android_media} onChange={(e) => u("android_media", e.target.checked)} />
            <span><b>{t("inlineEditor.androidMediaLabel")}</b><span>{t("inlineEditor.androidMediaHelp")}</span></span>
          </label>
        </div>
      )}
    </>
  );
}
