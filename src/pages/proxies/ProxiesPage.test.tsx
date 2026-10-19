import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProxiesPage } from "./index";
import { ConfirmHost } from "../../widgets/ConfirmHost/ConfirmHost";
import { ToastHost } from "../../widgets/ToastHost/ToastHost";
import { useProxy, type ProxyEntry, type ProxyTestSnapshot } from "../../entities/proxy";
import { useToastStore } from "../../shared/model/toast";
import { backend } from "../../test/tauri";

const proxy = (id: string, name: string, kind: ProxyEntry["kind"], host: string, port: number, user = ""): ProxyEntry => ({
  id, name, kind, host, port, username: user, password: user ? "secret" : "", country: "", notes: "",
});
const snap = (cc: string, country: string, tcp: number | null, udp: number | null): ProxyTestSnapshot => ({
  first_seen: "", last_seen: "", ip: "203.0.113.9", country_code: cc, country, region: "", city: "", isp: "",
  timezone: "", latitude: 0, longitude: 0, tcp_ms: tcp, udp_ms: udp, udp_error: null, geo_error: null, provider: "",
});

let proxies: ProxyEntry[];
const snapshots: Record<string, ProxyTestSnapshot> = {
  p1: snap("US", "United States", 42, 38),
  p2: snap("DE", "Germany", null, null),
};

const startingStore = useProxy.getInitialState();

beforeEach(() => {
  proxies = [
    proxy("p1", "US residential", "socks5", "203.0.113.18", 1080, "u1"),
    proxy("p2", "DE static", "http", "198.51.100.12", 8080),
    proxy("p3", "Office", "https", "192.0.2.50", 3128),
  ];
  backend.reset({
    proxy_list: () => proxies.map((p) => ({ ...p })),
    proxy_last_test: ({ id }) => snapshots[id as string] ?? null,
    proxy_full_test: ({ entry }) => snapshots[(entry as ProxyEntry).id] ?? snap("US", "United States", 55, null),
    profile_list: () => [{ id: "a1", proxy_id: "p1" }, { id: "a2", proxy_id: "p1" }, { id: "a3", proxy_id: "p3" }],
    proxy_delete: ({ id }) => { proxies = proxies.filter((p) => p.id !== id); return null; },
    proxy_save: ({ entry }) => {
      const saved = { ...(entry as ProxyEntry), id: "n1" };
      proxies = [...proxies, saved];
      return saved;
    },
    proxy_bulk_parse: ({ text }) => (text as string).split("\n").filter((l) => /^[\w.]+:\d+$/.test(l.trim())).map((l, i) => {
      const [host, port] = l.trim().split(":");
      return proxy("", `Imported ${i}`, "socks5", host, Number(port));
    }),
    proxy_bulk_save: ({ entries }) => (entries as unknown[]).length,
    ps_get_key: () => "",
    ps_me: () => Promise.reject("Invalid API key"),
  });
  useProxy.setState(startingStore, true);
  useToastStore.setState({ items: [] });
});

afterEach(() => { vi.useRealTimers(); });

async function renderPage() {
  const user = userEvent.setup();
  render(<><ProxiesPage /><ConfirmHost /><ToastHost /></>);
  await screen.findByText("US residential");
  return user;
}
const row = (name: string) => screen.getByText(name).closest("tr") as HTMLTableRowElement;
const visibleNames = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.querySelector(".name")?.textContent ?? "");

