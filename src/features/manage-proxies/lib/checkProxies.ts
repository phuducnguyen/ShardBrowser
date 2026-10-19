import { useProxy, type ProxyEntry } from "../../../entities/proxy";
import { storeBus } from "../../../shared/lib/storeBus";
import { toast } from "../../../shared/model/toast";

/// Tests proxies a few at a time so a long list does not open hundreds of sockets at once.
export async function checkProxies(targets: ProxyEntry[], concurrency = 5): Promise<void> {
  const { testProxy } = useProxy.getState();
  let next = 0;
  const worker = async () => {
    while (next < targets.length) await testProxy(targets[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
}

/// After the sheet adds proxies: show the full list (a hidden new row reads as "nothing happened"),
/// close the sheet, tell the rest of the app, and check what is new.
export async function finishAdding(before: Set<string>, message: string): Promise<void> {
  const store = useProxy.getState();
  await store.reload();
  store.setSearch("");
  store.setKindFilter("all");
  store.setStatusFilter("all");
  store.closeSheet();
  storeBus.emit("proxies");
  toast.ok(message);
  const fresh = useProxy.getState().proxies.filter((p) => !before.has(p.id));
  void checkProxies(fresh);
}
