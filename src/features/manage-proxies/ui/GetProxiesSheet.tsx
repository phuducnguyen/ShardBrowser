import { useEffect, useRef, useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Chips, Icon, Sheet, Tabs, type TabItem } from "../../../shared/ui/hv";
import { toast } from "../../../shared/model/toast";
import { useT } from "../../../shared/i18n";
import { useNav } from "../../../shared/model/navigation";
import { DASHBOARD_URL } from "../../../shared/lib/utils";
import {
  emptyProxy, parseProxyLine, proxyBulkParse, proxyBulkSave, proxySave, useProxy,
  type GetProxiesTab, type ProxyEntry,
} from "../../../entities/proxy";
import { usePsAccount } from "../../../entities/proxyshard";
import { finishAdding } from "../lib/checkProxies";

const PREFIX = "get-proxies";
const KINDS = (): { value: ProxyEntry["kind"]; label: string }[] => [
  { value: "socks5", label: "SOCKS5" },
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
];

/// "Get proxies": the one place proxies come from. Three sources, one sheet.
export function GetProxiesSheet() {
  const t = useT();
  const open = useProxy((s) => s.sheetOpen);
  const tab = useProxy((s) => s.sheetTab);
  const setTab = useProxy((s) => s.setSheetTab);
  const closeSheet = useProxy((s) => s.closeSheet);

  const tabs: TabItem<GetProxiesTab>[] = [
    { id: "proxyshard", label: t("getProxies.tabProxyShard") },
    { id: "import", label: t("getProxies.tabImport") },
    { id: "manual", label: t("getProxies.tabManual") },
  ];

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={t("getProxies.title")}
      closeLabel={t("getProxies.close")}
      initialFocus='[role="tab"][aria-selected="true"]'
    >
      <Tabs label={t("getProxies.tablist")} idPrefix={PREFIX} value={tab} tabs={tabs} onChange={setTab} />
      {tab === "proxyshard" && <ProxyShardTab />}
      {tab === "import" && <ImportTab />}
      {tab === "manual" && <ManualTab />}
    </Sheet>
  );
}

function Panel({ tab, children }: { tab: GetProxiesTab; children: ReactNode }) {
  return (
    <div className="sheet-body" role="tabpanel" id={`${PREFIX}-panel`} aria-labelledby={`${PREFIX}-tab-${tab}`}>
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="note"><Icon name="info" size={20} /><span>{children}</span></div>;
}

/* ---------- ProxyShard ---------- */

function ProxyShardTab() {
  const t = useT();
  const key = usePsAccount((s) => s.key);
  const status = usePsAccount((s) => s.status);
  const me = usePsAccount((s) => s.me);
  const err = usePsAccount((s) => s.err);
  const init = usePsAccount((s) => s.init);
  const saveKey = usePsAccount((s) => s.saveKey);
  const closeSheet = useProxy((s) => s.closeSheet);
  const [draft, setDraft] = useState("");

  useEffect(() => { void init(); }, [init]);
  // The saved key arrives from disk after mount.
  useEffect(() => { setDraft(key ?? ""); }, [key]);

  if (status === "ok") {
    return (
      <>
        <Panel tab="proxyshard">
          <Note>{t("getProxies.psConnected", { email: me?.email ?? "" })}</Note>
          <div className="list">
            <div className="list-row">
              <div className="grow">
                <b>{t("getProxies.psOrders")}</b>
                <small>{t("getProxies.psOrdersCount", { n: me?.active_orders ?? 0 })}</small>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { closeSheet(); useNav.getState().setSection("proxyshard"); }}
              >
                {t("getProxies.psOpenOrders")}
              </button>
            </div>
          </div>
          <p className="hint spaced">{t("getProxies.psOrdersHint")}</p>
        </Panel>
        <div className="sheet-foot">
          <span className="grow" />
          <button type="button" className="btn btn-text" onClick={() => saveKey("")}>{t("getProxies.psDisconnect")}</button>
        </div>
      </>
    );
  }

  const checking = status === "checking";
  const failed = status === "err";
  return (
    <>
      <Panel tab="proxyshard">
        <p className="hint">{t("getProxies.psIntro")}</p>
        <div className="group">
          <label className="label" htmlFor="gp-ps-key">{t("getProxies.psKeyLabel")}</label>
          <input
            id="gp-ps-key"
            className="field"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("getProxies.psKeyPlaceholder")}
            aria-invalid={failed || undefined}
            aria-describedby="gp-ps-err"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) void saveKey(draft); }}
          />
          <p id="gp-ps-err" className="hint is-error tight" role="alert">
            {failed ? err : ""}
          </p>
        </div>
        <Note>
          {t("getProxies.psBuyPart1")}
          <a className="link" href="#" onClick={(e) => { e.preventDefault(); openUrl(DASHBOARD_URL).catch(() => {}); }}>
            {t("getProxies.psBuyLink")}
          </a>
          {t("getProxies.psBuyPart2")}
        </Note>
      </Panel>
      <div className="sheet-foot">
        <span className="grow" />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={checking || !draft.trim()}
          onClick={() => void saveKey(draft)}
        >
          {checking ? <><span className="spin" />{t("getProxies.psConnecting")}</> : t("getProxies.psConnect")}
        </button>
      </div>
    </>
  );
}

/* ---------- Import ---------- */