describe("Proxies window: list", () => {
  it("shows each proxy with its address, location, status, latency and profile count", async () => {
    await renderPage();
    const us = within(row("US residential"));
    expect(us.getByText("SOCKS5 · 203.0.113.18:1080")).toBeInTheDocument();
    expect(us.getByText("United States")).toBeInTheDocument();
    expect(us.getByText("Alive")).toBeInTheDocument();
    expect(us.getByText("42 ms")).toBeInTheDocument();
    expect(us.getByText("UDP · 38 ms")).toBeInTheDocument();
    expect(us.getByText("2 profiles")).toBeInTheDocument();
    expect(us.getByText("Requires login")).toBeInTheDocument();
    expect(within(row("DE static")).getByText("Dead")).toBeInTheDocument();
    expect(within(row("Office")).getByText("Unchecked")).toBeInTheDocument();
    expect(within(row("Office")).getByText("1 profile")).toBeInTheDocument();
  });

  it("filters by status and keeps the counts honest", async () => {
    const user = await renderPage();
    expect(screen.getByRole("radio", { name: /^All\s*3$/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Alive\s*1$/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Dead/ }));
    expect(visibleNames()).toEqual(["DE static"]);
    await user.click(screen.getByRole("radio", { name: /^Unchecked/ }));
    expect(visibleNames()).toEqual(["Office"]);
  });

  it("filters by connection type from the side panel", async () => {
    const user = await renderPage();
    const panel = screen.getByRole("complementary", { name: "Type" });
    const http = within(panel).getByRole("button", { name: /^HTTP\s*1$/ });
    await user.click(http);
    expect(visibleNames()).toEqual(["DE static"]);
    expect(http).toHaveAttribute("aria-current", "true");
    expect(within(panel).getByRole("button", { name: /^All types/ })).not.toHaveAttribute("aria-current");
  });

  it("searches by name, address and location", async () => {
    const user = await renderPage();
    const search = screen.getByRole("searchbox", { name: "Search proxies" });
    await user.type(search, "germany");
    expect(visibleNames()).toEqual(["DE static"]);
    await user.clear(search);
    await user.type(search, "192.0.2");
    expect(visibleNames()).toEqual(["Office"]);
    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText("No proxies match these filters.")).toBeInTheDocument();
  });

  it("says so when there are no proxies at all, and offers the way out", async () => {
    proxies = [];
    const user = userEvent.setup();
    render(<ProxiesPage />);
    expect(await screen.findByText("No proxies yet.")).toBeInTheDocument();
    const inTable = within(screen.getByRole("table")).getByRole("button", { name: "Get proxies" });
    await user.click(inTable);
    expect(await screen.findByRole("dialog", { name: "Get proxies" })).toBeInTheDocument();
  });
});

