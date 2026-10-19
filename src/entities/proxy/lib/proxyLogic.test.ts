import { describe, expect, it } from "vitest";
import { parseProxyLine } from "./parseProxyLine";
import { latencyMeter, proxyStatus } from "./status";
import type { ProxyTestSnapshot } from "../model/types";

const snap = (tcp_ms: number | null): ProxyTestSnapshot => ({
  first_seen: "", last_seen: "", ip: "203.0.113.5", country_code: "DE", country: "Germany",
  region: "", city: "", isp: "", timezone: "", latitude: 0, longitude: 0,
  tcp_ms, udp_ms: null, udp_error: null, geo_error: null, provider: "",
});

describe("parseProxyLine", () => {
  it("reads host:port", () => {
    expect(parseProxyLine("203.0.113.10:8080")).toEqual({ kind: null, host: "203.0.113.10", port: 8080, username: "", password: "" });
  });
  it("reads host:port:user:pass", () => {
    expect(parseProxyLine("203.0.113.10:8080:bob:pw")).toMatchObject({ username: "bob", password: "pw" });
  });
  it("reads user:pass@host:port and keeps colons in the password", () => {
    expect(parseProxyLine("bob:p:w@203.0.113.10:8080")).toMatchObject({ host: "203.0.113.10", port: 8080, username: "bob", password: "p:w" });
  });
  it("takes the kind from a supported scheme", () => {
    expect(parseProxyLine("socks5://bob:pw@203.0.113.10:1080")?.kind).toBe("socks5");
    expect(parseProxyLine("HTTPS://203.0.113.10:3128")?.kind).toBe("https");
    expect(parseProxyLine("socks5h://203.0.113.10:1080")?.kind).toBe("socks5");
  });
  it("leaves the kind open for a scheme it does not support", () => {
    expect(parseProxyLine("socks4://203.0.113.10:1080")?.kind).toBeNull();
  });
  it("ignores a trailing # name, as the export writes it", () => {
    expect(parseProxyLine("socks5://203.0.113.10:1080  # Office")).toMatchObject({ host: "203.0.113.10", port: 1080 });
  });
  it.each(["", "   ", "not a proxy", "host", "host:0", "host:65536", "host:abc", "a:b:c", ":8080"])("rejects %j", (line) => {
    expect(parseProxyLine(line)).toBeNull();
  });
});

describe("proxyStatus", () => {
  it("is checking while a test runs, even with an old snapshot", () => {
    expect(proxyStatus(snap(40), true)).toBe("checking");
  });
  it("is unchecked without a snapshot", () => {
    expect(proxyStatus(undefined, false)).toBe("new");
  });
  it("is alive with a TCP round-trip and dead without one", () => {
    expect(proxyStatus(snap(40), false)).toBe("alive");
    expect(proxyStatus(snap(null), false)).toBe("dead");
  });
});

describe("latencyMeter", () => {
  it("grades the tone at 120 and 250 ms", () => {
    expect(latencyMeter(119).tone).toBe("good");
    expect(latencyMeter(120).tone).toBe("mid");
    expect(latencyMeter(249).tone).toBe("mid");
    expect(latencyMeter(250).tone).toBe("bad");
  });
  it("keeps the bar between 8 and 100 percent", () => {
    expect(latencyMeter(0).fill).toBe(100);
    expect(latencyMeter(5000).fill).toBe(8);
  });
});
