# Peak Finder (DATA 511)

Where should I hike, when (which quarter), and how much will it cost? A static web app over free, public, past data for about 50 lower-48 national park hikes.

- **Live site:** https://utg1209.github.io/Peak-Finder_DATA511/ (after Pages is enabled; see `docs/CREDENTIALS.md`)
- **Source of truth:** [`CLAUDE.md`](CLAUDE.md). Plan: `docs/implementation-plan.pdf`. Paper prototypes: `docs/paper-prototype/`. Visual target: `docs/reference/oct29-prototype.html`.
- **Who does what:** [`docs/work/README.md`](docs/work/README.md) (four lanes, one brief each).

```bash
cd app && npm ci && npm run dev     # http://localhost:5173/
npm test && npm run lint && npm run build
python3 scripts/make_fake_data.py   # regenerate the placeholder data
```

The app currently runs on **fake data** (yellow banner). The pipeline (`pipeline/`) replaces it file by file.
