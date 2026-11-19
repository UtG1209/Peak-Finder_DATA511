import type { z } from 'zod'
import {
  AdviceSchema,
  CostSchema,
  HikeMonthSchema,
  HikeSchema,
  MetaSchema,
  ProfileSchema,
  TravelSchema,
  type Advice,
  type CostRow,
  type Hike,
  type HikeMonth,
  type Meta,
  type Profile,
  type Quarter,
  type Travel,
} from './schema'

// The app never calls a live API: it reads committed JSON from public/data/.
const base = () => `${import.meta.env.BASE_URL}data/`

async function getJson<S extends z.ZodTypeAny>(file: string, schema: S): Promise<z.infer<S>> {
  const res = await fetch(base() + file)
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`)
  return schema.parse(await res.json())
}

export interface Dataset {
  hikes: Hike[]
  hikeMonth: HikeMonth[]
  travel: Travel[]
  cost: CostRow[]
  advice: Advice[]
  meta: Meta
}

export async function loadDataset(): Promise<Dataset> {
  const [hikes, hikeMonth, travel, cost, advice, meta] = await Promise.all([
    getJson('hikes.json', HikeSchema.array()),
    getJson('hike_month.json', HikeMonthSchema.array()),
    getJson('travel.json', TravelSchema.array()),
    getJson('cost.json', CostSchema.array()),
    getJson('advice.json', AdviceSchema.array()),
    getJson('meta.json', MetaSchema),
  ])
  return { hikes, hikeMonth, travel, cost, advice, meta }
}

/** Profiles are one file per hike and are loaded on demand (hike page), not up front. */
export const loadProfile = (hikeId: string): Promise<Profile> => getJson(`profiles/${hikeId}.json`, ProfileSchema)

/** Lookup tables built once from a Dataset so screens never scan arrays. */
export interface DataIndex {
  hikeById: Map<string, Hike>
  months: Map<string, HikeMonth[]> // hike id -> 12 rows, ordered by month
  travel: Map<string, Travel> // `${hikeId}|${city}`
  cost: Map<string, CostRow> // `${hikeId}|${city}|${quarter}`
  advice: Map<string, Advice[]> // hike id -> cards
}

export function indexDataset(ds: Dataset): DataIndex {
  const months = new Map<string, HikeMonth[]>()
  for (const m of ds.hikeMonth) {
    const list = months.get(m.hike_id) ?? []
    list.push(m)
    months.set(m.hike_id, list)
  }
  for (const list of months.values()) list.sort((a, b) => a.month - b.month)
  const advice = new Map<string, Advice[]>()
  for (const a of ds.advice) advice.set(a.hike_id, [...(advice.get(a.hike_id) ?? []), a])
  return {
    hikeById: new Map(ds.hikes.map((h) => [h.id, h])),
    months,
    travel: new Map(ds.travel.map((t) => [`${t.hike_id}|${t.city}`, t])),
    cost: new Map(ds.cost.map((c) => [`${c.hike_id}|${c.city}|${c.quarter}`, c])),
    advice,
  }
}

export const quarterMonths = (idx: DataIndex, hikeId: string, q: Quarter): HikeMonth[] =>
  (idx.months.get(hikeId) ?? []).filter((m) => Math.ceil(m.month / 3) === q)
export const travelFor = (idx: DataIndex, hikeId: string, city: string | null) => (city ? idx.travel.get(`${hikeId}|${city}`) ?? null : null)
export const costFor = (idx: DataIndex, hikeId: string, city: string, q: Quarter) => idx.cost.get(`${hikeId}|${city}|${q}`) ?? null
