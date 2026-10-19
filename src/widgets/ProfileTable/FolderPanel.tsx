import { useEffect } from "react";
import { useT } from "../../shared/i18n";
import { useFolders, useProfile } from "../../entities/profile";

// Native drag carries the profile id under our own type, and under text/plain for engines that insist on it.
const readDragId = (e: React.DragEvent) =>
  e.dataTransfer.getData("application/x-shardx-profile") || e.dataTransfer.getData("text/plain");

/// Secondary navigation of the Profiles window: folders with counts. Each one is also a drop
/// target for a dragged row ("All" takes a profile out of its folder).
export function FolderPanel() {
  const t = useT();
  const profiles = useProfile((s) => s.profiles);
  const folder = useProfile((s) => s.folder);
  const dropTarget = useProfile((s) => s.dropTarget);
  const setFolder = useProfile((s) => s.setFolder);
  const setDropTarget = useProfile((s) => s.setDropTarget);
  const setProfileFolder = useProfile((s) => s.setProfileFolder);
  const setFolderModal = useProfile((s) => s.setFolderModal);
  const deleteFolder = useProfile((s) => s.deleteFolder);
  const folders = useFolders();

  // Fall back to "all" when the open folder disappears (its last profile left, or it was deleted).
  useEffect(() => {
    if (folder !== "all" && !folders.includes(folder)) setFolder("all");
  }, [folders, folder, setFolder]);

  // Calling preventDefault on every dragover is what makes an element a valid drop target.
  const drop = (target: string, assignTo: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget !== target) setDropTarget(target);
    },
    onDragLeave: (e: React.DragEvent) => {
      // Moving onto a child of the button is still "over" it.
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      const id = readDragId(e);
      if (id) void setProfileFolder(id, assignTo);
    },
  });

  const item = (id: string, label: string, count: number, assignTo: string) => (
    <button
      key={id}
      type="button"
      className={["nav-item", folder === id && "is-active", dropTarget === (id === "all" ? "__all__" : id) && "is-drop"].filter(Boolean).join(" ")}
      aria-current={folder === id ? "true" : undefined}
      onClick={() => setFolder(id)}
      {...drop(id === "all" ? "__all__" : id, assignTo)}
    >
      {label}
      <span className="count">{count}</span>
    </button>
  );

  return (
    <aside className="panel" aria-label={t("profiles.panelFolders")}>
      <div className="panel-title">{t("profiles.panelFolders")}</div>
      {item("all", t("profiles.folderAll"), profiles.length, "")}
      {folders.map((f) => item(f, f, profiles.filter((p) => p.folder === f).length, f))}
      <div className="panel-actions">
        <button type="button" className="btn btn-text btn-sm" onClick={() => setFolderModal({ profileId: null })}>
          {t("profiles.newFolder")}
        </button>
        {folder !== "all" && (
          <button type="button" className="btn btn-text btn-sm" onClick={() => void deleteFolder(folder)}>
            {t("profiles.deleteFolder", { name: folder })}
          </button>
        )}
      </div>
    </aside>
  );
}
