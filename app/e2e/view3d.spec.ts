import { expect, test } from '@playwright/test'

// The opt-in 3D view (three.js): lazy chunk, same URL state, 2D stays the fallback.
const START = './#/?from=SEA&q=3&go=1&pick=angels-landing'
const toggle3d = (page: import('@playwright/test').Page) => page.locator('.viewtoggle').getByRole('button', { name: '3D view' })
const toggle2d = (page: import('@playwright/test').Page) => page.locator('.viewtoggle').getByRole('button', { name: '2D map' })

test.beforeEach(async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
})

test('no 3D chunk is requested before the user switches to 3D', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()) })
  await page.goto(START)
  await expect(page.locator('#mapPane canvas.maplibregl-canvas')).toBeVisible()
  await expect(page.locator('.ranked li')).toHaveCount(38)
  await page.waitForLoadState('networkidle')
  expect(scripts.filter((u) => /view3d|three/i.test(u)), 'script requests for the 3D chunk').toEqual([])
  expect(scripts.some((u) => /UsMap/.test(u))).toBe(true)
})

test('switching to 3D shows a canvas with size and no page errors; 2D -> 3D -> 2D keeps the URL state', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(START)
  await expect(page.locator('#mapPane canvas.maplibregl-canvas')).toBeVisible()

  await toggle3d(page).click()
  const canvas = page.locator('#mapPane canvas.v3d-canvas')
  await expect(canvas).toBeVisible()
  await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(300)
  await expect(canvas).toHaveAttribute('data-ready', '1') // the states outline is loaded and drawn
  await expect(page.locator('#mapPane canvas.maplibregl-canvas')).toHaveCount(0)
  await expect(page.locator('.v3d-dash')).toBeVisible()
  await expect(page.locator('.v3d-dash svg').first()).toBeVisible()
  await expect(page).toHaveURL(/view=3d/)
  for (const k of ['from=SEA', 'q=3', 'go=1', 'pick=angels-landing']) await expect(page).toHaveURL(new RegExp(k))

  await toggle2d(page).click()
  await expect(page.locator('#mapPane canvas.maplibregl-canvas')).toBeVisible()
  await expect(page.locator('#mapPane canvas.v3d-canvas')).toHaveCount(0)
  await expect(page).not.toHaveURL(/view=3d/)
  for (const k of ['from=SEA', 'q=3', 'go=1', 'pick=angels-landing']) await expect(page).toHaveURL(new RegExp(k))
  expect(errors, 'uncaught page errors').toEqual([])
})

test('clicking a peak in 3D selects it (same pick flow as the map)', async ({ page }) => {
  await page.goto('./#/?from=SEA&q=3&go=1&view=3d')
  const canvas = page.locator('#mapPane canvas.v3d-canvas')
  await expect(canvas).toHaveAttribute('data-ready', '1')
  // find a peak by scanning the canvas through the same picking the app uses
  const box = (await canvas.boundingBox())!
  let hit: { x: number; y: number } | null = null
  for (let y = box.y + 40; y < box.y + box.height - 40 && !hit; y += 12) {
    for (let x = box.x + 40; x < box.x + box.width - 40; x += 12) {
      await page.mouse.move(x, y)
      await page.waitForTimeout(25) // hover is picked on the next animation frame
      if (await page.locator('.ranked li.hot').count()) { hit = { x, y }; break }
    }
  }
  expect(hit, 'a peak is hoverable').not.toBeNull()
  await page.mouse.click(hit!.x, hit!.y)
  await expect(page).toHaveURL(/pick=/)
})

test('without WebGL the toggle is disabled with words and the 2D map still renders', async ({ page }) => {
  // getContext returns null for webgl/webgl2 on the app's detached probe canvas. MapLibre's canvas is attached to the page, so it still gets a
  // context: the point is the toggle's fallback, and a page with zero WebGL cannot draw the 2D MapLibre map either (that is existing behaviour).
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      if (!this.isConnected && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) return null
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest) as never
    } as typeof orig
  })
  const scripts: string[] = []
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()) })
  await page.goto(START)
  await expect(toggle3d(page)).toBeDisabled()
  await expect(page.locator('.viewtoggle')).toContainText('3D view needs WebGL')
  await expect(page.locator('#mapPane .us-map')).toBeVisible()
  await expect(page.locator('.ranked li')).toHaveCount(38)
  expect(scripts.filter((u) => /view3d|three/i.test(u))).toEqual([])
})
