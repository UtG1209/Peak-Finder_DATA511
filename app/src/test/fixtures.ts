import type { CostRow, HikeMonth, Profile, Travel } from '../data/schema'

export const month = (over: Partial<HikeMonth> & { month: number }): HikeMonth => ({
  hike_id: 'test', crowd_level: 0.5, crowd_band: 'moderate',
  tmax_p25: 70, tmax_p50: 75, tmax_p75: 80, tmax_summit_est: 70, wet_days: 2, snow_days: 0,
  smoky_days: 0, ozone_days: 0, heat_days: 0, daylight_hr: 12, sunrise: '06:30', sunset: '19:00',
  closed: false, missing: [], ...over,
})

/** Angels Landing, Q3 (Springdale-like): Jul 100.1, Aug 97.9 (real), Sep 88 -> quarter mean ~95.3 F. */
export const angelsQ3: HikeMonth[] = [
  month({ hike_id: 'angels-landing', month: 7, tmax_p50: 100.1, crowd_level: 0.98, smoky_days: 0.3, wet_days: 2.5 }),
  month({ hike_id: 'angels-landing', month: 8, tmax_p50: 97.9, crowd_level: 0.92, smoky_days: 0.4, wet_days: 3.2 }),
  month({ hike_id: 'angels-landing', month: 9, tmax_p50: 88, crowd_level: 0.93, smoky_days: 0.1, wet_days: 2 }),
]

export const travelSeaAngels: Travel = { hike_id: 'angels-landing', city: 'SEA', drive_hr: 15.6, drive_mi: 1060, airport: 'LAS', fly_drive_hr: 6.4, default_mode: 'fly' }

export const costSeaAngelsQ3: CostRow = {
  hike_id: 'angels-landing', city: 'SEA', quarter: 3, fare_one_way: 169.78, car_per_day: 60, drive_mi: 1060,
  gas_per_gal: 4.1, mpg: 25, lodging_per_night: 110, meals_per_day: 68, entry_fee_vehicle: 35, permit_fee: 6,
  sources: { fare: 'DOT Table 6, Q3 2025', lodging: 'GSA FY2026', gas: 'EIA West Coast', fees: 'NPS' },
}

/** A 1 km flat profile, one-way, no scaling, with a midpoint and a turnaround checkpoint. */
export const flatProfile = (over: Partial<Profile> = {}): Profile => ({
  hike_id: 'flat', step_m: 10,
  points: Array.from({ length: 101 }, (_, i) => [i * 10, 100] as [number, number]),
  osm_length_m: 1000, nps_length_m: 1000, scale: 1,
  checkpoints: [
    { id: 'c0', name: 'Trailhead', dist_m: 0, photo: null },
    { id: 'c1', name: 'Halfway', dist_m: 500, photo: null },
    { id: 'c2', name: 'Turnaround', dist_m: 1000, photo: null },
  ],
  ...over,
})