function ImportTab() {
  const t = useT();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<ProxyEntry["kind"]>("socks5");
  const [parsed, setParsed] = useState<ProxyEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

  // The backend is the one parser; ask it after the typing pauses. A stale answer is dropped.
  useEffect(() => {
    if (lines.length === 0) { setParsed([]); return; }
    let stale = false;
    const timer = setTimeout(() => {
      proxyBulkParse(text, kind).then((r) => { if (!stale) setParsed(r); }, () => { if (!stale) setParsed([]); });
    }, 250);
    return () => { stale = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lines` is derived from `text`
  }, [text, kind]);

  const valid = parsed.length;
  const invalid = Math.max(0, lines.length - valid);

  const run = async () => {
    const before = new Set(useProxy.getState().proxies.map((p) => p.id));
    setBusy(true);
    try {
      const n = await proxyBulkSave(parsed);
      await finishAdding(before, n === 1 ? t("getProxies.importedOne") : t("getProxies.importedMany", { n }));
    } catch (e) {
      toast.err(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Panel tab="import">
        <p className="hint">{t("getProxies.importHint")}</p>
        <div className="group">
          <textarea
            className="field"
            aria-label={t("getProxies.importListLabel")}
            spellCheck={false}
            placeholder={t("getProxies.importPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="group">
          <p className="label">{t("getProxies.importDefaultType")}</p>
          <Chips name="import-kind" label={t("getProxies.connectionType")} value={kind} options={KINDS()} onChange={setKind} />
        </div>
        <div aria-live="polite">
          {lines.length > 0 && (
            <p className="label tight">
              <span className="text-ok">{t("getProxies.importValid", { n: valid })}</span>
              {" · "}
              <span className={invalid ? "text-err" : undefined}>{t("getProxies.importInvalid", { n: invalid })}</span>
            </p>
          )}
          {invalid > 0 && (
            <div className="invalid" role="alert">
              {invalid === 1 ? t("getProxies.importInvalidHintOne") : t("getProxies.importInvalidHint", { n: invalid })}
            </div>
          )}
        </div>
      </Panel>
      <div className="sheet-foot">
        <span className="grow">{valid ? t("getProxies.importReady", { n: valid }) : t("getProxies.importNothing")}</span>
        <button type="button" className="btn btn-primary btn-sm" disabled={valid === 0 || busy} onClick={run}>
          {valid ? t("getProxies.importButtonN", { n: valid }) : t("getProxies.importButton")}
        </button>
      </div>
    </>
  );
}

/* ---------- Manual ---------- */

function ManualTab() {
  const t = useT();
  const [kind, setKind] = useState<ProxyEntry["kind"]>("socks5");
  const [quick, setQuick] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hostRef = useRef<HTMLInputElement>(null);

  const onQuick = (value: string) => {
    setQuick(value);
    const p = parseProxyLine(value);
    if (!p) return;
    setHost(p.host);
    setPort(String(p.port));
    setUser(p.username);
    setPass(p.password);
    if (p.kind) setKind(p.kind);
    setError("");
  };

  const run = async () => {
    const n = Number(port);
    if (!host.trim() || !/^\d+$/.test(port) || n < 1 || n > 65535) {
      setError(t("getProxies.manualError"));
      hostRef.current?.focus();
      return;
    }
    const before = new Set(useProxy.getState().proxies.map((p) => p.id));
    setBusy(true);
    try {
      await proxySave({ ...emptyProxy(), kind, host: host.trim(), port: n, username: user, password: pass });
      await finishAdding(before, t("getProxies.manualDone"));
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Panel tab="manual">
        <div className="group">
          <p className="label">{t("getProxies.connectionType")}</p>
          <Chips name="manual-kind" label={t("getProxies.connectionType")} value={kind} options={KINDS()} onChange={setKind} />
        </div>
        <div className="group">
          <label className="label" htmlFor="gp-quick">{t("getProxies.manualQuick")}</label>
          <input
            id="gp-quick"
            className="field"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("getProxies.manualQuickPlaceholder")}
            value={quick}
            onChange={(e) => onQuick(e.target.value)}
          />
        </div>
        <div className="group">
          <p className="label">{t("getProxies.manualDetails")}</p>
          <div className="fields">
            <div className="row2 wide-left">
              <input
                ref={hostRef}
                className="field"
                aria-label={t("getProxies.manualHost")}
                placeholder={t("getProxies.manualHost")}
                spellCheck={false}
                value={host}
                onChange={(e) => { setHost(e.target.value); setError(""); }}
              />
              <input
                className="field"
                aria-label={t("getProxies.manualPort")}
                placeholder={t("getProxies.manualPort")}
                inputMode="numeric"
                value={port}
                onChange={(e) => { setPort(e.target.value); setError(""); }}
              />
            </div>
            <input
              className="field"
              aria-label={t("getProxies.manualUser")}
              placeholder={t("getProxies.manualUser")}
              autoComplete="off"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <input
              className="field"
              type="password"
              aria-label={t("getProxies.manualPass")}
              placeholder={t("getProxies.manualPass")}
              autoComplete="off"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
        </div>
        <p className="hint is-error" role="alert">{error}</p>
      </Panel>
      <div className="sheet-foot">
        <span className="grow" />
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={run}>{t("getProxies.manualAdd")}</button>
      </div>
    </>
  );
}
