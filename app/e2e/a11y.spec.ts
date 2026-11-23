import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Accessibility gate: axe-core on the three main screens, both themes, desktop and phone. Serious and critical violations fail the build.
// Rules switched off (each with the reason) are in DISABLED below; keep that list short.
const DISABLED: Record<string, string> = {}

const SIZES = [
  { tag: '1400x850', width: 1400, height: 850 },
  { tag: '390x844', width: 390, height: 844 },
]
const THEMES = ['dark', 'light'] as const

const SCREENS: { name: string; url: string; phoneOnly?: boolean; ready: (p: Page) => Promise<void> }[] = [
  { name: 'explore before start', url: './', ready: async (p) => { await expect(p.locator('.guide')).toBeVisible() } },
  {
    name: 'explore with a tile open',
    url: './#/?from=SEA&q=3&go=1&pick=angels-landing',
    ready: async (p) => {
      await expect(p.locator('#mapPane canvas.maplibregl-canvas')).toBeVisible()
      await expect(p.locator('#detail.selected')).toBeVisible()
    },
  },
  {
    name: 'explore filters sheet', // the phone filters dialog
    url: './#/?from=SEA&q=3&go=1',
    phoneOnly: true,
    ready: async (p) => { await p.getByRole('button', { name: /Filters/ }).click(); await expect(p.getByRole('dialog', { name: 'Filters' })).toBeVisible() },
  },
  {
    name: 'explore list sheet expanded',
    url: './#/?from=SEA&q=3&go=1',
    phoneOnly: true,
    ready: async (p) => { await p.getByRole('button', { name: 'Expand the ranked list' }).click(); await expect(p.locator('.ranked li').first()).toBeVisible() },
  },
  {
    name: 'wheel dialog open', // lane 3's random picker, landed (reduced motion picks at once)
    url: './#/?from=SEA&q=3&go=1',
    ready: async (p) => {
      await p.getByRole('button', { name: /Spin the wheel/ }).first().click()
      await expect(p.getByRole('dialog', { name: /Spin the wheel/ })).toBeVisible()
      await expect(p.locator('.wheel-result h3')).toBeVisible()
    },
  },
  {
    // the whole page: fit breakdown, month strip, timed profile with daylight band and checkpoint tables, cost graph (limits set so past-limit cells and the warning styles are scanned too)
    name: 'hike page',
    url: './#/hike/angels-landing?from=SEA&q=3&temp=60-85&smoke=3&go=1',
    ready: async (p) => {
      await expect(p.locator('.costbars')).toBeVisible()
      await expect(p.locator('table.strip')).toBeVisible()
      await expect(p.locator('.elevchart')).toBeVisible()
      await expect(p.locator('.daylightband')).toBeVisible()
    },
  },
  {
    name: 'hike page, late start (after-dark warning)',
    url: './#/hike/angels-landing?from=SEA&q=3&temp=60-85&smoke=3&go=1',
    ready: async (p) => {
      await expect(p.locator('.elevchart')).toBeVisible()
      await p.locator('.starttime input').fill('17:30')
      await expect(p.locator('.trail-verdict')).toContainText('After dark')
    },
  },
  { name: 'about', url: './#/about', ready: async (p) => { await expect(p.locator('.worked')).toBeVisible() } },
]

for (const size of SIZES) {
  for (const theme of THEMES) {
    for (const s of SCREENS) {
      if (s.phoneOnly && size.width > 860) continue
      test(`axe: ${s.name}, ${theme}, ${size.tag}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' }) // reduced motion: no transitions halfway through the scan
        await page.setViewportSize({ width: size.width, height: size.height })
        await page.goto(s.url)
        await s.ready(page)
        await page.evaluate(() => document.fonts?.ready).catch(() => {})
        await page.waitForTimeout(600)
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
          .disableRules(Object.keys(DISABLED))
          .analyze()
        const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        const report = bad.map((v) => `${v.impact} ${v.id}: ${v.help}\n${v.nodes.slice(0, 4).map((n) => `    ${n.target.join(' ')}\n      ${(n.failureSummary ?? '').split('\n').slice(0, 3).join(' | ')}`).join('\n')}`).join('\n')
        // moderate and minor findings do not fail the build; they are listed in the report so they stay visible
        for (const v of result.violations.filter((x) => !bad.includes(x))) test.info().annotations.push({ type: `${v.impact} ${v.id}`, description: `${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}` })
        expect(bad, report).toEqual([])
      })
    }
  }
}
