import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Chips } from "../../../../shared/ui/hv";
import { AUTO_LANG, AUTO_TZ, LOCALES, TIMEZONES } from "../../../../shared/constants";
import { useNav } from "../../../../shared/model/navigation";
import { useT } from "../../../../shared/i18n";
import type { GeoMode, WebRtcMode } from "../../../../entities/profile";
import { useExtensions } from "../../../../entities/extension";
import type { TabProps } from "./types";

export function ExtensionsTab({ f, u }: TabProps) {
  const t = useT();
  const items = useExtensions((s) => s.items);
  const init = useExtensions((s) => s.init);
  const go = useNav((s) => s.setSection);
  useEffect(() => { void init(); }, [init]);

  const toggle = (id: string) =>
    u("extensions", f.extensions.includes(id) ? f.extensions.filter((x) => x !== id) : [...f.extensions, id]);

  if (items.length === 0) {
    return (
      <div className="group">
        <h2 className="sect">{t("inlineEditor.extensionsHeading")}</h2>
        <div className="empty">
          <span>{t("extensionPicker.emptyLibrary")}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => go("extensions")}>{t("extensionPicker.addOne")}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="group" style={{ maxWidth: "none" }}>
      <h2 className="sect">{t("inlineEditor.extensionsHeading")}</h2>
      <div className="list">
        {items.map((e) => (
          <div className="list-row" key={e.id}>
            <label>
              <input className="chk" type="checkbox" checked={f.extensions.includes(e.id)} onChange={() => toggle(e.id)} />
              <span className="grow">
                <b>{e.name}</b>
                {e.description && <small>{e.description}</small>}
              </span>
              {e.version && <small>{e.version}</small>}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LocaleTab({ f, u }: TabProps) {
  const t = useT();
  return (
    <>
      <div className="group">
        <label className="label" htmlFor="pe-tz">{t("inlineEditor.timezoneLabel")}</label>
        <select id="pe-tz" className="select" value={f.timezone} onChange={(e) => u("timezone", e.target.value)}>
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz === AUTO_TZ ? t("inlineEditor.timezoneAuto") : tz}</option>)}
        </select>
      </div>
      <div className="group">
        <label className="label" htmlFor="pe-lang">{t("inlineEditor.languageLabel")}</label>
        {/* Every entry but "auto" is the language's own name for itself. */}
        <select id="pe-lang" className="select" value={f.language} onChange={(e) => u("language", e.target.value)}>
          {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.code === AUTO_LANG ? t("inlineEditor.languageAuto") : l.label}</option>)}
        </select>
      </div>
    </>
  );
}

export function PrivacyTab({ f, u }: TabProps) {
  const t = useT();
  return (
    <>
      <div className="group">
        <h2 className="sect">{t("inlineEditor.webrtcLabel")}</h2>
        <Chips
          name="profile-webrtc"
          label={t("inlineEditor.webrtcLabel")}
          value={f.webrtc}
          options={[
            { value: "auto" as WebRtcMode, label: t("inlineEditor.webrtcAuto") },
            { value: "tcp_only" as WebRtcMode, label: t("inlineEditor.webrtcTcpOnly") },
            { value: "block" as WebRtcMode, label: t("inlineEditor.webrtcBlock") },
          ]}
          onChange={(v) => u("webrtc", v)}
        />
      </div>
      <div className="group">
        <label className="toggle">
          <input type="checkbox" checked={f.do_not_track} onChange={(e) => u("do_not_track", e.target.checked)} />
          <span><b>{t("inlineEditor.dntLabel")}</b></span>
        </label>
      </div>
    </>
  );
}

export function LocationTab({ f, u }: TabProps) {
  const t = useT();
  const num = (key: "geo_lat" | "geo_lng" | "geo_accuracy", label: string, step: string) => (
    <div>
      <label className="label" htmlFor={`pe-${key}`}>{label}</label>
      <input
        id={`pe-${key}`}
        className="field"
        type="number"
        step={step}
        value={f[key]}
        onChange={(e) => u(key, Number(e.target.value))}
      />
    </div>
  );
  return (
    <>
      <div className="group">
        <h2 className="sect">{t("inlineEditor.geoLabel")}</h2>
        <Chips
          name="profile-geo"
          label={t("inlineEditor.geoLabel")}
          value={f.geo_mode}
          options={[
            { value: "auto" as GeoMode, label: t("inlineEditor.geoAuto") },
            { value: "manual" as GeoMode, label: t("inlineEditor.geoManual") },
          ]}
          onChange={(v) => u("geo_mode", v)}
        />
      </div>
      {f.geo_mode === "manual" && (
        <div className="group">
          <div className="row3">
            {num("geo_lat", t("inlineEditor.latitudeLabel"), "0.0001")}
            {num("geo_lng", t("inlineEditor.longitudeLabel"), "0.0001")}
            {num("geo_accuracy", t("inlineEditor.accuracyLabel"), "1")}
          </div>
        </div>
      )}
    </>
  );
}

export function CookiesTab({ f, u }: TabProps) {
  const t = useT();
  const pick = async () => {
    const path = await open({
      multiple: false,
      directory: false,
      title: t("inlineEditor.cookiesDialogTitle"),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (typeof path === "string") u("cookies_file", path);
  };
  return (
    <div className="group">
      <h2 className="sect">{t("inlineEditor.cookiesHeading")}</h2>
      <p className="hint">{t("inlineEditor.cookiesHelp")}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void pick()}>
          {f.cookies_file ? t("inlineEditor.cookiesChange") : t("inlineEditor.cookiesLoad")}
        </button>
        {f.cookies_file && (
          <>
            <span title={f.cookies_file}>{f.cookies_file.split(/[/\\]/).pop()}</span>
            <button type="button" className="btn btn-text btn-sm" onClick={() => u("cookies_file", "")}>{t("inlineEditor.cookiesRemove")}</button>
          </>
        )}
      </div>
    </div>
  );
}
