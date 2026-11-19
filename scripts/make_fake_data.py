#!/usr/bin/env python3
"""Generate FAKE data for the 40 most famous, most data-complete lower-48 national park hikes.

Writes the files the app reads (shapes: CLAUDE.md section 4) into app/public/data/:
  hikes.json, hike_month.json, travel.json, cost.json, advice.json, meta.json,
  profiles/<id>.json  (+ placeholder photos in app/public/photos/)

Everything here is PLACEHOLDER so the UI can be built before the pipeline exists.
Hike names are real; coordinates, lengths and climate numbers are rough, written from
memory, and must be replaced by the pipeline (lanes 1 and 2). meta.json carries
"fake": true and the app shows a banner while that is set.

A few numbers are real answers from docs/ai-vs-data-check.md and are kept on purpose
(Zion June 2023 visits, Springdale 13.0 August days >= 100 F, SEA-LAS Q3 fare $169.78,
Glacier Sept share of July). Pure standard library, deterministic (seeded).

Usage:  python3 scripts/make_fake_data.py [--out app/public/data]
"""
from __future__ import annotations

import argparse
import json
import math
import random
import zlib
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
FT = 0.3048
MI = 1609.344

# --------------------------------------------------------------------------- climates
# mean/amp: typical daytime high (F) = mean + dt + amp*cos(2*pi*(month-7)/12)
# wet/snow: days per month; smoke/ozone: August peak days per month.
CLIM = {
    "canyon":        dict(mean=76, amp=24, wet=[2.2,2.2,2.5,2.0,1.5,0.8,2.5,3.2,2.0,2.0,1.8,1.8], snow=[1.5,1.0,0.6,0.1,0,0,0,0,0,0,0.4,1.2], smoke=0.4, ozone=1.2),
    "desert":        dict(mean=82, amp=24, wet=[1.5,1.5,1.5,1.0,1.0,0.6,2.5,3.0,2.0,1.5,1.0,1.5], snow=[0.3,0.2,0.1,0,0,0,0,0,0,0,0,0.2], smoke=0.4, ozone=1.5),
    "hotdesert":     dict(mean=90, amp=28, wet=[1.0,1.2,0.8,0.4,0.3,0.2,0.8,1.2,0.8,0.6,0.6,1.0], snow=[0]*12, smoke=0.2, ozone=2.0),
    "alpine":        dict(mean=48, amp=21, wet=[7,6,7,7,8,8,9,9,7,5,6,7], snow=[14,12,12,9,4,0.5,0,0,1,4,10,13], smoke=1.5, ozone=0.3),
    "montane":       dict(mean=62, amp=22, wet=[4,4,5,5,6,5,8,9,5,4,4,4], snow=[6,5,5,3,1,0,0,0,0,1,3,5], smoke=1.0, ozone=0.6),
    "northwest":     dict(mean=57, amp=14, wet=[18,15,16,13,10,8,4,4,7,13,19,20], snow=[2,1,0.5,0,0,0,0,0,0,0,0.5,2], smoke=2.0, ozone=0.1),
    "pnw-high":      dict(mean=48, amp=17, wet=[17,14,16,14,12,10,5,5,8,13,18,19], snow=[16,13,14,10,5,1,0,0,1,5,13,16], smoke=2.0, ozone=0.1),
    "norcal-coast":  dict(mean=60, amp=6,  wet=[12,11,12,9,6,3,1,1,2,6,10,13], snow=[0]*12, smoke=0.4, ozone=0.2),
    "sierra":        dict(mean=68, amp=22, wet=[6,6,6,4,3,1.5,1,1,1.5,2.5,4,6], snow=[5,5,5,2,0.5,0,0,0,0,0.5,3,5], smoke=3.3, ozone=3.8),
    "mediterranean": dict(mean=72, amp=16, wet=[6,6,6,3,1,0.3,0,0,0.5,2,4,5], snow=[0]*12, smoke=2.5, ozone=3.0),
    "plains":        dict(mean=64, amp=27, wet=[3,3,5,6,8,9,7,6,5,4,3,3], snow=[4,4,3,1,0,0,0,0,0,0.5,3,4], smoke=0.5, ozone=0.3),
    "humid-east":    dict(mean=66, amp=20, wet=[9,8,10,10,11,10,10,9,8,7,8,9], snow=[3,3,2,0.3,0,0,0,0,0,0,0.2,2], smoke=0.2, ozone=1.0),
    "northeast":     dict(mean=56, amp=22, wet=[10,9,11,11,12,11,10,9,9,10,11,11], snow=[8,7,5,1,0,0,0,0,0,0.5,4,8], smoke=0.2, ozone=0.8),
    "subtropical":   dict(mean=84, amp=7,  wet=[4,3,3,3,7,12,13,14,14,9,4,4], snow=[0]*12, smoke=0.05, ozone=0.6),
}
SMOKE_SHAPE = [0, 0, 0, 0, 0.05, 0.2, 0.6, 1.0, 0.8, 0.3, 0, 0]
OZONE_SHAPE = [0, 0, 0.1, 0.3, 0.6, 0.9, 1.0, 1.0, 0.7, 0.3, 0, 0]

# park crowd seasonality (relative monthly visits; normalised so the busiest month = 1)
CROWD = {
    "summer": [0.10, 0.10, 0.15, 0.25, 0.50, 0.85, 1.00, 1.00, 0.70, 0.35, 0.15, 0.10],
    "desert": [0.45, 0.55, 0.85, 0.95, 0.90, 0.80, 0.70, 0.70, 0.80, 0.95, 0.70, 0.50],
    "winter": [0.90, 1.00, 1.00, 0.80, 0.50, 0.30, 0.25, 0.25, 0.30, 0.50, 0.75, 0.85],
    "year":   [0.50, 0.55, 0.65, 0.75, 0.85, 0.95, 1.00, 1.00, 0.85, 0.80, 0.65, 0.55],
    "east":   [0.30, 0.35, 0.55, 0.75, 0.85, 0.90, 0.95, 0.95, 0.80, 1.00, 0.60, 0.40],
    "zion":   [0.40, 0.50, 0.78, 0.90, 0.96, 1.00, 0.96, 0.92, 0.95, 0.97, 0.65, 0.45],
    "grca":   [0.35, 0.45, 0.70, 0.85, 0.95, 0.90, 0.90, 0.85, 0.90, 0.95, 0.60, 0.40],
}

