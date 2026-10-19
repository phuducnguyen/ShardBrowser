import { useEffect, useMemo, useRef, useState } from "react";
import { FormDialog } from "../../../shared/ui/hv";
import { toast } from "../../../shared/model/toast";
import { useT } from "../../../shared/i18n";
import { PS_SIGNATURES } from "../../../entities/proxyshard";
import type { ProxyEntry } from "../../../entities/proxy";
import { proxySave } from "../../../entities/proxy";
import { psActive, psSignatureSet } from "../../../entities/proxyshard";

export function ProxyEditor({ initial, onClose, onSaved }: {
  initial: ProxyEntry;
  onClose: () => void;
  /** Hands back the saved entry, id included — the caller may want to bind it. */
  onSaved?: (p: ProxyEntry) => void;
}) {
  const t = useT();
  const [p, setP] = useState<ProxyEntry>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hostRef = useRef<HTMLInputElement>(null);
  // DC/ISP proxies imported from a ProxyShard order carry the order id in
  // notes — enables editing their p0f OS signature here.
  const orderId = useMemo(() => {
    const m = initial.notes.match(/ProxyShard order (\d+)/);
    return m ? Number(m[1]) : null;
  }, [initial.notes]);
  const [sig, setSig] = useState("");
  const [curSig, setCurSig] = useState("");
  // Pull the IP's currently-set p0f signature from the order's active list.
  useEffect(() => {
    if (!orderId) return;
    psActive(orderId)
      .then((r) => {
        const found = (r.data ?? []).find((d: any) => d.ip === initial.host);
        const s = found?.signature ?? "";
        setSig(s);
        setCurSig(s);
      })
      .catch(() => {});
  }, [orderId]);
  const save = async () => {
    if (!p.host.trim()) {
      setError(t("proxyEditor.hostRequired"));
      hostRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const saved = await proxySave(p);
      // Apply the p0f signature only when it changed to a non-empty value.
      if (orderId && sig && sig !== curSig) {
        try {
          await psSignatureSet(orderId, [{ ip: p.host, signature: sig }]);
          toast.ok(t("proxyEditor.p0fSet", { sig }));
        } catch (e) { toast.err(t("proxyEditor.p0fFailed", { err: String(e) })); }
      }
      toast.ok(initial.id ? t("proxyEditor.savedToast") : t("proxyEditor.addedToast"));
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast.err(String(e));
      setBusy(false);
    }
  };
  return (
    <FormDialog
      title={initial.id ? t("proxyEditor.editTitle") : t("proxyEditor.newTitle")}
      confirmLabel={t("proxyEditor.saveButton")}
      cancelLabel={t("proxyEditor.cancelButton")}
      confirmDisabled={busy}
      initialFocus={initial.id ? "#pe-name" : "#pe-host"}
      onClose={onClose}
      onConfirm={save}
    >
      <div>
        <label className="label" htmlFor="pe-name">{t("proxyEditor.nameLabel")}</label>
        <input
          id="pe-name"
          className="field"
          autoComplete="off"
          value={p.name}
          placeholder={p.host ? `${p.host}:${p.port}` : t("proxyEditor.namePlaceholder")}
          onChange={(e) => setP({ ...p, name: e.target.value })}
        />
      </div>
      <div className="row2">
        <div>
          <label className="label" htmlFor="pe-kind">{t("proxyEditor.typeLabel")}</label>
          <select
            id="pe-kind"
            className="select"
            value={p.kind}
            onChange={(e) => setP({ ...p, kind: e.target.value as ProxyEntry["kind"] })}
          >
            <option value="socks5">SOCKS5</option>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pe-country">{t("proxyEditor.countryLabel")}</label>
          <input id="pe-country" className="field" autoComplete="off" value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })} />
        </div>
      </div>
      <div className="row2 wide-left">
        <div>
          <label className="label" htmlFor="pe-host">{t("proxyEditor.hostLabel")}</label>
          <input
            id="pe-host"
            ref={hostRef}
            className="field"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            value={p.host}
            onChange={(e) => { setP({ ...p, host: e.target.value }); setError(""); }}
          />
        </div>
        <div>
          <label className="label" htmlFor="pe-port">{t("proxyEditor.portLabel")}</label>
          <input
            id="pe-port"
            className="field"
            type="number"
            min={1}
            max={65535}
            inputMode="numeric"
            value={p.port || ""}
            onChange={(e) => setP({ ...p, port: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      {error && <p className="hint is-error" role="alert">{error}</p>}
      <div className="row2">
        <div>
          <label className="label" htmlFor="pe-user">{t("proxyEditor.usernameLabel")}</label>
          <input id="pe-user" className="field" autoComplete="off" value={p.username} onChange={(e) => setP({ ...p, username: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="pe-pass">{t("proxyEditor.passwordLabel")}</label>
          <input id="pe-pass" className="field" type="password" autoComplete="off" value={p.password} onChange={(e) => setP({ ...p, password: e.target.value })} />
        </div>
      </div>
      {orderId && (
        <div>
          <label className="label" htmlFor="pe-sig">
            {t("proxyEditor.signatureLabel", { n: orderId })}
            {t("proxyEditor.signatureCurrent", { sig: curSig || t("proxyEditor.signatureNone") })}
          </label>
          <select id="pe-sig" className="select" value={sig} onChange={(e) => setSig(e.target.value)}>
            <option value="">{t("proxyEditor.signatureKeep")}</option>
            {PS_SIGNATURES.filter((o) => o.value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}
    </FormDialog>
  );
}
