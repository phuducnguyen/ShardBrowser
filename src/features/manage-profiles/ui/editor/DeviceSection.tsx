import { Chips, Icon } from "../../../../shared/ui/hv";
import { OS_OPTIONS } from "../../../../shared/constants";
import { useT } from "../../../../shared/i18n";
import type { GpuPicker } from "../../lib/useGpuPicker";
import type { ProfileForm } from "../../../../entities/profile";
import type { Update } from "./types";

/// Values of the `Sec-CH-UA-Platform-Version` client hint a page can read. Windows 10 reports 10.0.0;
/// Windows 11 builds report 13 and up. Android reports its major version.
const ANDROID_VERSIONS = ["12.0.0", "13.0.0", "14.0.0", "15.0.0", "16.0.0"];
const WINDOWS_VERSIONS: { value: string; build: string }[] = [
  { value: "13.0.0", build: "21H2" }, { value: "14.0.0", build: "22H2" }, { value: "15.0.0", build: "23H2" },
  { value: "19.0.0", build: "24H2" }, { value: "20.0.0", build: "25H2" },
];

/// Windows and Android lead: they are the two the device flow is built around.
const OS_ORDER = ["Windows", "Android", "macOS", "Linux"];

/// Create profile, device first: engine, OS, a filter, the device, and what a site will see of it.
/// Everything in the card is fixed when the profile is created; only the choices above it move.
export function DeviceSection({ f, u, gpu }: { f: ProfileForm; u: Update; gpu: GpuPicker }) {
  const t = useT();
  const cur = gpu.current;
  const versionOptions: { value: string; label: string }[] =
    gpu.osFilter === "Android" ? ANDROID_VERSIONS.map((v) => ({ value: v, label: t("deviceSection.androidVersion", { n: v.split(".")[0] }) }))
    : gpu.osFilter === "Windows" ? [
      { value: "10.0.0", label: t("deviceSection.windows10") },
      ...WINDOWS_VERSIONS.map((w) => ({ value: w.value, label: t("deviceSection.windows11", { build: w.build }) })),
    ]
    : [];
  // A version the library carries that is not in the list (an old or odd value) stays visible and selected.
  if (versionOptions.length > 0 && f.platform_version && !versionOptions.some((o) => o.value === f.platform_version)) {
    versionOptions.push({ value: f.platform_version, label: t("deviceSection.versionOther", { v: f.platform_version }) });
  }
  const isAndroid = gpu.osFilter === "Android";
  const hasFilter = gpu.filterValues.length > 0;
  const kindLabel = { phone: t("deviceSection.kindPhone"), tablet: t("deviceSection.kindTablet"), desktop: t("deviceSection.kindDesktop") };

  return (
    <>
      <div className="group">
        <h2 className="sect">{t("deviceSection.engineLabel")}</h2>
        <Chips
          name="profile-engine"
          label={t("deviceSection.engineLabel")}
          value="chrome"
          options={[
            { value: "chrome", label: t("deviceSection.engineChrome") },
            { value: "camoufox", label: t("deviceSection.engineCamoufox"), disabled: true, hint: t("deviceSection.noEngine") },
          ]}
          onChange={() => {}}
        />
      </div>

      <div className="group">
        <h2 className="sect">{t("inlineEditor.osLabel")}</h2>
        <Chips
          name="profile-os"
          label={t("inlineEditor.osLabel")}
          value={gpu.osFilter}
          options={[
            ...[...OS_OPTIONS]
              .sort((a, b) => OS_ORDER.indexOf(a.id) - OS_ORDER.indexOf(b.id))
              .map((o) => ({ value: o.id, label: o.label })),
            { value: "iOS", label: "iOS", disabled: true, hint: t("deviceSection.planned") },
          ]}
          onChange={gpu.pickOs}
        />
      </div>

      {versionOptions.length > 0 && (
        <div className="group">
          <label className="label" htmlFor="pe-osver">{t("deviceSection.osVersion")}</label>
          <select id="pe-osver" className="select narrow-select" value={f.platform_version} onChange={(e) => u("platform_version", e.target.value)}>
            {!f.platform_version && <option value="">{t("deviceSection.versionDevice")}</option>}
            {versionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="hint tight">{t("deviceSection.osVersionHelp")}</p>
        </div>
      )}

      <div className="group">
        <div className="dev-row">
          {hasFilter && (
            <div className="dev-filter">
              <label className="label" htmlFor="pe-filter">{isAndroid ? t("deviceSection.filterBrand") : t("deviceSection.filterMaker")}</label>
              <select id="pe-filter" className="select" value={gpu.filter} onChange={(e) => gpu.pickFilter(e.target.value)}>
                <option value="">{t("deviceSection.filterAny")}</option>
                {gpu.filterValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="dev-pick">
            <label className="label" htmlFor="pe-gpu">{t("deviceSection.deviceLabel")}</label>
            <select id="pe-gpu" className="select" value={f.gpu_preset_id} onChange={(e) => gpu.chooseGpu(e.target.value)}>
              {gpu.deviceList.length === 0 && <option value="">{t("inlineEditor.gpuEmpty", { os: gpu.osFilter })}</option>}
              {gpu.deviceList.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={gpu.randomize} disabled={gpu.deviceList.length === 0}>
            <Icon name="refresh" size={18} />{t("deviceSection.random")}
          </button>
        </div>
        <p className="hint tight">{t("deviceSection.count", { n: gpu.deviceList.length })}</p>
        {gpu.compat && !gpu.compat.compatible && (
          <div className="note warn" role="status" style={{ marginTop: 12 }}>
            <Icon name="info" size={20} /><span>{t("profileEditor.gpuIncompatible")}</span>
          </div>
        )}
      </div>

      {cur && (
        <section className="group" aria-labelledby="pe-see">
          <div className="dev-head">
            <h2 className="sect" id="pe-see">{t("deviceSection.seeTitle")}</h2>
            <span className="chip-plain">{t("deviceSection.locked")}</span>
          </div>
          <dl className="dev-card">
            <div><dt>{t("deviceSection.platform")}</dt><dd>{cur.os} · {kindLabel[cur.kind]}</dd></div>
            <div><dt>{t("deviceSection.browser")}</dt><dd>Chrome {cur.chrome}</dd></div>
            <div><dt>{t("deviceSection.screen")}</dt><dd>{cur.screenW}×{cur.screenH} @{cur.dpr}x</dd></div>
            <div><dt>{t("deviceSection.cores")}</dt><dd>{cur.cores}</dd></div>
            <div><dt>{t("deviceSection.memory")}</dt><dd>{t("deviceSection.memoryValue", { n: cur.memory })}</dd></div>
            <div><dt>{t("deviceSection.touch")}</dt><dd>{cur.touch}</dd></div>
            <div className="wide"><dt>{t("deviceSection.graphics")}</dt><dd>{cur.gpuName}</dd></div>
          </dl>
        </section>
      )}
    </>
  );
}
