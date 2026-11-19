// Runtime schemas for every file the app reads (CLAUDE.md section 4).
// This is the data contract: the pipeline output must pass these, and the TypeScript types
// are derived from them (z.infer), so the two cannot drift. Changing a shape needs team sign-off.
import { z } from 'zod'

const num = z.number()
const nullableNum = z.number().nullable()

export const PhotoSchema = z.object({
  file: z.string(),
  author: z.string(),
  license: z.string(),
  license_url: z.string(),
  page: z.string(),
})

export const PlaceSchema = z.object({ name: z.string(), lat: num, lon: num })

export const HikeSchema = z.object({
  id: z.string(),
  name: z.string(),
  park_code: z.string(),
  park_name: z.string(),
  state: z.string(),
  trailhead: PlaceSchema,
  end: PlaceSchema,
  length_mi: num,
  length_type: z.string(), // "round-trip" | "loop" | "one-way"
  gain_ft: num,
  max_elev_ft: num,
  route_type: z.enum(['out-and-back', 'loop', 'point-to-point']),
  difficulty: z.enum(['easy', 'moderate', 'hard']),
  nps_url: z.string(),
  description: z.string(),
  permit_note: z.string().nullable(),
  closure_note: z.string().nullable(),
  gear: z.array(z.string()),
  photo: PhotoSchema,
  featured: z.boolean(),
  walk_path: z.string().nullable(),
  // null when no GHCN station lies within 50 km (the app shows a grey "No station" cell)
  station: z.object({ id: z.string(), name: z.string(), dist_km: num, elev_ft: num }).nullable(),
  aqi_county: z.object({ fips: z.string(), name: z.string() }),
})

// Factor names used in HikeMonth.missing. Missing factors are left out of the match score.
export const MissingFactor = z.enum(['temp', 'wet', 'smoky', 'crowd'])

export const HikeMonthSchema = z.object({
  hike_id: z.string(),
  month: z.number().int().min(1).max(12),
  crowd_level: num, // month visits / the park's busiest month, 0..1 (park level)
  crowd_band: z.enum(['quiet', 'moderate', 'busy']),
  // Null when the hike has no station (then `missing` contains "temp" / "wet").
  tmax_p25: nullableNum,
  tmax_p50: nullableNum,
  tmax_p75: nullableNum,
  tmax_summit_est: nullableNum,
  wet_days: nullableNum,
  snow_days: nullableNum,
  smoky_days: num,
  ozone_days: num,
  heat_days: nullableNum,
  daylight_hr: num,
  sunrise: z.string(), // "HH:MM" local clock
  sunset: z.string(),
  closed: z.boolean(),
  missing: z.array(MissingFactor),
})

export const TravelSchema = z.object({
  hike_id: z.string(),
  city: z.string(),
  drive_hr: num,
  drive_mi: num,
  airport: z.string(),
  fly_drive_hr: num,
  default_mode: z.enum(['drive', 'fly']),
})

export const CostSchema = z.object({
  hike_id: z.string(),
  city: z.string(),
  quarter: z.number().int().min(1).max(4),
  fare_one_way: num,
  car_per_day: num,
  drive_mi: num,
  gas_per_gal: num,
  mpg: num,
  lodging_per_night: num,
  meals_per_day: num,
  entry_fee_vehicle: num,
  permit_fee: num,
  sources: z.object({ fare: z.string(), lodging: z.string(), gas: z.string(), fees: z.string() }),
})

export const CheckpointSchema = z.object({
  id: z.string(),
  name: z.string(),
  dist_m: num, // along the profile (OSM metres, before scaling)
  photo: z.string().nullable(),
})

export const ProfileSchema = z.object({
  hike_id: z.string(),
  step_m: num,
  points: z.array(z.tuple([num, num])), // [dist_m, elev_m]
  osm_length_m: num,
  nps_length_m: num, // one way for out-and-back, whole route otherwise
  scale: num, // nps_length_m / osm_length_m
  checkpoints: z.array(CheckpointSchema),
})

export const AdviceSchema = z.object({
  hike_id: z.string(),
  claim: z.string(),
  finding: z.string(),
  numbers: z.record(z.string(), num),
  source: z.string(),
  url: z.string(),
})

export const MetaSchema = z
  .object({
    fake: z.boolean().optional(),
    pipeline_version: z.string(),
    generated: z.string(),
    sources: z.array(z.object({ name: z.string(), url: z.string(), as_of: z.string() })),
  })
  .passthrough()

export type Photo = z.infer<typeof PhotoSchema>
export type Hike = z.infer<typeof HikeSchema>
export type HikeMonth = z.infer<typeof HikeMonthSchema>
export type Travel = z.infer<typeof TravelSchema>
export type CostRow = z.infer<typeof CostSchema>
export type Checkpoint = z.infer<typeof CheckpointSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type Advice = z.infer<typeof AdviceSchema>
export type Meta = z.infer<typeof MetaSchema>
export type Quarter = 1 | 2 | 3 | 4
