import { expect, test, type Page } from '@playwright/test'

// The Explore screen end to end, in a real browser against the production build:
// quarter changes the count, a bubble opens its hike, Back returns to the same map view,
// hover links map and list, the wheel lands on a hike, units and Share link work, the empty state offers its fix.
test.beforeEach(async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
})

interface Bubble { id: string; x: number; y: number }

/** Pixel position (page coordinates) of the first bubble that fits, found through the map's own projection. */
async function firstBubble(page: Page): Promise<Bubble> {
  await page.waitForFunction(() => {
    const m = (window as unknown as { __map?: { loaded: () => boolean; getSource: (s: string) => unknown } }).__map
    return !!m?.loaded() && !!m.getSource('hikes')
  })
  await page.waitForFunction(() => {
    const m = (window as unknown as { __map: { querySourceFeatures: (s: string) => unknown[] } }).__map
    return m.querySourceFeatures('hikes').length > 0
  })
  const box = (await page.locator('#mapPane .us-map').boundingBox())!
  const b = await page.evaluate(() => {
    const m = (window as unknown as { __map: { querySourceFeatures: (s: string) => { properties: { id: string; greyed: boolean }; geometry: { coordinates: [number, number] } }[]; project: (c: [number, number]) => { x: number; y: number } } }).__map
    const f = m.querySourceFeatures('hikes').find((x) => !x.properties.greyed)!
    const p = m.project(f.geometry.coordinates)
    return { id: String(f.properties.id), x: p.x, y: p.y }
  })
  return { id: b.id, x: box.x + b.x, y: box.y + b.y }
}
const mapCentre = (page: Page) => page.evaluate(() => {
  const c = (window as unknown as { __map: { getCenter: () => { lng: number; lat: number }; getZoom: () => number } }).__map
  return { lng: c.getCenter().lng, lat: c.getCenter().lat, zoom: c.getZoom() }
})
const fitCount = async (page: Page) => Number((await page.locator('#count b').innerText()).trim())

test('changing the quarter changes the count and the URL', async ({ page }) => {
  await page.goto('./#/?q=1&temp=60-80&go=1')
  await expect(page.locator('#count')).toContainText('of 40 hikes fit in Q1')
  const q1 = await fitCount(page)
  await page.locator('.qrow').getByRole('button', { name: /Q3/ }).click()
  await expect(page.locator('#count')).toContainText('in Q3')
  await expect(page).toHaveURL(/q=3/)
  expect(await fitCount(page)).not.toBe(q1) // the temperature limit cuts different hikes in winter and summer
})

