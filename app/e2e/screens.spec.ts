import { expect, test, type Page } from '@playwright/test'

// @visual: saves reference screenshots into $SHOTS_DIR (skipped when it is not set).
// SHOTS_DIR=/abs/path npx playwright test e2e/screens.spec.ts
const DIR = process.env.SHOTS_DIR
// THEME=light|dark forces the colour scheme (the app follows the system setting by default).
const THEME = process.env.THEME === 'light' || process.env.THEME === 'dark' ? process.env.THEME : undefined
const SIZES = [
  { tag: 'desktop', width: 1400, height: 850 },
  { tag: 'mobile', width: 390, height: 844 },
  { tag: 'tablet', width: 768, height: 1024 },
]

async function settle(page: Page) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page.waitForTimeout(1500) // bubble/zoom animations
}
async function mapReady(page: Page) {
  await expect(page.locator('#mapPane canvas.maplibregl-canvas')).toBeVisible()
  await expect(page.locator('.ranked li').first()).toBeAttached() // hidden while the phone sheet is collapsed
}

const SHOTS: { name: string; url: string; phoneOnly?: boolean; element?: string; ready: (p: Page) => Promise<void> }[] = [
  { name: '1-guide', url: './', ready: async (p) => { await expect(p.locator('.guide')).toBeVisible() } },
  { name: '2-explore', url: './#/?from=SEA&q=3&go=1', ready: mapReady },
  { name: '3-selected', url: './#/?from=SEA&q=3&go=1&pick=angels-landing', ready: mapReady },
  {
    name: '4-empty',
    url: './#/?from=SEA&q=3&temp=0-5&crowd=0&smoke=0&rain=0&go=1',
    ready: async (p) => {
      await expect(p.locator('#mapPane canvas.maplibregl-canvas')).toBeVisible()
      await expect(p.getByText(/No hike fits all your limits/).first()).toBeVisible()
    },
  },
  { name: '5-hike', url: './#/hike/angels-landing?from=SEA&q=3&go=1', ready: async (p) => { await expect(p.locator('h1').first()).toBeVisible() } },
  {
    name: '6-filters', // phone and tablet only: the filters sheet
    url: './#/?from=SEA&q=3&go=1',
    phoneOnly: true,
    ready: async (p) => { await mapReady(p); await p.getByRole('button', { name: /Filters/ }).click(); await expect(p.getByRole('dialog', { name: 'Filters' })).toBeVisible() },
  },
  {
    name: '7-hike-cost', // the cost section of the hike page, with a thin slice selected (its leader-line label)
    url: './#/hike/angels-landing?from=SEA&q=3&go=1',
    element: '.costgrid',
    ready: async (p) => { await expect(p.locator('.costbars')).toBeVisible(); await p.locator('.costbars .qbar.sel').scrollIntoViewIfNeeded() },
  },
]

test.describe('@visual screenshots', () => {
  test.skip(!DIR, 'set SHOTS_DIR to save screenshots')
  for (const size of SIZES) {
    for (const s of SHOTS) {
      if (s.phoneOnly && size.width > 860) continue
      test(`${s.name} ${size.tag}`, async ({ page }) => {
        if (THEME) await page.emulateMedia({ colorScheme: THEME })
        await page.setViewportSize({ width: size.width, height: size.height })
        await page.goto(s.url)
        await s.ready(page)
        await settle(page)
        if (s.element) await page.locator(s.element).screenshot({ path: `${DIR}/${s.name}-${size.tag}.png` })
        else await page.screenshot({ path: `${DIR}/${s.name}-${size.tag}.png` })
      })
    }
  }
})
