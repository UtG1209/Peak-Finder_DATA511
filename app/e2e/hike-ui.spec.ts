import { expect, test } from '@playwright/test'

const URL = './#/hike/angels-landing?from=SEA&q=3&go=1'

test('keyboard: Tab to a cost segment, Enter opens its line items, Esc closes', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('svg.costbars')).toBeVisible()
  const seg = page.locator('svg.costbars .seg').first()
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
  await expect(page.locator('.qcards .qcard').first()).toHaveAttribute('aria-pressed', 'true')
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
