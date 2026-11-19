# Contributing to Peak Finder

This is a UW DATA 511 team project. The repo is public so it can be read and shown, but **nothing reaches `main` without the owner's approval**.

## How changes get in
1. **Teammates** work on a branch in this repo (`lane-N/<feature>`); **everyone else** forks the repo and opens a pull request from the fork.
2. Open a pull request into `main`. The three CI checks (`app`, `pipeline`, `walks`) must pass.
3. **The owner (`@UtG1209`) must approve every pull request**, including pull requests from forks and from teammates. `main` is protected: no direct pushes, no force pushes, no deletions.
4. CI on pull requests from forks does not run until the owner approves the run (so a fork cannot use our Actions minutes or run arbitrary code unreviewed).

## Before you open a PR
- `npm run check` passes locally (see `docs/SETUP.md`).
- Read `CLAUDE.md` (scope, data shapes, rules) and your lane's brief in `docs/work/`.
- Never commit secrets (`.env` is ignored), never hand-edit `app/public/data/*.json`.
- Commit messages are written by you: no AI co-author trailers (CLAUDE.md rule 6; `npm run setup` installs a hook that strips them).
- Update `CLAUDE.md` in the same PR if you change a shape, screen, rule, command or the layout.

## Data and photos
Photos are Wikimedia Commons only, under Public domain, CC0, CC BY or CC BY-SA, always credited. Data comes from public US sources listed in `docs/CREDENTIALS.md` and `app/public/data/meta.json`.
