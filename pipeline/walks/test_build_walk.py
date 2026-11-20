"""Unit tests for the walk tooling. Standard library only:  python3 -m unittest discover -s pipeline/walks -v"""
import json
import tempfile
import unittest
from pathlib import Path

import build_walk as bw

HTML = """<html><body>Spring Summer Autumn Winter
<a id="backToHike" href="/">Back to Test</a><div id="backTransition"></div><svg><g id="timeMarkers"></g></svg>
<script>const params = new URLSearchParams(location.search); const season = params.get('season');
const back = params.get('back'); const times = params.get('times');
const PROFILE = %s;
</script>
Imagery: USGS The National Map. Elevation: Terrain Tiles (Mapzen). (c) OpenStreetMap. Wikimedia Commons. Season view is illustrative.
<img src="photos/start.jpg"><img src="clouds/mass.webp"></body></html>"""


def points(n=40, step=10, gain=1.0):
    return [[-112.0 + i * 1e-4, 37.0 + i * 1e-4, i * step, 1000 + i * gain] for i in range(n)]


def make_walk(root: Path, html=None, photos=("start.jpg", "start_winter.jpg")):
    (root / "photos").mkdir(parents=True)
    (root / "clouds").mkdir()
    (root / "dem" / "13").mkdir(parents=True)
    (root / "img" / "13").mkdir(parents=True)
    (root / "dem" / "13" / "a.png").write_bytes(b"x")
    (root / "img" / "13" / "a.jpg").write_bytes(b"x")
    for p in photos:
        (root / "photos" / p).write_bytes(b"x")
    (root / "clouds" / "mass.webp").write_bytes(b"x")
    (root / "index.html").write_text(html or HTML % json.dumps(points()), encoding="utf-8")


HIKE = {"id": "t", "name": "Test", "park_name": "Test Park", "route_type": "out-and-back", "length_mi": 0.5, "length_type": "round-trip",
        "max_elev_ft": 3500, "trailhead": {"name": "TH", "lat": 37.0, "lon": -112.0}, "end": {"name": "End", "lat": 37.0039, "lon": -111.9961}}


class Helpers(unittest.TestCase):
    def test_haversine(self):
        self.assertAlmostEqual(bw.haversine_m(0, 0, 0, 1), 111195, delta=200)
        self.assertEqual(bw.haversine_m(37, -112, 37, -112), 0)

    def test_parse_profile_and_summary(self):
        pts = bw.parse_profile(HTML % json.dumps(points()))
        s = bw.route_summary(pts)
        self.assertEqual(s["length_m"], 390)
        self.assertAlmostEqual(s["gain_m"], 39.0)
        self.assertEqual(s["start"], (37.0, -112.0))

    def test_parse_profile_rejects_garbage(self):
        with self.assertRaises(ValueError):
            bw.parse_profile("<html>no profile here</html>")
        with self.assertRaises(ValueError):
            bw.parse_profile("const PROFILE = [[1,2,3]];")

    def test_credits_and_seasons(self):
        self.assertEqual(bw.missing_credits(HTML), [])
        self.assertIn("OpenStreetMap", bw.missing_credits(HTML.replace("OpenStreetMap", "")))
        self.assertEqual(bw.missing_seasons(HTML), [])
        self.assertIn("Winter", bw.missing_seasons(HTML.replace("Winter", "")))
        self.assertIn("?season= query parameter", bw.missing_seasons(HTML.replace("URLSearchParams", "")))

    def test_referenced_files(self):
        self.assertEqual(bw.referenced_files(HTML), ["clouds/mass.webp", "photos/start.jpg"])

    def test_referenced_files_sees_the_dynamic_cloud_preloader(self):
        html = HTML + "<script>im.src = 'clouds/' + n + '.webp';</script>"
        self.assertIn("clouds/cumulus.webp", bw.referenced_files(html))
        shared = html.replace("'clouds/'", "'../_shared/clouds/'")
        self.assertIn("../_shared/clouds/wisps.webp", bw.referenced_files(shared))

    def test_referenced_files_includes_shared_clouds(self):
        html = HTML.replace("clouds/mass.webp", "../_shared/clouds/mass.webp")
        self.assertEqual(bw.referenced_files(html), ["../_shared/clouds/mass.webp", "photos/start.jpg"])

    def test_season_photo_counts(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t) / "w"
            make_walk(d, photos=("start.jpg", "start_winter.jpg", "a_spring.jpg", "b_winter.jpg"))
            c = bw.season_photo_counts(d)
            self.assertEqual((c["base"], c["winter"], c["spring"], c["summer"]), (1, 2, 1, 0))

    def test_dir_stats(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t) / "w"
            make_walk(d)
            st = bw.dir_stats(d)
            self.assertEqual(st["files"], 6)
            self.assertGreater(st["bytes"], 0)


class Compare(unittest.TestCase):
    def test_pass_when_close(self):
        s = bw.route_summary(points())
        r = {c[0]: c[1] for c in bw.compare_with_hike(s, {**HIKE, "length_mi": 0.5}, fake=False)}
        self.assertEqual(r["start near trailhead"], "PASS")

    def test_strict_fails_far_start_but_fake_only_warns(self):
        s = bw.route_summary(points())
        far = {**HIKE, "trailhead": {"name": "TH", "lat": 38.0, "lon": -112.0}}
        strict = {c[0]: c[1] for c in bw.compare_with_hike(s, far, fake=False)}
        loose = {c[0]: c[1] for c in bw.compare_with_hike(s, far, fake=True)}
        self.assertEqual(strict["start near trailhead"], "FAIL")
        self.assertEqual(loose["start near trailhead"], "WARN")

    def test_length_ratio_warns_when_far_off(self):
        s = bw.route_summary(points())
        r = {c[0]: c[1] for c in bw.compare_with_hike(s, {**HIKE, "length_mi": 10}, fake=False)}
        self.assertEqual(r["length vs NPS"], "WARN")


