# Lane 2: Travel, cost, elevation profiles, 3D walks

**Owner:** ______________  **Language:** Python 3.13, plus one React component  **Needs keys:** OpenRouteService, EIA, GSA (see [CREDENTIALS](../CREDENTIALS.md))

You make the numbers behind How much and the timed trail, and you connect the finished 3D walks to the app.

## What you produce
| File | Rows | Source | Notes |
|---|---|---|---|
| `travel.json` | hike x 10 cities | OpenRouteService matrix, DOT Table 6 | `drive_hr`, `drive_mi`, nearest `airport`, `fly_drive_hr`, `default_mode` (whichever is shorter door to trailhead) |
| `cost.json` | hike x 10 cities x 4 quarters (~2,000) | DOT Table 6 (Socrata, no key), GSA per diem, EIA gas, NPS fees | **Unit inputs**, not totals, so the browser applies party size, nights, mode live: `fare_one_way`, `car_per_day` (60, assumed), `drive_mi`, `gas_per_gal`, `mpg` (25), `lodging_per_night`, `meals_per_day`, `entry_fee_vehicle`, `permit_fee`, and a `sources` object |
| `profiles/<id>.json` | 1 per hike | trail kit s1 to s3 (OSM + AWS Terrarium tiles) | `points` = `[dist_m, elev_m]` every 10 m, `osm_length_m`, `nps_length_m` (one way for out-and-back), `scale`, `checkpoints` with names and photos |
| `walks/<id>/` | 3 | trail kit output | `angels_landing`, `grand_canyon`, `north_cascades`; copied into the Pages build by `deploy.yml` |
| `CloudTransition` | 1 component | the 29 Oct prototype | See below |

## Scripts (in `pipeline/`)
`travel.py`, `cost.py`, `profiles.py`. Raw downloads cached in `data/raw/`. The trail kit lives in `pipeline/trail_kit/` (read its
`docs/START_HERE_NEW_TRAIL.md` and `docs/LESSONS_LEARNED.md` first). Lane 1's `build.py` merges your output.

## Facts and traps
- **Drive times**: OpenRouteService matrix API, one request for 10 origins x many destinations (mind the free-plan limits; cache everything).
- **Fares**: DOT Consumer Airfare Report Table 6 average one-way fare by quarter and airport pair. The data lags about one quarter.
  Known answer: **SEA to LAS, Q3 2025 = $169.78**. Home-city airports: SEA, SFO, LAX, PHX, DEN, DFW, ORD, ATL, NYC (use JFK/LGA/EWR consistently), DCA.
- **Lodging and meals**: GSA per diem. It varies by month at only 18 of 51 parks; elsewhere flat. Known answer: Springdale $110 in July and October (FY2026).
- **Gas**: EIA regional price by home city's region. **Entry fees and permits**: NPS pages, by hand.
- **Profiles**: run the kit's s1 to s3 for each hike. Data hosts may be blocked in sandboxes; run on a laptop or use the kit's browser fallback.
  Check profile length against the NPS length: if more than 15% off, keep the NPS figure and set `scale` (OSM shortens switchbacks: Angels Landing
  is 3.3 km mapped vs about 4.3 km official). Checkpoints: the kit's photo stops for featured hikes; for the rest, named landmarks from the NPS
  page, else every quarter of the distance plus the summit or turnaround. **Checkpoint `dist_m` is in profile (OSM) metres**, before scaling.
- **Walks**: **never re-run s2/s3 on a finished trail**; rebuild from its cache (a fresh download can change the route). Walk pages must keep
  their credits (USGS imagery, Mapzen/AWS terrain, OpenStreetMap, each photo's Commons credit). Walk pages take `?season=winter|spring|summer|autumn`.
- Check the checkpoint-time model against NPS time estimates for 5 hikes; if far off, tell lane 4: we apply one global correction factor and say so on About.

## CloudTransition (React)
Reuse the cloud layers from `docs/reference/oct29-prototype.html` (search for `#clouds`, `#clFar`, the keyframes, and the code that
plays them). Build `app/src/components/CloudTransition.tsx`: clouds rush in, white-out, trail name, clouds part, then open
`walks/<id>/index.html?season=<season>` (Q1 winter, Q2 spring, Q3 summer, Q4 autumn). **Back** plays the clouds in reverse and returns to where the
user came from, scrolled where they left it. With `prefers-reduced-motion`, use a fade. Lane 4 calls it from the "Walk it in 3D" button; agree
the props with them (suggest `{ hikeId, season, onDone }`).
- Checkpoint times from the hike page should show on the walk's bottom elevation strip: add a `?times=` parameter handling in the walk template
  (`pipeline/trail_kit/template/template.html`) and rebuild from cache only.

## Acceptance
- [ ] `npm run validate:data` passes (from `app/`).
- [ ] Known answers: SEA-LAS Q3 2025 fare $169.78; Springdale GSA lodging $110 (July and October); Angels Landing profile scale about 1.31.
- [ ] Every hike has 10 travel rows and 40 cost rows, and a profile within 15% of the NPS length or a documented `scale`.
- [ ] Every `sources` string names a real source and period, never "(fake)".
- [ ] Three walks load from `https://utg1209.github.io/Peak-Finder_DATA511/walks/<id>/` with credits intact.
- [ ] The cloud transition works forward and in reverse, and respects reduced motion.

## Order of work
1. `profiles.py` for all hikes (lane 4 needs real profiles for the timed chart); copy the three walks into `walks/`.
2. `travel.py` then `cost.py` (G2 is Fri 20 Nov for the pipeline; cost view is the Thanksgiving-week priority).
3. `CloudTransition` with lane 4.

## Do not
Change a data shape (contract PR), re-run s2/s3 on a finished trail, or commit `.env`.
