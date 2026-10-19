import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTheme } from "@proxyshard/shardx-ui-kit";
import { HeroVMark, Icon, type IconName } from "../../shared/ui/hv";
import { useNav } from "../../shared/model/navigation";
import { useT } from "../../shared/i18n";
import { useProfile } from "../../entities/profile";
import type { RtUpdate, Section } from "../../shared/types";
import { ApiDialog } from "./ApiDialog";

type Destination = { id: Section; icon: IconName; label: string };

/// The 80px navigation rail. Profiles first, then Proxies; the rest follow in the order people reach for them.
export function AppRail() {
  const t = useT();
  const section = useNav((s) => s.section);
  const setSection = useNav((s) => s.setSection);
  const newProfile = useProfile((s) => s.newProfile);
  const { resolvedTheme, setTheme } = useTheme();
  const [update, setUpdate] = useState<RtUpdate | null>(null);
  const [apiOpen, setApiOpen] = useState(false);

  useEffect(() => {
    invoke<RtUpdate>("launcher_update_check").then(setUpdate).catch(() => {});
  }, []);

  const destinations: Destination[] = [
    { id: "browsers", icon: "grid", label: t("rail.profiles") },
    { id: "proxies", icon: "server", label: t("rail.proxies") },
    { id: "fingerprints", icon: "fingerprint", label: t("rail.fingerprints") },
    { id: "extensions", icon: "puzzle", label: t("rail.extensions") },
    { id: "bookmarks", icon: "bookmark", label: t("rail.bookmarks") },
    { id: "automation", icon: "bolt", label: t("rail.automation") },
    { id: "trash", icon: "trash", label: t("rail.trash") },
  ];

  const go = (d: Destination) => (
    <button
      key={d.id}
      type="button"
      className={section === d.id ? "rail-btn is-active" : "rail-btn"}
      aria-current={section === d.id ? "page" : undefined}
      onClick={() => setSection(d.id)}
    >
      <span className="pillbox"><Icon name={d.icon} /></span>
      {d.label}
    </button>
  );

  const startNewProfile = () => {
    setSection("browsers");
    newProfile();
  };

  const whatsNew = () => {
    if (update?.update_available && update.release_url) openUrl(update.release_url).catch(() => {});
    else setSection("patchlog");
  };

  const dark = resolvedTheme === "dark";
  return (
    <div className="hv" style={{ height: "100%" }}>
      <nav className="rail" aria-label={t("rail.label")}>
        <div className="logo" role="img" aria-label="HeroV Browser" title="HeroV Browser"><HeroVMark /></div>
        <div className="new-split">
          <button type="button" aria-label={t("rail.newProfile")} title={t("rail.newProfile")} onClick={startNewProfile}>
            <Icon name="plus" />
          </button>
        </div>
        {destinations.map(go)}
        <div className="spacer" />
        <button type="button" className="rail-btn" onClick={() => setApiOpen(true)}>
          <span className="pillbox"><Icon name="link" /></span>
          {t("rail.api")}
        </button>
        {go({ id: "settings", icon: "gear", label: t("rail.settings") })}
        <button
          type="button"
          className={section === "patchlog" ? "rail-btn is-active" : "rail-btn"}
          aria-current={section === "patchlog" ? "page" : undefined}
          title={update?.update_available ? t("rail.updateAvailable") : undefined}
          onClick={whatsNew}
        >
          <span className="pillbox"><Icon name="doc" /></span>
          {t("rail.whatsNew")}
          {update?.update_available && <span className="badge-dot" role="img" aria-label={t("rail.updateAvailable")} />}
        </button>
        <button type="button" className="rail-btn" aria-label={t("rail.themeToggle")} aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
          <span className="pillbox"><Icon name={dark ? "sun" : "moon"} /></span>
          {t("rail.theme")}
        </button>
      </nav>
      <ApiDialog open={apiOpen} onClose={() => setApiOpen(false)} />
    </div>
  );
}
