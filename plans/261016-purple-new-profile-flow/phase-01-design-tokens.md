# Phase 01 — Design tokens & typography

## Context links
- [Video analysis](research/video-analysis.md) · prototype `docs/design-prototypes/new-profile-flow/styles.css`

## Overview
Date 2026-10-16 · Priority high · Status: done in prototype, pending port

## Key insights
- The look is driven by few tokens: big radii (24 / 10 / 8), soft shadows instead of borders, dashed text inputs, one strong CTA color.
- Selected = tinted fill + colored border/dot; never solid fill except the primary CTA.

## Requirements
- CSS variables for color, radius, shadow, spacing (4 px base), type scale; light + dark themes.
- v2: brand seed `#535efd` (ShardX `--color-primary-base`); brand fills actions, Material tone 40 (`#3c47e8`) for text/icons on light; tonal surfaces from the neutral-variant ramp; state layers 8% hover / 12% press via `color-mix`. Port must reuse the existing ui-kit tokens (`--color-primary-*`, success/error/warning) instead of duplicating them.
- Font: Figtree 400/500/600/800 (predicted match for the video's Google-Sans-like face).
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for controls and focus rings.

## Architecture
`:root` tokens → `[data-theme="dark"]` overrides. In the React port these become `ui-kit/src/styles/tokens.css` (consumed by Tailwind 4 `@theme`).

## Related code files
- Prototype: `styles.css` (tokens block)
- Port target: `ui-kit/src/styles/*`, `ui-kit/scripts/copy-tokens.mjs`

## Implementation steps
1. Define palette (violet 50–900 scale, neutral cool-gray, semantic green/red/amber).
2. Define radius/shadow/spacing/type tokens.
3. Dark theme overrides; verify contrast.
4. Port: map to ui-kit `tokens.css`, rebuild package (`npm run build:ui-kit`).

## Todo
- [x] Tokens in prototype  - [ ] Contrast audit tool pass  - [ ] ui-kit port

## Success criteria
No hard-coded colors outside the token block; both themes readable; Lighthouse a11y ≥ 95 on the prototype.

## Risks
Changing ui-kit tokens recolors every existing screen at once → do it behind a branch and review all pages.

## Security considerations
Fonts loaded from Google Fonts in the prototype only; the app should bundle the font locally (offline desktop app, no CDN at runtime).

## Next steps
Phase 02.
