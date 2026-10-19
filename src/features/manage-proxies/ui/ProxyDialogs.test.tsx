import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProxyEditor } from "./ProxyEditor";
import { ProxyDistributeModal } from "./ProxyDistributeModal";
import { ProxyInfoPopover } from "./ProxyInfoPopover";
import { emptyProxy, useProxy, type ProxyEntry, type ProxyTestSnapshot } from "../../../entities/proxy";
import type { ProfileMeta } from "../../../entities/profile";
import { backend } from "../../../test/tauri";

const px = (id: string, name: string, host: string, port: number, country = ""): ProxyEntry => ({
  id, name, kind: "socks5", host, port, username: "", password: "", country, notes: "",
});
const prof = (id: string, name: string, proxy_id: string | null, folder = ""): ProfileMeta => ({
  id, name, notes: "", proxy_id, last_launched_at: null, created_at: "2026-09-01T00:00:00Z", pinned: false,
  folder, total_runtime_ms: 0, color: null, extensions: [], mobile: false,
});
const snap = (over: Partial<ProxyTestSnapshot> = {}): ProxyTestSnapshot => ({
  first_seen: "2026-09-01T10:00:00Z", last_seen: "2026-09-01T10:00:00Z", ip: "203.0.113.9", country_code: "US",
  country: "United States", region: "Texas", city: "Austin", isp: "Example ISP", timezone: "America/Chicago",
  latitude: 0, longitude: 0, tcp_ms: 42, udp_ms: 38, udp_error: null, geo_error: null, provider: "", ...over,
});

