import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { toast } from "../../../shared/lib/toast";
import { t } from "../../../shared/i18n";
import { camoufoxInstall, camoufoxLibrary, camoufoxStatus } from "../model/api";
import type { CamoufoxDevice, CamoufoxStatus, InstallProgress } from "../model/types";

type CamoufoxState = {
  /** Null until the first answer (and when there is no backend). */
  status: CamoufoxStatus | null;
  library: CamoufoxDevice[];
  progress: InstallProgress | null;
  installing: boolean;
  load: () => Promise<void>;
  /** Download and install the pinned release; progress arrives through `progress`. */
  install: (force?: boolean) => Promise<void>;
};

export const useCamoufox = create<CamoufoxState>((set, get) => ({
  status: null,
  library: [],
  progress: null,
  installing: false,

  load: async () => {
    const [status, library] = await Promise.all([camoufoxStatus().catch(() => null), camoufoxLibrary().catch(() => null)]);
    set({ status: status ?? null, library: library ?? [] });
  },

  install: async (force = false) => {
    if (get().installing) return;
    set({ installing: true, progress: null });
    let unlisten: () => void = () => {};
    try {
      unlisten = await listen<InstallProgress>("camoufox:progress", (e) => set({ progress: e.payload }));
      const status = await camoufoxInstall(force);
      set({ status });
      toast.ok(t("camoufox.installedToast"));
    } catch (e) {
      toast.err(t("camoufox.installFailed", { err: String(e) }));
    } finally {
      unlisten();
      set({ installing: false, progress: null });
    }
  },
}));
