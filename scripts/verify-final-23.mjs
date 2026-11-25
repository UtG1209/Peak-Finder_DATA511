// Final-goal check for the 23-hike scope (docs/work/final-23/). Usage: node scripts/verify-final-23.mjs [--plan 1|2|3|4]
// Plan 1 = hikes, months, advice, photos. Plan 2 = travel, cost, profiles. Plan 3 = walks. Plan 4 = release (all of the above plus fake=false).
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = join(root, 'app/public/data')
const json = (p) => JSON.parse(readFileSync(p, 'utf8'))
const planArg = process.argv.indexOf('--plan')
const plan = planArg > 0 ? Number(process.argv[planArg + 1]) : 4
const want = (n) => plan === 4 || plan === n

const rows = readFileSync(join(root, 'docs/work/final-23/final_hikes.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','))
const ids = new Set(rows.map((r) => r[0]))
const diffCount = { easy: 6, moderate: 7, hard: 10 }
const results = []
const check = (group, name, ok, detail = '') => { if (want(group)) results.push({ group, name, ok, detail }) }

const hikes = json(join(data, 'hikes.json'))
const months = json(join(data, 'hike_month.json'))
const travel = json(join(data, 'travel.json'))
const cost = json(join(data, 'cost.json'))
const advice = json(join(data, 'advice.json'))
const meta = json(join(data, 'meta.json'))
const hid = new Set(hikes.map((h) => h.id))
const diff = (set) => [...set].filter((i) => !hid.has(i))

// Plan 1
check(1, 'hikes.json has exactly the 23 in final_hikes.csv', hikes.length === 23 && diff(ids).length === 0 && [...hid].every((i) => ids.has(i)), `have ${hikes.length}; missing ${diff(ids)}; extra ${[...hid].filter((i) => !ids.has(i))}`)
for (const [d, n] of Object.entries(diffCount)) check(1, `${n} ${d} hikes`, hikes.filter((h) => h.difficulty === d).length === n, `have ${hikes.filter((h) => h.difficulty === d).length}`)
check(1, '12 month rows per hike', hikes.every((h) => months.filter((m) => m.hike_id === h.id).length === 12))
check(1, 'every photo file exists, no placeholder credit', hikes.every((h) => existsSync(join(root, 'app/public', h.photo.file)) && !/placeholder/i.test(h.photo.author) && !h.photo.file.endsWith('.svg')), hikes.filter((h) => !existsSync(join(root, 'app/public', h.photo.file)) || /placeholder/i.test(h.photo.author)).map((h) => h.id).join(' '))
check(1, 'no stale .svg or photo of a cut hike', readdirSync(join(root, 'app/public/photos')).every((f) => !f.endsWith('.svg') && ids.has(f.replace(/\.[^.]+$/, ''))), '')
check(1, 'advice cards only for the 23', advice.every((a) => hid.has(a.hike_id)))
check(1, 'meta.hike_count is 23', meta.hike_count === 23, `have ${meta.hike_count}`)
const cov = readFileSync(join(root, 'pipeline/catalogue/hikes_coverage.csv'), 'utf8').trim().split('\n')
const placeholders = cov.slice(1).map((l) => l.split(',')).filter((r) => ids.has(r[0]) && r.includes('placeholder')).map((r) => r[0])
check(1, 'no placeholder field left in hikes_coverage.csv for the 23', placeholders.length === 0, placeholders.join(' '))

// Plan 2
check(2, '10 travel rows per hike', hikes.every((h) => travel.filter((t) => t.hike_id === h.id).length === 10))
check(2, '40 cost rows per hike', hikes.every((h) => cost.filter((c) => c.hike_id === h.id).length === 40))
check(2, 'no cut hike in travel or cost', [...travel, ...cost].every((r) => hid.has(r.hike_id)))
check(2, 'cost_sources have no "(fake)" text', !JSON.stringify(meta.cost_sources ?? {}).toLowerCase().includes('fake'))
const profDir = join(data, 'profiles')
const profs = existsSync(profDir) ? readdirSync(profDir) : []
check(2, 'one profile per hike, none for a cut hike', profs.length === 23 && hikes.every((h) => profs.includes(`${h.id}.json`)), `have ${profs.length}`)
const profData = hikes.filter((h) => profs.includes(`${h.id}.json`)).map((h) => json(join(profDir, `${h.id}.json`)))
check(2, 'no generated .svg stop photo', profData.every((p) => p.checkpoints.every((c) => !(c.photo ?? '').endsWith('.svg'))))
check(2, 'profile scale matches NPS/OSM length', profData.every((p) => Math.abs(p.scale - p.nps_length_m / p.osm_length_m) < 0.01))

// Plan 3
const manifest = json(join(root, 'walks/manifest.json')).walks
const walkHikes = new Set(Object.values(manifest).map((w) => w.hike_id))
check(3, 'every manifest walk belongs to a final hike', [...walkHikes].every((i) => ids.has(i)))
check(3, 'featured and walk_path match the manifest', hikes.every((h) => h.featured === walkHikes.has(h.id) && (h.featured ? existsSync(join(root, h.walk_path, 'index.html')) : !h.walk_path)))
check(3, 'the 7 built walks are still there', ['angels-landing', 'bright-angel-trail', 'cascade-pass-sahale', 'mount-washburn', 'fairy-falls-grand-prismatic', 'grinnell-glacier', 'glacier-highline'].every((i) => walkHikes.has(i)))
check(3, 'Tier A walks built (Half Dome, Delicate Arch, Navajo, Mesa Arch, Skyline)', ['half-dome', 'delicate-arch', 'navajo-loop-queens-garden', 'mesa-arch', 'skyline-trail'].every((i) => walkHikes.has(i)), [...['half-dome', 'delicate-arch', 'navajo-loop-queens-garden', 'mesa-arch', 'skyline-trail']].filter((i) => !walkHikes.has(i)).join(' '))

// Plan 4 (release)
if (plan === 4) check(4, 'meta.fake is false', meta.fake === false)

const bad = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  plan ${r.group}  ${r.name}${!r.ok && r.detail ? `  [${r.detail}]` : ''}`)
console.log(`\n${results.length - bad.length}/${results.length} checks pass${plan === 4 ? ' (the whole final goal)' : ` for plan ${plan}`}`)
process.exit(bad.length ? 1 : 0)
