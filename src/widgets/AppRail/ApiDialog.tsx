import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Icon } from "../../shared/ui/hv";
import { clip } from "../../shared/lib/clipboard";
import { toast } from "../../shared/model/toast";
import { withUtm } from "../../shared/lib/utils";
import { useT } from "../../shared/i18n";
import { useDownloadMcp } from "../../features/DownloadMcp";

const DOCS_URL = "https://docs.proxyshard.com/eng/shardx-launcher-api/binding-and-lifecycle?fallback=true";

/// The local automation API in one place: where it listens, the MCP bundle, the docs.
/// Reached from the rail; it replaces the card that used to sit at the bottom of the sidebar.
export function ApiDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // null while loading, "" when the API is off.
  const [url, setUrl] = useState<string | null>(null);
  const mcp = useDownloadMcp();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>(".actions button")?.focus({ focusVisible: false } as FocusOptions);
    } else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setUrl(null);
    invoke<{ base_url: string; enabled: boolean }>("api_info")
      .then((i) => setUrl(i.enabled ? i.base_url : ""))
      .catch(() => setUrl(""));
  }, [open]);

  const copy = () => {
    if (!url) return;
    clip.write(url).then(
      () => toast.ok(t("apiDialog.copied")),
      (e) => toast.err(String(e)),
    );
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={onClose}>
      {open && (
        <>
          <h2 id={titleId}>{t("apiDialog.title")}</h2>
          <p>{url === null ? t("apiDialog.loading") : url ? t("apiDialog.on") : t("apiDialog.off")}</p>
          <div className="list spaced">
            {url && (
              <div className="list-row">
                <div className="grow"><b className="mono">{url.replace(/^https?:\/\//, "")}</b></div>
                <button type="button" className="icon-btn" aria-label={t("apiDialog.copy")} title={t("apiDialog.copy")} onClick={copy}>
                  <Icon name="copy" />
                </button>
              </div>
            )}
            <div className="list-row">
              <div className="grow"><b>{t("apiDialog.mcp")}</b></div>
              <button type="button" className="btn btn-secondary btn-sm" disabled={mcp.busy} onClick={() => void mcp.run()}>
                {mcp.busy ? t("downloadMcp.downloading") : t("downloadMcp.action")}
              </button>
            </div>
            <div className="list-row">
              <div className="grow"><b>{t("apiDialog.docs")}</b></div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { openUrl(withUtm(DOCS_URL)).catch(() => {}); }}>
                {t("apiDialog.openDocs")}
              </button>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn btn-text" onClick={onClose}>{t("apiDialog.close")}</button>
          </div>
        </>
      )}
    </dialog>
  );
}
