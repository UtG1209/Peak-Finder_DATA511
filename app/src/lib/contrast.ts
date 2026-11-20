// Colour maths for the design tokens: WCAG 2.x contrast ratio and a colour-vision-deficiency check.
// Pure functions, used by contrast.test.ts to guard styles/tokens.css. Not imported by app code.

export type Rgb = [number, number, number] // 0..255

export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toLinear = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. Text needs 4.5, large text and UI shapes need 3. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
export const CVD_MATRICES = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
} as const
export type Cvd = keyof typeof CVD_MATRICES

/** The colour as seen with the given colour-vision deficiency, as linear RGB (0..1, clipped). */
export function simulateCvd(hex: string, kind: Cvd): [number, number, number] {
  const lin = hexToRgb(hex).map(toLinear)
  const m = CVD_MATRICES[kind]
  return m.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))) as [number, number, number]
}

/** CIE L*a*b* (D65) from linear RGB. */
export function linearToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIE76 colour difference. About 2.3 is a just-noticeable difference; 20+ reads as clearly different colours. */
export function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Distance between two hex colours as seen by a viewer with `kind` (or normal vision when omitted). */
export function colourDistance(a: string, b: string, kind?: Cvd): number {
  const lin = (h: string) => (kind ? simulateCvd(h, kind) : (hexToRgb(h).map(toLinear) as [number, number, number]))
  return deltaE(linearToLab(lin(a)), linearToLab(lin(b)))
}