describe("ProxyEditor", () => {
  beforeEach(() => backend.reset({ proxy_save: ({ entry }) => ({ ...(entry as ProxyEntry), id: "n1" }) }));

  it("adds a proxy: host is focused first, the port can be changed, the saved entry is handed back", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<ProxyEditor initial={emptyProxy()} onClose={onClose} onSaved={onSaved} />);
    expect(screen.getByRole("dialog", { name: "New proxy" })).toBeInTheDocument();
    expect(screen.getByLabelText("Host")).toHaveFocus();
    await user.type(screen.getByLabelText("Host"), "203.0.113.50");
    await user.clear(screen.getByLabelText("Port"));
    await user.type(screen.getByLabelText("Port"), "3128");
    await user.selectOptions(screen.getByLabelText("Type"), "http");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(backend.argsOf("proxy_save")).toEqual([{ entry: { ...emptyProxy(), host: "203.0.113.50", port: 3128, kind: "http" } }]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "n1", host: "203.0.113.50" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses a blank host with an inline message and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProxyEditor initial={emptyProxy()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A proxy needs a host");
    expect(screen.getByLabelText("Host")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Host")).toHaveFocus();
    expect(backend.argsOf("proxy_save")).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Host"), "a");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("edits an existing proxy, and Enter in a field saves", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<ProxyEditor initial={px("p1", "US residential", "203.0.113.18", 1080, "US")} onClose={() => {}} onSaved={onSaved} />);
    expect(screen.getByRole("dialog", { name: "Edit proxy" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Shop proxy{Enter}");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(backend.argsOf("proxy_save")[0]).toEqual({ entry: expect.objectContaining({ id: "p1", name: "Shop proxy", country: "US" }) });
  });

  it("sets the p0f signature of a ProxyShard order only when it changed", async () => {
    const user = userEvent.setup();
    backend.reset({
      proxy_save: ({ entry }) => entry,
      ps_active: () => ({ data: [{ ip: "203.0.113.18", signature: "ios" }] }),
      ps_signature_set: () => null,
    });
    const p = { ...px("p1", "DC 1", "203.0.113.18", 1080), notes: "ProxyShard order 7" };
    const onSaved = vi.fn();
    const first = render(<ProxyEditor initial={p} onClose={() => {}} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText(/p0f signature · order #7/)).toHaveValue("ios"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(backend.argsOf("ps_signature_set")).toEqual([]);

    // The real dialog is unmounted by onClose; a fresh render stands in for opening it again.
    first.unmount();
    onSaved.mockClear();
    render(<ProxyEditor initial={p} onClose={() => {}} onSaved={onSaved} />);
    const sig = screen.getByLabelText(/p0f signature · order #7/);
    await waitFor(() => expect(sig).toHaveValue("ios"));
    await user.selectOptions(sig, "macos");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(backend.argsOf("ps_signature_set")).toEqual([{ orderId: 7, items: [{ ip: "203.0.113.18", signature: "macos" }] }]);
  });

  it("offers no signature field for an ordinary proxy, and Cancel saves nothing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProxyEditor initial={px("p1", "Office", "192.0.2.50", 3128)} onClose={onClose} />);
    expect(screen.queryByLabelText(/p0f signature/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(backend.argsOf("proxy_save")).toEqual([]);
  });
});

describe("ProxyDistributeModal", () => {
  const startingStore = useProxy.getInitialState();
  const proxies = [px("p1", "US one", "203.0.113.1", 1080, "US"), px("p2", "DE two", "203.0.113.2", 1080, "DE"), px("p3", "FR three", "203.0.113.3", 1080)];
  const profiles = [
    prof("a1", "Shop A", null, "Ads"), prof("a2", "Shop B", null, "Ads"), prof("a3", "Shop C", null, "Retail"),
    prof("a4", "Shop D", "p3", "Retail"),
  ];

  beforeEach(() => {
    backend.reset({
      profile_bind_proxy: () => null,
      proxy_list: () => proxies,
      profile_list: () => profiles,
    });
    useProxy.setState({ ...startingStore, proxies, profiles, proxySel: new Set(["p1", "p2"]) }, true);
  });
  afterEach(() => useProxy.setState(startingStore, true));

  it("pairs the picked proxies with profiles that have none, in the order shown", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProxyDistributeModal onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Distribute 2 proxies" })).toBeInTheDocument();
    expect(screen.getByText("Profiles · 3 of 3")).toBeInTheDocument();
    expect(screen.queryByText("Shop D")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bind 2" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(backend.argsOf("profile_bind_proxy")).toEqual([
      { profileId: "a1", proxyId: "p1" },
      { profileId: "a2", proxyId: "p2" },
    ]);
  });

  it("follows the folder filter and lets a profile be skipped", async () => {
    const user = userEvent.setup();
    render(<ProxyDistributeModal onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("Profiles from"), "Ads");
    expect(screen.getByText("Profiles · 2 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Shop C")).not.toBeInTheDocument();
    await user.click(within(screen.getByText("Shop A").closest("label") as HTMLElement).getByRole("checkbox"));
    expect(screen.getByText("Profiles · 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bind 1" })).toBeEnabled();
  });

  it("warns before replacing proxies when 'All profiles' is chosen", async () => {
    const user = userEvent.setup();
    render(<ProxyDistributeModal onClose={() => {}} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "All profiles" }));
    expect(screen.getByText("Shop D")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("1 of the profiles below already has a proxy");
  });

  it("disables the button when there is nothing to bind", async () => {
    const user = userEvent.setup();
    useProxy.setState({ profiles: [prof("a4", "Shop D", "p3")] });
    render(<ProxyDistributeModal onClose={() => {}} />);
    expect(screen.getByText(/No profiles match/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nothing to bind" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(backend.argsOf("profile_bind_proxy")).toEqual([]);
  });
});

describe("ProxyInfoPopover", () => {
  const proxy = px("p1", "US residential", "203.0.113.18", 1080, "US");
  beforeEach(() => backend.reset({
    proxy_history: () => [
      snap({ ip: "203.0.113.9", first_seen: "2026-09-01T10:00:00Z", last_seen: "2026-09-02T10:00:00Z" }),
      snap({ ip: "198.51.100.7", country_code: "DE", city: "Berlin", udp_ms: null, udp_error: "no reply", first_seen: "2026-09-03T10:00:00Z", last_seen: "2026-09-03T10:00:00Z" }),
    ],
  }));

  it("shows the latest IP, location and latency, then the IP history newest first", async () => {
    render(<ProxyInfoPopover proxy={proxy} anchor={{ x: 100, y: 100 }} latest={snap()} onClose={() => {}} />);
    const pop = screen.getByRole("dialog", { name: "US residential" });
    expect(within(pop).getByText("Texas, Austin")).toBeInTheDocument();
    expect(within(pop).getByText("America/Chicago")).toBeInTheDocument();
    expect(within(pop).getByText("Example ISP")).toBeInTheDocument();
    expect(within(pop).getByText("TCP 42 ms")).toBeInTheDocument();
    expect(within(pop).getByText("UDP 38 ms")).toBeInTheDocument();
    await waitFor(() => expect(within(pop).getByText("198.51.100.7")).toBeInTheDocument());
    const hist = pop.querySelector(".info-hist") as HTMLElement;
    const ips = [...hist.querySelectorAll(".ip .mono")].map((n) => n.textContent);
    expect(ips).toEqual(["198.51.100.7", "203.0.113.9"]);
    expect(hist).toHaveTextContent("UDP ✗");
  });

  it("hides UDP for a non-SOCKS5 proxy and says so when nothing was tested", async () => {
    const { rerender } = render(<ProxyInfoPopover proxy={{ ...proxy, kind: "http" }} anchor={{ x: 0, y: 0 }} latest={snap()} onClose={() => {}} />);
    expect(screen.queryByText(/^UDP \d/)).not.toBeInTheDocument();
    rerender(<ProxyInfoPopover proxy={proxy} anchor={{ x: 0, y: 0 }} onClose={() => {}} />);
    expect(screen.getByText(/Not tested yet/)).toBeInTheDocument();
  });

  it("explains a failed geo lookup", () => {
    render(<ProxyInfoPopover proxy={proxy} anchor={{ x: 0, y: 0 }} latest={snap({ geo_error: "timeout", tcp_ms: null })} onClose={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No location: timeout");
    expect(screen.getByText("TCP ✗")).toBeInTheDocument();
  });

  it("closes on Escape and on a click outside, but not on a click inside", () => {
    const onClose = vi.fn();
    render(<ProxyInfoPopover proxy={proxy} anchor={{ x: 0, y: 0 }} latest={snap()} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByText("Example ISP"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
