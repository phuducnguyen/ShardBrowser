# Phase 02 — App shell & Profiles list

## Context links
- [Video analysis](research/video-analysis.md) · current UI: `src/app/App.tsx`, `src/widgets/ProfileTable/*`, `src/pages/browsers/index.tsx`

## Overview
Date 2026-10-16 · Priority high · Status: done in prototype, pending port

## Key insights
- Three-column shell: icon rail (76 px) · secondary panel (190 px: folders or form tabs) · content card.
- The `+` split button in the rail is the single entry to "New profile" from anywhere.
- Row = checkbox, #, name + OS icon, browser, status pill, proxy type, flag + address, **Run**, kebab.

## Requirements
- Rail with logo, primary `+`, nav icons with tooltips (`aria-label`), active indicator, theme toggle.
- Folder panel with colored dots; "All" default; click filters rows.
- Table: select-all, per-row select, hover state, kebab menu (Edit, Sharing, Manage in Folder, Duplicate, Delete), keyboard operable.

## Architecture
Prototype: vanilla JS view switcher (`profiles` / `new`). React port: keep Feature-Sliced layout — `widgets/ProfileTable`, `widgets/FolderTabs` (exists), new `widgets/AppRail`.

## Related code files
- `src/widgets/ProfileTable/{ProfileTable,ProfileRow,FolderTabs,ProfileToolbar}.tsx`
- `src/features/manage-profiles/ui/ProfileRowActions.tsx`

## Implementation steps
1. Build rail + header + folder panel. 2. Build table with sample rows. 3. Kebab menu with focus management. 4. Wire "+" to New Profile view.
5. Port: restyle existing components first (no logic change), then add `AppRail`.

## Todo
- [x] Shell  - [x] Table  - [x] Kebab  - [ ] React port  - [ ] Component tests (row actions, folder filter, select-all)

## Success criteria
Visual parity with video frames 1 and 9 at 1280×800; all controls reachable by keyboard; no console errors.

## Risks
Existing live-view/fleet widgets (`LiveView`, `FleetMonitor`) have no equivalent in the video → keep them, restyle only.

## Security considerations
Row actions that delete must keep the existing confirm flow (`ConfirmHost`).

## Next steps
Phase 03.
