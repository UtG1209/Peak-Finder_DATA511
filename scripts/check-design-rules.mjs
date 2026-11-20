#!/usr/bin/env node
// Design guard (CLAUDE.md section 0). Fails when a .ts/.tsx file under app/src has
//   1. a raw hex colour literal (use a token: CSS var(--...) or readToken('--...') from lib/theme.ts), or
//   2. a Unicode arrow, cross, check or minus glyph used as an icon in JSX text or as a lone string (use <Icon name="..." /> from components/Icon.tsx).
// Skipped: tests, test/ helpers, lib/difficulty.ts (canvas needs literals; difficulty.test.ts keeps them equal to the tokens), lib/contrast*.
// Escape hatch for a real exception: put `design-ok` in a comment on the same line, with the reason.
// Run:  node scripts/check-design-rules.mjs   (also part of `npm run check`)
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = 'app/src'
const SKIP_FILE = [/\.test\.tsx?$/, /\.d\.ts$/, /(^|\/)test\//, /(^|\/)lib\/difficulty\.ts$/, /(^|\/)lib\/contrast[^/]*$/]
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/
const GLYPHS = '←→↑↓↗×✓✕✗✔−–'.split('')
const GLYPH_CLASS = '[←→↑↓↗×✓✕✗✔−]'
const JSX_TEXT = new RegExp(`>[^<>{}=]*${GLYPH_CLASS}[^<>{}]*<|^\\s*[^<>{}=;()'"\`/*]*${GLYPH_CLASS}[^<>{}]*$`)
const LONE_STRING = new RegExp(`(['"\`])\\s*${GLYPH_CLASS}\\s*\\1`)

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.tsx?$/.test(e.name)) yield p
  }
}

const problems = []
for (const file of walk(ROOT)) {
  const rel = relative('.', file).split(sep).join('/')
  if (SKIP_FILE.some((re) => re.test(rel))) continue
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const lines = src.split('\n')
  const isTsx = file.endsWith('.tsx')
  lines.forEach((raw, i) => {
    if (raw.includes('design-ok')) return
    const line = raw.replace(/(^|\s)\/\/.*$/, '$1')
    const at = (what, why) => problems.push(`${rel}:${i + 1}  ${what}  (${why})\n    ${raw.trim().slice(0, 140)}`)
    const hex = line.match(HEX)
    if (hex) at(`raw colour ${hex[0]}`, "use a token: var(--...) in CSS, readToken('--...') in canvas code")
    if (isTsx) {
      const m = line.match(JSX_TEXT) ?? line.match(LONE_STRING)
      if (m) {
        const g = GLYPHS.find((c) => m[0].includes(c))
        at(`glyph "${g}" used as an icon`, 'use <Icon name="..." /> from components/Icon.tsx')
      }
    }
  })
}

if (problems.length) {
  console.error(`Design rules broken (${problems.length}):\n`)
  for (const p of problems) console.error('  ' + p)
  console.error('\nFix them, or mark a real exception with a `design-ok: <reason>` comment on the same line.')
  process.exit(1)
}
console.log('Design rules ok: no raw hex colours and no glyph icons in app/src.')
