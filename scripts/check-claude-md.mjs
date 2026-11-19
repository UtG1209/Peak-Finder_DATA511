#!/usr/bin/env node
// Keeps CLAUDE.md honest. Every teammate's agent reads that file first, so it must match the code.
// Fails (exit 1) when:
//   1. a required section is missing,
//   2. a field named in the section 4 data shapes is not in app/src/data/schema.ts (or the other way round),
//   3. a repo path mentioned in backticks does not exist (pipeline/ is exempt: it is being written),
//   4. an `npm run <script>` mentioned does not exist in the root package.json,
//   5. the "State of the repo" block says fake data but meta.json says the data is real (or the reverse).
// Run:  node scripts/check-claude-md.mjs   (also part of `npm run check` and CI)
import { existsSync, readFileSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')
const md = read('CLAUDE.md')
const schema = read('app/src/data/schema.ts')
const pkg = JSON.parse(read('package.json'))
const errors = []
const err = (m) => errors.push(m)

// 1. required sections
const sections = ['## 0. Start here', '## 1. What we are building', '## 2. Screens', '## 3. Rules every screen follows', '## 4. Data files', '## 5. Models', '## 6. Data sources', '## 7. Tech stack', '## 8. Trail kit notes', '## 9. How to work in this repo']
for (const h of sections) if (!md.includes(h)) err(`CLAUDE.md is missing the section "${h}"`)

// 2. data shapes: section 4 fenced block vs schema.ts
const sec4 = md.split(/^## 4\./m)[1]?.split(/^## 5\./m)[0] ?? ''
const block = (sec4.match(/```[a-z]*\n([\s\S]*?)```/) ?? [])[1] ?? ''
const docKeys = new Set([...block.matchAll(/"([a-z][a-z0-9_]*)"\s*:/g)].map((m) => m[1]))
// keys that are map keys or examples, not schema properties
const docOnly = new Set(['fare', 'lodging', 'gas', 'fees', 'assumed', 'hikes'])
for (const k of docKeys) if (!docOnly.has(k) && !new RegExp(`\\b${k}\\s*:`).test(schema)) err(`section 4 names "${k}" but app/src/data/schema.ts has no such field`)
const schemaKeys = new Set([...schema.matchAll(/^\s{2,}([a-z][a-z0-9_]*):\s/gm)].map((m) => m[1]))
const schemaOnly = new Set(['passthrough'])
for (const k of schemaKeys) if (!schemaOnly.has(k) && !docKeys.has(k)) err(`schema.ts has field "${k}" but the section 4 shapes in CLAUDE.md do not show it`)

// 3. referenced repo paths
const roots = /^(app|docs|scripts|\.github|\.githooks|walks)\//
const paths = new Set([...md.matchAll(/`([A-Za-z0-9_.\-/]+)`/g)].map((m) => m[1]).filter((p) => roots.test(p) || /^\.env\.example$|^package\.json$|^Makefile$/.test(p)))
for (const p of paths) if (!existsSync(p.replace(/\/$/, ''))) err(`CLAUDE.md mentions \`${p}\` but it does not exist`)

// 4. npm scripts
for (const m of md.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) if (!pkg.scripts?.[m[1]]) err(`CLAUDE.md mentions \`npm run ${m[1]}\` but package.json has no such script`)

// 5. fake vs real
try {
  const meta = JSON.parse(read('app/public/data/meta.json'))
  const saysFake = /runs end to end on \*\*fake data\*\*/.test(md)
  if (meta.fake === true && !saysFake) err('meta.json is fake but the "State of the repo" block does not say so: update it')
  if (meta.fake !== true && saysFake) err('meta.json is real data but "State of the repo" still says fake data: update CLAUDE.md')
} catch { err('could not read app/public/data/meta.json') }

if (errors.length) {
  console.error(`CLAUDE.md is out of date (${errors.length} problem${errors.length > 1 ? 's' : ''}):`)
  for (const e of errors) console.error('  - ' + e)
  console.error('\nFix CLAUDE.md (or the code) in the same PR, then run: node scripts/check-claude-md.mjs')
  process.exit(1)
}
console.log(`CLAUDE.md is consistent with the code (${docKeys.size} shape fields, ${paths.size} paths, sections ok).`)
