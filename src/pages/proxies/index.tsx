import { useEffect } from "react";
import { Icon, Window } from "../../shared/ui/hv";
import { useStoreChanged } from "../../shared/hooks/useStoreChanged";
import { storeBus } from "../../shared/lib/storeBus";
import { useT } from "../../shared/i18n";
import { useProxy } from "../../entities/proxy";
import {
  BulkBar, GetProxiesSheet, ProxyDistributeModal, ProxyEditor, ProxyInfoPopover,
} from "../../features/manage-proxies";
import { ProxyTable } from "../../widgets/ProxyTable/ProxyTable";
import { TypePanel } from "../../widgets/ProxyTable/TypePanel";

export function ProxiesPage() {
  const t = useT();
  const init = useProxy((s) => s.init);
  const reload = useProxy((s) => s.reload);
  const openSheet = useProxy((s) => s.openSheet);
  const editing = useProxy((s) => s.editing);
  const setEditing = useProxy((s) => s.setEditing);
  const infoFor = useProxy((s) => s.infoFor);
  const setInfoFor = useProxy((s) => s.setInfoFor);
  const snapshots = useProxy((s) => s.snapshots);
  const distributeOpen = useProxy((s) => s.distributeOpen);
  const setDistributeOpen = useProxy((s) => s.setDistributeOpen);

  useEffect(() => { init(); }, [init]);
  // Pick up proxies/profiles added via the automation API or MCP live.
  useStoreChanged(reload);

  return (
    <>
      <Window
        title={t("proxies.title")}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openSheet()}>
            <Icon name="plus" />{t("proxies.getProxies")}
          </button>
        }
        overlays={<><GetProxiesSheet /><BulkBar /></>}
      >
        <TypePanel />
        <ProxyTable />
      </Window>
      {/* Dialogs and the popover render their own `.hv` root, so they can sit outside the Window. */}
      {editing && (
        <ProxyEditor
          initial={editing}
          onClose={() => { setEditing(null); reload(); }}
          onSaved={() => storeBus.emit("proxies")}
        />
      )}
      {distributeOpen && <ProxyDistributeModal onClose={() => setDistributeOpen(false)} />}
      {infoFor && (
        <ProxyInfoPopover
          proxy={infoFor.proxy}
          anchor={infoFor.anchor}
          latest={snapshots[infoFor.proxy.id]}
          onClose={() => setInfoFor(null)}
        />
      )}
    </>
  );
}
