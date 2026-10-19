import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrashPage } from "./trash";
import { BookmarksPage } from "./bookmarks";
import { ConfirmHost } from "../widgets/ConfirmHost/ConfirmHost";
import { ToastHost } from "../widgets/ToastHost/ToastHost";
import { useTrash, type TrashEntry } from "../entities/trash";
import { useBookmarks, type Bookmark } from "../entities/bookmark";
import { useProfile } from "../entities/profile";
import { useToastStore } from "../shared/model/toast";
import { backend } from "../test/tauri";

const now = Math.floor(Date.now() / 1000);
const trashed = (id: string, name: string, folder: string, daysLeft: number): TrashEntry => ({
  id, name, folder, deleted_at: now - 86400, expires_at: now + daysLeft * 86400, size_bytes: 5 * 1024 * 1024,
});
const prof = (id: string, name: string, folder: string) => ({
  id, name, notes: "", proxy_id: null, last_launched_at: null, created_at: "2026-09-01T00:00:00Z", pinned: false,
  folder, total_runtime_ms: 0, color: null, extensions: [], mobile: false,
});

const startingTrash = useTrash.getInitialState();
const startingBm = useBookmarks.getInitialState();
const startingProfile = useProfile.getInitialState();

describe("Trash window", () => {
  let items: TrashEntry[];
  beforeEach(() => {
    items = [trashed("aaaaaaaa-1111", "Old shop", "Ads", 6), trashed("bbbbbbbb-2222", "Last chance", "", 0)];
    backend.reset({
      trash_list: () => items.map((e) => ({ ...e })),
      trash_restore: ({ id }) => {
        const e = items.find((x) => x.id === id)!;
        items = items.filter((x) => x.id !== id);
        return { name: e.name };
      },
      trash_purge: ({ id }) => { items = items.filter((x) => x.id !== id); return null; },
      trash_empty: () => { const n = items.length; items = []; return n; },
    });
    useTrash.setState(startingTrash, true);
    useToastStore.setState({ items: [] });
  });

  async function renderTrash() {
    const user = userEvent.setup();
    render(<><TrashPage /><ConfirmHost /><ToastHost /></>);
    await screen.findByText("Old shop");
    return user;
  }
  const row = (name: string) => screen.getByText(name).closest("tr") as HTMLTableRowElement;

  it("lists deleted profiles with folder, size and the days they have left", async () => {
    await renderTrash();
    const r = within(row("Old shop"));
    expect(r.getByText("Ads")).toBeInTheDocument();
    expect(r.getByText("5.0 MB")).toBeInTheDocument();
    expect(r.getByText("6d")).toBeInTheDocument();
    expect(within(row("Last chance")).getByText("today")).toBeInTheDocument();
  });

  it("restores a profile straight away", async () => {
    const user = await renderTrash();
    await user.click(within(row("Old shop")).getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.queryByText("Old shop", { selector: ".name" })).not.toBeInTheDocument());
    expect(backend.argsOf("trash_restore")).toEqual([{ id: "aaaaaaaa-1111" }]);
  });

  it("deletes for good only after the dialog is confirmed", async () => {
    const user = await renderTrash();
    await user.click(within(row("Last chance")).getByRole("button", { name: "Delete" }));
    expect(backend.argsOf("trash_purge")).toEqual([]);
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Last chance")).not.toBeInTheDocument());
    expect(backend.argsOf("trash_purge")).toEqual([{ id: "bbbbbbbb-2222" }]);
  });

  it("empties the trash after confirmation and then shows the empty state", async () => {
    const user = await renderTrash();
    await user.click(screen.getByRole("button", { name: "Empty trash" }));
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getAllByRole("button").at(-1)!);
    expect(await screen.findByText("The trash is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Empty trash" })).not.toBeInTheDocument();
    expect(backend.argsOf("trash_empty")).toHaveLength(1);
  });
});

