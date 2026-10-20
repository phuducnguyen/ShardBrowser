# HeroV — Cloud first, Community and Commercial editions

Date 2026-10-20 · Status: **owner decisions recorded, plan proposed** · Supersedes the order in [release-plan.md](release-plan.md) (Cloud moves ahead of Profile workflow and Automation). Work packages stay in [feature-roadmap.md](feature-roadmap.md).

## 1. Decisions (owner, 2026-10-20)
| # | Decision |
|---|---|
| 1 | Release order: **Cloud first**. Goal one is a self-hosted **Community** edition; then a **Commercial** edition sold as a subscription with more features. |
| 2 | Backend changes approved for the profile-workflow work: tags (2.1), activity log (2.6), backup/restore (2.7), `write_text_file` (2.9). One commit per change, with tests. |
| 3 | Android focus: independent environment, fingerprint and device checks built as the engine's own core, learning from the reference projects (ideas only; no code copied from non-commercial/AGPL/unlicensed projects). |
| 4 | Repo history: commits carry the owner as sole author, no tool attribution; conventional-commit messages. Small, detailed commits pushed as they land. |
| 5 | Server language: **Rust with axum** (same toolchain as the launcher; shared types possible). |
| 6 | Community licence: **source-available with conditions**. The product keeps the HeroV name and logo; forks may not remove or replace the branding, and commercial hosting of the Commercial feature set needs a licence. Exact text to be drafted from a known template (e.g. a fair-code style licence) and reviewed by a lawyer before publishing. |

## 2. New release order
| Version | Theme | Notes |
|---|---|---|
| 0.2.0 | **Cloud alpha (self-host)** | Spec first, then service + client sync. Pulls in tags (2.1) and backup format (2.7), which sync touches. |
| 0.3.0 | **Community release** | Docker compose for any VPS (Dokploy file included), install guide, licence file, update channel. |
| 0.4.0 | **Team + Commercial gate** | Organisations, roles, sharing, audit log, licence/subscription check. |
| 0.5.0 | Profile workflow | Remaining WPs of old 0.2.0 (create N, task centre, bulk cookies, activity, undo). |
| 0.6.0 | Fingerprint quality + Android core | Second track, starts in parallel from 0.3.0 (section 5). |
| 0.7.0 | Automation and professional UX | Automation un-held here. |

One developer: the Cloud server track is calendar-bound, so fingerprint/Android research fills the gaps.

## 3. Editions
**Community (self-hosted, free).** One organisation on your own server. Sync of profiles, folders, proxies, bookmarks, settings; encrypted cookie/profile bundles; device list; backup/restore; tags; basic roles (owner + members); local API. Limits by design: no vendor-run cloud, community support, soft seat cap (e.g. 5).

**Commercial (subscription).** Community plus what buyers pay for in the market:
- Vendor-hosted cloud (no server to run), higher profile and seat limits.
- Team: custom roles, per-profile and per-folder permissions, sharing and ownership transfer, owner force-stop, invitations, audit log with export.
- Automation: no-code builder, recorder, schedule, templates, run history, REST/MCP API keys.
- Proxy tools: managed pool and health monitoring, per-role proxy permissions.
- Operations: bulk actions at scale, window synchroniser, activity history, SSO (later), priority support.
- Priced by profile tier, seats as an add-on; yearly discount; free trial.

## 3b. Limits and billing policy (modelled on HideMyAcc's public pricing page)
What the page shows (read 2026-10-20; the Monthly/Yearly toggle says "Discount 50%" and does not say which of the two prices is which, so confirm before copying numbers):
| Plan | Price shown, per month | Profiles | Free sub-accounts |
|---|---|---|---|
| Mini | $10 / $5 | 5 | none listed |
| Starter | $29 / $15 | 30 | none listed |
| Base | $49 / $25 | 100 | 1 |
| Team | $99 / $49 | 300 | 3 |
| Business | $199 / $99 | 1,000 | 5 |
| Share | $5 / $3 | cannot create profiles | acts as a sub-account on shared items only |
| Customized | contact support | any | own server, unlimited sharing |
Policy points: every paid plan has a 7-day free trial; more sub-accounts can be bought on the higher plans; **API, folders, quick profiles, sharing, mobile OS profiles unlock at Base**; import/export only on Business; payment inside the software. Refund and renewal terms sit on separate pages that were not read.

HeroV mapping (proposal, numbers are placeholders until pricing is decided):
| HeroV tier | Edition | Profiles | Seats | Gated features |
|---|---|---|---|---|
| Community | self-host, free | 50 per server | owner + 4 | sync, backup, tags, basic roles, local API |
| Starter | Commercial | 30 | 1 | hosted cloud, sync |
| Pro | Commercial | 100 | 1 free + paid | API keys, sharing, folders, **Android and iOS profiles (Pro and above only; Community and Starter get Windows, plus macOS and Linux when they ship)** |
| Team | Commercial | 300 | 3 free + paid | roles, audit log, automation |
| Business | Commercial | 1,000 | 5 free + paid | import/export, priority support |
| Share seat | Commercial add-on | none | 1 | open shared items only |
| Custom | Commercial | any | any | own-server deployment support |
Rules: profile count is the main price axis; extra seats are an add-on; 7-day trial; yearly billing about half off (verify wording); limits enforced by a signed licence claim the client checks offline, so a lapsed plan locks creation, never deletes data.

