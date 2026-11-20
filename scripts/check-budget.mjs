#!/usr/bin/env node
// Performance guard (run after `npm run build`): the first screen must stay light and must never pull in the 3D walks.
//   - initial JS (entry chunk + the Explore screen, gzip) <= 150 KB
//   - the map chunk is loaded separately and is allowed up to 350 KB gzip
//   - the opt-in 3D view (three.js chunk closure, excluding what the first screen and the map already load) <= 250 KB gzip,
//     and no initial chunk may contain WebGLRenderer
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
// ---- 3D view (three.js) ----
const manifestPath = join(dist, '.vite', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const keyOf = (re) => Object.keys(manifest).find((k) => re.test(k))
const staticClosure = (roots) => {
  const seen = new Set()
  const walk = (k) => { if (!k || seen.has(k) || !manifest[k]) return; seen.add(k); (manifest[k].imports ?? []).forEach(walk) }
  roots.forEach(walk)
  return seen
}
const view3dKey = keyOf(/view3d\/View3D\.tsx$/)
const initialKeys = staticClosure(['index.html', keyOf(/screens\/Explore\/Explore\.tsx$/)])
const mapKeys = staticClosure([keyOf(/components\/UsMap\.tsx$/)])
if (!view3dKey) fail('3D chunk not found in the build manifest (view3d/View3D.tsx)')
else {
  const files3d = [...staticClosure([view3dKey])].filter((k) => !initialKeys.has(k) && !mapKeys.has(k)).map((k) => manifest[k].file)
  const total3d = files3d.reduce((sum, f) => sum + gz(join(dist, f)), 0)
  console.log(`3D view chunks (load only after switching to 3D): ${kb(total3d)} KB gzip across ${files3d.length} file(s) [${files3d.map((f) => f.replace('assets/', '')).join(', ')}]  (budget 250)`)
  if (total3d > 250 * 1024) fail('3D view chunks over budget')
  const has = (f) => /WebGLRenderer/.test(readFileSync(join(dist, f), 'utf8'))
  if (!files3d.some(has)) console.log('note: WebGLRenderer not found by name in the 3D chunk (minified), so the initial-chunk check below is weaker')
  const initialFiles = [...initialKeys].map((k) => manifest[k].file).filter((f) => f.endsWith('.js'))
  const leaked = initialFiles.filter(has)
  console.log(`initial chunks checked for WebGLRenderer: ${initialFiles.length} file(s), ${leaked.length} contain it`)
  if (leaked.length) fail(`initial chunk(s) contain WebGLRenderer: ${leaked.join(', ')}`)
  const initialThree = initialFiles.filter((f) => files3d.includes(f))
  if (initialThree.length) fail('a 3D chunk is also in the initial set')
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
