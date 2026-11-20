import { expect, test, type Page } from '@playwright/test'

// The canvas map follows the theme, has accessible controls, and a missing WebGL never blanks the page.
const URL_GO = './#/?from=SEA&q=3&go=1'

test.beforeEach(async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
})

/** Resolve a CSS colour (e.g. the value of --map-land) to [r,g,b] through a probe element. */
async function cssColor(page: Page, token: string): Promise<number[]> {
  return page.evaluate((t) => {
    const el = document.createElement('i')
    el.style.backgroundColor = `var(${t})`
    document.body.appendChild(el)
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number)
    el.remove()
    return m.slice(0, 3)
  }, token)
}

/** Most common pixel colour in a small square of the page (a screenshot decoded in the page): the land fill near the middle of the US. */
async function dominantColor(page: Page, x: number, y: number, size = 24): Promise<number[]> {
  const png = await page.screenshot({ clip: { x, y, width: size, height: size } })
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const cv = document.createElement('canvas')
    cv.width = bmp.width
    cv.height = bmp.height
    const g = cv.getContext('2d')!
    g.drawImage(bmp, 0, 0)
    const d = g.getImageData(0, 0, cv.width, cv.height).data
    const counts = new Map<string, number>()
    for (let i = 0; i < d.length; i += 4) {
      const k = `${d[i]},${d[i + 1]},${d[i + 2]}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number)
  }, png.toString('base64'))
}

const near = (a: number[], b: number[], tol = 4) => a.every((v, i) => Math.abs(v - b[i]) <= tol)

test('toggling the theme recolours the pane and the land on the 2D map, without re-creating it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(URL_GO)
  const canvas = page.locator('#mapPane canvas.maplibregl-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.ranked li')).toHaveCount(40)
  await page.waitForTimeout(1500)
  await canvas.evaluate((c) => ((c as HTMLElement).dataset.mark = 'same')) // survives only if the canvas is not re-created

  const box = (await canvas.boundingBox())!
  const sx = box.x + 40 + (box.width - 400) / 2 - 12
  const sy = box.y + box.height / 2 - 12

  const seaDark = await page.locator('#mapPane').evaluate((el) => getComputedStyle(el).backgroundColor)
  const landDark = await dominantColor(page, sx, sy)
  expect(near(landDark, await cssColor(page, '--map-land')), `dark land ${landDark}`).toBe(true)

  await page.getByRole('button', { name: 'Dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.waitForTimeout(600)

  const seaLight = await page.locator('#mapPane').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(seaLight).not.toBe(seaDark)
  const landLight = await dominantColor(page, sx, sy)
  expect(near(landLight, await cssColor(page, '--map-land')), `light land ${landLight}`).toBe(true)
  expect(near(landLight, landDark, 20), 'land colour changed with the theme').toBe(false)
  await expect(canvas).toHaveAttribute('data-mark', 'same')
})

test('map controls are 44 px targets with names and drive the map', async ({ page }) => {
  await page.goto(URL_GO)
  const ctl = page.locator('#zoomctl')
  await expect(ctl).toBeVisible()
  for (const name of ['Zoom in', 'Zoom out', 'Zoom to results', 'Whole US']) {
    const b = ctl.getByRole('button', { name })
    await expect(b).toBeVisible()
    const box = (await b.boundingBox())!
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(43.5)
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(43.5)
  }
  await ctl.getByRole('button', { name: 'Zoom in' }).click()
  await ctl.getByRole('button', { name: 'Whole US' }).click()
  await page.getByRole('button', { name: '3D view' }).click()
  await expect(ctl).toBeHidden() // the 3D view has its own Reset view
})

test('3D scene recolours on theme toggle (canvas pixels change) without a new canvas', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`${URL_GO}&view=3d`)
  const canvas = page.locator('#mapPane canvas.v3d-canvas')
  await expect(canvas).toHaveAttribute('data-ready', '1')
  await page.waitForTimeout(800)
  await canvas.evaluate((c) => ((c as HTMLElement).dataset.mark = 'same'))
  const box = (await canvas.boundingBox())!
  const x = box.x + box.width / 2 - 12
  const y = box.y + box.height / 2 - 12
  const dark = await dominantColor(page, x, y)
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.waitForTimeout(800)
  const light = await dominantColor(page, x, y)
  expect(near(light, dark, 20), `3D ground ${dark} -> ${light}`).toBe(false)
  await expect(canvas).toHaveAttribute('data-mark', 'same')
})

test('with WebGL blocked the map pane explains it and the ranked list still works', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof orig
  })
  await page.goto(URL_GO)
  await expect(page.locator('.map-fail-msg')).toContainText('The map needs WebGL')
  await expect(page.locator('.map-fail-msg')).toContainText('The ranked list on the left has every hike')
  await expect(page.locator('.ranked li')).toHaveCount(40)
  await page.locator('.ranked li').first().hover() // the page is alive
  await expect(page.locator('#count')).toBeVisible()
})
