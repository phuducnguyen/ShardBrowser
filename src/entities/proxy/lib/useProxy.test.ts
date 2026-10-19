import { beforeEach, describe, expect, it } from "vitest";
import { filterProxies, useProxy } from "./useProxy";
import type { ProxyEntry, ProxyTestSnapshot } from "../model/types";

const p = (id: string, name: string, kind: ProxyEntry["kind"], host = "203.0.113.1", port = 1080): ProxyEntry => ({
  id, name, kind, host, port, username: "", password: "", country: "", notes: "",
});
const snap = (tcp_ms: number | null, country = "Germany"): ProxyTestSnapshot => ({
  first_seen: "", last_seen: "", ip: "198.51.100.7", country_code: "DE", country, region: "", city: "Berlin", isp: "Example",
  timezone: "", latitude: 0, longitude: 0, tcp_ms, udp_ms: null, udp_error: null, geo_error: null, provider: "",
});

const list = [p("a", "Alpha", "socks5"), p("b", "Beta", "http"), p("c", "Gamma", "https"), p("d", "Delta", "socks5")];
const snaps = { a: snap(40), b: snap(null), c: snap(90, "France") };

describe("filterProxies", () => {
  it("returns everything with no filters", () => {
    expect(filterProxies(list, snaps, "")).toHaveLength(4);
  });
  it("filters by type", () => {
    expect(filterProxies(list, snaps, "", "socks5").map((x) => x.id)).toEqual(["a", "d"]);
  });
  it("filters by derived status, treating a missing snapshot as unchecked", () => {
    expect(filterProxies(list, snaps, "", "all", "alive").map((x) => x.id)).toEqual(["a", "c"]);
    expect(filterProxies(list, snaps, "", "all", "dead").map((x) => x.id)).toEqual(["b"]);
    expect(filterProxies(list, snaps, "", "all", "new").map((x) => x.id)).toEqual(["d"]);
  });
  it("combines search, type and status", () => {
    expect(filterProxies(list, snaps, "germany", "socks5", "alive").map((x) => x.id)).toEqual(["a"]);
    expect(filterProxies(list, snaps, "germany", "http", "alive")).toEqual([]);
  });
  it("searches the country name and city from the last test, and the IP", () => {
    expect(filterProxies(list, snaps, "france").map((x) => x.id)).toEqual(["c"]);
    expect(filterProxies(list, snaps, "berlin")).toHaveLength(3);
    expect(filterProxies(list, snaps, "198.51.100.7")).toHaveLength(3);
  });
  it("ignores case and surrounding spaces", () => {
    expect(filterProxies(list, snaps, "  ALPHA ").map((x) => x.id)).toEqual(["a"]);
  });
});

describe("shift-click range selection", () => {
  beforeEach(() => {
    useProxy.setState(useProxy.getInitialState(), true);
    useProxy.setState({ proxies: list, snapshots: snaps });
  });

  it("selects the run between the anchor and the clicked row", () => {
    const s = useProxy.getState();
    s.selectProxy(true, [list[0]]);
    s.selectRangeTo("c");
    expect([...useProxy.getState().proxySel].sort()).toEqual(["a", "b", "c"]);
  });

  it("stays inside the rows the filters leave visible", () => {
    useProxy.setState({ kindFilter: "socks5" });
    const s = useProxy.getState();
    s.selectProxy(true, [list[0]]);
    s.selectRangeTo("d");
    // b and c are hidden by the filter, so they must not be picked up by the range.
    expect([...useProxy.getState().proxySel].sort()).toEqual(["a", "d"]);
  });
});

describe("sheet state", () => {
  beforeEach(() => useProxy.setState(useProxy.getInitialState(), true));

  it("opens on the remembered tab unless told otherwise", () => {
    const s = useProxy.getState();
    s.openSheet("manual");
    expect(useProxy.getState()).toMatchObject({ sheetOpen: true, sheetTab: "manual" });
    s.closeSheet();
    s.openSheet();
    expect(useProxy.getState()).toMatchObject({ sheetOpen: true, sheetTab: "manual" });
  });
});
