import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { indexDataset, type DataIndex, type Dataset } from '../data/loaders'
import { AdviceSchema, CostSchema, HikeMonthSchema, HikeSchema, MetaSchema, TravelSchema } from '../data/schema'
import { bestRelaxation, countFitting, evaluate } from './explore'
import { defaultFilters, type FilterState } from './filters'

// Uses the data files the app ships (fake or real), so this also guards the contract between lanes.
let data: Dataset
let index: DataIndex
const open = (over: Partial<FilterState> = {}): FilterState => ({ ...defaultFilters(new Date(2026, 10, 19)), ...over })

beforeAll(() => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', f), 'utf8'))
  data = {
    hikes: HikeSchema.array().parse(read('hikes.json')),
    hikeMonth: HikeMonthSchema.array().parse(read('hike_month.json')),
    travel: TravelSchema.array().parse(read('travel.json')),
    cost: CostSchema.array().parse(read('cost.json')),
    advice: AdviceSchema.array().parse(read('advice.json')),
    meta: MetaSchema.parse(read('meta.json')),
  }
  index = indexDataset(data)
})

describe('evaluate', () => {
  it('scores every hike and, with every limit wide open, nothing is filtered out', () => {
    const rows = evaluate(data, index, open())
    expect(rows).toHaveLength(data.hikes.length)
    expect(countFitting(rows)).toBe(data.hikes.length)
    expect(rows.every((r) => r.result.match === 100)).toBe(true)
  })

  it('sorts fitting hikes first, then by match % (best first)', () => {
    const rows = evaluate(data, index, open({ q: 3, temp: [60, 85] }))
    const outs = rows.map((r) => r.out)
    expect(outs).toEqual([...outs].sort((a, b) => Number(a) - Number(b))) // all false, then all true
    const fit = rows.filter((r) => !r.out).map((r) => r.result.match)
    expect(fit).toEqual([...fit].sort((a, b) => b - a))
  })

  it('a hike that fails a limit stays in the list (never disappears), as a grey dot', () => {
    const rows = evaluate(data, index, open({ q: 3, temp: [10, 20] }))
    expect(rows).toHaveLength(data.hikes.length)
    expect(rows.some((r) => r.out)).toBe(true)
  })

  it('category filters (difficulty, 3D walk) mark other hikes as out', () => {
    const hard = evaluate(data, index, open({ diff: ['hard'] }))
    for (const r of hard) expect(r.out).toBe(r.hike.difficulty !== 'hard')
    const only3d = evaluate(data, index, open({ has3d: true }))
    for (const r of only3d) expect(r.out).toBe(!r.hike.featured)
  })

  it('travel limit is ignored without a home city (UX rule 5: city changes distance)', () => {
    expect(countFitting(evaluate(data, index, open({ travel: 1 })))).toBe(data.hikes.length)
  })
})

describe('bestRelaxation (the empty-state fix)', () => {
  const impossible = open({ q: 3, temp: [0, 5] })
  it('suggests the one limit to loosen, with how many hikes it brings back', () => {
    expect(countFitting(evaluate(data, index, impossible))).toBe(0)
    const fix = bestRelaxation(data, index, impossible)
    expect(fix).not.toBeNull()
    expect(fix!.gain).toBeGreaterThan(0)
    expect(fix!.label).toMatch(/temperature/)
    // applying it really does bring them back
    expect(countFitting(evaluate(data, index, { ...impossible, ...fix!.patch }))).toBe(fix!.gain)
  })
  it('returns null when there is nothing to loosen', () => {
    expect(bestRelaxation(data, index, open())).toBeNull()
  })
})
