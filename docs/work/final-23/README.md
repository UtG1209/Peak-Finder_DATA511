# Final 23 hikes: how to pick up the work

Decided 2026-11-24. Nothing built is cut. The list is `final_hikes.csv` in this folder (23 rows).
The older lane briefs (`../lane-*.md`, `../remaining-plan.md`, `../follow-ups.md`) stay as they are; these four plans sit on top of them.

## The 23
| Level | Count | Hikes |
|---|---|---|
| Easy | 6 | Fairy Falls, Mesa Arch, General Sherman, Moro Rock, Clingmans Dome, Anhinga |
| Moderate | 7 | Highline, Delicate Arch, Navajo Loop, Skyline, Inspiration Point, Cadillac North Ridge, Emerald Lake |
| Hard | 10 | Angels Landing, Bright Angel, Cascade Pass, Mount Washburn, Grinnell, Half Dome, Alum Cave, Ryan Mountain, Zion Narrows, Longs Peak |

Hard is 10, not 7, because every hike that already has real data or a walk stays. Fame decided the 7 new ones.
"Built" means: in `pipeline/catalogue/priority_hikes.csv` (real trailhead, cost and profile) or in `walks/manifest.json`.
- **7 new hikes** (placeholder data today): General Sherman, Moro Rock, Clingmans Dome, Anhinga, Emerald Lake, Zion Narrows, Longs Peak.
- **Mount Washburn** has a walk but placeholder trailhead, gain, elevation, cost and profile: it needs the priority treatment too.
- **15 hikes are cut from the dataset** (everything in `hikes.json` not in the CSV). Their photos, profiles and stop `.svg` placeholders go with them. Do this in one PR (Plan 1, step 1), never by hand-editing JSON.

## The four plans (disjoint files, run side by side)
| Plan | File | Who picks it | Owns |
|---|---|---|---|
| 1 | [plan-1-data-core.md](plan-1-data-core.md) | Python, data | the cut, `hikes.json`, `hike_month.json`, `advice.json`, `meta.json`, photos, checks, CLAUDE.md counts |
| 2 | [plan-2-travel-cost-profiles.md](plan-2-travel-cost-profiles.md) | Python, keys | `travel.json`, `cost.json`, `profiles/*.json` for the 8 hikes, the known gaps |
| 3 | [plan-3-walks.md](plan-3-walks.md) | Python plus patience | `walks/`, `walks/manifest.json`, the walk to app link |
| 4 | [plan-4-app-end-to-end.md](plan-4-app-end-to-end.md) | React | every screen, button and test at 23 hikes, the integration sweep, release |

Order: **Plan 1 step 1 first** (it fixes the list; about an hour). Then 1, 2, 3 run in parallel. Plan 4 starts its code work right away
(it needs no new data) and does its final sweep last. Plan 4 also owns the last PR that flips `"fake"` to `false`.

## How to start (any plan)
1. `git checkout main && git pull`, branch `final23/plan-<n>-<topic>`.
2. Tell Claude: "Read CLAUDE.md, docs/work/final-23/README.md and docs/work/final-23/plan-<n>-*.md, then do the steps in order."
3. `npm run setup`, `npm run doctor`. Keys (Plans 1 and 2 only): `docs/CREDENTIALS.md`.
4. One PR per numbered step or per two small steps. `npm run check` green before every PR. No co-author or AI trailers in commits or PRs (hook enforces it).

## Rules for all four (from CLAUDE.md, repeated because they bite)
- Never hand-edit `app/public/data/*.json`; change the pipeline, the catalogue CSVs or `scripts/make_fake_data.py`.
- Never invent a number: no source means a marked placeholder listed in `hikes_coverage.csv` or `follow-ups.md`.
- Data shapes, the screen list and the UX rules (CLAUDE.md sections 2 to 4) change only with the user's approval.
- Nothing from `walks/` loads on the first screen. Never re-run kit tile steps on a finished walk.
- Update CLAUDE.md in the same PR as anything it describes.

## Integration map: what feeds what (use it for the final sweep)
| Thing the user sees | Reads | Produced by |
|---|---|---|
| Explore map markers, size, colour, list, match % | `hikes.json`, `hike_month.json`, `travel.json` | Plans 1, 2 |
| Slider histograms, "Spin the wheel", empty-state fix, 3D view cones | same rows as the map (`models/match.ts`, `lib/explore.ts`) | Plan 4 checks |
| Hover card, photo tile | `hikes.json` photo plus credit, `cost.json` typical cost | Plans 1, 2 |
| "Walk it in 3D" button, cloud transition, walk Back button | `hikes.json` `featured`, `walk_path`, from `walks/manifest.json` | Plan 3 |
| Hike page header, gear, quarter strip, month strip | `hikes.json`, `hike_month.json` | Plan 1 |
| Advice vs data card | `advice.json` | Plan 1 |
| Timed elevation profile, scrubber, daylight band, stop photos | `profiles/<id>.json`, `hike_month.json` sunrise and sunset | Plan 2 |
| Cost graph, party size, nights, mode, popover sources | `cost.json`, `travel.json`, `meta.json` `cost_sources` | Plan 2 |
| Similar hikes | `models/twins.ts` over hikes plus months | Plan 4 checks |
| About page counts, sources, limits, work-in-progress notice | `meta.json` | Plans 1 and 4 |
| Share link, units toggle, theme toggle, Reset filters, Back | URL state in `lib/filters.ts` | Plan 4 checks |
| Banner "Work in progress" | `meta.json` `fake` | Plan 4 (last) |

External APIs exist only in the pipeline: NPS pages, NOAA NCEI, EPA AirData, NPS IRMA, FCC Area, OpenRouteService, DOT Table 6, GSA, EIA, Wikimedia Commons, OSM Overpass, AWS Terrarium tiles. The browser app calls none of them.

## Final goal (the whole project)
Each plan ends with a "Final goal and agent verification" section. A fresh verifier agent, not the author, checks it.
`npm run verify:final` (script `scripts/verify-final-23.mjs`) tests the data side by machine: `--plan 1` to `--plan 4` run a subset, no flag runs everything.
Today it fails on purpose (38 hikes, placeholders, no new walks); each plan turns its own lines green. The project is finished when `npm run verify:final` is all PASS and Plan 4's `FINAL_REPORT.md` is written.

## Plan 5 (separate, owned by the user)
[plan-5-hike-page-redesign.md](plan-5-hike-page-redesign.md): redesign what opens after "Open this hike" as graphs, plots and interactive dashboards, 3D where it helps. It does not block Plans 1 to 4 and changes only `app/src/screens/Hike/` and the charts.
