import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Plan 5 final goal: every one of the 23 hike pages renders at each quarter, desktop and phone, dark and light, with no console error,
// no sideways scroll, and every block present (also with no home city, where the cost block shows its empty message).
const ids: string[] = JSON.parse(readFileSync(new URL('../public/data/hikes.json', import.meta.url), 'utf8')).map((h: { id: string }) => h.id)

for (const [tag, width, height, scheme] of [['desktop dark', 1280, 900, 'dark'], ['phone light', 390, 844, 'light']] as const) {
  test(`all ${ids.length} hikes, every quarter: ${tag}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height })
    const problems: string[] = []
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR_FAILED/.test(m.text())) problems.push(`console: ${m.text()}`) })
    for (const id of ids) {
      for (const q of [1, 2, 3, 4]) {
        await page.goto(`./#/hike/${id}?from=SEA&q=${q}&temp=55-85&go=1`)
        await expect(page.locator('.hp-head h1'), `${id} q${q}`).toBeVisible()
        await expect(page.locator('.hp-intro .headline'), `${id} q${q} headline`).not.toBeEmpty()
        await expect(page.locator('.when-q .wq'), `${id} q${q} cards`).toHaveCount(4)
        await expect(page.locator('.wq.on'), `${id} q${q} selected`).toContainText(`Q${q}`)
        await expect(page.locator('.elevchart'), `${id} q${q} profile`).toBeVisible()
        await expect(page.locator('svg.costbars'), `${id} q${q} cost`).toBeVisible()
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(over, `${id} q${q} sideways scroll`).toBeLessThanOrEqual(1)
        const bar = await page.locator('.selbar').evaluate((el) => el.getBoundingClientRect().height)
        expect(bar, `${id} selection bar height`).toBeGreaterThan(40)
      }
    }
    expect(problems, 'console and page errors').toEqual([])
  })
}

test('no home city and no limits: the page still answers, and the cost block asks for a city', async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(e.message))
  for (const id of ids) {
    await page.goto(`./#/hike/${id}?q=2&go=1`)
    await expect(page.locator('.hp-intro .headline'), id).toContainText(/No limits set|fit/)
    await expect(page.locator('#cost-h'), id).toBeVisible()
    await expect(page.getByText(/Pick a home city/).first(), id).toBeVisible()
  }
  expect(problems).toEqual([])
})