describe("Proxies window: selection and bulk actions", () => {
  it("shows the bulk bar for ticked rows and hides it on clear", async () => {
    const user = await renderPage();
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
    await user.click(within(row("US residential")).getByRole("checkbox"));
    await user.click(within(row("Office")).getByRole("checkbox"));
    const bar = screen.getByRole("toolbar", { name: "Bulk actions" });
    expect(within(bar).getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select all proxies" })).toHaveProperty("indeterminate", true);
    await user.click(within(bar).getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("selects every visible row from the header checkbox", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("checkbox", { name: "Select all proxies" }));
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select all proxies" })).toBeChecked();
  });

  it("checks the selected proxies from the bulk bar", async () => {
    const user = await renderPage();
    await user.click(within(row("Office")).getByRole("checkbox"));
    await user.click(within(screen.getByRole("toolbar", { name: "Bulk actions" })).getByRole("button", { name: "Check" }));
    await waitFor(() => expect(backend.argsOf("proxy_full_test").map((a) => (a.entry as ProxyEntry).id)).toEqual(["p3"]));
  });

  it("checks every visible proxy from the toolbar", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Check all" }));
    await waitFor(() => expect(backend.argsOf("proxy_full_test")).toHaveLength(3));
  });
});

describe("Proxies window: delete", () => {
  async function openDelete(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(within(row(name)).getByRole("button", { name: `Actions for ${name}` }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    return screen.findByRole("alertdialog");
  }

  it("asks first, and says how many profiles use the proxy", async () => {
    const user = await renderPage();
    const dialog = await openDelete(user, "US residential");
    expect(within(dialog).getByText(/Profiles using a deleted proxy \(2\)/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(backend.argsOf("proxy_delete")).toHaveLength(0);
    expect(row("US residential")).toBeInTheDocument();
  });

  it("deletes only after the dialog is confirmed", async () => {
    const user = await renderPage();
    const dialog = await openDelete(user, "Office");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Office")).not.toBeInTheDocument());
    expect(backend.argsOf("proxy_delete")).toEqual([{ id: "p3" }]);
    expect(await screen.findByText("Proxy deleted")).toBeInTheDocument();
  });

  it("leaves the proxy alone when the dialog is dismissed with Escape", async () => {
    const user = await renderPage();
    const dialog = await openDelete(user, "DE static");
    // The platform raises `cancel` on Escape; jsdom does not, so raise it the way the browser would.
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(backend.argsOf("proxy_delete")).toHaveLength(0);
  });
});

describe("Proxies window: row menu", () => {
  it("opens on click, moves with the arrow keys, and Escape returns focus to the button", async () => {
    const user = await renderPage();
    const button = within(row("US residential")).getByRole("button", { name: "Actions for US residential" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Check", "Edit", "Details", "Copy address", "Assign to profiles", "Delete"]);
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(items[5]).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the pointer goes down elsewhere", async () => {
    const user = await renderPage();
    await user.click(within(row("Office")).getByRole("button", { name: "Actions for Office" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("heading", { name: "Proxies" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("Get proxies sheet", () => {
  async function openSheet() {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Get proxies" }));
    const sheet = await screen.findByRole("dialog", { name: "Get proxies" });
    return { user, sheet };
  }

  it("opens on the ProxyShard tab with focus on the selected tab, and switches tabs with the arrow keys", async () => {
    const { user, sheet } = await openSheet();
    const tabs = within(sheet).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["ProxyShard", "Import", "Manual"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(within(sheet).getByRole("tabpanel")).toHaveAccessibleName("ProxyShard");
  });

  it("closes from the close button", async () => {
    const { user, sheet } = await openSheet();
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Get proxies" })).not.toBeInTheDocument());
  });

  describe("ProxyShard tab", () => {
    it("explains a rejected key and marks the field invalid", async () => {
      const { user, sheet } = await openSheet();
      const key = within(sheet).getByLabelText("API key");
      expect(within(sheet).getByRole("button", { name: "Connect" })).toBeDisabled();
      await user.type(key, "bad-key");
      await user.click(within(sheet).getByRole("button", { name: "Connect" }));
      expect(await within(sheet).findByText(/Invalid API key/)).toBeInTheDocument();
      expect(key).toHaveAttribute("aria-invalid", "true");
      expect(backend.argsOf("ps_set_key")).toEqual([{ key: "bad-key" }]);
    });

    it("shows the account once connected and links to the orders page", async () => {
      backend.handlers.ps_me = () => ({ email: "me@example.com", active_orders: 3, wallet_balance: 0 });
      const { user, sheet } = await openSheet();
      await user.type(within(sheet).getByLabelText("API key"), "good-key-123");
      await user.click(within(sheet).getByRole("button", { name: "Connect" }));
      expect(await within(sheet).findByText("Connected as me@example.com.")).toBeInTheDocument();
      expect(within(sheet).getByText("3 active orders")).toBeInTheDocument();
    });
  });

  describe("Import tab", () => {
    async function openImport() {
      const ctx = await openSheet();
      await ctx.user.click(within(ctx.sheet).getByRole("tab", { name: "Import" }));
      return ctx;
    }

    it("does nothing until there is something to import", async () => {
      const { sheet } = await openImport();
      expect(within(sheet).getByRole("button", { name: "Import" })).toBeDisabled();
      expect(within(sheet).getByText("Nothing to import")).toBeInTheDocument();
    });

    it("reports valid and invalid lines as the list is pasted", async () => {
      const { user, sheet } = await openImport();
      await user.click(within(sheet).getByRole("textbox", { name: "Proxy list" }));
      await user.paste("203.0.113.10:8080\n203.0.113.11:1080\nnot a proxy");
      expect(await within(sheet).findByText("2 valid")).toBeInTheDocument();
      expect(within(sheet).getByText("1 invalid")).toBeInTheDocument();
      expect(within(sheet).getByRole("alert")).toHaveTextContent("1 line could not be read and will be skipped.");
      expect(within(sheet).getByRole("button", { name: "Import 2" })).toBeEnabled();
    });

    it("sends the parsed proxies to be saved, closes, and checks the new ones", async () => {
      const { user, sheet } = await openImport();
      backend.handlers.proxy_bulk_save = ({ entries }) => {
        (entries as ProxyEntry[]).forEach((e, i) => proxies.push({ ...e, id: `new${i}` }));
        return (entries as unknown[]).length;
      };
      await user.click(within(sheet).getByRole("textbox", { name: "Proxy list" }));
      await user.paste("203.0.113.10:8080\n203.0.113.11:1080");
      await user.click(await within(sheet).findByRole("button", { name: "Import 2" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Get proxies" })).not.toBeInTheDocument());
      expect(backend.argsOf("proxy_bulk_save")[0].entries).toHaveLength(2);
      expect(await screen.findByText("Imported 2 proxies — checking…")).toBeInTheDocument();
      await waitFor(() => expect(backend.argsOf("proxy_full_test").map((a) => (a.entry as ProxyEntry).id).sort()).toEqual(["new0", "new1"]));
      expect(await screen.findByText("SOCKS5 · 203.0.113.10:8080")).toBeInTheDocument();
    });

    it("asks the backend with the chosen default type", async () => {
      const { user, sheet } = await openImport();
      await user.click(within(sheet).getByRole("radio", { name: "HTTP" }));
      await user.click(within(sheet).getByRole("textbox", { name: "Proxy list" }));
      await user.paste("203.0.113.10:8080");
      await within(sheet).findByText("1 valid");
      expect(backend.argsOf("proxy_bulk_parse").at(-1)).toMatchObject({ kind: "http" });
    });
  });

  describe("Manual tab", () => {
    async function openManual() {
      const ctx = await openSheet();
      await ctx.user.click(within(ctx.sheet).getByRole("tab", { name: "Manual" }));
      return ctx;
    }

    it("fills the fields and the type from a pasted proxy line", async () => {
      const { user, sheet } = await openManual();
      await user.type(within(sheet).getByLabelText("Quick add"), "http://bob:pw@203.0.113.77:3128");
      expect(within(sheet).getByLabelText("IP address or host")).toHaveValue("203.0.113.77");
      expect(within(sheet).getByLabelText("Port")).toHaveValue("3128");
      expect(within(sheet).getByLabelText("Username")).toHaveValue("bob");
      expect(within(sheet).getByLabelText("Password")).toHaveValue("pw");
      expect(within(sheet).getByRole("radio", { name: "HTTP" })).toBeChecked();
    });

    it("refuses a bad host or port and keeps the sheet open", async () => {
      const { user, sheet } = await openManual();
      await user.type(within(sheet).getByLabelText("IP address or host"), "203.0.113.77");
      await user.type(within(sheet).getByLabelText("Port"), "99999");
      await user.click(within(sheet).getByRole("button", { name: "Add proxy" }));
      expect(within(sheet).getByRole("alert")).toHaveTextContent("Enter a valid host and port.");
      expect(within(sheet).getByLabelText("IP address or host")).toHaveFocus();
      expect(backend.argsOf("proxy_save")).toHaveLength(0);
      expect(sheet).toBeVisible();
    });

    it("saves the proxy, shows it in the list, and checks it", async () => {
      const { user, sheet } = await openManual();
      await user.type(within(sheet).getByLabelText("Quick add"), "socks5://bob:pw@203.0.113.77:1080");
      await user.click(within(sheet).getByRole("button", { name: "Add proxy" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Get proxies" })).not.toBeInTheDocument());
      expect(backend.argsOf("proxy_save")[0].entry).toMatchObject({
        kind: "socks5", host: "203.0.113.77", port: 1080, username: "bob", password: "pw",
      });
      expect(await screen.findByText("203.0.113.77:1080")).toBeInTheDocument();
      await waitFor(() => expect(backend.argsOf("proxy_full_test").map((a) => (a.entry as ProxyEntry).id)).toContain("n1"));
    });

    it("shows the backend's reason when saving fails", async () => {
      backend.handlers.proxy_save = () => Promise.reject("host already exists");
      const { user, sheet } = await openManual();
      await user.type(within(sheet).getByLabelText("Quick add"), "203.0.113.77:1080");
      await user.click(within(sheet).getByRole("button", { name: "Add proxy" }));
      expect(await within(sheet).findByText("host already exists")).toBeInTheDocument();
      expect(sheet).toBeVisible();
    });
  });
});
