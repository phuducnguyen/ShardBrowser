import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// The Tauri bridge does not exist in jsdom. Every UI test talks to the fake in ./tauri instead;
// a test sets `backend.handlers` for the commands it cares about.
vi.mock("@tauri-apps/api/core", () => import("./tauri").then((m) => m.coreMock));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}), emit: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => null) }));

// Node 25 ships an experimental global `localStorage` that shadows jsdom's and has no methods unless
// Node was started with --localstorage-file. Tests get a plain in-memory one instead.
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof globalThis[name]?.getItem !== "function") {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true });
  }
}

// A few test files opt out of jsdom with `// @vitest-environment node`; the DOM parts below skip themselves there.
const hasDom = typeof window !== "undefined";

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  try { localStorage.clear(); } catch { /* storage blocked */ }
});

if (hasDom) {
  // jsdom does not implement modal <dialog>; the app runs in Chromium (WebView2),
  // where it exists. This mirrors the two behaviours the code relies on: `open`
  // toggles, and `close()` fires a `close` event.
  const open = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.show = open;
  HTMLDialogElement.prototype.showModal = open;
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };

  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
