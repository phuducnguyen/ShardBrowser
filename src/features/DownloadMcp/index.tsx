import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "../../shared/model/toast";
import { useT } from "../../shared/i18n";

/// Asks for a folder, then writes the MCP bundle into it. The button that calls
/// it lives wherever the layout wants it; this owns only the flow and its state.
export function useDownloadMcp() {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const dir = await open({ directory: true, title: t("downloadMcp.dirPickerTitle") });
    if (typeof dir !== "string") return;
    setBusy(true);
    try {
      const p = await invoke<string>("mcp_download", { dir });
      toast.ok(t("downloadMcp.downloadedTo", { path: p }));
    } catch (e) {
      toast.err(t("downloadMcp.downloadFailed", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return { busy, run };
}
