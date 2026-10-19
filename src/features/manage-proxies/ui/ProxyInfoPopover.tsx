import { useEffect, useState } from "react";
import { CountryFlag } from "../../../shared/ui/CountryFlag";
import { toast } from "../../../shared/model/toast";
import { fmtTs } from "../../../shared/lib/utils";
import { useT } from "../../../shared/i18n";
import type { ProxyEntry, ProxyTestSnapshot } from "../../../entities/proxy";
import { proxyHistory } from "../../../entities/proxy";

/// Proxy detail popover: latest IP/geo + UDP + IP-change history.
export function ProxyInfoPopover({
  proxy, anchor, latest, onClose,
}: {
  proxy: ProxyEntry;
  anchor: { x: number; y: number };
  latest?: ProxyTestSnapshot;
  onClose: () => void;
}) {
  const t = useT();
  const [history, setHistory] = useState<ProxyTestSnapshot[]>([]);
  useEffect(() => {
    proxyHistory(proxy.id)
      .then((h) => setHistory([...h].reverse()))
      .catch((e) => toast.err(String(e)));
  }, [proxy.id]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".info-pop")) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Clamp inside viewport to avoid clipping at the right edge.
  const left = Math.min(anchor.x, window.innerWidth - 360);
  const top = Math.min(anchor.y + 8, window.innerHeight - 320);
  const where = latest
    ? [latest.region, latest.city].filter(Boolean).join(", ") || latest.country || "—"
    : "—";

  return (
    <div className="hv" style={{ display: "contents" }}>
      <div
        className="info-pop"
        role="dialog"
        aria-label={proxy.name || `${proxy.host}:${proxy.port}`}
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {latest?.ip ? (
          <>
            <dl>
              <dt>IP</dt>
              <dd className="mono">{latest.ip}</dd>
              <dt>{t("proxyInfoPopover.location")}</dt>
              <dd>
                {latest.country_code && <CountryFlag cc={latest.country_code} height={14} />}
                <span>{where}</span>
              </dd>
              {latest.timezone && (<><dt>{t("proxyInfoPopover.timezone")}</dt><dd>{latest.timezone}</dd></>)}
              {latest.isp && (<><dt>ISP</dt><dd>{latest.isp}</dd></>)}
            </dl>
            <div className="pills">
              <span className={latest.tcp_ms != null ? "status" : "status is-error"}>
                TCP {latest.tcp_ms != null ? `${latest.tcp_ms} ms` : "✗"}
              </span>
              {proxy.kind === "socks5" && (
                <span className={latest.udp_ms != null ? "status" : "status is-error"} title={latest.udp_error ?? undefined}>
                  UDP {latest.udp_ms != null ? `${latest.udp_ms} ms` : "✗"}
                </span>
              )}
            </div>
            {latest.geo_error && (
              <div className="geo-err" role="alert">{t("proxyInfoPopover.geoError", { error: latest.geo_error })}</div>
            )}
          </>
        ) : (
          <div className="none">{t("proxyInfoPopover.notTested")}</div>
        )}
        <h3>{t("proxyInfoPopover.historyTitle")}</h3>
        <div className="info-hist">
          {history.length === 0 && <div className="none">{t("proxyInfoPopover.historyEmpty")}</div>}
          {history.map((s, i) => (
            <div key={`${s.ip}-${s.first_seen}-${i}`}>
              <div className="ip">
                <span className="mono">{s.ip || "—"}</span>
                {s.country_code && <CountryFlag cc={s.country_code} />}
                {s.city && <span>{s.city}</span>}
              </div>
              <div className="when">
                {fmtTs(s.first_seen)}
                {s.first_seen !== s.last_seen && <> → {fmtTs(s.last_seen)}</>}
                {s.udp_ms != null && <> · UDP ✓</>}
                {s.udp_error && <> · UDP ✗</>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
