import { useEffect, useMemo, useState } from "react";
import { FormDialog, Icon, Window } from "../../shared/ui/hv";
import { useStoreChanged } from "../../shared/hooks/useStoreChanged";
import { useExtensions, type ExtensionEntry } from "../../entities/extension";
import { fmtBytes } from "../../shared/lib/utils";
import { useT } from "../../shared/i18n";

function Card({ e }: { e: ExtensionEntry }) {
  const t = useT();
  const remove = useExtensions((s) => s.remove);
  return (
    <article className="ext-card">
      <div className="ext-head">
        {e.icon ? (
          <img src={e.icon} alt="" className="ext-ico" />
        ) : (
          <div className="ext-ico is-blank"><Icon name="puzzle" size={22} /></div>
        )}
        <div className="ext-meta">
          <h3 title={e.name}>{e.name}</h3>
          <div className="sub">
            {e.version && <span>v{e.version} · </span>}
            <span>{fmtBytes(e.size_bytes)}</span>
          </div>
        </div>
      </div>
      <p className="ext-desc">{e.description || <span className="soft">{t("extensions.noDescription")}</span>}</p>
      <div className="fp-foot">
        <button type="button" className="btn btn-danger btn-sm push" onClick={() => remove(e)}>
          <Icon name="trash" size={18} />{t("extensions.remove")}
        </button>
      </div>
    </article>
  );
}

/** Add by address: a Web Store page, a bare id, or a .crx / .zip link. */
function LinkDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const busy = useExtensions((s) => s.busy);
  const importUrl = useExtensions((s) => s.importUrl);
  return (
    <FormDialog
      mid
      title={t("extensions.linkTitle")}
      confirmLabel={busy ? t("extensions.downloading") : t("extensions.download")}
      cancelLabel={t("extensions.cancel")}
      confirmDisabled={busy || !url.trim()}
      initialFocus="#ext-url"
      onClose={onClose}
      onConfirm={() => importUrl(url)}
    >
      <div>
        <label className="label" htmlFor="ext-url">{t("extensions.linkFieldLabel")}</label>
        <input
          id="ext-url"
          className="field"
          autoComplete="off"
          spellCheck={false}
          value={url}
          placeholder="https://chromewebstore.google.com/detail/…"
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <p className="hint">{t("extensions.linkHelp")}</p>
    </FormDialog>
  );
}

export function ExtensionsPage() {
  const t = useT();
  const init = useExtensions((s) => s.init);
  const items = useExtensions((s) => s.items);
  const busy = useExtensions((s) => s.busy);
  const search = useExtensions((s) => s.search);
  const setSearch = useExtensions((s) => s.setSearch);
  const importFiles = useExtensions((s) => s.importFiles);
  const importFolder = useExtensions((s) => s.importFolder);
  const linkOpen = useExtensions((s) => s.linkOpen);
  const setLinkOpen = useExtensions((s) => s.setLinkOpen);

  const reload = useExtensions((s) => s.reload);
  useEffect(() => { init(); }, [init]);
  // Pick up extensions added through the automation API.
  useStoreChanged(reload);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <>
      <Window
        single
        title={t("extensions.title")}
        actions={
          <>
            <button type="button" className="btn btn-text btn-sm" disabled={busy} onClick={importFolder}>
              <Icon name="folder" size={18} />{t("extensions.unpackedFolder")}
            </button>
            <button type="button" className="btn btn-text btn-sm" disabled={busy} onClick={() => setLinkOpen(true)}>
              <Icon name="link" size={18} />{t("extensions.fromLink")}
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={importFiles}>
              <Icon name="plus" />{t("extensions.addFiles")}
            </button>
          </>
        }
      >
        <div className="card stack clip">
          <div className="toolbar">
            <p className="hint" style={{ margin: 0 }}>{t("extensions.pageHelp")}</p>
            <span className="grow" />
            <label className="search">
              <Icon name="search" size={18} />
              <span className="sr-only">{t("extensions.searchLabel")}</span>
              <input type="search" placeholder={t("extensions.searchPlaceholder")} autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
          <div className="fp-body">
            {shown.length === 0 ? (
              <div className="empty-hero">
                <div className="empty-ico"><Icon name="puzzle" size={26} /></div>
                <h3>{items.length === 0 ? t("extensions.emptyTitle") : t("extensions.noMatchTitle")}</h3>
                <p>{t("extensions.emptyHelp")}</p>
              </div>
            ) : (
              <div className="fp-grid ext-grid">
                {shown.map((e) => <Card key={e.id} e={e} />)}
              </div>
            )}
          </div>
        </div>
      </Window>
      {linkOpen && <LinkDialog onClose={() => setLinkOpen(false)} />}
    </>
  );
}
