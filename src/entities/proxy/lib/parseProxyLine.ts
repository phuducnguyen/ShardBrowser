import type { ProxyEntry } from "../model/types";

export type ParsedProxyLine = {
  /** From the scheme when there is one we support, otherwise null (caller picks the default). */
  kind: ProxyEntry["kind"] | null;
  host: string;
  port: number;
  username: string;
  password: string;
};

const KIND_BY_SCHEME: Record<string, ProxyEntry["kind"]> = {
  http: "http",
  https: "https",
  socks5: "socks5",
  socks5h: "socks5",
};

/// One proxy line as people paste it: `host:port`, `host:port:user:pass`,
/// `user:pass@host:port`, any of those behind `scheme://`, with an optional
/// trailing `# name`. Returns null for anything else. Used for instant feedback
/// in the Manual tab; the Import tab leaves parsing to the backend.
export function parseProxyLine(raw: string): ParsedProxyLine | null {
  let s = raw.replace(/\s+#.*$/, "").trim();
  if (!s) return null;

  let kind: ParsedProxyLine["kind"] = null;
  const scheme = s.match(/^([a-z0-9]+):\/\/(.*)$/i);
  if (scheme) {
    kind = KIND_BY_SCHEME[scheme[1].toLowerCase()] ?? null;
    s = scheme[2];
  }

  let host: string;
  let port: string;
  let username = "";
  let password = "";
  const at = s.lastIndexOf("@");
  if (at > -1) {
    const cred = s.slice(0, at);
    [host, port] = s.slice(at + 1).split(":");
    const colon = cred.indexOf(":");
    username = colon < 0 ? cred : cred.slice(0, colon);
    password = colon < 0 ? "" : cred.slice(colon + 1);
  } else {
    const parts = s.split(":");
    if (parts.length !== 2 && parts.length !== 4) return null;
    [host, port, username = "", password = ""] = parts;
  }

  if (!host || !/^\d+$/.test(port ?? "")) return null;
  const n = Number(port);
  if (n < 1 || n > 65535) return null;
  return { kind, host, port: n, username, password };
}
