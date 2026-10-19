import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncompatibleWarningModal } from "./IncompatibleNotice";
import { useGpuCompat } from "../../../shared/model/gpuCompat";
import type { GpuCompat } from "../../../entities/fingerprint/model/types";

const compat: GpuCompat = {
  compatible: false,
  missing_webgl1: ["WEBGL_compressed_texture_astc"],
  missing_webgl2: [],
  missing_webgpu: ["texture-compression-astc"],
  profile_renderer: "Apple M2",
};

beforeEach(() => {
  localStorage.clear();
  useGpuCompat.setState({ ...useGpuCompat.getInitialState(), caps: { renderer: "Test GPU" } as never, suppressed: false }, true);
});

describe("IncompatibleWarningModal", () => {
  it("explains what the profile claims against what this machine has, WebGPU included", () => {
    render(<IncompatibleWarningModal compat={compat} onKeep={() => {}} onCancel={() => {}} />);
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText("Apple M2")).toBeInTheDocument();
    expect(within(dlg).getByText("Test GPU")).toBeInTheDocument();
    expect(within(dlg).getAllByText("WEBGL_compressed_texture_astc").length).toBeGreaterThan(0);
    expect(within(dlg).getByText("texture-compression-astc")).toBeInTheDocument();
  });

  it("keeps the fingerprint only on a deliberate click, never on Enter", async () => {
    const user = userEvent.setup();
    const onKeep = vi.fn();
    const onCancel = vi.fn();
    render(<IncompatibleWarningModal compat={compat} onKeep={onKeep} onCancel={onCancel} />);
    // Focus starts on the safe choice, so a stray Enter cancels instead of confirming.
    expect(screen.getByRole("button", { name: "Pick another" })).toHaveFocus();
    await user.click(screen.getByRole("checkbox"));
    await user.keyboard("{Enter}");
    expect(onKeep).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Use it anyway" }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("remembers 'don't warn again' only when it was ticked and the fingerprint was kept", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<IncompatibleWarningModal compat={compat} onKeep={() => {}} onCancel={() => {}} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Pick another" }));
    expect(useGpuCompat.getState().suppressed).toBe(false);
    unmount();

    render(<IncompatibleWarningModal compat={compat} onKeep={() => {}} onCancel={() => {}} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Use it anyway" }));
    expect(useGpuCompat.getState().suppressed).toBe(true);
    expect(localStorage.getItem("shardx.gpuCompat.suppressWarning")).toBe("1");
  });
});
