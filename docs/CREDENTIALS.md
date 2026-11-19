# API keys, accounts and passwords: what we need

**Short answer: no passwords, and only a handful of free API keys, all for the Python pipeline.** The web app never calls an API and never sees a key.
Everything below is free. Each person signs up for their own key (do not share keys in chat or git); the team lead does not need to collect any.

## Keys (store in `.env`, copy from `.env.example`; `.env` is git-ignored)

| Variable | Service | Lane | Needed for | Cost | Sign up |
|---|---|---|---|---|---|
| `ORS_API_KEY` | OpenRouteService | 2 | Drive time and distance, 10 cities x every hike (matrix API) | Free plan, daily request limits (check the dashboard; cache results) | https://openrouteservice.org/dev/#/signup |
| `EIA_API_KEY` | US Energy Information Administration | 2 | Regional gasoline price for the drive cost | Free | https://www.eia.gov/opendata/register.php |
| `GSA_API_KEY` | api.data.gov (GSA per diem) | 2 | Lodging and meals rates. If you prefer, download the FY2026 rates file instead and skip the key | Free | https://api.data.gov/signup/ |
| `NPS_API_KEY` | NPS Developer API | 1 and 2 | Optional: park fees, hours, alerts, to check NPS pages | Free | https://www.nps.gov/subjects/developer/get-started.htm |
| `SOCRATA_APP_TOKEN` | data.transportation.gov (DOT Table 6 fares) | 2 | Optional: higher rate limit. The API works without it | Free | https://data.transportation.gov/ (Developer settings) |
| `COMMONS_USER_AGENT` | Wikimedia Commons | 1 and 2 | Not a key: Wikimedia asks scripts to identify themselves. Use `PeakFinderDATA511/0.1 (your contact)` | Free | none |

## No key needed
NOAA GHCN-Daily through the NCEI access API (lane 1), EPA AirData daily AQI files by county (lane 1), NPS Visitor Use Statistics / IRMA (lane 1),
OpenStreetMap Overpass, AWS Terrarium elevation tiles and USGS imagery tiles (trail kit, lane 2). Some of these hosts are blocked in sandboxes: run on a laptop
or use the kit's browser fallback.

## Accounts and access (one-time)
| What | Who | Why |
|---|---|---|
| GitHub repo write access for all four of us | Repo owner (`UtG1209`): Settings, Collaborators | Everyone pushes branches and opens PRs |
| GitHub Pages: Settings, Pages, Source = **GitHub Actions** | Repo owner | Makes the shared live link work (`.github/workflows/deploy.yml`) |
| Branch protection on `main`: require the CI check to pass (optional but recommended) | Repo owner | Keeps the live site green |
| Node 22+, Python 3.13 on your laptop | Each person | `npm run dev`, the pipeline |

There are **no repository secrets** to add: the deploy workflow uses GitHub's built-in token only. If we ever need one, it goes in Settings, Secrets, never in the repo.

## Rules
- Never commit `.env`, a key, or a screenshot showing one. If a key leaks, revoke it at the provider and make a new one.
- Keys are used only by `pipeline/` scripts on your laptop. Processed JSON is what gets committed.
- Cache raw downloads in `data/raw/` (git-ignored) so you never hit a rate limit twice for the same request.
- Provider limits and sign-up pages change: if one of the links above is out of date, search for the provider's current "API key" page.
