export type CloudPhase = 'rush' | 'white' | 'part'
export interface CloudSchedule { start: CloudPhase; steps: { at: number; phase: CloudPhase }[]; doneAt: number }

/** Forward: clouds rush in, white-out (navigate on white). Back: start in the white-out, clouds part. Reduced motion: a plain fade, no clouds. */
export const cloudSchedule = (dir: 'in' | 'out', reduced: boolean): CloudSchedule => {
  if (dir === 'in') return reduced ? { start: 'white', steps: [], doneAt: 220 } : { start: 'rush', steps: [{ at: 1050, phase: 'white' }], doneAt: 1500 }
  return reduced ? { start: 'white', steps: [{ at: 20, phase: 'part' }], doneAt: 260 } : { start: 'white', steps: [{ at: 300, phase: 'part' }], doneAt: 1700 }
}

