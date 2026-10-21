import { useRef } from "react";
import { CountryFlag } from "../../shared/ui/CountryFlag";
import { Icon, KebabMenu } from "../../shared/ui/hv";
import { fmtTs, fmtUptime } from "../../shared/lib/utils";
import { useT } from "../../shared/i18n";
import { useProfile, type ProfileMeta } from "../../entities/profile";
import type { ProxyEntry } from "../../entities/proxy";

export function ProfileRow({ profile: p, proxy }: { profile: ProfileMeta; proxy: ProxyEntry | null }) {
  const t = useT();
  const isRunning = useProfile((s) => !!s.running[p.id]);
  const since = useProfile((s) => s.running[p.id]);
  const starting = useProfile((s) => s.startBusy.has(p.id));
  const selected = useProfile((s) => s.selected.has(p.id));
  const startStop = useProfile((s) => s.startStop);
  const togglePin = useProfile((s) => s.togglePin);
  const cloneProfile = useProfile((s) => s.cloneProfile);
  const remove = useProfile((s) => s.remove);
  const expand = useProfile((s) => s.expand);
  const toggleSelect = useProfile((s) => s.toggleSelect);
  const selectRangeTo = useProfile((s) => s.selectRangeTo);
  const setQuickEdit = useProfile((s) => s.setQuickEdit);
  const setFolderModal = useProfile((s) => s.setFolderModal);
  const setProfileFolder = useProfile((s) => s.setProfileFolder);
  const exportCookies = useProfile((s) => s.exportCookies);
  const importCookies = useProfile((s) => s.importCookies);
  // A shift-press selects a run in mousedown; the change event that follows must not toggle it again.
  const shiftPress = useRef(false);

  const live = isRunning && since ? Date.now() - since : 0;
  const total = p.total_runtime_ms + live;

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    // Our own type lets other drop zones ignore it; text/plain is what some engines require to start a drag at all.
    e.dataTransfer.setData("application/x-shardx-profile", p.id);
    e.dataTransfer.setData("text/plain", p.id);
    // A small chip instead of the full-row ghost, which would cover the folder list and stop the drop landing.
    const chip = document.createElement("div");
    chip.className = "drag-chip";
    chip.textContent = p.name || p.id.slice(0, 8);
    document.body.appendChild(chip);
    e.dataTransfer.setDragImage(chip, 12, 12);
    setTimeout(() => chip.remove(), 0);
  };

  return (
    <tr data-id={p.id} draggable onDragStart={onDragStart}>
      <td>
        <input
          className="chk"
          type="checkbox"
          aria-label={t("profileRow.select", { name: p.name })}
          checked={selected}
          onMouseDown={(e) => {
            shiftPress.current = e.shiftKey;
            if (e.shiftKey) { e.preventDefault(); selectRangeTo(p.id); }
          }}
          onChange={() => {
            if (shiftPress.current) { shiftPress.current = false; return; }
            toggleSelect(p.id);
          }}
        />
      </td>
      <td>
        <span className="name">
          {p.pinned && <span className="dim" title={t("profileRow.pinnedTitle")}><Icon name="pin" size={14} /><span className="sr-only">{t("profileRow.pinnedTitle")}</span></span>}
          <button type="button" className="name-btn" onClick={() => void expand(p.id)}>{p.name}</button>
        </span>
        <span className="sub">
          {p.engine === "camoufox" && <><span className="engine-tag">{t("deviceSection.engineCamoufox")}</span>{" · "}</>}
          {p.notes || p.id.slice(0, 8)}
        </span>
      </td>
      <td>
        <span className={isRunning ? "status" : "status is-idle"}>
          {isRunning ? t("profileRow.statusRunning") : t("profileRow.statusIdle")}
        </span>
        {total > 0 && <span className="sub">{isRunning ? fmtUptime(total) : t("profileRow.totalRuntime", { time: fmtUptime(total) })}</span>}
      </td>
      <td>
        <button type="button" className="name-btn" title={t("profileRow.changeProxyTitle")} onClick={() => setQuickEdit({ kind: "proxy", profile: p })}>
          {proxy ? (
            <span className="loc">
              {proxy.country && <CountryFlag cc={proxy.country} height={14} />}
              {proxy.kind.toUpperCase()} · {proxy.host}:{proxy.port}
            </span>
          ) : <span className="dim">{t("profileRow.noProxy")}</span>}
        </button>
      </td>
      <td>{p.last_launched_at ? fmtTs(p.last_launched_at) : <span className="dim">{t("profileRow.neverLaunched")}</span>}</td>
      <td className="actions-cell">
        <button
          type="button"
          className={isRunning ? "btn-run is-stop" : "btn-run"}
          disabled={!isRunning && starting}
          onClick={() => void startStop(p)}
        >
          {isRunning ? t("profileRow.stop") : starting ? t("profileRow.starting") : t("profileRow.start")}
        </button>
        <KebabMenu
          label={t("profileRow.actions", { name: p.name })}
          items={[
            { label: t("profileRow.menuEdit"), onSelect: () => void expand(p.id) },
            { label: t("profileRow.menuClone"), onSelect: () => void cloneProfile(p.id) },
            { label: p.pinned ? t("profileRow.menuUnpin") : t("profileRow.menuPin"), onSelect: () => void togglePin(p) },
            { label: t("profileRow.menuChangeProxy"), onSelect: () => setQuickEdit({ kind: "proxy", profile: p }) },
            { label: t("profileRow.menuEditNotes"), onSelect: () => setQuickEdit({ kind: "notes", profile: p }) },
            { label: t("profileRow.menuMoveToFolder"), onSelect: () => setFolderModal({ profileId: p.id }) },
            ...(p.folder ? [{ label: t("profileRow.menuRemoveFromFolder"), onSelect: () => void setProfileFolder(p.id, "") }] : []),
            { label: t("profileRow.menuExportCookies"), onSelect: () => void exportCookies(p) },
            { label: t("profileRow.menuImportCookies"), onSelect: () => void importCookies(p) },
            { label: t("profileRow.menuDelete"), onSelect: () => void remove(p.id), danger: true },
          ]}
        />
      </td>
    </tr>
  );
}