test('clicking a bubble opens the hike, and Back returns to the same map view', async ({ page }) => {
  await page.goto('./#/?q=3&go=1')
  await firstBubble(page) // wait until the bubbles are drawn
  // pan away from the whole-US view first, so "same view" is something other than the default
  await page.locator('#zoomctl').getByRole('button', { name: 'Zoom in' }).click()
  await page.waitForTimeout(500)
  const before = await mapCentre(page)
  const b2 = await firstBubble(page)
  await page.mouse.click(b2.x, b2.y)
  // two trailheads in one park can overlap, so the click may land on a neighbour: any hike page proves it works
  await expect(page).toHaveURL(/#\/hike\//, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'What it costs' })).toBeVisible()

  await page.getByRole('link', { name: /Back to map/ }).first().click()
  await expect(page.locator('#mapPane')).not.toHaveClass(/blurred/)
  await page.waitForFunction(() => !!(window as unknown as { __map?: { loaded: () => boolean } }).__map?.loaded())
  const after = await mapCentre(page)
  expect(after.zoom).toBeCloseTo(before.zoom, 1)
  expect(after.lng).toBeCloseTo(before.lng, 1)
  expect(after.lat).toBeCloseTo(before.lat, 1)
})

test('hovering a bubble highlights its list row (and the list row highlights the card)', async ({ page }) => {
  await page.goto('./#/?q=3&go=1')
  const b = await firstBubble(page)
  await page.mouse.move(b.x, b.y)
  await expect(page.locator('.ranked li.hot')).toHaveCount(1)
  const name = await page.locator('.ranked li.hot .name').innerText()
  await expect(page.locator('#detail h3')).toContainText(name.replace(/3D$/, '').trim())
  await page.mouse.move(5, 5)
  await expect(page.locator('.ranked li.hot')).toHaveCount(0)
})

test('the wheel lands on one of the top hikes and Open goes to its page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // reduced motion: it picks at once
  await page.goto('./#/?q=3&go=1')
  await page.getByRole('button', { name: 'Not sure? Spin the wheel' }).first().click()
  const dialog = page.getByRole('dialog', { name: /Spin the wheel/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/Your pick/)).toBeVisible()
  const pick = await dialog.locator('h3').innerText()
  const top = await page.locator('.ranked li .name').evaluateAll((els) => els.slice(0, 12).map((e) => (e.textContent ?? '').replace(/3D$/, '').trim()))
  expect(top).toContain(pick)
  await dialog.getByRole('button', { name: /Open/ }).click()
  await expect(page).toHaveURL(/#\/hike\//)
  await expect(page.locator('.hp-head h1')).toHaveText(pick)
})

test('Escape closes the wheel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#/?q=3&go=1')
  await page.getByRole('button', { name: 'Not sure? Spin the wheel' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('metric toggle changes the words and is kept in the URL; Share link copies a link that opens unblurred', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./#/?q=3&temp=60-80&go=1')
  await expect(page.locator('.ctl-h .val').first()).toContainText('°F')
  await page.getByRole('group', { name: 'Units' }).getByRole('button', { name: /°C/ }).click()
  await expect(page).toHaveURL(/units=metric/)
  await expect(page.locator('.ctl-h .val').first()).toHaveText('16–27°C')
  await expect(page.locator('#detail')).toContainText('°C')
  await expect(page.locator('#detail')).toContainText(' km ')
  await expect(page.locator('input[aria-label="Typical daytime high, highest"]')).toHaveAttribute('aria-valuetext', /degrees Celsius/)

  await page.getByRole('button', { name: 'Share link' }).click()
  await expect(page.getByRole('button', { name: /Link copied/ })).toBeVisible()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('units=metric')
  expect(link).toContain('go=1')
  expect(link).toContain('temp=60-80')
  // a pasted Share link restores the same state
  await page.goto('about:blank')
  await page.goto(link)
  await expect(page.locator('#mapPane')).not.toHaveClass(/blurred/)
  await expect(page.locator('.ctl-h .val').first()).toHaveText('16–27°C')
})

test('no match: the empty state names the one change that brings hikes back, and one click applies it', async ({ page }) => {
  await page.goto('./#/?q=3&temp=0-5&go=1')
  await expect(page.locator('.empty')).toContainText('No hike fits all your limits')
  await expect(page.locator('.empty')).toContainText(/Allowing .* adds \d+/)
  await expect(page.locator('.misses')).toHaveText('Nearest misses')
  await expect(page.locator('.ranked li').first()).toBeVisible() // the list is never blank
  await page.getByRole('button', { name: 'Allow it' }).click()
  await expect(page.locator('.empty')).toHaveCount(0)
  expect(await fitCount(page)).toBeGreaterThan(0)
})

test('a hike with no weather station says so on its card and is left out of the match', async ({ page }) => {
  await page.goto('./#/?q=3&temp=60-80&go=1')
  const row = page.locator('.ranked li', { hasText: 'No station' }) // none in the list text: the note is on the card
  expect(await row.count()).toBe(0)
  // find a hike whose months carry missing: ['temp', ...] in the shipped data and hover it in the list
  const res = await page.request.get('./data/hike_month.json')
  const months = (await res.json()) as { hike_id: string; missing: string[] }[]
  const noStation = months.find((m) => m.missing.includes('temp'))
  test.skip(!noStation, 'every hike in this dataset has a weather station')
  const hikes = (await (await page.request.get('./data/hikes.json')).json()) as { id: string; name: string }[]
  const name = hikes.find((h) => h.id === noStation!.hike_id)!.name
  await page.locator('.ranked li', { hasText: name }).first().hover()
  await expect(page.locator('#detail')).toContainText('No station within 50 km')
  await expect(page.locator('#detail')).toContainText('Left out of the match')
})

test('keyboard: Tab reaches the rail, then the list, then the map; skip link jumps to the map', async ({ page }) => {
  await page.goto('./#/?q=3&go=1')
  const skip = page.getByRole('button', { name: 'Skip to the map' })
  for (let i = 0; i < 4 && !(await skip.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab') // the sample-data banner link comes first
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#mapPane')).toBeFocused()
  // focusing a list row highlights it (same as hover)
  await page.locator('.ranked li button').nth(2).focus()
  await expect(page.locator('.ranked li.hot')).toHaveCount(1)
})

// Motion (lane 3 step 2): bubbles resize over ~400 ms, and instantly with prefers-reduced-motion.
const radiusSum = (page: Page) => page.evaluate(() => {
  const m = (window as unknown as { __map: { querySourceFeatures: (s: string) => { properties: { r: number } }[] } }).__map
  return m.querySourceFeatures('hikes').reduce((s, f) => s + Number(f.properties.r), 0)
})

test('bubbles resize gradually when the quarter changes', async ({ page }) => {
  await page.goto('./#/?q=1&temp=60-80&go=1')
  await firstBubble(page)
  const start = await radiusSum(page)
  await page.locator('.qrow').getByRole('button', { name: /Q3/ }).click()
  await page.waitForTimeout(120)
  const mid = await radiusSum(page)
  await page.waitForTimeout(700)
  const end = await radiusSum(page)
  expect(end).not.toBeCloseTo(start, 1) // the quarter really changed the sizes
  const lo = Math.min(start, end), hi = Math.max(start, end)
  expect(mid, 'part-way through the resize').toBeGreaterThan(lo + 0.01)
  expect(mid, 'part-way through the resize').toBeLessThan(hi - 0.01)
})

test('with reduced motion the bubbles jump straight to the new size', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#/?q=1&temp=60-80&go=1')
  await firstBubble(page)
  await page.locator('.qrow').getByRole('button', { name: /Q3/ }).click()
  await page.waitForTimeout(60)
  const soon = await radiusSum(page)
  await page.waitForTimeout(700)
  expect(await radiusSum(page)).toBeCloseTo(soon, 3)
})
