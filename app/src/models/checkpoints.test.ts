import { describe, expect, it } from 'vitest'
import { flatProfile } from '../test/fixtures'
import { beforeDark, defaultStartMin, eventIndexAt, finishTime, formatClock, parseClock, positionAt, smoothElevations, STOP_MINUTES, stepTime, timeAtWalked, timeline, toblerSpeedKmh } from './checkpoints'

describe('Tobler speed', () => {
  it('peaks at 6 km/h on a slight downhill (S = -0.05)', () => expect(toblerSpeedKmh(-0.05)).toBeCloseTo(6, 6))
  it('is about 5.04 km/h on the flat', () => expect(toblerSpeedKmh(0)).toBeCloseTo(6 * Math.exp(-0.175), 6))
  it('slows on steep climbs and steep descents', () => {
    expect(toblerSpeedKmh(0.3)).toBeLessThan(toblerSpeedKmh(0.1))
    expect(toblerSpeedKmh(-0.4)).toBeLessThan(toblerSpeedKmh(-0.1))
  })
})

describe('timeline', () => {
  const flatMinutesPerHalf = (500 / 1000 / toblerSpeedKmh(0)) * 60

  it('times a flat out-and-back with 10 minute stops', () => {
    const tl = timeline(flatProfile(), 7 * 60)
    expect(tl.map((e) => `${e.checkpoint.id}:${e.dir}`)).toEqual(['c0:up', 'c1:up', 'c2:up', 'c1:down', 'c0:down'])
    expect(tl[0].time).toBe(420) // no stop at the trailhead
    expect(tl[1].time).toBeCloseTo(420 + flatMinutesPerHalf, 6)
    expect(tl[2].time).toBeCloseTo(420 + 2 * flatMinutesPerHalf + STOP_MINUTES, 6)
    // two stops going out (c1, c2) and one coming back (c1); none at the start or the finish
    expect(finishTime(tl)).toBeCloseTo(420 + 4 * flatMinutesPerHalf + 3 * STOP_MINUTES, 6)
  })

  it('scales distances by nps / osm length (Angels Landing: 3.3 km on the map, 4.3 km official)', () => {
    const plain = finishTime(timeline(flatProfile(), 0))
    const scaled = finishTime(timeline(flatProfile({ nps_length_m: 1314, scale: 1.314 }), 0))
    const stops = 3 * STOP_MINUTES
    expect((scaled - stops) / (plain - stops)).toBeCloseTo(1.314, 3) // walking time grows with the length
  })

  it('climbing is slower than the way down for the same stretch', () => {
    const climb = flatProfile({ points: Array.from({ length: 101 }, (_, i) => [i * 10, 100 + i * 1.5] as [number, number]) }) // 15% grade
    const tl = timeline(climb, 0)
    const up = tl[2].time - tl[0].time - STOP_MINUTES
    const down = tl[4].time - tl[2].time - STOP_MINUTES - STOP_MINUTES
    expect(down).toBeLessThan(up)
  })

  it('a one-way route has no return leg and no stop at the end', () => {
    const tl = timeline(flatProfile(), 0, false)
    expect(tl.map((e) => e.dir)).toEqual(['up', 'up', 'up'])
    expect(tl[2].stopMin).toBe(0)
  })

  it('checkpoint walked distance is in scaled metres', () => {
    const tl = timeline(flatProfile({ nps_length_m: 2000, scale: 2 }), 0)
    expect(tl[2].walkedM).toBeCloseTo(2000)
    expect(tl[4].walkedM).toBeCloseTo(4000)
  })
})

describe('noisy real-world profiles', () => {
  it('a single elevation spike does not add days to the total (smoothing and slope cap)', () => {
    const flat = finishTime(timeline(flatProfile(), 0))
    const spiky = flatProfile()
    spiky.points = spiky.points.map((p, i) => (i === 40 ? ([p[0], p[1] + 39] as [number, number]) : p)) // a 39 m spike in one 10 m step
    const t = finishTime(timeline(spiky, 0))
    expect(t).toBeLessThan(flat * 1.6)
    expect(t).toBeGreaterThan(flat)
  })
  it('smoothing keeps a steady ramp essentially unchanged in the middle', () => {
    const ramp = Array.from({ length: 21 }, (_, i) => [i * 10, i * 1.5] as [number, number])
    const sm = smoothElevations(ramp, 10)
    expect(sm[10]).toBeCloseTo(ramp[10][1], 6)
    expect(sm).toHaveLength(21)
  })
})

