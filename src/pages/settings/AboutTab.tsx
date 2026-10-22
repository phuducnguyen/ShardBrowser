import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { HeroVMark, Icon } from "../../shared/ui/hv";
import { toast } from "../../shared/model/toast";
import { useT, useLang } from "../../shared/i18n";
import { buildDate, buildLine, useBuildInfo, versionTag } from "../../shared/model/buildInfo";
import type { RtUpdate } from "../../shared/types";

const RELEASES = "https://github.com/phuducnguyen/ShardBrowser/releases";

/// Settings → About: which HeroV build is running, whether a newer one exists, and one click to
/// copy the build line into a bug report.
export function AboutTab() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const info = useBuildInfo((s) => s.info);
  const load = useBuildInfo((s) => s.load);
  const [update, setUpdate] = useState<RtUpdate | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { load(); }, [load]);

  const check = async (announce: boolean) => {
    setChecking(true);
    try {
      const u = await invoke<RtUpdate>("launcher_update_check");
      setUpdate(u);
      if (announce) {
        if (u.update_available && u.latest) toast.info(t("about.updateFound", { v: u.latest }));
        else if (u.latest) toast.ok(t("about.upToDate"));
        else toast.info(t("about.checkUnknown"));
      }
    } catch (e) {
      if (announce) toast.err(String(e));
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => { check(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(buildLine(info));
      toast.ok(t("about.copied"));
    } catch (e) {
      toast.err(String(e));
    }
  };

  if (!info) return <p className="hint">{t("about.unknown")}</p>;
  const pre = info.channel !== "stable";
  return (
    <>
      <div className="group about-head">
        <HeroVMark size={56} />
        <div>
          <p className="about-name">HeroV Browser</p>
          <p className="about-ver">
            <span data-testid="about-version">{versionTag(info)}</span>
            <span className={`chip-plain ${pre ? "is-warn" : ""}`}>{pre ? t("about.channelPre", { c: info.channel }) : t("about.channelStable")}</span>
          </p>
        </div>
      </div>

      <div className="group">
        <dl className="dev-card">
          <div><dt>{t("about.version")}</dt><dd>{info.version}</dd></div>
          <div><dt>{t("about.channel")}</dt><dd>{info.channel}</dd></div>
          <div><dt>{t("about.built")}</dt><dd>{buildDate(info, lang)}</dd></div>
          <div><dt>{t("about.commit")}</dt><dd><code>{info.commit}</code></dd></div>
          <div className="wide"><dt>{t("about.engineContract")}</dt><dd>{info.engine_compat}</dd></div>
        </dl>
        {pre && <p className="hint">{t("about.preHint")}</p>}
      </div>

      <div className="group">
        <p className="sect">{t("about.updates")}</p>
        <p className="hint" data-testid="about-update">
          {update?.update_available && update.latest
            ? t("about.updateFound", { v: update.latest })
            : update?.latest
              ? t("about.upToDate")
              : t("about.checkUnknown")}
        </p>
        <div className="copy-row spaced">
          <button type="button" className="btn btn-secondary btn-sm" disabled={checking} onClick={() => check(true)}>
            <Icon name="refresh" size={18} />{checking ? t("about.checking") : t("about.checkNow")}
          </button>
          {update?.update_available && update.release_url && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openUrl(update.release_url!).catch(() => {})}>
              <Icon name="download" size={18} />{t("about.getUpdate")}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
            <Icon name="copy" size={18} />{t("about.copy")}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openUrl(`${RELEASES}/tag/${versionTag(info)}`).catch(() => {})}>
            <Icon name="link" size={18} />{t("about.notes")}
          </button>
        </div>
      </div>
    </>
  );
}
