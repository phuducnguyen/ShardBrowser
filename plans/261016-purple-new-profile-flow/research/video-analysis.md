# Video analysis — hidemyacc.com/media/fingerprint.webm

Source: 9.0 s, 2280×1280, AV1, 30 fps. Frames extracted with ffmpeg (4 fps) and read manually
(no Gemini key available, so no `ai-multimodal` call). Colors/fonts are **estimates** from pixels.
Reference stills: `.reference/hidemyacc/` (git-ignored, third-party).

## Flow (what the buttons do)
1. **Profiles list** → click `+` in the left rail.
2. **New Profile / Overview** → pick OS (Windows), OS version + UA string, browser (Brave), version, optional "Customize User Agent".
3. **Proxy tab** → radio cards `Free proxy [Use now!]` / `Your proxy` / `Without proxy`; icon button opens Proxy Manager. Free → Country select.
4. **Your proxy** → Connection type select (HTTP…), **Quick add** (`host:port:user:pass`) auto-fills the 4 manual fields, **Check Proxy** button.
5. Tab list highlighted in sequence (editing effect only — not product behaviour).
6. **Create** → returns to Profiles; new row `Facebook 1` appears at the top, status Ready, proxy flag + address.

## Layout (px at the 1280-wide frame)
| Region | Size | Notes |
|---|---|---|
| Icon rail | 76 w, full height | dark navy; logo top; primary `+` split button (blue, 2 stacked cells); round yellow "grid" button for active page; 7 icon items; 2 bottom icons |
| Page header | ~90 h | hamburger + uppercase page title (~24 px, 800) ; right: promo pill "Buy Proxy", dark pill "0 coin +", round avatar |
| Folder panel (list) / Tab panel (form) | 190 w, radius ~24, white, soft shadow | active item = raised white pill with shadow, text darker |
| Form top bar | ~55 h card | dashed-border name input, folder select, **Create** button (blue, ~200×42, radius 10) |
| Content card | white, radius ~24, padding ~24 | section label uppercase 15 px 600; fields ~580 w |
| Table | row height ~59 | cols: checkbox, #, name (+share icon, OS icon), browser, status pill, proxy type, flag+IP, Run button, kebab |

## Typography (predicted)
Rounded geometric sans, double-story `a`, open apertures — Google Sans / Product Sans family.
Closest Google Fonts: **Figtree** (UI), weight 400/500/600/800. Sizes: title 24/800 uppercase, section label 14–15/600 uppercase,
labels 15/600, inputs 15/400, table 14/400, status pill 12/600, tab items 15/400 (active 500).

## Color (observed → purple remap)
| Role | Observed | Purple version |
|---|---|---|
| Rail | navy `#0B1730` | deep violet `#1A1030` |
| Primary CTA (Create) | blue `#2F80F5` | violet `#7C3AED` |
| Selected radio card | pale blue fill + blue border | `#F3EEFF` fill + `#7C3AED` border |
| Secondary action (Check Proxy) | amber `#F2B23A` | lavender `#EDE4FF` / text `#5B21B6` |
| Active page dot | amber | orchid `#C084FC` |
| Run / Ready | green `#2FD08B` | keep semantic green |
| Surface / page bg | white / `#F6F6F8` | white / `#F6F4FB` |

## Components & states
- **Radio card**: 170×40, radius 8, 1 px border, trailing radio dot; selected = tinted fill + check dot.
- **Select**: white, soft shadow, no border, chevron; **dashed inputs** for text (name, quick add, manual fields).
- **Segmented OS/Browser**: bordered pill buttons with trailing radio dot; selected = tinted + colored dot.
- **Status pill**: mint bg, green text, radius 999. **Run**: green, radius 8, white 600 text.
- **Row kebab** menu (from docs): Edit, Sharing, Manage in Folder, Duplicate, Delete.

## Motion
Not much native motion in the clip: tab content swaps instantly, new row appears on return. Plan adds restrained
150–250 ms transitions (tab crossfade, radio card press, new-row highlight, toast) — see phase-03.

## Not reproduced (deliberately)
Ghost logo, "Buy Proxy"/coin promo, the cursor overlay, and the zoom/blur editing effect.
