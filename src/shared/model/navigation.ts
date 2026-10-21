import { create } from "zustand";
import type { Section } from "../types";

const RAIL_KEY = "herov.rail.wide";

/// Wide (icon + label) unless the person collapsed it last time. Storage can be blocked, so it never throws.
function readRailWide(): boolean {
  try { return localStorage.getItem(RAIL_KEY) !== "0"; } catch { return true; }
}

/// App-level navigation state (active sidebar section, and whether the rail shows labels).
type NavState = {
  section: Section;
  setSection: (section: Section) => void;
  railWide: boolean;
  toggleRail: () => void;
};

export const useNav = create<NavState>((set, get) => ({
  section: "browsers",
  setSection: (section) => set({ section }),
  railWide: readRailWide(),
  toggleRail: () => {
    const next = !get().railWide;
    set({ railWide: next });
    try { localStorage.setItem(RAIL_KEY, next ? "1" : "0"); } catch { /* not persisted; still applies this session */ }
  },
}));