describe('positionAt', () => {
  const tl = timeline(flatProfile(), 7 * 60)

  it('is at the trailhead before the start and after the finish', () => {
    expect(positionAt(tl, 0).dist).toBe(0)
    expect(positionAt(tl, 24 * 60).dist).toBe(0)
    expect(positionAt(tl, 24 * 60).nextCheckpoint).toBeNull()
  })

  it('walks outward: halfway between c0 and c1 at half the time', () => {
    const half = (tl[1].time - tl[0].time) / 2
    const p = positionAt(tl, tl[0].time + half)
    expect(p.dist).toBeCloseTo(250, 3)
    expect(p.dir).toBe('up')
    expect(p.nextCheckpoint?.checkpoint.id).toBe('c1')
  })

  it('stays put during a stop', () => {
    const p = positionAt(tl, tl[2].time + 5)
    expect(p.dist).toBe(1000)
    expect(p.dir).toBe('up')
  })

  it('walks back on the return leg', () => {
    const depart = tl[2].time + STOP_MINUTES
    const p = positionAt(tl, depart + (tl[3].time - depart) / 2)
    expect(p.dir).toBe('down')
    expect(p.dist).toBeCloseTo(750, 3)
    expect(p.nextCheckpoint?.checkpoint.id).toBe('c1')
  })
})

describe('daylight and clocks', () => {
  it('beforeDark compares the finish with sunset', () => {
    const tl = timeline(flatProfile(), 7 * 60)
    expect(beforeDark(tl, finishTime(tl) + 1)).toBe(true)
    expect(beforeDark(tl, finishTime(tl) - 1)).toBe(false)
  })
  it('parses and formats clock times', () => {
    expect(parseClock('06:38')).toBe(398)
    expect(formatClock(398)).toBe('6:38 am')
    expect(formatClock(13 * 60 + 5)).toBe('1:05 pm')
    expect(formatClock(0)).toBe('12:00 am')
  })
  it('default start is one hour after sunrise', () => expect(defaultStartMin('06:38')).toBe(458))
})

describe('stepping between checkpoints (Back / Forward buttons and arrow keys)', () => {
  const tl = timeline(flatProfile(), 7 * 60) // c0:up c1:up c2:up c1:down c0:down
  const times = tl.map((e) => e.time)

  it('Forward walks the hike in its own order: up to the summit, then back down', () => {
    let t = times[0]
    const seen: string[] = [`${tl[eventIndexAt(tl, t)].checkpoint.id}`]
    for (let i = 0; i < 4; i++) {
      t = stepTime(tl, t, 1)
      const e = tl[eventIndexAt(tl, t)]
      seen.push(`${e.checkpoint.id}:${e.dir}`)
    }
    expect(seen).toEqual(['c0', 'c1:up', 'c2:up', 'c1:down', 'c0:down'])
  })

  it('Back reverses it, and both ends stay put', () => {
    expect(stepTime(tl, times[4], -1)).toBe(times[3])
    expect(stepTime(tl, times[1], -1)).toBe(times[0])
    expect(stepTime(tl, times[0], -1)).toBe(times[0]) // already at the start
    expect(stepTime(tl, times[4], 1)).toBe(times[4]) // already at the finish
  })

  it('between two checkpoints Back goes to the one behind you and Forward to the one ahead', () => {
    const mid = (times[1] + STOP_MINUTES + times[2]) / 2 - 1 // walking from c1 to c2
    expect(stepTime(tl, mid, -1)).toBe(times[1])
    expect(stepTime(tl, mid, 1)).toBe(times[2])
  })

  it('while waiting at a stop, Back goes to that stop and Forward to the next', () => {
    const waiting = times[1] + 4
    expect(stepTime(tl, waiting, -1)).toBe(times[1])
    expect(stepTime(tl, waiting, 1)).toBe(times[2])
  })

  it('eventIndexAt is -1 before the start', () => {
    expect(eventIndexAt(tl, times[0] - 5)).toBe(-1)
  })
})

describe('timeAtWalked (dragging the marker along the profile)', () => {
  const tl = timeline(flatProfile(), 0)
  it('clamps to the start and the finish', () => {
    expect(timeAtWalked(tl, -50)).toBe(tl[0].time)
    expect(timeAtWalked(tl, 1e9)).toBe(finishTime(tl))
  })
  it('is the inverse of positionAt', () => {
    for (const w of [100, 500, 800, 1000, 1400, 1900]) {
      const t = timeAtWalked(tl, w)
      expect(positionAt(tl, t).walkedM).toBeCloseTo(w, 0)
    }
  })
  it('later distance means later time', () => {
    expect(timeAtWalked(tl, 300)).toBeLessThan(timeAtWalked(tl, 700))
  })
})

