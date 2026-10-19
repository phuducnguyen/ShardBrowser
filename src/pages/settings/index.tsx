import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CopyField, Icon, NavTabs, Window, type TabItem } from "../../shared/ui/hv";
import { toast } from "../../shared/model/toast";
import { withUtm } from "../../shared/lib/utils";
import type { Settings, ApiInfo } from "../../entities/settings";
import { HELPER_KINDS } from "../../entities/settings";
import { settingsGet, settingsSave, settingsLoadError, apiInfo, apiRegenerateToken, mcpDownload } from "../../entities/settings";
import { DataRootCard } from "../../features/manage-profiles/ui/DataRootCard";
import { ProfileDefaultsTab } from "./ProfileDefaultsTab";
import { useT, useLang, LANG_OPTIONS, type Lang } from "../../shared/i18n";

type Tab = "general" | "browser" | "defaults" | "data" | "api";
const PREFIX = "settings";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><b>{label}</b></span>
    </label>
  );
}

export function SettingsPage() {
  const t = useT();
  const lang = useLang((st) => st.lang);
  const setLang = useLang((st) => st.setLang);
  const [tab, setTab] = useState<Tab>("general");
  const [s, setS] = useState<Settings>({
    browser_path: null,
    theme: "dark",
    geo_checker: "ip-api.com",
    screen_resolution_mode: "fingerprint",
    helper_enabled: true,
    helper_triggers: [],
    extra_args: "",
    api_enabled: true,
    api_port: 40325,
  });
  const [api, setApi] = useState<ApiInfo | null>(null);
  const refreshApi = () => apiInfo().then(setApi).catch(() => {});
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    settingsGet().then(setS);
    settingsLoadError().then(setLoadError).catch(() => {});
    refreshApi();
  }, []);
  const regenToken = async () => {
    try { setApi(await apiRegenerateToken()); toast.ok(t("settings.tokenRegenerated")); }
    catch (e) { toast.err(String(e)); }
  };

  const [mcpBusy, setMcpBusy] = useState(false);
  // Download MCP server source; user manages install + client setup.
  const downloadMcp = async () => {
    const dir = await open({ directory: true, title: t("settings.mcpDownloadDialogTitle") });
    if (typeof dir !== "string") return;
    setMcpBusy(true);
    try {
      const path = await mcpDownload(dir);
      toast.ok(t("settings.mcpDownloaded", { path }));
    } catch (e) { toast.err(t("settings.mcpDownloadFailed", { err: String(e) })); }
    finally { setMcpBusy(false); }
  };
  const save = async () => {
    try { await settingsSave(s); toast.ok(t("settings.saved")); }
    catch (e) { toast.err(String(e)); }
    refreshApi();
  };

  const tabs: TabItem<Tab>[] = [
    { id: "general", label: t("settings.tabGeneral") },
    { id: "browser", label: t("settings.tabBrowser") },
    { id: "defaults", label: t("settings.tabDefaults") },
    { id: "data", label: t("settings.tabData") },
    { id: "api", label: t("settings.tabApi") },
  ];
  const triggers = s.helper_triggers ?? [];
  const helperOn = s.helper_enabled ?? true;

  return (
    <Window title={t("settings.title")}>
      <aside className="panel" aria-label={t("settings.tablist")}>
        <NavTabs label={t("settings.tablist")} idPrefix={PREFIX} value={tab} tabs={tabs} onChange={setTab} />
      </aside>
      <div className="card grow">
        {tab === "defaults" ? (
          <ProfileDefaultsTab panelId={`${PREFIX}-panel`} labelledBy={`${PREFIX}-tab-defaults`} />
        ) : (<>
        <div className="tabpanel" role="tabpanel" id={`${PREFIX}-panel`} aria-labelledby={`${PREFIX}-tab-${tab}`} key={tab}>
          {loadError && (
            <div className="callout-err" role="alert">
              <strong>{t("settings.loadErrorTitle")}</strong>{t("settings.loadErrorBody1")}<code>settings.json.bad</code>{t("settings.loadErrorBody2")}<code>Set-Content -Encoding UTF8</code>{t("settings.loadErrorBody3")}
              <div className="soft small">{loadError}</div>
            </div>
          )}

          {tab === "general" && (
            <>
              <div className="group">
                <p className="sect">{t("settings.languageTitle")}</p>
                <p className="hint">{t("settings.languageHelp")}</p>
                <label className="label" htmlFor="st-lang">{t("settings.interfaceLanguageLabel")}</label>
                <select id="st-lang" className="select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                  {LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="group">
                <p className="sect">{t("settings.geoCheckerTitle")}</p>
                <p className="hint">
                  {t("settings.geoCheckerHelp1")}<strong>{t("settings.geoCheckerTestWord")}</strong>{t("settings.geoCheckerHelp2")}
                </p>
                <label className="label" htmlFor="st-geo">{t("settings.providerLabel")}</label>
                <select id="st-geo" className="select" value={s.geo_checker ?? "ip-api.com"} onChange={(e) => setS({ ...s, geo_checker: e.target.value })}>
                  <option value="ip-api.com">{t("settings.geoIpApiCom")}</option>
                  <option value="ipapi.co">{t("settings.geoIpapiCo")}</option>
                  <option value="ipwho.is">{t("settings.geoIpwhoIs")}</option>
                </select>
              </div>

              <div className="group">
                <p className="sect">{t("settings.screenTitle")}</p>
                <p className="hint">
                  <strong>{t("settings.screenFromFingerprintWord")}</strong>{t("settings.screenHelp1")}
                  <strong>{t("settings.screenRealWord")}</strong>{t("settings.screenHelp2")}
                </p>
                <label className="label" htmlFor="st-screen">{t("settings.screenModeLabel")}</label>
                <select id="st-screen" className="select" value={s.screen_resolution_mode ?? "fingerprint"} onChange={(e) => setS({ ...s, screen_resolution_mode: e.target.value })}>
                  <option value="fingerprint">{t("settings.screenModeFingerprint")}</option>
                  <option value="real">{t("settings.screenModeReal")}</option>
                </select>
              </div>
            </>
          )}

          {tab === "browser" && (
            <>
              <div className="group">
                <p className="sect">{t("settings.helperTitle")}</p>
                <p className="hint">
                  {t("settings.helperHelp1")}
                  <strong>{t("settings.helperOffersWord")}</strong>{t("settings.helperHelp2")}
                  <br />
                  <strong>{t("settings.helperNeverSync")}</strong>{t("settings.helperHelp3")}
                </p>
                <Toggle label={t("settings.helperEnableLabel")} checked={helperOn} onChange={(v) => setS({ ...s, helper_enabled: v })} />
                {helperOn && (
                  <>
                    <p className="label">{t("settings.helperReactTo")}</p>
                    <p className="hint">{t("settings.helperTriggersHelp")}</p>
                    <div className="seg" role="group" aria-label={t("settings.helperReactTo")}>
                      {HELPER_KINDS.map((k) => {
                        const picked = triggers.includes(k.value);
                        return (
                          <label key={k.value}>
                            <span>{t(k.label)}</span>
                            <input
                              type="checkbox"
                              checked={picked}
                              onChange={() => setS({ ...s, helper_triggers: picked ? triggers.filter((x) => x !== k.value) : [...triggers, k.value] })}
                            />
                            <span className="rd" />
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="group">
                <p className="sect">{t("settings.cameraTitle")}</p>
                <p className="hint">
                  {t("settings.cameraHelp1")}
                  <strong>{t("settings.cameraLeaveOn")}</strong>{t("settings.cameraHelp2")}
                </p>
                <Toggle label={t("settings.cameraSwitchLabel")} checked={s.camera_enabled ?? true} onChange={(v) => setS({ ...s, camera_enabled: v })} />
              </div>

              <div className="group">
                <p className="sect">{t("settings.extraArgsTitle")}</p>
                <p className="hint">
                  {t("settings.extraArgsHelp1")}<strong>{t("settings.extraArgsLastWord")}</strong>{t("settings.extraArgsHelp2")}
                  <br />
                  {t("settings.extraArgsHelp3")}
                </p>
                <textarea
                  className="field mono-args"
                  aria-label={t("settings.extraArgsTitle")}
                  rows={3}
                  spellCheck={false}
                  value={s.extra_args ?? ""}
                  placeholder={"--disable-background-timer-throttling\n--window-size=1280,800"}
                  onChange={(e) => setS({ ...s, extra_args: e.target.value })}
                />
              </div>
            </>
          )}

          {tab === "data" && (
            <div className="group">
              <p className="sect">{t("settings.dataLocationTitle")}</p>
              <DataRootCard />
            </div>
          )}

          {tab === "api" && (
            <>
              <div className="group">
                <p className="sect">{t("settings.apiTitle")}</p>
                <p className="hint">
                  {t("settings.apiHelp1")}<strong>127.0.0.1</strong>{t("settings.apiHelp2")}{" "}
                  <button
                    type="button"
                    className="link-btn is-link"
                    onClick={() => { openUrl(withUtm("https://docs.proxyshard.com/eng/shardx-launcher-api/binding-and-lifecycle?fallback=true")).catch(() => {}); }}
                  >
                    {t("settings.apiRefLink")}
                  </button>
                </p>
                <Toggle label={t("settings.apiEnableLabel")} checked={s.api_enabled ?? true} onChange={(v) => setS({ ...s, api_enabled: v })} />
                <label className="label" htmlFor="st-port">{t("settings.apiPortLabel")}</label>
                <input
                  id="st-port"
                  className="field narrow"
                  type="number"
                  min={1}
                  max={65535}
                  inputMode="numeric"
                  value={s.api_port ?? 40325}
                  onChange={(e) => setS({ ...s, api_port: Number(e.target.value) || 40325 })}
                />
                {api && (
                  <>
                    <p className="label">{t("settings.apiBaseUrlLabel")}</p>
                    <CopyField label={t("settings.apiBaseUrlLabel")} value={api.base_url} />
                    <p className="label">{t("settings.apiTokenLabel")}</p>
                    <CopyField label={t("settings.apiTokenLabel")} value={api.token} secret />
                    <div className="copy-row spaced">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={regenToken}>
                        <Icon name="refresh" size={18} />{t("settings.apiRegenerateBtn")}
                      </button>
                      <span className="soft small">{t("settings.apiRegenerateHint")}</span>
                    </div>
                    <p className="hint">
                      {t("settings.apiAuthHeaderHint")}<code>Authorization: Bearer &lt;token&gt;</code>.
                    </p>
                  </>
                )}
              </div>

              <div className="group">
                <p className="sect">{t("settings.mcpTitle")}</p>
                <p className="hint">
                  {t("settings.mcpHelp1")}<strong>MCP</strong>{t("settings.mcpHelp2")}
                </p>
                <button type="button" className="btn btn-secondary btn-sm" disabled={mcpBusy} onClick={downloadMcp}>
                  <Icon name="download" size={18} />{mcpBusy ? t("settings.mcpDownloading") : t("settings.mcpDownloadBtn")}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="savebar">
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>{t("settings.saveBtn")}</button>
        </div>
        </>)}
      </div>
    </Window>
  );
}
