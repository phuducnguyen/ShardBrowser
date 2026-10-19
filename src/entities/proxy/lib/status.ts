import type { ProxyTestSnapshot } from "../model/types";

export type ProxyStatus = "alive" | "dead" | "new" | "checking";

/// What a row says about a proxy. Derived, never stored: a snapshot with a TCP
/// round-trip is alive, a snapshot without one is dead, no snapshot is unchecked.
export function proxyStatus(snap: ProxyTestSnapshot | undefined, busy: boolean): ProxyStatus {
  if (busy) return "checking";
  if (!snap) return "new";
  return snap.tcp_ms != null ? "alive" : "dead";
}

export type LatencyTone = "good" | "mid" | "bad";

/// Bar for the Latency column: shorter round-trip, fuller bar.
export function latencyMeter(ms: number): { tone: LatencyTone; fill: number } {
  const tone: LatencyTone = ms < 120 ? "good" : ms < 250 ? "mid" : "bad";
  return { tone, fill: Math.max(8, Math.min(100, 100 - ms / 4)) };
}
