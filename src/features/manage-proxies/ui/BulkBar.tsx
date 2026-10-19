import { Icon } from "../../../shared/ui/hv";
import { useProxy } from "../../../entities/proxy";
import { useT } from "../../../shared/i18n";

/// Floating bar for the rows ticked in the table. Destructive action last, in the error colour.
export function BulkBar() {
  const t = useT();
  const count = useProxy((s) => s.proxySel.size);
  const bulkTest = useProxy((s) => s.bulkTest);
  const bulkExport = useProxy((s) => s.bulkExport);
  const bulkDelete = useProxy((s) => s.bulkDelete);
  const clearSelected = useProxy((s) => s.clearSelected);
  const setDistributeOpen = useProxy((s) => s.setDistributeOpen);

  if (count === 0) return null;
  return (
    <div className="bulkbar" role="toolbar" aria-label={t("bulkBar.label")}>
      <b>{t("bulkBar.selected", { n: count })}</b>
      <button type="button" onClick={bulkTest}>{t("bulkBar.check")}</button>
      <button type="button" onClick={() => setDistributeOpen(true)}>{t("bulkBar.assign")}</button>
      <button type="button" onClick={bulkExport}>{t("bulkBar.copy")}</button>
      <button type="button" className="danger" onClick={bulkDelete}>{t("bulkBar.delete")}</button>
      <button type="button" aria-label={t("bulkBar.clear")} onClick={clearSelected}><Icon name="close" size={18} /></button>
    </div>
  );
}
