import { useEffect } from "react";
import { Icon, Window } from "../../shared/ui/hv";
import { useStoreChanged } from "../../shared/hooks/useStoreChanged";
import { daysUntil, fmtBytes, fmtTs } from "../../shared/lib/utils";
import { useTrash } from "../../entities/trash";
import { useT } from "../../shared/i18n";

export function TrashPage() {
  const t = useT();
  const init = useTrash((s) => s.init);
  const items = useTrash((s) => s.items);
  const busy = useTrash((s) => s.busy);
  const restore = useTrash((s) => s.restore);
  const purge = useTrash((s) => s.purge);
  const empty = useTrash((s) => s.empty);

  const reload = useTrash((s) => s.reload);
  useEffect(() => { init(); }, [init]);
  // A profile deleted or restored through the API belongs in this list.
  useStoreChanged(reload);

  return (
    <Window
      single
      title={t("trash.title")}
      actions={items.length > 0 && (
        <button type="button" className="btn btn-danger btn-sm" onClick={empty}>
          <Icon name="trash" size={18} />{t("trash.emptyTrash")}
        </button>
      )}
    >
      <div className="card stack clip">
        <div className="table-wrap">
          <p className="hint">{t("trash.intro")}</p>
          {items.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>{t("trash.colName")}</th>
                  <th>{t("trash.colFolder")}</th>
                  <th>{t("trash.colDeleted")}</th>
                  <th>{t("trash.colSize")}</th>
                  <th><span className="sr-only">{t("trash.colActions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const left = daysUntil(e.expires_at);
                  return (
                    <tr key={e.id}>
                      <td>
                        <span className="name">{e.name}</span>
                        <span className="sub mono">{e.id.slice(0, 8)}</span>
                      </td>
                      <td>{e.folder || <span className="sub">—</span>}</td>
                      <td>
                        {fmtTs(`@${e.deleted_at}`)}{" "}
                        <span className={left <= 1 ? "status is-error" : "status is-idle"}>
                          {left === 0 ? t("trash.expiresToday") : t("trash.daysLeft", { n: left })}
                        </span>
                      </td>
                      <td>{fmtBytes(e.size_bytes)}</td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-secondary btn-sm" disabled={busy === e.id} onClick={() => restore(e)}>
                          <Icon name="refresh" size={18} />{t("trash.restore")}
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => purge(e)}>
                          <Icon name="trash" size={18} />{t("trash.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {items.length === 0 && (
            <div className="empty-hero">
              <div className="empty-ico"><Icon name="trash" size={26} /></div>
              <h3>{t("trash.emptyTitle")}</h3>
              <p>{t("trash.emptyHint")}</p>
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
