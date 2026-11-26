import { expect, test } from '@playwright/test'

const URL = './#/hike/angels-landing?from=SEA&q=3&go=1'

test('keyboard: Tab to a cost segment, Enter opens its line items, Esc closes', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('svg.costbars')).toBeVisible()
  const seg = page.locator('svg.costbars .seg[data-seg$="-lodging"]').first()
  await seg.focus()
  await expect(seg).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.costdetail li').first()).toBeVisible()
  await expect(page.locator('.costdetail h3')).toContainText('Lodging')
  await page.keyboard.press('Escape')
  await expect(page.locator('.costdetail h3')).toContainText('Pick a part')
})

test('keyboard: a quarter label is a focusable button that changes the quarter', async ({ page }) => {
  await page.goto(URL)
  const q1 = page.locator('svg.costbars .qlabel').first()
  await q1.focus()
  await page.keyboard.press('Enter')
  await expect(q1).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.when-q .wq').first()).toHaveAttribute('aria-pressed', 'true')
})

test('the cost bar fills follow the theme', async ({ page }) => {
  await page.goto(URL)
  const fill = () => page.locator('svg.costbars .fill.p-lodging').first().evaluate((el) => getComputedStyle(el).fill)
  const toggle = page.getByRole('button', { name: /theme|mode|light|dark/i }).first()
  const before = await fill()
  await toggle.click()
  await expect.poll(fill).not.toBe(before)
  expect(await page.locator('html').getAttribute('data-theme')).toMatch(/light|dark/)
})

test('no placeholder or internal wording is shown, and Back to map works', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('main')).not.toContainText(/lane \d|pipeline/i)
  await page.getByRole('link', { name: /Back to map/ }).click()
  await expect(page.locator('#mapPane')).toBeVisible()
})

test('the answer sentence sits under the name: never "100%", and says when no limits are set', async ({ page }) => {
  await page.goto('./#/hike/angels-landing?from=SEA&q=3&go=1&temp=55-85')
  const h = page.locator('.hp-intro .headline')
  await expect(h).toBeVisible()
  await expect(h).not.toContainText('100%')
  await expect(h).toContainText(/fits? (your limits|\d+%)|equally well/)
  await page.goto('./#/hike/angels-landing?from=SEA&q=3&go=1')
  await expect(page.locator('.hp-intro .headline')).toContainText('No limits set')
})

test('missing data: a hike with no weather station shows a grey panel in words and the page still works', async ({ page }) => {
  // no hike in the shipped data lacks a station, so the data file is stubbed (Plan 5b decision 4)
  await page.route('**/data/hike_month.json', async (route) => {
    const rows = (await (await route.fetch()).json()) as Record<string, unknown>[]
    const patched = rows.map((r) => (r.hike_id === 'angels-landing' ? { ...r, tmax_p25: null, tmax_p50: null, tmax_p75: null, tmax_summit_est: null, heat_days: null, missing: ['temp'] } : r))
    await route.fulfill({ json: patched })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./#/hike/angels-landing?from=SEA&q=3&temp=55-85&go=1')
  await expect(page.locator('.when-q .wq')).toHaveCount(4)
  await expect(page.locator('.wc-svg')).toContainText('No station within 50 km')
  await expect(page.locator('.hp-intro .headline')).toBeVisible()
  expect(errors).toEqual([])
})

test('sources are one focus away: Tab to a hero tile shows its source, Esc leaves it', async ({ page }) => {
  await page.goto(URL)
  const tile = page.locator('.hero-stats .srcfocus').first()
  await tile.focus()
  await expect(tile).toBeFocused()
  await expect(tile).toHaveAttribute('title', /quarter with the highest match/)
  await page.keyboard.press('Escape')
  await expect(tile).not.toBeFocused()
})
