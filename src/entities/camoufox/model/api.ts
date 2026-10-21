import { invoke } from "@tauri-apps/api/core";
import type { CamoufoxDevice, CamoufoxStatus } from "./types";

// A plain browser with no backend (or a test with no handler) answers null; callers treat it as "unknown".
export const camoufoxStatus = () => invoke<CamoufoxStatus | null>("camoufox_status");
export const camoufoxLibrary = () => invoke<CamoufoxDevice[] | null>("camoufox_library");
export const camoufoxInstall = (force = false) => invoke<CamoufoxStatus>("camoufox_install", { force });
