import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FingerprintsPage } from "./index";
import { ConfirmHost } from "../../widgets/ConfirmHost/ConfirmHost";
import { ToastHost } from "../../widgets/ToastHost/ToastHost";
import { useFingerprint, type FingerprintEntry } from "../../entities/fingerprint";
import { useGpuCompat } from "../../shared/model/gpuCompat";
import { useToastStore } from "../../shared/model/toast";
import { backend } from "../../test/tauri";

const fp = (id: string, label: string, platform: string, builtin = true): FingerprintEntry => ({
  id, label, platform, chrome: "152", gpu: `GPU of ${label}`, tag_color: "#335", builtin, payload: {},
} as FingerprintEntry);

let library: FingerprintEntry[];
const startingFp = useFingerprint.getInitialState();
const startingGpu = useGpuCompat.getInitialState();

beforeEach(() => {
  library = [
    fp("w1", "Windows · RTX 3060", "Windows"),
    fp("w2", "Windows · RX 6600", "Windows", false),
    fp("m1", "macOS · Apple M2", "macOS"),
  ];
  backend.reset({
    fingerprint_list: () => library.map((e) => ({ ...e })),
    fingerprint_delete: ({ id }) => { library = library.filter((e) => e.id !== id); return null; },
    fingerprint_import: ({ idHint }) => {
      const e = fp("n1", String(idHint ?? "imported"), "Linux", false);
      library = [...library, e];
      return e;
    },
    profile_create_from_template: () => ({ id: "x", name: "From template" }),
    gpu_caps: () => ({ renderer: "Test GPU", vendor: "x", webgl1: [], webgl2: [], engine_version: "1" }),
    gpu_caps_compat: () => ({
      w2: { compatible: false, missing_webgl1: ["WEBGL_lose_context"], missing_webgl2: [], missing_webgpu: [], profile_renderer: "AMD RX 6600" },
    }),
  });
  useFingerprint.setState(startingFp, true);
  useGpuCompat.setState(startingGpu, true);
  useToastStore.setState({ items: [] });
});

async function renderPage() {
  const user = userEvent.setup();
  render(<><FingerprintsPage /><ConfirmHost /><ToastHost /></>);
  await screen.findByText("macOS · Apple M2");
  return user;
}

describe("Fingerprints window", () => {
  it("groups the library by platform and counts each group", async () => {
    await renderPage();
    const win = screen.getByRole("region", { name: "Windows" });
    expect(within(win).getByText("Windows · RTX 3060")).toBeInTheDocument();
    expect(within(win).getByText("Windows · RX 6600")).toBeInTheDocument();
    expect(within(win).getByRole("heading")).toHaveTextContent("Windows2");
    expect(within(screen.getByRole("region", { name: "macOS" })).getByText("macOS · Apple M2")).toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Platform" });
    expect(within(panel).getByRole("button", { name: /^All platforms\s*3$/ })).toHaveAttribute("aria-current", "true");
  });

  it("narrows to one platform from the side panel", async () => {
    const user = await renderPage();
    const panel = screen.getByRole("complementary", { name: "Platform" });
    await user.click(within(panel).getByRole("button", { name: /^macOS\s*1$/ }));
    expect(screen.queryByText("Windows · RTX 3060")).not.toBeInTheDocument();
    expect(screen.getByText("macOS · Apple M2")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: /^All platforms/ }));
    expect(screen.getByText("Windows · RTX 3060")).toBeInTheDocument();
  });

  it("creates a profile from a card", async () => {
    const user = await renderPage();
    const card = screen.getByText("macOS · Apple M2").closest(".fp-card") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Use →" }));
    await waitFor(() => expect(backend.argsOf("profile_create_from_template")).toEqual([{ templateId: "m1" }]));
    expect(await screen.findByText(/Created "From template"/)).toBeInTheDocument();
  });

  it("offers Remove only on user-added cards, and asks first", async () => {
    const user = await renderPage();
    const builtin = screen.getByText("Windows · RTX 3060").closest(".fp-card") as HTMLElement;
    expect(within(builtin).getByText("built-in")).toBeInTheDocument();
    expect(within(builtin).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    const own = screen.getByText("Windows · RX 6600").closest(".fp-card") as HTMLElement;
    await user.click(within(own).getByRole("button", { name: "Remove" }));
    expect(backend.argsOf("fingerprint_delete")).toEqual([]);
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(backend.argsOf("fingerprint_delete")).toEqual([{ id: "w2" }]));
    await waitFor(() => expect(screen.queryByText("Windows · RX 6600")).not.toBeInTheDocument());
  });

  it("shows the GPU mismatch badge and opens its explanation", async () => {
    const user = await renderPage();
    const card = screen.getByText("Windows · RX 6600").closest(".fp-card") as HTMLElement;
    await user.click(await within(card).findByRole("button", { name: "GPU mismatch" }));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText("AMD RX 6600")).toBeInTheDocument();
    expect(within(dlg).getAllByText("WEBGL_lose_context").length).toBeGreaterThan(0);
    expect(within(dlg).getByText("Test GPU")).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const clean = screen.getByText("Windows · RTX 3060").closest(".fp-card") as HTMLElement;
    expect(within(clean).queryByRole("button", { name: "GPU mismatch" })).not.toBeInTheDocument();
  });

  it("pastes JSON through the importer and shows the new fingerprint", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Paste JSON" }));
    const dlg = screen.getByRole("dialog", { name: "Paste FingerprintConfig JSON" });
    const importBtn = within(dlg).getByRole("button", { name: "Import" });
    expect(importBtn).toBeDisabled();
    await user.type(within(dlg).getByLabelText(/^Name/), "linux-test");
    await user.click(within(dlg).getByLabelText("Paste the full JSON"));
    await user.paste('{"name":"x"}');
    expect(importBtn).toBeEnabled();
    await user.click(importBtn);
    await waitFor(() => expect(backend.argsOf("fingerprint_import")).toEqual([{ jsonText: '{"name":"x"}', idHint: "linux-test" }]));
    expect(await screen.findByText("linux-test")).toBeInTheDocument();
  });

  it("says so when the library is empty", async () => {
    library = [];
    render(<FingerprintsPage />);
    expect(await screen.findByText(/Library is empty/)).toBeInTheDocument();
  });
});
