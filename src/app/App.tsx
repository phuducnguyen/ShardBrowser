import { useEffect } from "react";
import { TitleBar } from "../widgets/TitleBar/TitleBar";
import { AppRail } from "../widgets/AppRail";
import { FirstRunGate } from "../widgets/FirstRunGate/FirstRunGate";
import { ToastHost } from "../widgets/ToastHost/ToastHost";
import { ConfirmHost } from "../widgets/ConfirmHost/ConfirmHost";
import { StarModal } from "../widgets/StarModal/StarModal";
import { HelperWatcher } from "../widgets/HelperWatcher";
import { WhatsNewGate } from "../widgets/WhatsNewGate";
import { BrowsersPage } from "../pages/browsers";
import { ProxiesPage } from "../pages/proxies";
import { ProxyShardPage } from "../pages/proxyshard";
import { FingerprintsPage } from "../pages/fingerprints";
import { ExtensionsPage } from "../pages/extensions";
import { BookmarksPage } from "../pages/bookmarks";
import { AutomationPage } from "../pages/automation";
import { TrashPage } from "../pages/trash";
import { SettingsPage } from "../pages/settings";
import { PatchLogPage } from "../pages/patchlog";
import { useNav } from "../shared/model/navigation";
import { useProfileDefaults } from "../entities/profile-defaults";
import { useLauncherWarning } from "../shared/hooks/useLauncherWarning";
import { trackSection } from "../shared/lib/analytics";
import type { Section } from "../shared/types";

/// Windows already on the HeroV frame. They fill the area themselves; every other page
/// still sits in the padded, scrolling column until it is ported.
const HEROV_WINDOWS: Section[] = ["browsers", "proxies", "fingerprints", "extensions", "bookmarks", "trash", "settings", "patchlog"];

export function App() {
  const section = useNav((s) => s.section);
  const railWide = useNav((s) => s.railWide);
  const windowed = HEROV_WINDOWS.includes(section);

  useEffect(() => { void trackSection(section); }, [section]);
  // What a new profile starts from lives in a backend file; read it once now.
  useEffect(() => { void useProfileDefaults.getState().hydrate(); }, []);
  useLauncherWarning();

  return (
    <>
      <TitleBar />
      <HelperWatcher />
      <WhatsNewGate />
      <FirstRunGate>
        <div
          className="grid overflow-hidden bg-bg-weak-50 [grid-template-rows:minmax(0,1fr)]"
          style={{
            height: "100vh", paddingTop: "var(--titlebar-h)",
            gridTemplateColumns: `${railWide ? 216 : 72}px 1fr`, transition: "grid-template-columns .2s cubic-bezier(.2,0,0,1)",
          }}
        >
          <AppRail />
          <main className={windowed ? "min-h-0 min-w-0 overflow-hidden" : "overflow-y-auto px-7 py-6"}>
            {section === "browsers" && <BrowsersPage />}
            {section === "proxies" && <ProxiesPage />}
            {section === "proxyshard" && <ProxyShardPage />}
            {section === "fingerprints" && <FingerprintsPage />}
            {section === "extensions" && <ExtensionsPage />}
            {section === "bookmarks" && <BookmarksPage />}
            {section === "automation" && <AutomationPage />}
            {section === "trash" && <TrashPage />}
            {section === "patchlog" && <PatchLogPage />}
            {section === "settings" && <SettingsPage />}
          </main>
        </div>
        <ToastHost />
        <ConfirmHost />
        <StarModal />
      </FirstRunGate>
    </>
  );
}
