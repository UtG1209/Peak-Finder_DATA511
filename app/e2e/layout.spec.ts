import { expect, test } from '@playwright/test'

// Phone and tablet layout checks: nothing scrolls sideways, the hike page has a 16 px gutter, controls are 44 px, chart text is at least 12 px.
const SIZES = [{ w: 390, h: 844 }, { w: 768, h: 1024 }]
const URLS: Record<string, string> = {
  'explore, before start': './#/?from=SEA&q=3',
  'explore, tile open': './#/?from=SEA&q=3&go=1&pick=angels-landing',
  'explore, empty': './#/?from=SEA&q=3&temp=0-5&crowd=0&smoke=0&rain=0&go=1',
  'hike page': './#/hike/angels-landing?from=SEA&q=3&go=1',
  about: './#/about',
}

for (const { w, h } of SIZES) {
  for (const [name, url] of Object.entries(URLS)) {
    test(`no horizontal scroll: ${name}, ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(url)
      await page.waitForTimeout(800)
      const over = await page.evaluate(() => {
        const wide = (el: Element) => el.scrollWidth > el.clientWidth + 1
        const scrollers = [document.documentElement, document.body, ...document.querySelectorAll('.hikepage, .page, .explore, .rail-list, .sheet-body, .rail-filters')]
        return scrollers.filter(wide).map((el) => el.className || el.tagName)
      })
      expect(over).toEqual([])
    })
  }
}

test('hike page on a phone: 16 px gutter, one column, 44 px controls, chart text 12 px or more', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(URLS['hike page'])
  await expect(page.locator('.costbars')).toBeVisible()
  const gutter = await page.locator('.hikepage').evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))
  expect(gutter).toBe(16)
  const cols = await page.locator('.hp-head').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(cols).toBe(1)
  const small = await page.evaluate(() => {
    const sel = '.hikepage button, .hikepage select, .hikepage a.back, .hikepage a.go, .hikepage .wq'
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 43.5)
      .map(({ el, r }) => `${el.className || el.tagName} ${Math.round(r.height)}px`)
  })
  expect(small).toEqual([])
  const tiny = await page.evaluate(() => {
    const svg = document.querySelector('.costbars') as SVGSVGElement
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
    return [...svg.querySelectorAll('text')].map((t) => ({ t: t.textContent, px: parseFloat(getComputedStyle(t).fontSize) * scale })).filter((x) => x.px < 11.9)
  })
  expect(tiny).toEqual([])
})

test('phone: the legend is a compact row with words, and the tile shows photo, name, match, reasons and Open without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(URLS['explore, tile open'])
  await expect(page.locator('#detail.selected')).toBeVisible()
  const legend = page.locator('#legend')
  await expect(legend).toBeVisible()
  for (const word of ['Easy', 'Moderate', 'Hard', 'Filtered out', '3D walk ready']) await expect(legend).toContainText(word)
  const tile = page.locator('#detail')
  await expect(tile.locator('img')).toBeVisible()
  await expect(tile.getByRole('heading', { name: 'Angels Landing' })).toBeVisible()
  await expect(tile.locator('.fit-pct')).toBeVisible()
  await expect(tile.locator('.row').first()).toBeVisible()
  const open = tile.getByRole('button', { name: /Open this hike/ })
  await expect(open).toBeVisible()
  const t = (await tile.boundingBox())!, b = (await open.boundingBox())!, zoom = (await page.locator('#zoomctl').boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(t.y + t.height + 0.5) // the button is inside the tile, not cut off
  expect(t.y).toBeGreaterThanOrEqual(zoom.y + zoom.height) // the tile never covers the zoom buttons
  expect(await tile.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true) // and nothing inside needs scrolling
})
