import { expect, test } from '@playwright/test'

// The first-minute path a visitor takes: guide, Show hikes, a visible map, open a hike, see its cost graph.
test.beforeEach(async ({ page }) => {
  // fonts come from Google: not needed for the test, and CI may have no internet for them
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
})

test('Show hikes reveals a map that has size, a canvas and bubbles', async ({ page }) => {
  const errors: string[] = []
  const failed: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/Peak-Finder_DATA511/') && !r.url().endsWith('favicon.ico')) failed.push(`${r.status()} ${r.url()}`) })

  await page.goto('./')
  const guide = page.locator('.guide')
  await expect(guide).toBeVisible()
  await expect(page.locator('#mapPane')).toHaveClass(/blurred/) // blurred until the user presses Show hikes

  await guide.getByRole('button', { name: /Show hikes/ }).click()
  await expect(page.locator('#mapPane')).not.toHaveClass(/blurred/)
  await expect(page.locator('#count')).toContainText('of 40 hikes fit')

  // the regression this test exists for: MapLibre's stylesheet must not collapse the container
  const map = page.locator('#mapPane .us-map')
  await expect(map).toBeVisible()
  await expect.poll(async () => (await map.boundingBox())?.height ?? 0, { message: 'map container height' }).toBeGreaterThan(300)
  await expect.poll(async () => (await map.evaluate((el) => getComputedStyle(el).position)), { message: 'map container position' }).toBe('absolute')
  const canvas = map.locator('canvas.maplibregl-canvas')
  await expect(canvas).toBeVisible()
  expect((await canvas.boundingBox())!.height).toBeGreaterThan(300)

  // bubbles drawn: the legend and ranked list exist, and the map reports rendered features
  await expect(page.locator('.ranked li')).toHaveCount(40)
  expect(errors, 'uncaught page errors').toEqual([])
  expect(failed, 'failed requests under the site base path').toEqual([])
})

test('a hike opens with its cost graph and Back returns to a visible map', async ({ page }) => {
  await page.goto('./#/?from=SEA&q=3&go=1')
  await expect(page.locator('.ranked li').first()).toBeVisible()
  await page.locator('.ranked li button').first().click()
  // clicking only selects: the photo tile stays open and the page does NOT change until its button is pressed
  await expect(page).toHaveURL(/pick=/)
  await expect(page).not.toHaveURL(/#\/hike\//)
  await expect(page.locator('#detail.selected')).toBeVisible()
  await page.locator('#detail').getByRole('button', { name: /Open this hike/ }).click()
  await expect(page).toHaveURL(/#\/hike\//)
  await expect(page.getByRole('heading', { name: 'What it costs' })).toBeVisible()
  await expect(page.locator('svg.costbars')).toBeVisible()
  await expect(page.locator('.qcards .qcard')).toHaveCount(4)

  await page.getByRole('link', { name: /Back to map/ }).click()
  await expect(page.locator('#mapPane')).not.toHaveClass(/blurred/) // go=1 survives the round trip
  await expect(page.locator('#detail.selected')).toBeVisible() // and so does the open tile
  await expect.poll(async () => (await page.locator('#mapPane .us-map').boundingBox())?.height ?? 0).toBeGreaterThan(300)
})
