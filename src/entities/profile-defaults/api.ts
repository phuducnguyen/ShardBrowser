import { invoke } from "@tauri-apps/api/core";

/// The stored defaults, or null before the first save (or in a plain browser with no backend).
export const profileDefaultsGet = () => invoke<unknown>("profile_defaults_get").catch(() => null);

export const profileDefaultsSet = (value: unknown) => invoke<void>("profile_defaults_set", { value });
