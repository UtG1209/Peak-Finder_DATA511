import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// The e2e build does not ship walks/ (SKIP_WALKS), so serve the real walk page from disk: its own inline Back-button script is what is under test.
const WALK_HTML = fileURLToPath(new URL('../../walks/angels_landing/index.html', import.meta.url))

// The walk's own Back button (not the browser's), against the real walk page: it must land on the same hike page, the clouds must play in reverse, and the scroll must be restored.
const HIKE = './#/hike/angels-landing?from=SEA&q=3&temp=60-85&smoke=3&go=1'

test.beforeEach(async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
})

test("the walk's own Back button returns to the hike page, clouds in reverse, same scroll", async ({ page }) => {
  await page.route('**/walks/angels_landing/index.html*', (r) => r.fulfill({ path: WALK_HTML, contentType: 'text/html' }))
  await page.goto(HIKE)
  await expect(page.locator('.elevchart')).toBeVisible()
  await page.evaluate(() => { document.querySelector('.hikepage')!.scrollTop = 900 }) // the page scrolls inside .hikepage
  await page.getByRole('link', { name: /Walk it in 3D/ }).evaluate((a: HTMLElement) => a.click())
  await page.waitForURL(/walks\/angels_landing\/index\.html\?season=summer/)
  const back = page.locator('#backToHike')
  await expect(back).toBeVisible()
  await back.click()
  await page.waitForURL(/#\/hike\/angels-landing/, { timeout: 15000 })
  await expect(page.locator('.hp-head h1')).toHaveText('Angels Landing')
  expect(page.url()).toContain('q=3') // same quarter and limits
  await expect(page.locator('.cloud-transition')).toHaveCount(0, { timeout: 8000 })
  await expect.poll(() => page.evaluate(() => document.querySelector('.hikepage')!.scrollTop)).toBeGreaterThan(500)
})
