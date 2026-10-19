import { useEffect } from "react";
import { Icon, Window } from "../../shared/ui/hv";
import { useStoreChanged } from "../../shared/hooks/useStoreChanged";
import { useT } from "../../shared/i18n";
import { useProfile } from "../../entities/profile";
import { FolderPanel } from "../../widgets/ProfileTable/FolderPanel";
import { ProfileTable } from "../../widgets/ProfileTable/ProfileTable";
import {
  ProfileBulkBar, ProfileEditor, ProfileFolderModal, ProfileQuickEdit, ProfileTemplatePicker,
} from "../../features/manage-profiles";

export function BrowsersPage() {
  const t = useT();
  const init = useProfile((s) => s.init);
  const reload = useProfile((s) => s.reload);
  const startProcessPolling = useProfile((s) => s.startProcessPolling);
  const newProfile = useProfile((s) => s.newProfile);
  const bulkImport = useProfile((s) => s.bulkImport);
  const setTemplatePickerOpen = useProfile((s) => s.setTemplatePickerOpen);
  const editing = useProfile((s) => s.expanded !== null);

  useEffect(() => { void init(); }, [init]);
  // Poll real child-process status (anchors the uptime clock, refreshes totals).
  useEffect(() => startProcessPolling(), [startProcessPolling]);
  // Pick up profiles/proxies created via the automation API or MCP live.
  useStoreChanged(reload);

  if (editing) return <ProfileEditor />;

  return (
    <>
      <Window
        title={t("profiles.title")}
        actions={
          <>
            <button type="button" className="btn btn-text btn-sm" title={t("importProfilesButton.tooltip")} onClick={() => void bulkImport()}>
              <Icon name="download" size={18} />{t("importProfilesButton.label")}
            </button>
            <button type="button" className="btn btn-text btn-sm" onClick={() => setTemplatePickerOpen(true)}>
              {t("fromTemplateButton.label")}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={newProfile}>
              <Icon name="plus" />{t("profiles.newProfile")}
            </button>
          </>
        }
        overlays={<ProfileBulkBar />}
      >
        <FolderPanel />
        <ProfileTable />
      </Window>
      {/* Dialogs bring their own `.hv` root, so they can sit outside the window. */}
      <ProfileTemplatePicker />
      <ProfileFolderModal />
      <ProfileQuickEdit />
    </>
  );
}
