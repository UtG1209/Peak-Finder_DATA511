"""Offline unit tests for lane 2 source parsing and data-contract conversions."""
import unittest

from cost import gsa_rates_for_hike
from profiles import convert_route, profile_config
from travel import DOT_TABLE6, fare_lookup, haversine_m


class TravelTests(unittest.TestCase):
    def test_dot_table6_uses_the_official_dataset(self):
        self.assertEqual(DOT_TABLE6, "https://data.transportation.gov/resource/yj5y-b2ir.json")

    def test_dot_table6_known_fare_and_directionless_pair(self):
        rows = [
            {"year": "2025", "quarter": "3", "city1": "Las Vegas, NV", "city2": "Seattle, WA", "fare": "169.78"},
            {"year": "2024", "quarter": "3", "city1": "Seattle, WA", "city2": "Las Vegas, NV", "fare": "150.00"},
        ]
        self.assertEqual(fare_lookup(rows, "SEA", "LAS", 3), (169.78, 2025))

    def test_haversine_uses_lon_lat(self):
        self.assertAlmostEqual(haversine_m((-122.0, 47.0), (-122.0, 48.0)), 111_195, delta=100)


class CostTests(unittest.TestCase):
    def test_gsa_monthly_rates_are_selected_by_quarter(self):
        hike = {"id": "zion", "state": "UT", "park_name": "Zion", "aqi_county": {"name": "Washington County, UT"}}
        rows = [{"City": "Springdale", "State": "UT", "County": "Washington", "Jan": "110", "Feb": "110", "Mar": "110",
                 "Apr": "110", "May": "110", "Jun": "110", "Jul": "110", "Aug": "110", "Sep": "110",
                 "Oct": "110", "Nov": "110", "Dec": "110", "Meals": "68"}]
        self.assertEqual(gsa_rates_for_hike(hike, rows, 3)[:2], (110.0, 68.0))
        self.assertEqual(gsa_rates_for_hike(hike, rows, 4)[:2], (110.0, 68.0))


class ProfileTests(unittest.TestCase):
    def test_profile_scale_uses_one_way_nps_length_for_round_trip(self):
        hike = {"id": "angels-landing", "length_mi": 5.4, "length_type": "round-trip", "route_type": "out-and-back",
                "trailhead": {"name": "The Grotto"}, "end": {"name": "Summit"}}
        raw = [[-112.95, 37.25, 0, 1000], [-112.945, 37.255, 1650, 1200], [-112.94, 37.26, 3307, 1300]]
        profile = convert_route(hike, raw)
        self.assertAlmostEqual(profile["scale"], (5.4 * 1609.344 / 2) / 3307, places=3)
        self.assertEqual(profile["checkpoints"][0]["dist_m"], 0)
        self.assertEqual(profile["checkpoints"][-1]["dist_m"], 3307)

    def test_generated_profile_config_has_nested_bboxes_and_requested_endpoints(self):
        hike = {"name": "Long Hike", "length_mi": 10, "trailhead": {"name": "Start", "lat": 40, "lon": -110},
                "end": {"name": "End", "lat": 40.05, "lon": -109.95}}
        cfg = profile_config(hike, "profile-long-hike")
        self.assertEqual(cfg["start"]["name"], "Start")
        self.assertEqual(cfg["end"]["name"], "End")
        self.assertTrue(cfg["bounds"]["wide"][0] < cfg["bounds"]["mid"][0])
        self.assertEqual(cfg["bounds"]["mid"], cfg["bounds"]["core"])


if __name__ == "__main__":
    unittest.main()
