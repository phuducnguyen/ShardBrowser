import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { backend } from "../test/tauri";
import { FirstRunGate } from "./FirstRunGate/FirstRunGate";
import { StarModal } from "./StarModal/StarModal";

describe("First-run gate", () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    vi.mocked(listen).mockImplementation(async () => () => {});
  });

  it("lets the app through when the engine is installed and current", async () => {
    backend.reset({
      runtime_status: () => ({ spec: {}, installed: true, fingerprints_installed: true, update_available: false }),
    });
    render(<FirstRunGate><p>app</p></FirstRunGate>);
    expect(await screen.findByText("app")).toBeInTheDocument();
    expect(backend.argsOf("runtime_install")).toHaveLength(0);
  });

  it("downloads first and shows the progress while it runs", async () => {
    let onProgress: (e: { payload: unknown }) => void = () => {};
    vi.mocked(listen).mockImplementation((async (name: string, cb: (e: { payload: unknown }) => void) => {
      if (name === "runtime:progress") onProgress = cb;
      return () => {};
    }) as never);
    backend.reset({
      runtime_status: () => ({ spec: {}, installed: false, fingerprints_installed: false, update_available: false }),
      runtime_install: () => new Promise(() => {}),
    });
    render(<FirstRunGate><p>app</p></FirstRunGate>);
    expect(await screen.findByText("Contacting CDN…")).toBeInTheDocument();
    expect(screen.queryByText("app")).not.toBeInTheDocument();
    act(() => onProgress({ payload: { label: "Engine", phase: "download", received: 5 * 1024 * 1024, total: 10 * 1024 * 1024, percent: 50 } }));
    expect(screen.getByRole("progressbar", { name: "Engine" })).toHaveValue(50);
    expect(screen.getByText(/5\.0 MB \/ 10\.0 MB/)).toBeInTheDocument();
  });

  it("shows a failed install as an alert", async () => {
    backend.reset({
      runtime_status: () => ({ spec: {}, installed: false, fingerprints_installed: false, update_available: false }),
      runtime_install: () => { throw "CDN unreachable"; },
    });
    render(<FirstRunGate><p>app</p></FirstRunGate>);
    expect(await screen.findByRole("alert")).toHaveTextContent("CDN unreachable");
    expect(screen.queryByText("app")).not.toBeInTheDocument();
  });
});

describe("Star prompt", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); vi.mocked(openUrl).mockClear(); });

  it("appears once, then stays away after Maybe later", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<StarModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(screen.getByRole("dialog", { name: "Enjoying ShardX?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Maybe later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("shardx-star-prompt")).toBe("done");
    unmount();
    render(<StarModal />);
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the repository from the star button and is remembered", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StarModal />);
    await act(async () => { vi.advanceTimersByTime(800); });
    await user.click(screen.getByRole("button", { name: "Star on GitHub" }));
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("shardx-star-prompt")).toBe("done");
  });
});