# --------------------------------------------------------------------------- hikes
# id, name, code, park, state, trailhead, lat, lon, end, lat, lon, length_mi (round trip for
# out-and-back), gain_ft, max_elev_ft, route, difficulty, climate, dt(F), crowd, fips, county,
# gear, permit, closed months, optional (start_ft, end_ft) elevations
H = []


def h(*a, el=None):
    H.append((*a, el))


h("angels-landing", "Angels Landing", "ZION", "Zion National Park", "UT", "The Grotto", 37.25897, -112.95097, "Summit", 37.26931, -112.94792, 5.4, 1500, 5790, "out-and-back", "hard", "canyon", 0, "zion", "49053", "Washington County, UT", ["chains", "exposure", "no-shade"], "Permit lottery", ())
h("bright-angel-trail", "Bright Angel Trail to Phantom Ranch", "GRCA", "Grand Canyon National Park", "AZ", "Bright Angel Trailhead", 36.0577, -112.1438, "Phantom Ranch", 36.1066, -112.0963, 19.0, 4380, 6860, "out-and-back", "hard", "montane", 0, "grca", "04005", "Coconino County, AZ", ["steep", "no-shade", "extra-water"], None, (), el=(6860, 2480))
h("cascade-pass-sahale", "Cascade Pass to Sahale Glacier", "NOCA", "North Cascades National Park", "WA", "Cascade Pass Trailhead", 48.4767, -121.0753, "Sahale Glacier Camp", 48.4806, -121.0450, 12.0, 4000, 7600, "out-and-back", "hard", "pnw-high", 0, "summer", "53057", "Skagit County, WA", ["steep", "snow-gear", "exposure"], None, (11, 12, 1, 2, 3, 4))
h("mount-washburn", "Mount Washburn via Chittenden Road", "YELL", "Yellowstone National Park", "WY", "Dunraven Pass Trailhead", 44.7915, -110.4415, "Summit", 44.7978, -110.4339, 6.4, 1400, 10243, "out-and-back", "moderate", "alpine", 0, "summer", "56029", "Park County, WY", ["exposure", "snow-gear"], None, (11, 12, 1, 2, 3, 4, 5))
h("fairy-falls-grand-prismatic", "Fairy Falls and Grand Prismatic Overlook", "YELL", "Yellowstone National Park", "WY", "Fairy Falls Trailhead", 44.5249, -110.8358, "Fairy Falls", 44.5201, -110.8774, 5.4, 200, 7350, "out-and-back", "easy", "alpine", 3, "summer", "56039", "Teton County, WY", ["bear-spray"], None, ())
h("grinnell-glacier", "Grinnell Glacier", "GLAC", "Glacier National Park", "MT", "Many Glacier Trailhead", 48.7967, -113.6565, "Grinnell Glacier Overlook", 48.7578, -113.7273, 10.6, 1840, 6740, "out-and-back", "hard", "alpine", 5, "summer", "30035", "Glacier County, MT", ["bear-spray", "steep", "snow-gear"], None, (11, 12, 1, 2, 3, 4, 5, 6))
h("glacier-highline", "Highline Trail to Granite Park Chalet", "GLAC", "Glacier National Park", "MT", "Logan Pass", 48.6967, -113.7183, "Granite Park Chalet", 48.7603, -113.7547, 7.6, 800, 6700, "point-to-point", "moderate", "alpine", 2, "summer", "30029", "Flathead County, MT", ["exposure", "bear-spray", "snow-gear"], None, (11, 12, 1, 2, 3, 4, 5, 6), el=(6646, 6700))
h("half-dome", "Half Dome", "YOSE", "Yosemite National Park", "CA", "Happy Isles Trailhead", 37.7326, -119.5577, "Summit", 37.7459, -119.5332, 16.0, 4800, 8842, "out-and-back", "hard", "sierra", 0, "summer", "06043", "Mariposa County, CA", ["chains", "exposure", "extra-water", "headlamp"], "Permit lottery", (11, 12, 1, 2, 3, 4, 5))
h("upper-yosemite-falls", "Upper Yosemite Fall Trail", "YOSE", "Yosemite National Park", "CA", "Camp 4 Trailhead", 37.7926, -119.6010, "Top of Upper Yosemite Fall", 37.7990, -119.5981, 7.2, 3200, 6526, "out-and-back", "hard", "sierra", 0, "summer", "06043", "Mariposa County, CA", ["steep", "extra-water"], None, ())
h("moro-rock", "Moro Rock", "SEKI", "Sequoia and Kings Canyon National Parks", "CA", "Moro Rock Trailhead", 36.5469, -118.7653, "Summit", 36.5472, -118.7652, 0.5, 250, 6725, "out-and-back", "easy", "sierra", -8, "summer", "06107", "Tulare County, CA", ["steep", "exposure"], None, (12, 1, 2, 3))
h("delicate-arch", "Delicate Arch", "ARCH", "Arches National Park", "UT", "Wolfe Ranch Trailhead", 38.7357, -109.5206, "Delicate Arch", 38.7436, -109.4993, 3.0, 480, 4800, "out-and-back", "moderate", "desert", -2, "desert", "49019", "Grand County, UT", ["no-shade", "extra-water", "exposure"], None, ())
h("mesa-arch", "Mesa Arch", "CANY", "Canyonlands National Park", "UT", "Mesa Arch Trailhead", 38.3892, -109.8683, "Mesa Arch", 38.3891, -109.8688, 0.7, 100, 6100, "loop", "easy", "desert", -6, "desert", "49037", "San Juan County, UT", ["exposure"], None, ())
h("navajo-loop-queens-garden", "Navajo Loop and Queen's Garden", "BRCA", "Bryce Canyon National Park", "UT", "Sunset Point", 37.6232, -112.1663, "Wall Street", 37.6178, -112.1677, 2.9, 600, 8000, "loop", "moderate", "canyon", -10, "desert", "49017", "Garfield County, UT", ["steep"], None, ())
h("cassidy-arch", "Cassidy Arch", "CARE", "Capitol Reef National Park", "UT", "Grand Wash Trailhead", 38.2897, -111.2475, "Cassidy Arch", 38.2891, -111.2548, 3.4, 670, 5800, "out-and-back", "moderate", "desert", -4, "desert", "49055", "Wayne County, UT", ["exposure", "no-shade"], None, ())
h("skyline-trail", "Skyline Trail", "MORA", "Mount Rainier National Park", "WA", "Paradise", 46.7855, -121.7347, "Panorama Point", 46.8002, -121.7242, 5.5, 1700, 6800, "loop", "moderate", "pnw-high", 0, "summer", "53053", "Pierce County, WA", ["snow-gear"], None, ())
h("hurricane-hill", "Hurricane Hill", "OLYM", "Olympic National Park", "WA", "Hurricane Hill Trailhead", 47.9697, -123.4995, "Hurricane Hill", 47.9735, -123.4960, 3.2, 700, 5757, "out-and-back", "moderate", "pnw-high", 2, "summer", "53009", "Clallam County, WA", ["exposure"], None, ())
h("garfield-peak", "Garfield Peak", "CRLA", "Crater Lake National Park", "OR", "Crater Lake Lodge", 42.8963, -122.1342, "Garfield Peak", 42.9052, -122.1245, 3.4, 1000, 8054, "out-and-back", "moderate", "alpine", 0, "summer", "41035", "Klamath County, OR", ["snow-gear", "exposure"], None, (11, 12, 1, 2, 3, 4, 5))
h("lassen-peak", "Lassen Peak", "LAVO", "Lassen Volcanic National Park", "CA", "Lassen Peak Trailhead", 40.4739, -121.5099, "Summit", 40.4880, -121.5050, 5.0, 2000, 10457, "out-and-back", "hard", "alpine", 5, "summer", "06089", "Shasta County, CA", ["exposure", "extra-water", "snow-gear"], None, (11, 12, 1, 2, 3, 4, 5, 6))
h("lady-bird-johnson-grove", "Lady Bird Johnson Grove Loop", "REDW", "Redwood National and State Parks", "CA", "Lady Bird Johnson Grove", 41.2890, -124.0153, "Grove Loop", 41.2893, -124.0150, 1.4, 100, 1300, "loop", "easy", "norcal-coast", 0, "year", "06015", "Del Norte County, CA", [], None, ())
h("pinnacles-high-peaks", "High Peaks Loop", "PINN", "Pinnacles National Park", "CA", "Bear Gulch Day Use Area", 36.4752, -121.1859, "High Peaks Overlook", 36.4871, -121.1830, 5.3, 1500, 2650, "loop", "moderate", "mediterranean", 6, "desert", "06069", "San Benito County, CA", ["no-shade", "exposure"], None, ())
h("ryan-mountain", "Ryan Mountain", "JOTR", "Joshua Tree National Park", "CA", "Ryan Mountain Trailhead", 34.0113, -116.1585, "Summit", 34.0126, -116.1507, 3.0, 1050, 5457, "out-and-back", "moderate", "desert", -10, "winter", "06071", "San Bernardino County, CA", ["no-shade", "extra-water"], None, ())
h("golden-canyon", "Golden Canyon to Red Cathedral", "DEVA", "Death Valley National Park", "CA", "Golden Canyon Trailhead", 36.4209, -116.8271, "Red Cathedral", 36.4283, -116.8135, 3.0, 600, 400, "out-and-back", "easy", "hotdesert", 0, "winter", "06027", "Inyo County, CA", ["no-shade", "extra-water"], None, ())
h("lost-mine-trail", "Lost Mine Trail", "BIBE", "Big Bend National Park", "TX", "Lost Mine Trailhead", 29.2755, -103.2990, "Juniper Canyon Overlook", 29.2720, -103.3040, 4.8, 1100, 6850, "out-and-back", "moderate", "desert", -8, "winter", "48043", "Brewster County, TX", ["exposure", "no-shade", "extra-water"], None, ())
h("guadalupe-peak", "Guadalupe Peak", "GUMO", "Guadalupe Mountains National Park", "TX", "Pine Springs Trailhead", 31.8886, -104.8218, "Guadalupe Peak", 31.8912, -104.8607, 8.4, 3000, 8751, "out-and-back", "hard", "desert", -8, "desert", "48109", "Culberson County, TX", ["steep", "exposure", "extra-water"], None, ())
h("alkali-flat", "Alkali Flat Trail", "WHSA", "White Sands National Park", "NM", "Alkali Flat Trailhead", 32.7790, -106.1780, "Alkali Flat Loop", 32.8040, -106.2350, 5.0, 100, 4000, "loop", "easy", "desert", -10, "year", "35035", "Otero County, NM", ["no-shade", "extra-water"], None, ())
h("emerald-lake", "Emerald Lake", "ROMO", "Rocky Mountain National Park", "CO", "Bear Lake Trailhead", 40.3114, -105.6450, "Emerald Lake", 40.3070, -105.6660, 3.2, 650, 10110, "out-and-back", "moderate", "alpine", -4, "summer", "08069", "Larimer County, CO", ["snow-gear"], None, ())
h("high-dune", "High Dune", "GRSA", "Great Sand Dunes National Park", "CO", "Dunes Parking Area", 37.7503, -105.5144, "High Dune", 37.7480, -105.5400, 2.6, 700, 8700, "out-and-back", "moderate", "montane", 8, "summer", "08003", "Alamosa County, CO", ["no-shade", "extra-water", "steep"], None, ())
h("inspiration-point", "Hidden Falls and Inspiration Point", "GRTE", "Grand Teton National Park", "WY", "Jenny Lake Visitor Center", 43.7569, -110.7264, "Inspiration Point", 43.7587, -110.7524, 7.6, 700, 7200, "out-and-back", "moderate", "alpine", 6, "summer", "56039", "Teton County, WY", ["bear-spray"], None, ())
h("cadillac-north-ridge", "Cadillac North Ridge", "ACAD", "Acadia National Park", "ME", "Cadillac North Ridge Trailhead", 44.3650, -68.2150, "Summit", 44.3527, -68.2240, 4.4, 1300, 1530, "out-and-back", "moderate", "northeast", 0, "east", "23009", "Hancock County, ME", ["exposure"], None, ())
h("alum-cave-leconte", "Alum Cave to Mount LeConte", "GRSM", "Great Smoky Mountains National Park", "TN", "Alum Cave Trailhead", 35.6307, -83.4428, "LeConte Lodge", 35.6540, -83.4390, 11.0, 2763, 6593, "out-and-back", "hard", "humid-east", -10, "east", "47155", "Sevier County, TN", ["exposure", "steep", "headlamp"], None, ())
h("clingmans-dome", "Clingmans Dome Tower", "GRSM", "Great Smoky Mountains National Park", "NC", "Clingmans Dome Trailhead", 35.5628, -83.4983, "Observation Tower", 35.5633, -83.4985, 1.0, 330, 6643, "out-and-back", "easy", "humid-east", -12, "east", "37173", "Swain County, NC", ["steep"], None, (12, 1, 2, 3))
h("old-rag", "Old Rag Mountain Loop", "SHEN", "Shenandoah National Park", "VA", "Old Rag Trailhead", 38.5523, -78.2965, "Summit", 38.5547, -78.3103, 9.3, 2600, 3284, "loop", "hard", "humid-east", -2, "east", "51113", "Madison County, VA", ["scramble", "exposure", "extra-water"], "Day-use ticket", ())
h("anhinga-trail", "Anhinga Trail", "EVER", "Everglades National Park", "FL", "Anhinga Trailhead", 25.3829, -80.5822, "Anhinga Boardwalk", 25.3846, -80.5810, 0.8, 0, 10, "loop", "easy", "subtropical", 0, "winter", "12086", "Miami-Dade County, FL", ["no-shade", "bug-spray"], None, ())
h("wheeler-peak", "Wheeler Peak", "GRBA", "Great Basin National Park", "NV", "Summit Trailhead", 38.9858, -114.3092, "Wheeler Peak", 38.9870, -114.3133, 8.6, 2900, 13063, "out-and-back", "hard", "alpine", -4, "summer", "32033", "White Pine County, NV", ["exposure", "extra-water", "snow-gear", "headlamp"], None, (11, 12, 1, 2, 3, 4, 5, 6))
h("south-kaibab-skeleton-point", "South Kaibab to Skeleton Point", "GRCA", "Grand Canyon National Park", "AZ", "South Kaibab Trailhead", 36.0544, -112.0836, "Skeleton Point", 36.0771, -112.0889, 6.0, 2040, 7260, "out-and-back", "hard", "montane", 0, "grca", "04005", "Coconino County, AZ", ["steep", "no-shade", "extra-water", "exposure"], None, (), el=(7260, 5220))
h("zion-narrows", "The Narrows, bottom-up", "ZION", "Zion National Park", "UT", "Riverside Walk Trailhead", 37.2850, -112.9470, "Big Spring", 37.3240, -112.9420, 9.4, 200, 4900, "out-and-back", "moderate", "canyon", 0, "zion", "49053", "Washington County, UT", ["water-crossing", "extra-water"], None, ())
h("longs-peak", "Longs Peak Keyhole Route", "ROMO", "Rocky Mountain National Park", "CO", "Longs Peak Trailhead", 40.2733, -105.5560, "Summit", 40.2549, -105.6150, 14.5, 5100, 14259, "out-and-back", "hard", "alpine", -4, "summer", "08069", "Larimer County, CO", ["exposure", "scramble", "headlamp", "snow-gear"], None, (10, 11, 12, 1, 2, 3, 4, 5, 6))
h("general-sherman-tree", "General Sherman Tree", "SEKI", "Sequoia and Kings Canyon National Parks", "CA", "Sherman Tree Trailhead", 36.5819, -118.7519, "General Sherman Tree", 36.5817, -118.7512, 1.2, 200, 7050, "out-and-back", "easy", "sierra", -10, "summer", "06107", "Tulare County, CA", [], None, ())
h("hall-of-mosses", "Hoh Hall of Mosses", "OLYM", "Olympic National Park", "WA", "Hoh Rain Forest Visitor Center", 47.8600, -123.9350, "Hall of Mosses", 47.8610, -123.9370, 0.8, 100, 700, "loop", "easy", "northwest", 0, "summer", "53031", "Jefferson County, WA", [], None, ())
h("devils-garden", "Devils Garden Loop", "ARCH", "Arches National Park", "UT", "Devils Garden Trailhead", 38.7826, -109.5948, "Double O Arch", 38.7881, -109.5890, 7.2, 700, 5200, "loop", "moderate", "desert", -2, "desert", "49019", "Grand County, UT", ["exposure", "no-shade", "extra-water"], None, ())

