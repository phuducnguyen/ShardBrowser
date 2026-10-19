import { create } from "zustand";
import { profileDefaultsGet, profileDefaultsSet } from "./api";
import { STORAGE_KEY, factoryDefaults, sanitizeDefaults, type ProfileDefaults } from "./model";

function read(): ProfileDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitizeDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return factoryDefaults();
  }
}

function write(d: ProfileDefaults) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* storage blocked: defaults last for this session */ }
}

/// The backend file (`profile-defaults.json`) is the source of truth; local storage is a cache that
/// lets the first screen use the right values before the backend has answered, and carries over what
/// an earlier build kept only there.
type State = {
  defaults: ProfileDefaults;
  /// Reads the backend once at start-up. Never throws: with no backend the cache stands.
  hydrate: () => Promise<void>;
  /// Updates the app at once and the file after; rejects if the file could not be written.
  save: (d: ProfileDefaults) => Promise<void>;
  reset: () => Promise<void>;
};

const hasCache = () => { try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; } };

export const useProfileDefaults = create<State>((set) => ({
  defaults: read(),
  hydrate: async () => {
    const stored = await profileDefaultsGet();
    if (stored) {
      const clean = sanitizeDefaults(stored);
      write(clean);
      set({ defaults: clean });
    } else if (hasCache()) {
      // First start on a backend that has the file feature: move over what the cache holds.
      const cached = read();
      set({ defaults: cached });
      await profileDefaultsSet(cached).catch(() => {});
    }
  },
  save: async (d) => {
    const clean = sanitizeDefaults(d);
    write(clean);
    set({ defaults: clean });
    await profileDefaultsSet(clean);
  },
  reset: async () => {
    const f = factoryDefaults();
    write(f);
    set({ defaults: f });
    await profileDefaultsSet(f);
  },
}));
