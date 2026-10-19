# Phase 03 — New Profile flow

## Context links
- [Video analysis](research/video-analysis.md) · current UI: `src/features/manage-profiles/ui/{NewProfileButton,ProfileInlineEditor,ProxySelect}.tsx`

## Overview
Date 2026-10-16 · Priority high · Status: done in prototype, pending port

## Key insights
- One persistent top bar (name, folder, **Create**) stays visible across all tabs → Create is always one click away.
- Proxy "Quick add" parses `host:port:user:pass` into the manual fields instantly; Check Proxy gives inline feedback.
- Segmented radios (OS, browser) beat dropdowns for 4–5 options: fewer clicks, all options visible.

## Requirements
- Tabs: Overview, Proxy, Extensions, Timezone, WebRTC, Geolocation, Advanced, Cookies, Bookmarks (vertical tablist, arrow-key navigation).
- Overview: OS (5), OS version, UA string, browser (5), version, Customize UA toggle.
- Proxy: Free / Your / Without; Free → country; Your → type, quick add, 4 fields, Check Proxy (loading → success/error state).
- Create validates the name, adds the row at the top, shows a toast, returns to Profiles.
- Motion: tab crossfade 150 ms, radio press 120 ms, new-row highlight 1.2 s, honors `prefers-reduced-motion`.

## Architecture
Single form state object → serialized on Create. In the React port: map to the existing profile create API call (no backend change); validation with a small schema.

## Related code files
- `src/entities/profile/model/*`, `src/features/manage-profiles/ui/*`, `src/shared/i18n/locales/en.json`
- Fingerprint pickers: `src/features/manage-fingerprints/*` (more devices/fingerprints are added there)

## Implementation steps
1. Header bar + vertical tabs. 2. Overview tab. 3. Proxy tab with parser + Check Proxy (simulated in prototype).
4. Remaining tabs (simple controls). 5. Create → list. 6. Port with tests: parser unit tests, tab keyboard nav, Create validation, proxy mode switching.

## Todo
- [x] Prototype flow  - [ ] Map each field to existing API fields  - [ ] React port  - [ ] Tests  - [ ] en strings → vi.json

## Success criteria
Flow in the video reproducible end-to-end in ≤ 6 clicks; parser handles `host:port`, `host:port:user:pass`, `user:pass@host:port`; tests green; en and vi keys in parity.

## Risks
Fields shown in the video that the core does not support (e.g. Bookmarks tab, Brave/Yandex browsers) → render only what the engine supports; mark others "coming soon" or hide.

## Security considerations
Proxy credentials: never log, mask password field, no persistence in localStorage; Check Proxy must go through the existing backend command, not the browser.

## Next steps
Phase 04 after prototype approval.
