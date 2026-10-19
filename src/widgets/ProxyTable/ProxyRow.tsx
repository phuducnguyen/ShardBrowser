import { useRef } from "react";
import { CountryFlag } from "../../shared/ui/CountryFlag";
import { Icon, KebabMenu } from "../../shared/ui/hv";
import { clip } from "../../shared/lib/clipboard";
import { toast } from "../../shared/model/toast";
import { useT } from "../../shared/i18n";
import { latencyMeter, proxyStatus, useProxy, type ProxyEntry } from "../../entities/proxy";

export function ProxyRow({ proxy, profileCount }: { proxy: ProxyEntry; profileCount: number }) {
  const t = useT();
  const snap = useProxy((s) => s.snapshots[proxy.id]);
  const busy = useProxy((s) => !!s.proxyTesting[proxy.id]);
  const selected = useProxy((s) => s.proxySel.has(proxy.id));
  const selectProxy = useProxy((s) => s.selectProxy);
  const selectRangeTo = useProxy((s) => s.selectRangeTo);
  const testProxy = useProxy((s) => s.testProxy);
  const removeProxy = useProxy((s) => s.removeProxy);
  const setEditing = useProxy((s) => s.setEditing);
  const setInfoFor = useProxy((s) => s.setInfoFor);
  const row = useRef<HTMLTableRowElement>(null);
  // A shift-press selects a run in mousedown; the change event that follows must not toggle it again.
  const shiftPress = useRef(false);

  const status = proxyStatus(snap, busy);
  const address = `${proxy.host}:${proxy.port}`;
  const name = proxy.name || address;
  const cc = snap?.country_code || proxy.country;
  const place = snap?.country || cc;

  const showDetails = () => {
    const rect = row.current?.getBoundingClientRect();
    setInfoFor({ proxy, anchor: { x: (rect?.right ?? 0) - 120, y: (rect?.bottom ?? 0) } });
  };
  const assign = () => useProxy.setState({ proxySel: new Set([proxy.id]), anchorId: proxy.id, distributeOpen: true });
  const copy = () => {
    clip.write(address).then(
      () => toast.ok(t("proxyRow.copied")),
      (e) => toast.err(String(e)),
    );
  };

  return (
    <tr ref={row} data-id={proxy.id}>
      <td>
        <input
          className="chk"
          type="checkbox"
          aria-label={t("proxyRow.select", { name })}
          checked={selected}
          onMouseDown={(e) => {
            shiftPress.current = e.shiftKey;
            if (e.shiftKey) { e.preventDefault(); selectRangeTo(proxy.id); }
          }}
          onChange={() => {
            if (shiftPress.current) { shiftPress.current = false; return; }
            selectProxy(!selected, [proxy]);
          }}
        />
      </td>
      <td>
        <span className="name">
          {name}
          {(proxy.username || proxy.password) && (
            <span className="dim" title={t("proxyRow.requiresLogin")}>
              <Icon name="lock" size={14} />
              <span className="sr-only">{t("proxyRow.requiresLogin")}</span>
            </span>
          )}
        </span>
        <span className="sub">{proxy.kind.toUpperCase()} · {address}</span>
      </td>
      <td>
        {place ? <span className="loc"><CountryFlag cc={cc} height={14} />{place}</span> : <span className="dim">—</span>}
      </td>
      <td>
        <StatusPill status={status} />
        {status === "alive" && proxy.kind === "socks5" && snap && (
          <span className="sub">{snap.udp_ms != null ? t("proxyRow.udpOk", { ms: snap.udp_ms }) : t("proxyRow.udpNone")}</span>
        )}
      </td>
      <td>
        {status === "alive" && snap?.tcp_ms != null ? <Latency ms={snap.tcp_ms} /> : <span className="meter none">—</span>}
      </td>
      <td>
        {profileCount > 0
          ? (profileCount === 1 ? t("proxyRow.usedOne") : t("proxyRow.usedMany", { n: profileCount }))
          : <span className="dim">—</span>}
      </td>
      <td className="actions-cell">
        <button
          type="button"
          className="tool-btn"
          aria-label={t("proxyRow.check", { name })}
          title={t("proxyRow.menuCheck")}
          disabled={busy}
          onClick={() => void testProxy(proxy)}
        >
          <Icon name="refresh" size={20} />
        </button>
        <KebabMenu
          label={t("proxyRow.actions", { name })}
          items={[
            { label: t("proxyRow.menuCheck"), onSelect: () => void testProxy(proxy) },
            { label: t("proxyRow.menuEdit"), onSelect: () => setEditing(proxy) },
            { label: t("proxyRow.menuDetails"), onSelect: showDetails },
            { label: t("proxyRow.menuCopy"), onSelect: copy },
            { label: t("proxyRow.menuAssign"), onSelect: assign },
            { label: t("proxyRow.menuDelete"), onSelect: () => void removeProxy(proxy.id), danger: true },
          ]}
        />
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: ReturnType<typeof proxyStatus> }) {
  const t = useT();
  if (status === "alive") return <span className="status">{t("proxyStatus.alive")}</span>;
  if (status === "dead") return <span className="status is-error">{t("proxyStatus.dead")}</span>;
  if (status === "checking") {
    return <span className="status is-warn"><span className="spin sm" aria-hidden="true" />{t("proxyStatus.checking")}</span>;
  }
  return <span className="status is-idle">{t("proxyStatus.new")}</span>;
}

function Latency({ ms }: { ms: number }) {
  const { tone, fill } = latencyMeter(ms);
  return (
    <span className={`meter ${tone}`}>
      <span><i style={{ width: `${fill}%` }} /></span>
      {ms} ms
    </span>
  );
}
