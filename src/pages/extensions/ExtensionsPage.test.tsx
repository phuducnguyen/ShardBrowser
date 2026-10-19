import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExtensionsPage } from "./index";
import { ConfirmHost } from "../../widgets/ConfirmHost/ConfirmHost";
import { ToastHost } from "../../widgets/ToastHost/ToastHost";
import { useExtensions, type ExtensionEntry } from "../../entities/extension";
import { useToastStore } from "../../shared/model/toast";
import { backend } from "../../test/tauri";

const ext = (id: string, name: string, description: string, version = "1.0.0"): ExtensionEntry => ({
  id, name, version, description, icon: "", path: `/x/${id}`, size_bytes: 2 * 1024 * 1024, added_at: "@0",
} as ExtensionEntry);

let items: ExtensionEntry[];
const starting = useExtensions.getInitialState();

beforeEach(() => {
  items = [ext("e1", "uBlock Origin", "Blocks ads", "1.60.0"), ext("e2", "Cookie editor", "")];
  backend.reset({
    extension_list: () => items.map((e) => ({ ...e })),
    extension_delete: ({ id }) => { items = items.filter((e) => e.id !== id); return null; },
    extension_import_url: ({ url }) => {
      const e = ext("n1", "Downloaded " + String(url).length, "From link");
      items = [...items, e];
      return e;
    },
  });
  useExtensions.setState(starting, true);
  useToastStore.setState({ items: [] });
});

async function renderPage() {
  const user = userEvent.setup();
  render(<><ExtensionsPage /><ConfirmHost /><ToastHost /></>);
  await screen.findByText("uBlock Origin");
  return user;
}
const card = (name: string) => screen.getByText(name).closest("article") as HTMLElement;

describe("Extensions window", () => {
  it("shows each extension with version, size and description", async () => {
    await renderPage();
    const c = within(card("uBlock Origin"));
    expect(c.getByText(/v1\.60\.0/)).toBeInTheDocument();
    expect(c.getByText(/2\.0 MB/)).toBeInTheDocument();
    expect(c.getByText("Blocks ads")).toBeInTheDocument();
    expect(within(card("Cookie editor")).getByText(/No description/)).toBeInTheDocument();
  });

  it("searches by name and description, and says when nothing matches", async () => {
    const user = await renderPage();
    const search = screen.getByRole("searchbox", { name: "Search extensions" });
    await user.type(search, "blocks");
    expect(screen.getByText("uBlock Origin")).toBeInTheDocument();
    expect(screen.queryByText("Cookie editor")).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.queryByText("uBlock Origin")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("removes an extension only after the dialog is confirmed", async () => {
    const user = await renderPage();
    await user.click(within(card("Cookie editor")).getByRole("button", { name: "Remove" }));
    expect(backend.argsOf("extension_delete")).toEqual([]);
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getAllByRole("button").at(-1)!);
    await waitFor(() => expect(screen.queryByText("Cookie editor")).not.toBeInTheDocument());
    expect(backend.argsOf("extension_delete")).toEqual([{ id: "e2" }]);
  });

  it("adds an extension from a link: the button waits for an address, then the dialog closes", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: /From (a )?link/i }));
    const dlg = screen.getByRole("dialog");
    const go = within(dlg).getAllByRole("button").at(-1)!;
    expect(within(dlg).getByRole("textbox")).toHaveFocus();
    expect(go).toBeDisabled();
    await user.type(within(dlg).getByRole("textbox"), "abcdefghijklmnopabcdefghijklmnop");
    expect(go).toBeEnabled();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(backend.argsOf("extension_import_url")).toEqual([{ url: "abcdefghijklmnopabcdefghijklmnop" }]));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Downloaded 32")).toBeInTheDocument();
  });

  it("explains an empty library", async () => {
    items = [];
    render(<ExtensionsPage />);
    expect(await screen.findByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
