# Peak Finder: how the four of us work

Four lanes, one repo, one live link. Each lane has its own brief in this folder. Pick yours, read
`CLAUDE.md` once (it is the source of truth for scope, screens, data shapes and models), and start.
**Nobody waits for anybody**: the app already runs on fake data, and each lane swaps its own piece for real data.

| Lane | Brief | Owns | Produces |
|---|---|---|---|
| 1 | [lane-1-data-core.md](lane-1-data-core.md) | Hike catalogue, crowds, weather, air quality, daylight, checks | `hikes.json`, `hike_month.json`, `advice.json`, `meta.json` |
| 2 | [lane-2-travel-cost-walks.md](lane-2-travel-cost-walks.md) | Travel, cost, elevation profiles, 3D walks, cloud transition | `travel.json`, `cost.json`, `profiles/*.json`, `walks/`, `CloudTransition` |
| 3 | [lane-3-explore.md](lane-3-explore.md) | The Explore screen: filters, map, ranked list, wheel | `app/src/screens/Explore`, map and filter components, `match` model |
| 4 | [lane-4-hike-page-about.md](lane-4-hike-page-about.md) | Hike page, About page, user testing | `app/src/screens/Hike`, `About`, charts, `checkpoints` and `cost` models |

Names go in each brief's "Owner" line. Lanes 1 and 2 are Python (`pipeline/`). Lanes 3 and 4 are React (`app/`).

## The shared UI (everyone sees the same thing, any time)

- **Live site** (updates on every merge to `main`): https://utg1209.github.io/Peak-Finder_DATA511/
  One-time setup by a repo admin: Settings, Pages, Source = "GitHub Actions". Until then run it locally.
- **Every branch and PR** uploads a downloadable build ("app-build-<sha>") on the Actions tab, so you can look at
  someone's work before it is merged.
- **Locally**: `cd app && npm ci && npm run dev` then open http://localhost:5173/. Needs Node 22+.
- A yellow banner says "Sample data" while `app/public/data/meta.json` has `"fake": true`. Real data removes it.

## Run it

```bash
cd app
npm ci
npm run dev            # the app, with hot reload
npm test               # models, URL state, and the data contract on app/public/data
npm run lint && npm run build
npm run validate:data  # only the data contract (use this when you produce data)

python3 scripts/make_fake_data.py   # regenerate the fake data (lane 1/2 replace its files one by one)
```

## The rules (short)

1. **The data shapes are frozen** (CLAUDE.md section 4, enforced by `app/src/data/schema.ts` and the contract test).
   To change one: open a PR labelled `contract`, and all four of us approve it. Never edit another lane's output by hand.
2. **Small PRs into `main`, one feature each.** Branch names: `lane-1/ghcn`, `lane-3/wheel`. CI must pass (lint, tests, build).
   Merge to `main` at least weekly so the live link always shows the latest.
3. **Stay in your lane's files.** If you need a change in someone else's file, ask in the group chat or open a PR and tag them.
   Shared files (`schema.ts`, `styles.css` tokens, `CLAUDE.md`) change only through a PR everybody sees.
4. **Fake data keeps you unblocked.** Real data lands by replacing files in `app/public/data/` with pipeline output that
   passes `npm run validate:data`. Do not commit half-real files: replace a whole file or none.
5. **Never commit secrets.** Keys live in `.env` (git-ignored). See [../CREDENTIALS.md](../CREDENTIALS.md).
6. **Every number has a source; "typical", not exact.** The seven UX rules in CLAUDE.md section 3 apply to every screen.
7. **Decisions we made on our own** (and need the team to confirm) are in [../DECISIONS.md](../DECISIONS.md).

## What is already built (the base)

- `app/`: React + Vite + TypeScript, MapLibre, D3, Framer Motion, Vitest. Dark, sand-orange look from the 29 Oct prototype
  (`docs/reference/oct29-prototype.html`); one accent token (`--accent`) in `app/src/styles.css`.
- `app/src/data/`: zod schemas (the contract), loaders, `useData()` hook, loading and error states.
- `app/src/models/`: `match.ts`, `checkpoints.ts`, `cost.ts` with 60 tests, including the Angels Landing Q3 case.
- `app/src/lib/`: URL filter state (`filters.ts`, `useFilters`), `explore.ts` (score every hike, empty-state fix), cities, quarters.
- `app/src/screens/`: Explore (working, with a guided start: blurred map until "Show hikes", and one colour per difficulty), Hike (header, quarter cards, cost graph; month strip and timed profile still to build), About (placeholder).
- `scripts/make_fake_data.py`: the 40 hikes, 480 months, 400 travel rows, 1,600 cost rows, 40 profiles, 7 advice cards (about 585 KB, profiles aside).
- `.github/workflows/`: `ci.yml` (lint, tests, build, artifact) and `deploy.yml` (GitHub Pages from `main`).

## Dates (from the plan)

| Gate | Date | Means |
|---|---|---|
| G1 contract frozen | Sun 15 Nov (passed) | 40+ hikes listed, shapes agreed, repo + fake data + auto-deploy live |
| G2 real data in | **Fri 20 Nov** | Pipeline v1 passes its checks; the live map shows real crowds, weather, air quality |
| G3 feature complete | Tue 1 Dec | Every Must in the plan works on real data on the live link |
| G4 code freeze | Fri 4 Dec | Round 2 testing done, severity 3 and 4 issues fixed, About complete; after this only bug fixes |
| Last class | Fri 11 Dec | Final presentation and report |

Thanksgiving week (26 and 27 Nov) only carries fixes from test round 1 and the cost view.
