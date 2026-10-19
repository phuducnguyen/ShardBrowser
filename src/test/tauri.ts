import { vi } from "vitest";

/// Shared fake of the Tauri IPC for UI tests, wired in by setup.ts. A test sets
/// `backend.handlers` per scenario; every call is recorded in `backend.calls`.
export type Handler = (args: Record<string, unknown>) => unknown;

export const backend = {
  handlers: {} as Record<string, Handler>,
  calls: [] as { cmd: string; args: Record<string, unknown> }[],
  reset(handlers: Record<string, Handler> = {}) {
    this.handlers = handlers;
    this.calls = [];
  },
  /** Arguments of every call to `cmd`, in order. */
  argsOf(cmd: string) {
    return this.calls.filter((c) => c.cmd === cmd).map((c) => c.args);
  },
};

export const coreMock = {
  invoke: vi.fn(async (cmd: string, args: Record<string, unknown> = {}) => {
    backend.calls.push({ cmd, args });
    const h = backend.handlers[cmd];
    // An unhandled command resolves to null, like a backend command returning ().
    return h ? h(args) : null;
  }),
};
