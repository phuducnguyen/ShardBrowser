import { useMemo } from "react";
import { filterProxies, useProxy } from "./useProxy";

/// The rows the table shows: search (name/host/port/country/notes/user + geo
/// snapshot) plus the type and status filters.
export function useFilteredProxies() {
    const proxies = useProxy((s) => s.proxies);
    const snapshots = useProxy((s) => s.snapshots);
    const search = useProxy((s) => s.search);
    const kind = useProxy((s) => s.kindFilter);
    const status = useProxy((s) => s.statusFilter);
    return useMemo(
        () => filterProxies(proxies, snapshots, search, kind, status),
        [proxies, snapshots, search, kind, status],
    );
}

/// proxy_id → bound-profile count (O(n) tally; n is small).
export function useProfileCountByProxy() {
    const profiles = useProxy((s) => s.profiles);
    return useMemo(() => {
        const out: Record<string, number> = {};
        for (const p of profiles) {
            if (p.proxy_id) out[p.proxy_id] = (out[p.proxy_id] ?? 0) + 1;
        }
        return out;
    }, [profiles]);
}