# Featured hikes (the ones with a finished 3D walk) come from walks/manifest.json: that file is the single source of truth.
# Add a walk with pipeline/walks/build_walk.py and it shows up here, in hikes.json and on the hike page automatically.
def _load_walks():
    try:
        m = json.loads((ROOT / "walks" / "manifest.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}, {}
    featured, profiles = {}, {}
    for wid, w in m["walks"].items():
        featured[w["hike_id"]] = f"walks/{wid}/"
        pj = ROOT / "walks" / wid / "profile.json"
        if pj.exists():  # real route from the walk itself: the hike page and the walk then agree
            profiles[w["hike_id"]] = json.loads(pj.read_text(encoding="utf-8"))
    return featured, profiles


FEATURED, WALK_PROFILES = _load_walks()
NO_STATION: set[str] = set()  # the curated 40 all have a station; add ids here to test the "No station within 50 km" state

# checkpoints for the three featured hikes: (name, fraction of one-way distance)
FEATURED_STOPS = {
    "angels-landing": [("The Grotto", 0), ("Refrigerator Canyon", 0.22), ("Walter's Wiggles", 0.45), ("Scout Lookout", 0.62), ("Angels Landing summit", 1)],
    "bright-angel-trail": [("Bright Angel Trailhead", 0), ("1.5-Mile Resthouse", 0.16), ("3-Mile Resthouse", 0.31), ("Indian Garden", 0.50), ("Colorado River", 0.88), ("Phantom Ranch", 1)],
    "cascade-pass-sahale": [("Cascade Pass Trailhead", 0), ("Cascade Pass", 0.45), ("Sahale Arm", 0.75), ("Sahale Glacier Camp", 1)],
}

# --------------------------------------------------------------------------- cities and airports
CITIES = {  # code: (name, lat, lon, airport lat/lon, gas $/gal)
    "SEA": ("Seattle", 47.61, -122.33, (47.449, -122.309), 4.25),
    "SFO": ("San Francisco", 37.77, -122.42, (37.619, -122.375), 4.90),
    "LAX": ("Los Angeles", 34.05, -118.24, (33.942, -118.408), 4.80),
    "PHX": ("Phoenix", 33.45, -112.07, (33.434, -112.012), 3.70),
    "DEN": ("Denver", 39.74, -104.99, (39.856, -104.674), 3.40),
    "DFW": ("Dallas/Fort Worth", 32.78, -96.80, (32.899, -97.040), 3.00),
    "ORD": ("Chicago", 41.88, -87.63, (41.978, -87.905), 3.50),
    "ATL": ("Atlanta", 33.75, -84.39, (33.637, -84.428), 3.10),
    "NYC": ("New York", 40.71, -74.01, (40.641, -73.778), 3.60),
    "DCA": ("Washington DC", 38.91, -77.04, (38.852, -77.038), 3.40),
}
AIRPORTS = {
    "LAS": (36.084, -115.153), "SLC": (40.788, -111.978), "PHX": (33.434, -112.012), "DEN": (39.856, -104.674),
    "SEA": (47.449, -122.309), "PDX": (45.589, -122.595), "SFO": (37.619, -122.375), "LAX": (33.942, -118.408),
    "SAN": (32.733, -117.190), "FAT": (36.776, -119.718), "RNO": (39.499, -119.768), "SJC": (37.362, -121.929),
    "SMF": (38.695, -121.591), "BZN": (45.777, -111.153), "JAC": (43.607, -110.738), "FCA": (48.311, -114.256),
    "ABQ": (35.040, -106.609), "ELP": (31.807, -106.378), "MAF": (31.943, -102.202), "SAT": (29.534, -98.470),
    "ATL": (33.637, -84.428), "DCA": (38.852, -77.038), "MIA": (25.793, -80.290), "TYS": (35.811, -83.994),
    "CLE": (41.411, -81.850), "BGR": (44.807, -68.828), "BIS": (46.773, -100.746), "RAP": (44.045, -103.057),
    "GJT": (39.122, -108.527), "TUS": (32.116, -110.941), "MFR": (42.374, -122.873), "ACV": (40.978, -124.109),
    "PSP": (33.829, -116.507), "LIT": (34.729, -92.224), "CAE": (33.939, -81.119), "DRO": (37.151, -107.754),
    "MTJ": (38.510, -107.894), "BOI": (43.564, -116.223), "DFW": (32.899, -97.040), "ORD": (41.978, -87.905),
}
STATE_TZ = {  # (standard UTC offset, observes DST)
    "UT": (-7, True), "CO": (-7, True), "NM": (-7, True), "WY": (-7, True), "MT": (-7, True), "AZ": (-7, False),
    "CA": (-8, True), "OR": (-8, True), "WA": (-8, True), "NV": (-8, True), "TX": (-6, True), "AR": (-6, True),
    "ND": (-7, True), "SD": (-7, True), "SC": (-5, True), "ME": (-5, True), "TN": (-5, True), "NC": (-5, True),
    "VA": (-5, True), "OH": (-5, True), "FL": (-5, True),
}
TZ_OVERRIDE = {"GUMO": (-7, True)}

LODGING = {"ZION": 110, "GRCA": 150, "YOSE": 130, "GLAC": 140, "YELL": 130, "GRTE": 190, "ACAD": 160, "ARCH": 140,
           "ROMO": 140, "GRSM": 120, "SEKI": 120, "MORA": 125, "OLYM": 115, "BRCA": 120, "SHEN": 110}
MEALS = {"GRTE": 92, "ACAD": 80, "GRCA": 74, "YELL": 74, "GLAC": 74, "YOSE": 74}
ENTRY = {"GRSM": 0, "CONG": 0, "CUVA": 0, "HOSP": 0, "REDW": 0, "GRBA": 0, "WHSA": 25, "PEFO": 25, "BADL": 30,
         "THRO": 30, "JOTR": 30, "SAGU": 25, "DEVA": 30, "PINN": 30, "BIBE": 30, "GUMO": 10, "BLCA": 30, "MEVE": 30}
PERMIT = {"angels-landing": 6, "half-dome": 10, "old-rag": 1}
SEASONAL_LODGING = {"summer", "east"}  # crowd shapes whose lodging price moves with the quarter
QTR_LODGING = [0.80, 1.00, 1.30, 0.90]
QTR_FARE = [0.90, 1.00, 1.05, 0.95]


# --------------------------------------------------------------------------- helpers
def rng_for(key: str) -> random.Random:
    return random.Random(zlib.crc32(key.encode()) ^ 511)


def hav_mi(lat1, lon1, lat2, lon2) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def band(c: float) -> str:
    return "quiet" if c < 0.4 else "moderate" if c < 0.7 else "busy"


def clock(hours: float) -> str:
    m = round(hours * 60) % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"


def daylight(lat, lon, state, code, month):
    """Sunrise/sunset (local clock) and day length for the 15th of the month."""
    n = date(2025, month, 15).timetuple().tm_yday
    decl = math.radians(23.44) * math.sin(2 * math.pi * (284 + n) / 365)
    phi = math.radians(lat)
    cos_h = (math.sin(math.radians(-0.833)) - math.sin(phi) * math.sin(decl)) / (math.cos(phi) * math.cos(decl))
    cos_h = max(-1, min(1, cos_h))
    half = math.degrees(math.acos(cos_h)) / 15  # hours
    tz, dst = TZ_OVERRIDE.get(code, STATE_TZ[state])
    noon = 12 - (lon - tz * 15) / 15 + (1 if dst and 3 <= month <= 10 else 0)
    return round(2 * half, 1), clock(noon - half), clock(noon + half)


def r1(x):
    return round(x, 1)


# --------------------------------------------------------------------------- build
def build_hikes():
    hikes, meta_rows = [], []
    for idx, row in enumerate(H):
        (hid, name, code, park, st, th, tlat, tlon, en, elat, elon, mi, gain, maxft, route, diff,
         clim, dt, crowd, fips, county, gear, permit, closed, el) = row
        rng = rng_for(hid)
        if el:
            start_ft, end_ft = el
        elif route == "loop":
            start_ft = end_ft = maxft - gain
        else:
            start_ft, end_ft = maxft - gain, maxft
        nps_len = round(mi * MI / (2 if route == "out-and-back" else 1))
        scale = 1.314 if hid == "angels-landing" else round(rng.uniform(1.02, 1.30), 3)
        osm_len = 3307 if hid == "angels-landing" else round(nps_len / scale)
        station = None
        if hid not in NO_STATION:
            station = {"id": "USC00429717" if hid == "angels-landing" else f"FAKE{idx:04d}",
                       "name": "Zion National Park" if hid == "angels-landing" else f"{park} station (fake)",
                       "dist_km": 5.0 if hid == "angels-landing" else r1(rng.uniform(1.5, 32)),
                       "elev_ft": 4050 if hid == "angels-landing" else round(start_ft + rng.uniform(-300, 300), -1)}
        if hid in FEATURED:
            blurb = {"angels-landing": "A chain-assisted climb along a narrow fin to a view over Zion Canyon.",
                     "bright-angel-trail": "The classic corridor trail from the South Rim to the Colorado River and Phantom Ranch.",
                     "cascade-pass-sahale": "Switchbacks to Cascade Pass, then a high ridge walk to the foot of Sahale Glacier."}[hid]
        else:
            blurb = f"A {diff} {route} hike in {park}. Placeholder text from fake data."
        hikes.append({
            "id": hid, "name": name, "park_code": code, "park_name": park, "state": st,
            "trailhead": {"name": th, "lat": tlat, "lon": tlon}, "end": {"name": en, "lat": elat, "lon": elon},
            "length_mi": mi, "length_type": "round-trip" if route == "out-and-back" else "loop" if route == "loop" else "one-way",
            "gain_ft": gain, "max_elev_ft": maxft, "route_type": route, "difficulty": diff,
            "nps_url": f"https://www.nps.gov/{code.lower()}/index.htm", "description": blurb,
            "permit_note": permit, "closure_note": ("Closed by snow outside summer (fake)" if closed else None),
            "gear": gear,
            "photo": {"file": f"photos/{hid}.svg", "author": "Peak Finder team (placeholder)", "license": "CC0",
                      "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                      "page": "https://github.com/UtG1209/Peak-Finder_DATA511"},
            "featured": hid in FEATURED, "walk_path": FEATURED.get(hid),
            "station": station, "aqi_county": {"fips": fips, "name": county},
        })
        meta_rows.append(dict(hid=hid, code=code, st=st, lat=tlat, lon=tlon, clim=clim, dt=dt, crowd=crowd,
                              closed=closed, maxft=maxft, start_ft=start_ft, end_ft=end_ft, route=route,
                              nps_len=nps_len, osm_len=osm_len, scale=scale, name=name, en=en))
    return hikes, meta_rows


def build_months(hikes, mrows):
    out = []
    for hk, m in zip(hikes, mrows):
        c = CLIM[m["clim"]]
        shape = CROWD[m["crowd"]]
        peak = max(shape)
        rng = rng_for(m["hid"] + "-months")
        no_station = hk["station"] is None
        for mo in range(1, 13):
            crowd = min(1.0, max(0.02, shape[mo - 1] / peak + (rng.uniform(-0.03, 0.03) if shape[mo - 1] < peak else 0)))
            if shape[mo - 1] == peak:
                crowd = 1.0
            crowd = round(crowd, 2)
            p50 = c["mean"] + m["dt"] + c["amp"] * math.cos(2 * math.pi * (mo - 7) / 12) + rng.gauss(0, 0.5)
            if m["hid"] == "angels-landing":
                p50 = {7: 100.4 - 0.3, 8: 97.9}.get(mo, p50)  # Springdale: Aug 97.9 is real
            p25, p75 = p50 - rng.uniform(2.6, 3.8), p50 + rng.uniform(2.0, 3.0)
            summit = p50 - 3.5 * (m["end_ft"] - m["start_ft"]) / 1000
            hot = min(31.0, max(0.0, (p50 - 89) * 1.4))
            if m["hid"] == "angels-landing" and mo == 8:
                hot = 13.0  # real: 13.0 August days >= 100F at Springdale (2015-24)
            wet = c["wet"][mo - 1] * rng.uniform(0.85, 1.15)
            snow_k = max(0.0, min(2.0, (m["maxft"] - 1500) / 6000))
            snow = c["snow"][mo - 1] * snow_k * rng.uniform(0.8, 1.2) if p50 < 55 else 0.0
            smoke = c["smoke"] * SMOKE_SHAPE[mo - 1] * rng.uniform(0.7, 1.3)
            ozone = c["ozone"] * OZONE_SHAPE[mo - 1] * rng.uniform(0.7, 1.3)
            if m["hid"] == "angels-landing" and mo == 8:
                smoke = 0.4
            dl, sr, ss = daylight(m["lat"], m["lon"], m["st"], m["code"], mo)
            out.append({
                "hike_id": m["hid"], "month": mo, "crowd_level": crowd, "crowd_band": band(crowd),
                "tmax_p25": None if no_station else r1(p25), "tmax_p50": None if no_station else r1(p50),
                "tmax_p75": None if no_station else r1(p75), "tmax_summit_est": None if no_station else r1(summit),
                "wet_days": None if no_station else r1(wet), "snow_days": None if no_station else r1(snow),
                "smoky_days": r1(smoke), "ozone_days": r1(ozone), "heat_days": None if no_station else r1(hot),
                "daylight_hr": dl, "sunrise": sr, "sunset": ss, "closed": mo in m["closed"],
                "missing": ["temp", "wet"] if no_station else [],
            })
    return out


def nearest_airport(lat, lon):
    return min(AIRPORTS, key=lambda a: hav_mi(lat, lon, *AIRPORTS[a]))


def build_travel(hikes, mrows):
    out = []
    for hk, m in zip(hikes, mrows):
        ap = nearest_airport(m["lat"], m["lon"])
        ap_drive_mi = hav_mi(m["lat"], m["lon"], *AIRPORTS[ap]) * 1.25
        for code, (_, clat, clon, aplatlon, _gas) in CITIES.items():
            drive_mi = round(hav_mi(clat, clon, m["lat"], m["lon"]) * 1.22)
            drive_hr = r1(drive_mi / 54)
            gc = hav_mi(*aplatlon, *AIRPORTS[ap])
            fly_hr = r1(gc / 480 + 1.0 + 1.5 + ap_drive_mi / 52 + (1.5 if gc > 1500 else 0))
            if m["hid"] == "angels-landing" and code == "SEA":
                drive_mi, drive_hr, ap, fly_hr = 1060, 15.6, "LAS", 6.4  # CLAUDE.md example row
            mode = "fly" if fly_hr < drive_hr - 0.5 else "drive"
            out.append({"hike_id": m["hid"], "city": code, "drive_hr": drive_hr, "drive_mi": drive_mi,
                        "airport": ap, "fly_drive_hr": fly_hr, "default_mode": mode})
    return out


def build_cost(hikes, mrows, travel):
    tmap = {(t["hike_id"], t["city"]): t for t in travel}
    out = []
    for hk, m in zip(hikes, mrows):
        code = m["code"]
        base_lodging = LODGING.get(code, 110)
        seasonal = m["crowd"] in SEASONAL_LODGING
        for city, (_, _, _, aplatlon, gas) in CITIES.items():
            t = tmap[(m["hid"], city)]
            gc = hav_mi(*aplatlon, *AIRPORTS[t["airport"]])
            for q in range(1, 5):
                rng = rng_for(f"{m['hid']}-{city}-{q}")
                fare = round((70 + gc * 0.085) * QTR_FARE[q - 1] * rng.uniform(0.92, 1.08), 2)
                row = {
                    "hike_id": m["hid"], "city": city, "quarter": q,
                    "fare_one_way": fare, "car_per_day": 60, "drive_mi": t["drive_mi"],
                    "gas_per_gal": round(gas + rng.uniform(-0.15, 0.15), 2), "mpg": 25,
                    "lodging_per_night": round(base_lodging * (QTR_LODGING[q - 1] if seasonal else 1.0)),
                    "meals_per_day": MEALS.get(code, 68), "entry_fee_vehicle": ENTRY.get(code, 35),
                    "permit_fee": PERMIT.get(m["hid"], 0),
                }
                if m["hid"] == "angels-landing" and city == "SEA" and q == 3:  # CLAUDE.md example row (real inputs)
                    row.update(fare_one_way=169.78, gas_per_gal=4.10, lodging_per_night=110)
                out.append(row)
    return out


def build_profile(hk, m):
    if m["hid"] in WALK_PROFILES:
        return WALK_PROFILES[m["hid"]]
    rng = rng_for(m["hid"] + "-profile")
    start, end = m["start_ft"] * FT, m["end_ft"] * FT
    top = m["maxft"] * FT
    length = m["osm_len"]
    dists = list(range(0, length, 10))
    if dists[-1] != length:
        dists.append(length)
    ph = [rng.uniform(0, 6.28) for _ in range(3)]
    amp = max(1.5, min(35.0, 0.02 * abs(top - min(start, end))))
    pts = []
    for d in dists:
        t = d / length
        if m["route"] == "loop":
            span = top - start
            e = start + span * (math.sin(math.pi * t) ** 0.9)
        else:
            e = start + (end - start) * (t ** (1.15 if end > start else 0.85))
        wiggle = sum(amp / (i + 1) * math.sin((i + 1) * 9 * t + ph[i]) for i in range(3)) * math.sin(math.pi * t) ** 0.5
        pts.append([d, round(e + wiggle, 1)])
    pts[0][1], pts[-1][1] = round(start, 1), round(end if m["route"] != "loop" else start, 1)
    if m["hid"] == "angels-landing":
        pts[0][1] = 1304.0
    stops = FEATURED_STOPS.get(m["hid"])
    if stops:
        fr = stops
    elif m["route"] == "out-and-back" or m["route"] == "point-to-point":
        fr = [("Trailhead", 0), ("Quarter way", 0.25), ("Halfway", 0.5), ("Three-quarters", 0.75), (m["en"], 1)]
    else:
        fr = [("Trailhead", 0), ("Quarter way", 0.25), ("Halfway", 0.5), ("Three-quarters", 0.75)]
    cps = [{"id": f"c{i}", "name": n, "dist_m": round(f * length / 10) * 10 if f < 1 else length,
            "photo": f"photos/{m['hid']}.svg"} for i, (n, f) in enumerate(fr)]
    return {"hike_id": m["hid"], "step_m": 10, "points": pts, "osm_length_m": length,
            "nps_length_m": m["nps_len"], "scale": round(m["nps_len"] / length, 3), "checkpoints": cps}


def build_advice():
    irma = "https://irma.nps.gov/STATS/"
    epa = "https://aqs.epa.gov/aqsweb/airdata/download_files.html"
    return [
        {"hike_id": "glacier-highline", "claim": "Go in September for quiet",
         "finding": "September visits were 44.6% of July in 2010 and 76.6% in 2023, so the quiet shoulder season is mostly gone.",
         "numbers": {"2010": 0.446, "2023": 0.766}, "source": "NPS IRMA, Recreation Visits by Month", "url": irma},
        {"hike_id": "angels-landing", "claim": "Zion is busiest in summer, in August",
         "finding": "June 2023 was the busiest month: 564,036 visits, 12.20% of the 4,623,238 year total.",
         "numbers": {"June 2023": 564036, "Year 2023": 4623238}, "source": "NPS IRMA, Recreation Visits by Month", "url": irma},
        {"hike_id": "angels-landing", "claim": "Zion summers are hot but not that hot",
         "finding": "Springdale averaged 13.0 days at or above 100 F each August in 2015-24 (130 days), far more than reanalysis models suggest.",
         "numbers": {"Station mean Aug high (F)": 97.9, "Days >= 100 F per August": 13.0}, "source": "NOAA GHCN-Daily, station USC00429717",
         "url": "https://www.ncei.noaa.gov/access/search/data-search/daily-summaries"},
        {"hike_id": "half-dome", "claim": "Bad air in Yosemite means wildfire smoke",
         "finding": "In Mariposa County, 71 of 310 August days had AQI over 100 (2015-24). Only 33 were PM2.5 smoke; 38 were ozone.",
         "numbers": {"AQI>100 days": 71, "PM2.5 (smoke) days": 33, "Ozone days": 38}, "source": "EPA AirData, daily AQI by county", "url": epa},
        {"hike_id": "grinnell-glacier", "claim": "Glacier's air is always clean",
         "finding": "Flathead County August days over AQI 100 went from 4 (2005-14) to 38 (2015-24), all of them PM2.5 smoke.",
         "numbers": {"2005-14": 4, "2015-24": 38}, "source": "EPA AirData, daily AQI by county", "url": epa},
        {"hike_id": "cadillac-north-ridge", "claim": "Acadia is quiet once summer ends",
         "finding": "September and October together carried 28.8% of visits in 2010 and 30.5% in 2023: fall is now a main season.",
         "numbers": {"2010": 0.288, "2023": 0.305}, "source": "NPS IRMA, Recreation Visits by Month", "url": irma},
        {"hike_id": "angels-landing", "claim": "Flights to Las Vegas are cheap from Seattle",
         "finding": "The average one-way Seattle to Las Vegas fare was $169.78 in Q3 2025, not the $118 some tools suggest.",
         "numbers": {"Q3 2025 average one-way fare ($)": 169.78}, "source": "DOT Consumer Airfare Report, Table 6",
         "url": "https://www.transportation.gov/policy/aviation-policy/domestic-airline-consumer-airfare-report"},
    ]


def build_meta(n_hikes):
    return {
        "fake": True,
        "fake_notice": "Placeholder data generated by scripts/make_fake_data.py. Not real. Replace with pipeline output.",
        "pipeline_version": "fake-0.1.0", "generated": date.today().isoformat(), "typical_years": "2015-2024 (2020 excluded)",
        "hike_count": n_hikes,
        # one entry per cost input; the hike page popover shows these next to each line item (moved here from every cost row)
        "cost_sources": {
            "fare": {"label": "DOT Consumer Airfare Report, Table 6 (fake)", "detail": "Average one-way fare for the same quarter, home-city airport to the hike's nearest airport", "url": "https://www.transportation.gov/policy/aviation-policy/domestic-airline-consumer-airfare-report"},
            "lodging": {"label": "GSA per diem, FY2026 (fake)", "detail": "Lodging and meals rate for the county; varies by month at only 18 of 51 parks", "url": "https://www.gsa.gov/travel/plan-a-trip/per-diem-rates"},
            "gas": {"label": "EIA regional gasoline price (fake)", "detail": "Regional average for the home city, at 25 mpg", "url": "https://www.eia.gov/petroleum/gasdiesel/"},
            "fees": {"label": "NPS entrance and permit fees (fake)", "detail": "Per-vehicle entrance fee (capped at the $80 annual pass) plus any permit", "url": "https://www.nps.gov/planyourvisit/fees-and-passes.htm"},
            "assumed": {"label": "Team assumption", "detail": "Rental car at $60 a day. Not from a data source", "url": ""},
        },
        "sources": [
            {"name": "NPS Visitor Use Statistics (IRMA)", "url": "https://irma.nps.gov/STATS/", "as_of": "not loaded (fake)"},
            {"name": "NOAA GHCN-Daily", "url": "https://www.ncei.noaa.gov/access/search/data-search/daily-summaries", "as_of": "not loaded (fake)"},
            {"name": "EPA AirData daily AQI by county", "url": "https://aqs.epa.gov/aqsweb/airdata/download_files.html", "as_of": "not loaded (fake)"},
            {"name": "DOT Consumer Airfare Report, Table 6", "url": "https://www.transportation.gov/policy/aviation-policy/domestic-airline-consumer-airfare-report", "as_of": "not loaded (fake)"},
            {"name": "GSA per diem", "url": "https://www.gsa.gov/travel/plan-a-trip/per-diem-rates", "as_of": "not loaded (fake)"},
            {"name": "EIA gasoline prices", "url": "https://www.eia.gov/petroleum/gasdiesel/", "as_of": "not loaded (fake)"},
            {"name": "OpenRouteService", "url": "https://openrouteservice.org/", "as_of": "not loaded (fake)"},
            {"name": "US states outline (us-atlas, from US Census, ISC licence)", "url": "https://github.com/topojson/us-atlas", "as_of": "static asset"},
        ],
    }


def placeholder_svg(name: str, park: str) -> str:
    seed = zlib.crc32(name.encode())
    hue = 168 + seed % 28  # teal family
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" role="img" aria-label="Placeholder photo for '
        f'{escape(name)}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl({hue},45%,78%)"/>'
        f'<stop offset="1" stop-color="hsl({hue},40%,38%)"/></linearGradient></defs><rect width="900" height="600" fill="url(#g)"/>'
        f'<path d="M0 430 L170 270 L290 360 L470 170 L640 340 L760 260 L900 380 V600 H0Z" fill="hsl({hue},45%,22%)" opacity=".85"/>'
        f'<text x="450" y="330" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="46" font-weight="700" fill="#fff">{escape(name)}</text>'
        f'<text x="450" y="378" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="26" fill="#fff" opacity=".9">{escape(park)} · placeholder image</text></svg>'
    )


def dump(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    return path.stat().st_size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "app" / "public" / "data"))
    args = ap.parse_args()
    out = Path(args.out)
    photos = out.parent / "photos"

    # start clean so hikes dropped from the list leave no stale profiles or photos behind
    for stale in list((out / "profiles").glob("*.json")) + list(photos.glob("*.svg")):
        stale.unlink()

    hikes, mrows = build_hikes()
    months = build_months(hikes, mrows)
    travel = build_travel(hikes, mrows)
    cost = build_cost(hikes, mrows, travel)
    sizes = {
        "hikes.json": dump(out / "hikes.json", hikes),
        "hike_month.json": dump(out / "hike_month.json", months),
        "travel.json": dump(out / "travel.json", travel),
        "cost.json": dump(out / "cost.json", cost),
        "advice.json": dump(out / "advice.json", build_advice()),
        "meta.json": dump(out / "meta.json", build_meta(len(hikes))),
    }
    prof = 0
    for hk, m in zip(hikes, mrows):
        prof += dump(out / "profiles" / f"{m['hid']}.json", build_profile(hk, m))
        photos.mkdir(parents=True, exist_ok=True)
        (photos / f"{m['hid']}.svg").write_text(placeholder_svg(hk["name"], hk["park_name"]), encoding="utf-8")

    total = sum(sizes.values())
    print(f"{len(hikes)} hikes, {len(months)} hike_month, {len(travel)} travel, {len(cost)} cost rows")
    for k, v in sizes.items():
        print(f"  {k:16s} {v / 1024:8.1f} KB")
    print(f"  {'profiles/*':16s} {prof / 1024:8.1f} KB (not in the 1 MB budget)")
    print(f"  total except profiles: {total / 1024:.0f} KB (budget 1024 KB)")


if __name__ == "__main__":
    main()
