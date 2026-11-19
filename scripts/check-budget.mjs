#!/usr/bin/env node
// Performance guard (run after `npm run build`): the first screen must stay light and must never pull in the 3D walks.
//   - initial JS (entry chunk + the Explore screen, gzip) <= 150 KB
//   - the map chunk is loaded separately and is allowed up to 350 KB gzip
//   - dist/index.html and entry chunks must not reference walks/
// Usage: node scripts/check-budget.mjs   (from the repo root)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = join(process.cwd(), 'app', 'dist')
const assets = join(dist, 'assets')
const kb = (n) => (n / 1024).toFixed(1)
const gz = (f) => gzipSync(readFileSync(f)).length
const files = readdirSync(assets).filter((f) => f.endsWith('.js'))
let failed = false
const fail = (m) => { console.error('FAIL ' + m); failed = true }

const entry = files.find((f) => f.startsWith('index-'))
const explore = files.find((f) => f.startsWith('Explore-'))
const map = files.find((f) => f.startsWith('UsMap-'))
const initial = [entry, explore].filter(Boolean).reduce((s, f) => s + gz(join(assets, f)), 0)
console.log(`initial JS (entry + Explore): ${kb(initial)} KB gzip  (budget 150)`)
if (initial > 150 * 1024) fail('initial JS over budget')
if (map) {
  const m = gz(join(assets, map))
  console.log(`map chunk (loads after first paint): ${kb(m)} KB gzip  (budget 350)`)
  if (m > 350 * 1024) fail('map chunk over budget')
}
for (const f of [join(dist, 'index.html'), ...[entry, explore].filter(Boolean).map((f) => join(assets, f))]) {
  if (/walks\//.test(readFileSync(f, 'utf8'))) {
    // the hike page may link to a walk, but the entry and Explore chunks must not
    fail(`${f} references walks/`)
  }
}
const dataDir = join(dist, 'data')
let data = 0
for (const f of readdirSync(dataDir)) { const p = join(dataDir, f); if (statSync(p).isFile() && f !== 'us-states.topo.json') data += statSync(p).size }
console.log(`data files loaded up front: ${kb(data)} KB raw  (budget 1024)`)
if (data > 1024 * 1024) fail('data over 1 MB')
process.exit(failed ? 1 : 0)
