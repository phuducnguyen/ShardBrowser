import { Icon } from "../../../shared/ui/hv";
import { useT } from "../../../shared/i18n";
import { useProfile, useSyncBlockReason } from "../../../entities/profile";

/// Floating bar for the ticked profiles. Destructive action last, in the error colour.
export function ProfileBulkBar() {
  const t = useT();
  const count = useProfile((s) => s.selected.size);
  const bulkLaunch = useProfile((s) => s.bulkLaunch);
  const bulkLaunchSynced = useProfile((s) => s.bulkLaunchSynced);
  const bulkStop = useProfile((s) => s.bulkStop);
  const bulkExport = useProfile((s) => s.bulkExport);
  const bulkDelete = useProfile((s) => s.bulkDelete);
  const clearSelected = useProfile((s) => s.clearSelected);
  const syncBlocked = useSyncBlockReason();

  if (count === 0) return null;
  return (
    <div className="bulkbar" role="toolbar" aria-label={t("profiles.bulkLabel")}>
      <b>{t("bulkActionsBar.selectedCount", { n: count })}</b>
      <button type="button" onClick={() => void bulkLaunch()}>{t("bulkActionsBar.launch")}</button>
      {/* Meaningless for a single profile, so it only appears for a group. The reason sits on a wrapper so it still shows while the button is disabled. */}
      {count >= 2 && (
        <span title={syncBlocked || t("bulkActionsBar.launchSyncedHint")}>
          <button type="button" disabled={!!syncBlocked} onClick={() => void bulkLaunchSynced()}>{t("bulkActionsBar.launchSynced")}</button>
        </span>
      )}
      <button type="button" onClick={() => void bulkStop()}>{t("bulkActionsBar.stop")}</button>
      <button type="button" onClick={() => void bulkExport()}>{t("bulkActionsBar.export")}</button>
      <button type="button" className="danger" onClick={() => void bulkDelete()}>{t("bulkActionsBar.delete")}</button>
      <button type="button" aria-label={t("bulkActionsBar.clear")} onClick={clearSelected}><Icon name="close" size={18} /></button>
    </div>
  );
}