describe("Bookmarks window", () => {
  let items: Bookmark[];
  beforeEach(() => {
    items = [
      { id: "b1", title: "Ads manager", url: "facebook.com/ads/manager", folder: "Ads" },
      { id: "b2", title: "", url: "tiktok.com/business", folder: "" },
    ];
    backend.reset({
      bookmark_list: () => items.map((b) => ({ ...b })),
      bookmark_save: ({ entry }) => {
        const e = { ...(entry as Bookmark), id: (entry as Bookmark).id || "n1" };
        items = [...items.filter((b) => b.id !== e.id), e];
        return e;
      },
      bookmark_delete: ({ id }) => { items = items.filter((b) => b.id !== id); return null; },
      profile_list: () => [prof("p1", "Shop A", "Ads"), prof("p2", "Shop B", "Ads"), prof("p3", "Direct", "")],
      process_list: () => [],
    });
    useBookmarks.setState(startingBm, true);
    useProfile.setState(startingProfile, true);
    useToastStore.setState({ items: [] });
  });

  async function renderBookmarks() {
    const user = userEvent.setup();
    render(<><BookmarksPage /><ConfirmHost /><ToastHost /></>);
    await screen.findByText("Ads manager");
    return user;
  }
  const rowNames = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.querySelector(".link-btn")?.textContent);

  it("shows each bookmark with where it applies, counting profiles", async () => {
    await renderBookmarks();
    const ads = screen.getByText("Ads manager").closest("tr") as HTMLElement;
    expect(within(ads).getByText("Ads · 2 profiles")).toBeInTheDocument();
    // A blank title falls back to the address.
    const tik = screen.getByRole("button", { name: "tiktok.com/business" }).closest("tr") as HTMLElement;
    expect(within(tik).getByText("Every profile · 3")).toBeInTheDocument();
  });

  it("filters by folder from the side panel and by search", async () => {
    const user = await renderBookmarks();
    const panel = screen.getByRole("complementary", { name: "Folder" });
    expect(within(panel).getByRole("button", { name: /^All\s*2$/ })).toHaveAttribute("aria-current", "true");
    await user.click(within(panel).getByRole("button", { name: /^Ads\s*1$/ }));
    expect(rowNames()).toEqual(["Ads manager"]);
    await user.click(within(panel).getByRole("button", { name: /^Every profile\s*1$/ }));
    expect(rowNames()).toEqual(["tiktok.com/business"]);
    await user.click(within(panel).getByRole("button", { name: /^All/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search bookmarks" }), "tiktok");
    expect(rowNames()).toEqual(["tiktok.com/business"]);
  });

  it("adds a bookmark into the folder that is open", async () => {
    const user = await renderBookmarks();
    await user.click(within(screen.getByRole("complementary", { name: "Folder" })).getByRole("button", { name: /^Ads/ }));
    await user.click(screen.getByRole("button", { name: "New bookmark" }));
    const dlg = screen.getByRole("dialog", { name: "New bookmark" });
    expect(within(dlg).getByLabelText("URL")).toHaveFocus();
    expect(within(dlg).getByLabelText("Folder")).toHaveValue("Ads");
    await user.type(within(dlg).getByLabelText("URL"), "example.com/x");
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(backend.argsOf("bookmark_save")).toHaveLength(1));
    expect(backend.argsOf("bookmark_save")[0]).toEqual({ entry: expect.objectContaining({ url: "example.com/x", folder: "Ads" }) });
    expect(await screen.findByText("example.com/x", { selector: ".link-btn" })).toBeInTheDocument();
  });

  it("edits a bookmark from its title", async () => {
    const user = await renderBookmarks();
    await user.click(screen.getByRole("button", { name: "Ads manager" }));
    const dlg = screen.getByRole("dialog", { name: "Edit bookmark" });
    await user.clear(within(dlg).getByLabelText("Title"));
    await user.type(within(dlg).getByLabelText("Title"), "Ads v2");
    await user.selectOptions(within(dlg).getByLabelText("Folder"), "");
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(backend.argsOf("bookmark_save")[0]).toEqual({ entry: expect.objectContaining({ id: "b1", title: "Ads v2", folder: "" }) }));
  });

  it("deletes only after the dialog is confirmed", async () => {
    const user = await renderBookmarks();
    const r = screen.getByText("Ads manager").closest("tr") as HTMLElement;
    await user.click(within(r).getByRole("button", { name: "Delete" }));
    expect(backend.argsOf("bookmark_delete")).toEqual([]);
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Ads manager")).not.toBeInTheDocument());
    expect(backend.argsOf("bookmark_delete")).toEqual([{ id: "b1" }]);
  });

  it("explains an empty library", async () => {
    items = [];
    render(<BookmarksPage />);
    expect(await screen.findByText("No bookmarks yet")).toBeInTheDocument();
  });
});
