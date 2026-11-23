const MAX_R = 10 // px radius of a 100% bubble (was 11: smaller so the Utah/Arizona cluster collides less)
const MIN_R = 5
const GREY_R = 3.5 // a hike that fails a limit is a small hollow grey dot, never removed

/** Radius from match so bubble AREA (not radius) tracks the number. */
export const bubbleRadius = (match: number, greyed: boolean): number =>
  greyed ? GREY_R : Math.max(MIN_R, MAX_R * Math.sqrt(Math.max(0, Math.min(100, match)) / 100))

export interface ScreenPoint {
  id: string
  x: number
  y: number
}

/**
 * Deterministic declutter: when two trailheads are closer than `minDist` px on screen, nudge each apart along the line between them
 * (half the shortfall each, at most `maxShift` px in total per peak). Exactly coincident points are split along a fixed angle by sorted id.
 * Returns pixel offsets only for peaks that move; far-apart peaks get none. Pure, same input gives same output.
 */
export function separate(points: ScreenPoint[], minDist = 14, maxShift = 9): Map<string, [number, number]> {
  const pts = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((p) => ({ id: p.id, x: p.x, y: p.y, dx: 0, dy: 0 }))
  for (let iter = 0; iter < 4; iter++) {
    let moved = false
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]
        const b = pts[j]
        let vx = b.x + b.dx - (a.x + a.dx)
        let vy = b.y + b.dy - (a.y + a.dy)
        let d = Math.hypot(vx, vy)
        if (d >= minDist) continue
        if (d < 0.01) { vx = Math.cos(1 + i); vy = Math.sin(1 + i); d = 1 } // coincident: fixed direction from the sorted index
        const push = (minDist - Math.max(d, 0.01 * minDist)) / 2
        const ux = vx / d
        const uy = vy / d
        a.dx -= ux * push; a.dy -= uy * push
        b.dx += ux * push; b.dy += uy * push
        moved = true
      }
    }
    for (const p of pts) {
      const m = Math.hypot(p.dx, p.dy)
      if (m > maxShift) { p.dx *= maxShift / m; p.dy *= maxShift / m }
    }
    if (!moved) break
  }
  const out = new Map<string, [number, number]>()
  for (const p of pts) if (Math.hypot(p.dx, p.dy) > 0.25) out.set(p.id, [p.dx, p.dy])
  return out
}