## 4. Market scan (public pages only, no reverse engineering)
Figures come from comparison blogs that disagree with each other; confirm on vendor pages before pricing HeroV.
| Product | What is sold | Pattern to note |
|---|---|---|
| Multilogin | Tiers by profile count; API from the first paid tier; extra seats ~$20-30 | Seats priced separately. |
| GoLogin | ~$9-24/month by profile count; REST API on paid plans; cloud sync and team in paid tier | Cheap entry, team gated. |
| AdsPower | ~$9/month for 10 profiles; Local API, RPA builder, Selenium/Puppeteer, MCP; team plan custom | Automation (RPA) and API are the upsell. |
| Dolphin Anty | Plans by profile count; extra users from ~$10/month; role-based access, automation API, RPA | Seat add-on, RBAC. |
| Octo Browser | Starter / Base / Team / Advanced; local API from Base | Team tier unlocks collaboration. |
| Incogniton | Seats included in higher plan, extra seats ~$5/month | Low-cost seats. |

Sources: [Proxying](https://www.proxying.io/blog/best-anti-detect-browsers), [Afina](https://afina.io/en/blog/best-antidetect-browsers-comparison-2026), [DataResearchTools](https://dataresearchtools.com/anti-detect-browser-pricing-comparison-2026/), [Coronium](https://www.coronium.io/partners/antidetect-browsers), [Pixelscan](https://pixelscan.net/blog/best-free-antidetect-browsers/).

Takeaways: (1) price by profile count, seats as add-on; (2) API and automation are the paid upsell; (3) roles, audit log and sharing gate the team tier; (4) a free self-hosted edition without team features already exists in the market, so Community must be useful alone and Commercial must add team and hosted convenience.
HideMyAcc specifics come only from its public release notes already summarised in `gap-analysis.md`; the search found no independent pricing source for it.

## 5. Android core (independent environment, fingerprint, device checks)
Goal: every Android profile is an isolated, internally consistent device.
1. **Device as a unit.** One record per device: UA, client hints, screen/DPR, touch, sensors, battery, memory/cores, WebGL/WebGPU, fonts, media codecs, TLS/HTTP2 shape. Fields never mix across devices; `check:fingerprints` rejects inconsistencies.
2. **Independent environment per profile.** Own data dir, own noise seeds, own network identity (proxy, WebRTC, timezone, language); no shared cache or storage; a cross-profile leak test proves it.
3. **Device checks as engine tests.** A fixed suite (CreepJS plus our own probes: UA vs hints vs platform, screen vs window, touch vs pointer media queries, GPU vs WebGL parameters, locale vs timezone vs IP) runs before each release.
4. **WebGL parameter truth.** Synthetic parameter sets fail CreepJS's allow-list, so only real captures fix it. Without phones: collector page (3.1) + converter (3.2) given to willing contacts or a rented device farm. Until then Android entries are labelled experimental.
5. **Learn, do not copy.** Reference projects stay ideas-only (`docs/references/fingerprint-reference-projects.md`).
Acceptance: 10 distinct real-device captures clean in CreepJS; zero consistency errors; leak test passes across 20 profiles.

## 6. First task of 0.2.0: Cloud spec
Spec written: [docs/specs/cloud-sync.md](../../docs/specs/cloud-sync.md) (draft 1). Covers: service stack (Rust axum or Node Fastify), Postgres + S3-compatible storage, auth (argon2id, TOTP), client-side encryption with a passphrase-derived key the server never sees, revision-based sync with a conflict list, Dokploy compose, backup and restore drill. Edition gating (licence claim checked by client and server) is designed in the same spec.

## 7. Open questions
- ~~Server language~~ decided: Rust axum.
- ~~Licence~~ decided in principle: source-available with branding conditions; text still to draft and have reviewed.
- Seat and profile limits per edition; trial length (proposal in section 3b).
- Whether the hosted Commercial cloud runs on your VPS or a managed provider.

### Decisions still to take before building the Cloud (recorded 2026-10-20, owner has deferred them to the plan)
1. Open `src-tauri/src/cloud/` as the one new module of the frozen core, for the Cloud program.
2. Offer a "device-only key" mode (no recovery code) next to the recovery-code mode.
3. Licence service: separate tiny service or inside the website backend.
4. Where `herov-server` lives: `server/` in this repository as its own Cargo workspace (recommended, keeps spec and code together) or a separate repository.

### Blocking question: the browser engine's licence (raised 2026-10-20)
The engine the app downloads is closed source and its published terms (summarised in `docs/engine-and-api-reference.md`, section Licensing) do **not** permit using it "as part of a commercial anti-detect, browser or fingerprint-spoofing product or service" and say to contact the authors before building a commercial product on it. The Commercial edition (subscription) and the hosted cloud sell exactly that. Needed before any paid tier ships: written permission or a commercial licence from the engine's authors, or an engine HeroV may lawfully build on. Until resolved, treat the Commercial edition as unlaunchable and keep the Community edition's wording to what the engine terms allow.
