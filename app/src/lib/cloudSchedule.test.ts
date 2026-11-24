import { describe, expect, it } from 'vitest'
import { cloudSchedule } from './cloudSchedule'

describe('cloudSchedule', () => {
  it('goes in through clouds and navigates on the white-out', () => {
    const s = cloudSchedule('in', false)
    expect(s.start).toBe('rush')
    expect(s.steps[0]).toEqual({ at: 1050, phase: 'white' })
    expect(s.doneAt).toBeGreaterThan(s.steps[0].at)
  })
  it('comes back from white and parts the clouds', () => {
    const s = cloudSchedule('out', false)
    expect(s.start).toBe('white')
    expect(s.steps.at(-1)?.phase).toBe('part')
  })
  it('is a short fade with reduced motion', () => {
    expect(cloudSchedule('in', true).steps).toEqual([])
    expect(cloudSchedule('in', true).doneAt).toBeLessThan(400)
    expect(cloudSchedule('out', true).doneAt).toBeLessThan(400)
  })
})
