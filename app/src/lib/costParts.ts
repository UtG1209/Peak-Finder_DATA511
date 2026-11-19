export type Part = 'transport' | 'lodging' | 'food' | 'activity' | 'buffer'
export const PART_LABEL: Record<Part, string> = { lodging: 'Lodging', food: 'Food', transport: 'Transport', activity: 'Park fees and permits', buffer: 'Buffer (15%)' }
