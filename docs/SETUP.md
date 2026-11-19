# Setup: from a fresh clone to a running app

Works on macOS, Linux and Windows (use WSL or Git Bash on Windows). You do **not** need any API key to run or work on the app.

```bash
git clone https://github.com/UtG1209/Peak-Finder_DATA511.git
cd Peak-Finder_DATA511
npm run doctor      # checks Node >= 22, npm, Python >= 3.9 (changes nothing)
npm run setup       # npm ci inside app/
npm run dev         # http://localhost:5173/   (hot reload; the 3D walks are served at /walks/<id>/)
```

Node 22 is pinned in `.nvmrc` (`nvm use`). Same commands exist as `make setup`, `make dev`, `make check` (`make help`).

## Everyday commands (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | The app with hot reload |
| `npm test` | Models, URL state and the **data contract** on `app/public/data` |
| `npm run lint` | ESLint |
| `npm run build` | Production build into `app/dist`, including the 3D walks (`SKIP_WALKS=1` leaves them out) |
| `npm run check` | Everything CI runs: CLAUDE.md consistency, lint, tests, build (no walks), performance budget |
| `npm run docs:check` | Only the CLAUDE.md consistency check |
| `npm run e2e` | Browser smoke test (needs `npx playwright install chromium` once, in `app/`): Show hikes, map visible, hike page, Back |
| `npm run validate:data` | Check `app/public/data/*.json` against the schemas. **Run this on any data you produce** |
| `npm run fake-data` | Regenerate the placeholder data (deterministic: same output every run) |

## Is my checkout healthy?
`npm run check` should finish green on a clean clone. CI runs the same plus a check that the committed fake data equals what
`scripts/make_fake_data.py` produces, so never hand-edit `app/public/data/*.json`: change the generator or the pipeline.

## Pipeline lanes only (Python)
```bash
python3 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r pipeline/requirements.txt
cp .env.example .env                                    # fill in only the keys your lane needs (docs/CREDENTIALS.md)
```
`.env` and `data/raw/` are git-ignored. The trail kit has its own requirements: `pipeline/trail_kit/requirements.txt`.

## The 3D walks
`walks/<id>/` holds finished static sites (about 35 MB each). The app only links to them: **nothing from `walks/` is loaded until someone clicks
"Walk it in 3D"**. See `docs/DECISIONS.md` ("Walks: size and hosting") before adding more.

## Seeing the live site
`https://utg1209.github.io/Peak-Finder_DATA511/` updates on every merge to `main` (repo admin: Settings, Pages, Source = GitHub Actions, once).
Branch builds are downloadable from the Actions tab (artifact `app-build-<sha>`, without the walks).

## Troubleshooting
- **Blank map in dev**: hard-refresh; check the console. The map worker is bundled explicitly in `src/components/UsMap.tsx`.
- **`npm ci` fails with an engine error**: you are on Node < 22.
- **Tests fail on `data-contract`**: you changed `app/public/data` by hand or a shape. Run `npm run fake-data`, or fix your pipeline output.
- **Port 5173 busy**: `npm run dev -- --port 5180`.

## Working with your own agent (Claude Code, Codex, Cursor...)
Open the agent in the repo root. It reads `CLAUDE.md` first (`AGENTS.md` points there): scope, screens, data shapes, rules, and which lane brief to follow.
Tell it which lane you own. `CLAUDE.md` is checked in CI against the code, so what it says is current: if you notice it is wrong, fix it in your PR.
