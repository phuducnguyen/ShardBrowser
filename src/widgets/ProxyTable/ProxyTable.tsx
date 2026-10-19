import { useState } from "react";
import { Chips, Icon, type ChipOption } from "../../shared/ui/hv";
import { toast } from "../../shared/model/toast";
import { useT } from "../../shared/i18n";
import {
  filterProxies, useFilteredProxies, useProfileCountByProxy, useProxy, type StatusFilter,
} from "../../entities/proxy";
import { checkProxies } from "../../features/manage-proxies";
import { ProxyRow } from "./ProxyRow";

// A long list renders in steps: every row subscribes to the store, so a few thousand at once would stall.
const PAGE = 200;

export function ProxyTable() {
  const t = useT();
  const rows = useFilteredProxies();
  const total = useProxy((s) => s.proxies.length);
  const sel = useProxy((s) => s.proxySel);
  const selectProxy = useProxy((s) => s.selectProxy);
  const openSheet = useProxy((s) => s.openSheet);
  const profileCounts = useProfileCountByProxy();
  const [shown, setShown] = useState(PAGE);

  const visible = rows.slice(0, shown);
  const everyChecked = rows.length > 0 && rows.every((p) => sel.has(p.id));
  const someChecked = rows.some((p) => sel.has(p.id));

  const checkAll = () => {
    if (rows.length === 0) return;
    toast.info(rows.length === 1 ? t("proxies.checkingOne") : t("proxies.checkingMany", { n: rows.length }));
    void checkProxies(rows);
  };

  return (
    <div className="card stack clip">
      <Toolbar onCheckAll={checkAll} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  className="chk"
                  type="checkbox"
                  aria-label={t("proxies.selectAll")}
                  checked={everyChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked && !everyChecked; }}
                  onChange={(e) => selectProxy(e.target.checked, rows)}
                />
              </th>
              <th>{t("proxies.colProxy")}</th>
              <th>{t("proxies.colLocation")}</th>
              <th>{t("proxies.colStatus")}</th>
              <th>{t("proxies.colLatency")}</th>
              <th>{t("proxies.colUsedBy")}</th>
              <th><span className="sr-only">{t("proxies.colActions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => <ProxyRow key={p.id} proxy={p} profileCount={profileCounts[p.id] ?? 0} />)}
            {rows.length > shown && (
              <tr className="empty-row">
                <td colSpan={7}>
                  <button type="button" className="btn btn-text btn-sm" onClick={() => setShown((n) => n + PAGE)}>
                    {t("proxies.showMore", { n: Math.min(PAGE, rows.length - shown) })}
                  </button>
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>
                  {total === 0 ? (
                    <>
                      {t("proxies.emptyNone")}
                      {" "}
                      <button type="button" className="btn btn-text btn-sm" onClick={() => openSheet()}>{t("proxies.getProxies")}</button>
                    </>
                  ) : t("proxies.emptyFiltered")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Toolbar({ onCheckAll }: { onCheckAll: () => void }) {
  const t = useT();
  const proxies = useProxy((s) => s.proxies);
  const snapshots = useProxy((s) => s.snapshots);
  const search = useProxy((s) => s.search);
  const setSearch = useProxy((s) => s.setSearch);
  const kind = useProxy((s) => s.kindFilter);
  const status = useProxy((s) => s.statusFilter);
  const setStatus = useProxy((s) => s.setStatusFilter);

  const count = (s: StatusFilter) => filterProxies(proxies, snapshots, search, kind, s).length;
  const options: ChipOption<StatusFilter>[] = [
    { value: "all", label: t("proxies.statusAll"), count: count("all") },
    { value: "alive", label: t("proxyStatus.alive"), count: count("alive") },
    { value: "dead", label: t("proxyStatus.dead"), count: count("dead") },
    { value: "new", label: t("proxyStatus.new"), count: count("new") },
  ];

  return (
    <div className="toolbar">
      <Chips name="proxy-status" label={t("proxies.filterStatus")} value={status} options={options} onChange={setStatus} />
      <span className="grow" />
      <button type="button" className="tool-btn" aria-label={t("proxies.checkAll")} title={t("proxies.checkAll")} onClick={onCheckAll}>
        <Icon name="refresh" />
      </button>
      <label className="search">
        <Icon name="search" size={18} />
        <span className="sr-only">{t("proxies.searchLabel")}</span>
        <input type="search" placeholder={t("proxies.searchPlaceholder")} autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
    </div>
  );
}
