# Errors log

Errors hit while cutting the dataset to 23 hikes, with cause and fix.

## CI: pipeline checks failed (run 45528060801, 2026-11-25)
- **Symptom:** 7 failed, 8 errors in `pipeline/checks`. Examples: `test_build` `assert 456 == 12 * 23`; `test_candidates`, `test_nps_facts`, `test_photos` id lists differ; `test_hikes` `KeyError: 'upper-yosemite-falls'`; `test_nps_visits` park sets differ; `test_photos` `FileNotFoundError` for `upper-yosemite-falls.jpg`.
- **Cause:** the cut trimmed `app/public/data` only. Pipeline catalogue CSVs and `data/processed/*.json` still had 38 hikes.
- **Fix:** `pipeline/cut_to_final.py` now also filters those files. 79 pipeline tests pass locally.
- **Status:** fix pushed, CI re-run pending.

## CI: `test_advice.py` ReadTimeout (same run)
- **Symptom:** 8 errors, `ReadTimeout` on `aqs.epa.gov` after 300 s.
- **Cause:** the EPA server was slow or unreachable. The tests passed in the earlier run.
- **Fix:** none needed yet. Re-run CI. If it repeats, cache the EPA data or skip these tests when offline.

## Earlier, local
- **Stale `.svg` photo references:** profiles kept pointing at deleted files. Deleted them and regenerated.
- **`sed -i` on macOS:** BSD sed needs `-i ''`. Redid the edit in Python.
- **`make_fake_data.py` regenerated 38 profiles:** it did not know the final list. Added a filter on `final_hikes.csv`.
- **`meta.hike_count` stuck at 38:** needed `hikes.py` before `meta.py --publish`.
- **e2e: 7 specs with hard-coded "38":** changed to 23, then 90 passed.
- **`No module named 'requests'`:** system Python lacks it. Use `.venv/bin/python`.
