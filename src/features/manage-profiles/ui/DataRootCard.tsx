import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { Icon } from "../../../shared/ui/hv";
import { toast } from "../../../shared/model/toast";
import { confirmModal } from "../../../shared/lib/confirm";
import { t, useT } from "../../../shared/i18n";
import {
  dataRootGet, dataRootMigrate,
  type DataRootInfo, type MigrationProgress,
} from "../../../entities/settings";

// Getters: the map is built at import time, so the language has to be read
// when the phase is shown, not here.
const PHASE_LABEL: Record<MigrationProgress["phase"], string> = {
  get scan() { return t("dataRootCard.phaseScan"); },
  get copy() { return t("dataRootCard.phaseCopy"); },
  get verify() { return t("dataRootCard.phaseVerify"); },
  get cleanup() { return t("dataRootCard.phaseCleanup"); },
  get done() { return t("dataRootCard.phaseDone"); },
};

/** Where profiles, user-data, extensions and the trash live. The move copies,
 *  verifies, then deletes; the backend refuses launches while it runs. */
export function DataRootCard() {
  const t = useT();
  const [info, setInfo] = useState<DataRootInfo | null>(null);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);

  const refresh = () => dataRootGet().then(setInfo).catch(() => {});
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    let un: (() => void) | undefined;
    let disposed = false;
    listen<MigrationProgress>("data-migration", (e) => {
      setProgress(e.payload.phase === "done" ? null : e.payload);
    }).then((fn) => { if (disposed) fn(); else un = fn; });
    return () => { disposed = true; un?.(); };
  }, []);

  const running = progress !== null;

  const move = async () => {
    const dir = await open({ directory: true, title: t("dataRootCard.pickFolderTitle") });
    if (typeof dir !== "string") return;
    const ok = await confirmModal({
      title: t("dataRootCard.confirmTitle"),
      message: t("dataRootCard.confirmMessage", { dir }),
      buttons: [
        { label: t("dataRootCard.cancel"), value: false },
        { label: t("dataRootCard.moveAction"), value: true, primary: true },
      ],
    });
    if (ok !== true) return;
    setProgress({ phase: "scan", done: 0, total: 0, percent: 0, current: "" });
    try {
      const n = await dataRootMigrate(dir);
      toast.ok(n === 1 ? t("dataRootCard.movedOne") : t("dataRootCard.movedMany", { n }));
    } catch (e) {
      toast.err(String(e));
    } finally {
      setProgress(null);
      refresh();
    }
  };

  return (
    <div>
      <p className="hint">{t("dataRootCard.intro")}</p>
      <p className="label">
        {t("dataRootCard.currentLocation")}
        {info && !info.custom && <span className="soft">{t("dataRootCard.defaultSuffix")}</span>}
      </p>
      <div className="copy-row">
        <span className="path-box" title={info?.path}>{info?.path ?? "…"}</span>
        <button
          type="button"
          className="btn btn-text btn-sm"
          disabled={!info || running}
          onClick={() => info && openPath(info.path).catch(() => toast.err(t("dataRootCard.openFailed")))}
        >
          {t("dataRootCard.reveal")}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={running} onClick={move}>
          <Icon name="folder" size={18} />{t("dataRootCard.change")}
        </button>
      </div>

      {progress && (
        <div className="progress-box" role="status">
          <div className="row">
            <strong>{PHASE_LABEL[progress.phase]}</strong>
            <span className="soft">{progress.total > 0 ? `${progress.done} / ${progress.total}` : ""}</span>
          </div>
          <progress className="bar" value={progress.percent} max={100} aria-label={PHASE_LABEL[progress.phase]} />
          {progress.current && <span className="soft small ellip-line">{progress.current}</span>}
        </div>
      )}
    </div>
  );
}
