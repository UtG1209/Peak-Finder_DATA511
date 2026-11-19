Paste this into Claude Code in the repo root (after the files in the checklist below are in place).

---

You are working on Peak Finder, our DATA 511 team project. Read `CLAUDE.md` fully first; it is the source of truth for scope, screens, data shapes, models and rules. Then look at `docs/paper-prototype/` (our paper prototype photos), `docs/ai-vs-data-check.md`, and skim `docs/implementation-plan.pdf`. If the trail kit is in `pipeline/trail_kit/`, read its `docs/START_HERE_NEW_TRAIL.md` and `docs/LESSONS_LEARNED.md` too.

Before writing code, reply with: (1) a short summary of what you understood, (2) anything in CLAUDE.md that is unclear or contradictory, and (3) your plan for step 1. Wait for my OK.

Step 1, after my OK:
- Scaffold `app/` with React + Vite + TypeScript, MapLibre GL JS, D3, Framer Motion, Vitest.
- Write `scripts/make_fake_data.py` that generates fake data for ~50 real lower-48 national park hikes in exactly the shapes in CLAUDE.md section 4 (hikes, hike_month, travel, cost, profiles, advice, meta with "fake": true), into `app/public/data/`.
- Add `app/src/data/` loaders with TypeScript types matching those shapes.
- Implement the three models in `app/src/models/` (match, checkpoint times, cost) with Vitest tests, including the Angels Landing Q3 test case.
- Add `.github/workflows/ci.yml` (install, lint, test, build) and `deploy.yml` (GitHub Pages from `main`), and a `.gitignore` covering `node_modules`, `data/raw`, `.env`.
- A minimal Explore page that loads the fake data and shows hikes on the map, so we can see the deploy works.

Work on a branch `setup/scaffold`, commit in small steps, and stop after step 1 with a summary of what was built, how to run it (`npm run dev`, tests), and what's next. Don't change the data shapes or screen list without asking me.
