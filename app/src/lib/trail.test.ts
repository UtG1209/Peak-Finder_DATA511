import { describe, expect, it } from 'vitest'
import { flatProfile } from '../test/fixtures'
import { finishTime, timeline } from '../models/checkpoints'
import { checkpointLabel, daylightVerdict, durationLabel, trailCurve, turnaroundEvent } from './trail'

describe('trailCurve (the two-hump chart)', () => {
  const profile = flatProfile({ nps_length_m: 2000, scale: 2 })
  it('out-and-back: the climb, then the return, x = distance walked in official metres', () => {
    const c = trailCurve(profile, true)
    expect(c[0].walkedM).toBe(0)
    const turn = c.findIndex((p) => p.dir === 'down')
    expect(c[turn - 1].walkedM).toBeCloseTo(2000) // the summit is one official length out
    expect(c[c.length - 1].walkedM).toBeCloseTo(4000) // and the trailhead again at twice that
    expect(c.map((p) => p.walkedM)).toEqual([...c.map((p) => p.walkedM)].sort((a, b) => a - b)) // x never goes backwards
  })
  it('a loop or one-way route is a single curve', () => {
    const c = trailCurve(profile, false)
    expect(c.every((p) => p.dir === 'up')).toBe(true)
    expect(c[c.length - 1].walkedM).toBeCloseTo(2000)
  })
  it('the return retraces the climb in reverse', () => {
    const hill = flatProfile({ points: Array.from({ length: 11 }, (_, i) => [i * 10, 100 + i * 10] as [number, number]) })
    const c = trailCurve(hill, true)
    const up = c.filter((p) => p.dir === 'up').map((p) => p.elevM)
    const down = c.filter((p) => p.dir === 'down').map((p) => p.elevM)
    expect(down[0]).toBeCloseTo(up[up.length - 2], 6)
    expect(down[down.length - 1]).toBeCloseTo(up[0], 6)
  })
})

describe('turnaroundEvent', () => {
  it('is the summit for out-and-back and the finish for a one-way route', () => {
    const p = flatProfile()
    expect(turnaroundEvent(timeline(p, 0)).checkpoint.id).toBe('c2')
    expect(turnaroundEvent(timeline(p, 0, false)).checkpoint.id).toBe('c2')
  })
})

describe('daylightVerdict', () => {
  const tl = timeline(flatProfile(), 7 * 60)
  const finish = finishTime(tl)
  it('finishing well before sunset', () => {
    const v = daylightVerdict(tl, '06:00', '20:00')
    expect(v.finishesAfterSunset).toBe(false)
    expect(v.startsBeforeSunrise).toBe(false)
    expect(v.marginMin).toBeCloseTo(20 * 60 - finish)
  })
  it('finishing after dark is flagged with a negative margin', () => {
    const v = daylightVerdict(tl, '06:00', '07:30')
    expect(v.finishesAfterSunset).toBe(true)
    expect(v.marginMin).toBeLessThan(0)
  })
  it('starting before sunrise is flagged', () => {
    expect(daylightVerdict(timeline(flatProfile(), 5 * 60), '06:30', '20:00').startsBeforeSunrise).toBe(true)
  })
  it('finishing exactly at sunset still counts as before dark', () => {
    const sunset = `${String(Math.floor(finish / 60)).padStart(2, '0')}:${String(Math.ceil(finish) % 60).padStart(2, '0')}`
    expect(daylightVerdict(tl, '06:00', sunset).finishesAfterSunset).toBe(false)
  })
})

describe('labels', () => {
  it('durationLabel', () => {
    expect(durationLabel(275)).toBe('4 h 35 min')
    expect(durationLabel(60)).toBe('1 h')
    expect(durationLabel(25)).toBe('25 min')
    expect(durationLabel(-90)).toBe('1 h 30 min')
  })
  it('checkpointLabel', () => expect(checkpointLabel('c3')).toBe('C3'))
})
