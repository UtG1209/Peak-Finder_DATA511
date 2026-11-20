const MAX_R = 11 // px radius of a 100% bubble
const MIN_R = 5
const GREY_R = 3.5 // a hike that fails a limit is a small hollow grey dot, never removed

/** Radius from match so bubble AREA (not radius) tracks the number. */
export const bubbleRadius = (match: number, greyed: boolean): number =>
  greyed ? GREY_R : Math.max(MIN_R, MAX_R * Math.sqrt(Math.max(0, Math.min(100, match)) / 100))