class Profile(unittest.TestCase):
    def test_profile_shape_and_checkpoints(self):
        pts = points(n=400)  # 3.99 km
        s = bw.route_summary(pts)
        cfg = {"start": {"name": "Start"}, "end": {"name": "End"},
               "stops": [{"at": 0.01, "title": "Too close to start", "photo": "a"}, {"at": 0.5, "title": "Middle", "photo": "b"}, {"at": 0.999, "title": "Too close to end", "photo": "c"}]}
        out = bw.profile_json("w", cfg, s, pts, {**HIKE, "length_mi": 5})
        self.assertEqual([c["name"] for c in out["checkpoints"]], ["Start", "Middle", "End"])
        self.assertEqual(out["checkpoints"][0]["dist_m"], 0)
        self.assertEqual(out["checkpoints"][-1]["dist_m"], out["osm_length_m"])
        self.assertEqual(out["points"][0], [0, 1000.0])
        self.assertAlmostEqual(out["scale"], out["nps_length_m"] / out["osm_length_m"], places=3)
        self.assertEqual(out["checkpoints"][1]["photo"], "walks/w/photos/b.jpg")


class Verify(unittest.TestCase):
    def run_verify(self, html=None, legacy=False, budget=15, photos=("start.jpg",)):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t) / "w"
            make_walk(d, html=html, photos=photos)
            run = bw.Run("w", "t")
            bw.phase_verify(run, d, HIKE, legacy, budget)
            return run

    def test_good_walk_has_no_failures(self):
        run = self.run_verify()
        self.assertFalse(run.failed, [r for r in run.results if r.status == "FAIL"])

    def test_missing_referenced_photo_fails(self):
        run = self.run_verify(html=HTML % json.dumps(points()) + '<img src="photos/ghost.jpg">')
        self.assertTrue(run.failed)

    def test_missing_credit_fails(self):
        run = self.run_verify(html=(HTML % json.dumps(points())).replace("USGS", ""))
        self.assertTrue(run.failed)

    def test_size_budget_applies_to_new_walks_only(self):
        self.assertTrue(self.run_verify(budget=0.0000001).failed)
        self.assertFalse(self.run_verify(budget=0.0000001, legacy=True).failed)


class Manifest(unittest.TestCase):
    def test_real_manifest_is_consistent(self):
        m = bw.load_manifest()
        self.assertGreaterEqual(len(m["walks"]), 3)
        hikes = {h["id"]: h for h in json.loads((bw.DATA / "hikes.json").read_text())}
        for wid, w in m["walks"].items():
            self.assertTrue((bw.WALKS / wid / "index.html").exists(), wid)
            self.assertIn(w["hike_id"], hikes)
            self.assertTrue(hikes[w["hike_id"]]["featured"])
            self.assertEqual(hikes[w["hike_id"]]["walk_path"], f"walks/{wid}/")
        for h in hikes.values():
            if h["featured"]:
                self.assertIn(h["walk_path"].split("/")[1], m["walks"])

    def test_plan_has_every_phase(self):
        self.assertEqual({p[0][0] for p in bw.PLAN}, set("ABCDE"))
        self.assertEqual(len({p[0] for p in bw.PLAN}), len(bw.PLAN))


try:
    import optimize_walk as ow  # needs Pillow and numpy; the CI job without them skips these tests
except ImportError:
    ow = None


@unittest.skipIf(ow is None, "Pillow/numpy not installed")
class OptimizePatch(unittest.TestCase):
    PAGE = ("<style>#cFar>div{background-image:url(clouds/wisps.webp)} #cMid>div{background-image:url(clouds/cumulus.webp)} "
            "#cNear>div{background-image:url(clouds/mass.webp)}</style><script>"
            "const dem = {tiles: [base + 'dem/{z}/{x}/{y}.png']}; const s = {tiles: [base + 'season/' + name + '/{z}/{x}/{y}.png']};"
            "const i = {tiles: [base + 'img/{z}/{x}/{y}.jpg']}; im.src = 'clouds/' + n + '.webp';</script>")

    def test_every_form_is_redirected(self):
        out, n = ow.patch_page(self.PAGE)
        self.assertNotIn(".png", out.replace("{y}.png", "X") if "{y}.png" in out else out)
        self.assertIn("dem/{z}/{x}/{y}.webp'", out)
        self.assertIn("'/{z}/{x}/{y}.webp'", out)
        self.assertIn("img/{z}/{x}/{y}.jpg'", out)  # imagery stays JPEG
        self.assertEqual(out.count("../_shared/clouds/"), 4)
        self.assertEqual(n, 3 + 1 + 2)

    def test_a_stray_cloud_reference_is_an_error(self):
        with self.assertRaises(SystemExit):
            ow.patch_page(self.PAGE + "<img src=\"photos/x.jpg\"><i style=\"x:url('clouds/other.webp')\">")


if __name__ == "__main__":
    unittest.main()
