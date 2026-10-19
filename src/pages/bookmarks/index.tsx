import { useEffect, useMemo, useState } from "react";
import { FormDialog, Icon, Window } from "../../shared/ui/hv";
import { useStoreChanged } from "../../shared/hooks/useStoreChanged";
import { useBookmarks, emptyBookmark, type Bookmark } from "../../entities/bookmark";
import { useFolders, useProfile } from "../../entities/profile";
import { useT } from "../../shared/i18n";

function Editor({ initial, folders, onClose }: {
  initial: Bookmark;
  folders: string[];
  onClose: () => void;
}) {
  const t = useT();
  const [b, setB] = useState(initial);
  const save = useBookmarks((s) => s.save);
  return (
    <FormDialog
      title={initial.id ? t("bookmarks.editTitle") : t("bookmarks.newTitle")}
      confirmLabel={t("bookmarks.save")}
      cancelLabel={t("bookmarks.cancel")}
      initialFocus="#bm-url"
      onClose={onClose}
      onConfirm={() => save(b)}
    >
      <div>
        <label className="label" htmlFor="bm-url">{t("bookmarks.urlLabel")}</label>
        <input
          id="bm-url"
          className="field"
          autoComplete="off"
          spellCheck={false}
          value={b.url}
          placeholder="facebook.com/ads/manager"
          onChange={(e) => setB({ ...b, url: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="bm-title">{t("bookmarks.titleLabel")}</label>
        <input
          id="bm-title"
          className="field"
          autoComplete="off"
          value={b.title}
          placeholder={t("bookmarks.titlePlaceholder")}
          onChange={(e) => setB({ ...b, title: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="bm-folder">{t("bookmarks.folderLabel")}</label>
        <select id="bm-folder" className="select" value={b.folder} onChange={(e) => setB({ ...b, folder: e.target.value })}>
          <option value="">{t("bookmarks.folderAnyOption")}</option>
          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <p className="hint">
        {t("bookmarks.hintPart1")}<strong>ShardX</strong>{t("bookmarks.hintPart2")}
      </p>
    </FormDialog>
  );
}

export function BookmarksPage() {
  const t = useT();
  const init = useBookmarks((s) => s.init);
  const items = useBookmarks((s) => s.items);
  const editing = useBookmarks((s) => s.editing);
  const setEditing = useBookmarks((s) => s.setEditing);
  const remove = useBookmarks((s) => s.remove);
  const search = useBookmarks((s) => s.search);
  const setSearch = useBookmarks((s) => s.setSearch);
  const folder = useBookmarks((s) => s.folder);
  const setFolder = useBookmarks((s) => s.setFolder);

  const initProfiles = useProfile((s) => s.init);
  const folders = useFolders();
  const profiles = useProfile((s) => s.profiles);

  const reload = useBookmarks((s) => s.reload);
  useEffect(() => { init(); initProfiles(); }, [init, initProfiles]);
  useStoreChanged(reload);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (b) =>
        (folder === "all" || b.folder === (folder === "__any__" ? "" : folder)) &&
        (!q || b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)),
    );
  }, [items, search, folder]);

  const countIn = (f: string) =>
    f === "" ? profiles.length : profiles.filter((p) => p.folder === f).length;

  const tabs = [
    { id: "all", label: t("bookmarks.tabAll"), count: items.length },
    { id: "__any__", label: t("bookmarks.tabEveryProfile"), count: items.filter((b) => b.folder === "").length },
    ...folders.map((f) => ({ id: f, label: f, count: items.filter((b) => b.folder === f).length })),
  ];

  return (
    <>
      <Window
        title={t("bookmarks.heading")}
        actions={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setEditing(emptyBookmark(folder === "all" || folder === "__any__" ? "" : folder))}
          >
            <Icon name="plus" />{t("bookmarks.newButton")}
          </button>
        }
      >
        <aside className="panel" aria-label={t("bookmarks.folderLabel")}>
          <div className="panel-title">{t("bookmarks.folderLabel")}</div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === folder ? "nav-item is-active" : "nav-item"}
              aria-current={tab.id === folder ? "true" : undefined}
              onClick={() => setFolder(tab.id)}
            >
              {tab.label}
              <span className="count">{tab.count}</span>
            </button>
          ))}
        </aside>
        <div className="card stack clip">
          <div className="toolbar">
            <p className="hint" style={{ margin: 0 }}>{t("bookmarks.subtitle")}</p>
            <span className="grow" />
            <label className="search">
              <Icon name="search" size={18} />
              <span className="sr-only">{t("bookmarks.searchLabel")}</span>
              <input type="search" placeholder={t("bookmarks.searchPlaceholder")} autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
          <div className="table-wrap">
            {shown.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>{t("bookmarks.titleLabel")}</th>
                    <th>{t("bookmarks.urlLabel")}</th>
                    <th>{t("bookmarks.folderLabel")}</th>
                    <th><span className="sr-only">{t("bookmarks.colActions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <button type="button" className="link-btn" title={t("bookmarks.editTooltip")} onClick={() => setEditing(b)}>
                          {b.title || b.url}
                        </button>
                      </td>
                      <td className="mono"><span className="ellip" title={b.url}>{b.url}</span></td>
                      <td>
                        {b.folder
                          ? countIn(b.folder) === 1
                            ? t("bookmarks.folderProfileCountOne", { folder: b.folder })
                            : t("bookmarks.folderProfileCount", { folder: b.folder, n: countIn(b.folder) })
                          : t("bookmarks.everyProfileCount", { n: profiles.length })}
                      </td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(b)}>
                          <Icon name="trash" size={18} />{t("bookmarks.delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {shown.length === 0 && (
              <div className="empty-hero">
                <div className="empty-ico"><Icon name="bookmark" size={26} /></div>
                <h3>{items.length === 0 ? t("bookmarks.emptyTitle") : t("bookmarks.emptyFolderTitle")}</h3>
                <p>{t("bookmarks.emptyHint")}</p>
              </div>
            )}
          </div>
        </div>
      </Window>
      {editing && <Editor initial={editing} folders={folders} onClose={() => setEditing(null)} />}
    </>
  );
}
