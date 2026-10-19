import { useT } from "../../shared/i18n";
import { filterProxies, useProxy, type KindFilter } from "../../entities/proxy";

/// Secondary navigation of the Proxies window: filter by connection type, with counts.
export function TypePanel() {
  const t = useT();
  const proxies = useProxy((s) => s.proxies);
  const snapshots = useProxy((s) => s.snapshots);
  const search = useProxy((s) => s.search);
  const status = useProxy((s) => s.statusFilter);
  const active = useProxy((s) => s.kindFilter);
  const setKind = useProxy((s) => s.setKindFilter);

  const items: { id: KindFilter; label: string }[] = [
    { id: "all", label: t("proxies.typeAll") },
    { id: "socks5", label: "SOCKS5" },
    { id: "http", label: "HTTP" },
    { id: "https", label: "HTTPS" },
  ];

  return (
    <aside className="panel" aria-label={t("proxies.panelType")}>
      <div className="panel-title">{t("proxies.panelType")}</div>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={it.id === active ? "nav-item is-active" : "nav-item"}
          aria-current={it.id === active ? "true" : undefined}
          onClick={() => setKind(it.id)}
        >
          {it.label}
          <span className="count">{filterProxies(proxies, snapshots, search, it.id, status).length}</span>
        </button>
      ))}
    </aside>
  );
}
