import { useEffect, useMemo, useState } from "react";
import { Chips } from "../../shared/ui/hv";
import { LOCALES, TIMEZONES } from "../../shared/constants";
import { toast } from "../../shared/model/toast";
import { useT } from "../../shared/i18n";
import { deviceInfo, devicesFor, filterOptions, fingerprintList, type FingerprintEntry } from "../../entities/fingerprint";
import { factoryDefaults, useProfileDefaults, type DefaultOs, type ProfileDefaults } from "../../entities/profile-defaults";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><b>{label}</b></span>
    </label>
  );
}

/// Settings → Profile defaults: what every new profile starts from. Existing profiles are untouched.
/// Renders its own panel and save bar, because this tab saves to the defaults, not to the app settings.
export function ProfileDefaultsTab({ panelId, labelledBy }: { panelId: string; labelledBy: string }) {
  const t = useT();
  const saved = useProfileDefaults((s) => s.defaults);
  const save = useProfileDefaults((s) => s.save);
  const [d, setD] = useState<ProfileDefaults>(saved);
  const [fps, setFps] = useState<FingerprintEntry[]>([]);
  useEffect(() => { fingerprintList().then(setFps).catch(() => {}); }, []);

  const devices = useMemo(() => fps.map(deviceInfo), [fps]);
  const filterValues = useMemo(() => filterOptions(devices, d.os), [devices, d.os]);
  const pinnable = useMemo(() => devicesFor(devices, d.os, d.filter), [devices, d.os, d.filter]);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = (patch: Partial<ProfileDefaults>) => setD((cur) => ({ ...cur, ...patch }));
  const setNoise = (k: keyof ProfileDefaults["noise"], on: boolean) =>
    setD((cur) => ({ ...cur, noise: { ...cur.noise, [k]: on ? "auto" : "real" } }));

  const planned = t("deviceSection.planned");
  const onSave = async () => {
    try { await save(d); toast.ok(t("profileDefaults.saved")); }
    catch (e) { toast.err(String(e)); }
  };
  const onReset = () => { setD(factoryDefaults()); };

  return (
    <>
      <div className="tabpanel" role="tabpanel" id={panelId} aria-labelledby={labelledBy}>
        <p className="hint">{t("profileDefaults.intro")}</p>

        <div className="group">
          <h2 className="sect">{t("deviceSection.engineLabel")}</h2>
          <Chips
            name="pd-engine"
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
            name="pd-os"
            label={t("inlineEditor.osLabel")}
            value={d.os}
            options={[
              { value: "Windows", label: "Windows" },
              { value: "Android", label: "Android" },
              { value: "macOS", label: "macOS", disabled: true, hint: planned },
              { value: "Linux", label: "Linux", disabled: true, hint: planned },
              { value: "iOS", label: "iOS", disabled: true, hint: planned },
            ]}
            onChange={(v) => set({ os: v as DefaultOs, filter: "", pinnedId: "" })}
          />
        </div>

        <div className="group">
          <h2 className="sect">{t("profileDefaults.deviceTitle")}</h2>
          <Chips
            name="pd-mode"
            label={t("profileDefaults.deviceTitle")}
            value={d.mode}
            options={[
              { value: "random", label: t("profileDefaults.modeRandom") },
              { value: "pinned", label: t("profileDefaults.modePinned") },
            ]}
            onChange={(v) => set({ mode: v })}
          />
          <div className="dev-row">
            {filterValues.length > 0 && (
              <div className="dev-filter">
                <label className="label" htmlFor="pd-filter">{d.os === "Android" ? t("deviceSection.filterBrand") : t("deviceSection.filterMaker")}</label>
                <select id="pd-filter" className="select" value={d.filter} onChange={(e) => set({ filter: e.target.value, pinnedId: "" })}>
                  <option value="">{t("deviceSection.filterAny")}</option>
                  {filterValues.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {d.mode === "pinned" && (
              <div className="dev-pick">
                <label className="label" htmlFor="pd-pinned">{t("profileDefaults.pinnedLabel")}</label>
                <select id="pd-pinned" className="select" value={d.pinnedId} onChange={(e) => set({ pinnedId: e.target.value })}>
                  <option value="">{t("profileDefaults.pinnedNone")}</option>
                  {pinnable.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
            )}
          </div>
          <p className="hint tight">
            {d.mode === "random" ? t("profileDefaults.randomHelp", { n: pinnable.length }) : t("profileDefaults.pinnedHelp")}
          </p>
        </div>

        <div className="group">
          <h2 className="sect">{t("profileDefaults.protectTitle")}</h2>
          <p className="hint">{t("profileDefaults.protectHelp")}</p>
          <div className="def-grid">
            <Toggle label={t("profileDefaults.canvas")} checked={d.noise.canvas === "auto"} onChange={(v) => setNoise("canvas", v)} />
            <Toggle label={t("profileDefaults.webgl")} checked={d.noise.webgl === "auto"} onChange={(v) => setNoise("webgl", v)} />
            <Toggle label={t("profileDefaults.audio")} checked={d.noise.audio === "auto"} onChange={(v) => setNoise("audio", v)} />
            <Toggle label={t("profileDefaults.clientRects")} checked={d.noise.client_rects === "auto"} onChange={(v) => setNoise("client_rects", v)} />
            <Toggle label={t("profileDefaults.fonts")} checked={d.noise.fonts === "auto"} onChange={(v) => setNoise("fonts", v)} />
            <Toggle label={t("profileDefaults.sensors")} checked={d.noise.sensors === "auto"} onChange={(v) => setNoise("sensors", v)} />
          </div>
        </div>

        <div className="group">
          <h2 className="sect">{t("profileDefaults.webrtcTitle")}</h2>
          <Chips
            name="pd-webrtc"
            label={t("profileDefaults.webrtcTitle")}
            value={d.webrtc}
            options={[
              { value: "auto", label: t("profileDefaults.webrtcAuto") },
              { value: "tcp_only", label: t("profileDefaults.webrtcTcp") },
              { value: "block", label: t("profileDefaults.webrtcBlock") },
            ]}
            onChange={(v) => set({ webrtc: v })}
          />
        </div>

        <div className="group">
          <div className="dev-row">
            <div className="dev-pick">
              <label className="label" htmlFor="pd-lang">{t("profileDefaults.language")}</label>
              <select id="pd-lang" className="select" value={d.language} onChange={(e) => set({ language: e.target.value })}>
                {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="dev-pick">
              <label className="label" htmlFor="pd-tz">{t("profileDefaults.timezone")}</label>
              <select id="pd-tz" className="select" value={d.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                {TIMEZONES.map((z) => <option key={z} value={z}>{z === "auto" ? t("profileDefaults.timezoneAuto") : z}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="savebar split">
        <button type="button" className="btn btn-text btn-sm" onClick={onReset}>{t("profileDefaults.reset")}</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty} onClick={onSave}>{t("profileDefaults.save")}</button>
      </div>
    </>
  );
}
