import { expect, test, type Page } from '@playwright/test'

// Keyboard-only flow, end to end: guide, Show hikes, a list row, the tile's Open button, the hike page (quarter, cost chart), Back.
// And reduced motion: nothing animates when the user asks for less.

/** Press Tab until the focused element satisfies `test` (evaluated in the page). Fails after `max` presses. */
async function tabTo(page: Page, testFn: string, what: string, max = 80, key = 'Tab') {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key)
    const ok = await page.evaluate(`(() => { const el = document.activeElement; return !!el && (${testFn})(el) })()`)
    if (ok) return
  }
  throw new Error(`Tab never reached: ${what}`)
}
const named = (sel: string, text: string) => `(el) => !!el.closest(${JSON.stringify(sel)}) && (el.getAttribute('aria-label') || el.textContent || '').trim().startsWith(${JSON.stringify(text)})`

for (const size of [{ tag: 'desktop', width: 1400, height: 850 }, { tag: 'phone', width: 390, height: 844 }]) {
  test(`keyboard only: guide to hike page and back, ${size.tag}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('./#/?from=SEA&q=3') // a home city, so the hike page has a cost chart
    await expect(page.locator('.guide')).toBeVisible()
    // 1. the guide's Show hikes button is reachable and works with Enter
    await tabTo(page, named('.guide', 'Show hikes'), 'Show hikes in the guide')
    await page.keyboard.press('Enter')
    await expect(page.locator('.guide')).toHaveCount(0, { timeout: 20_000 }) // the map chunk starting up can block the page for seconds on software WebGL
    await expect(page).toHaveURL(/go=1/)
    // 2. focus order: the rail (and list) come before the map controls
    // 3. a list row selects the hike and opens the tile
    await tabTo(page, `(el) => !!el.closest('.ranked') && el.tagName === 'BUTTON'`, 'a ranked list row')
    await page.keyboard.press('Enter')
    await expect(page.locator('#detail.selected')).toBeVisible()
    // 4. the tile's Open button
    await tabTo(page, named('#detail', 'Open this hike'), 'Open this hike')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/hike\//)
    await expect(page.locator('h1')).toBeFocused() // the new page's title takes focus, so Tab starts at the top of it
    // 5. quarter strip: choose Q2 with the keyboard
    await tabTo(page, `(el) => el.classList.contains('qcard') && /Q2/.test(el.textContent || '')`, 'the Q2 card')
    await page.keyboard.press('Enter')
    await expect(page.locator('.qcard.sel')).toContainText('Q2')
    // 6. cost chart: a stacked segment opens its line items, Escape closes them
    await tabTo(page, `(el) => el.classList.contains('seg')`, 'a cost segment')
    await page.keyboard.press('Enter')
    await expect(page.locator('.costdetail')).toBeVisible()
    await expect(page.locator('.costdetail .cd-head')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.cd-head')).toHaveCount(0)
    // 7. Back to the map lands on the same open tile
    await tabTo(page, `(el) => el.classList.contains('back') && /Back to map/.test(el.textContent || '')`, 'Back to map', 80, 'Shift+Tab')
    await page.keyboard.press('Enter')
    await expect(page.locator('#detail.selected')).toBeVisible()
  })
}

test('phone: filters dialog and list sheet work from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#/?from=SEA&q=3&go=1')
  const filters = page.getByRole('button', { name: /Filters/ })
  await filters.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Filters' })
  await expect(dialog).toBeVisible()
  // focus moves into the dialog, and the page behind it cannot be reached
  await expect(page.locator('.rail-filters :focus')).toHaveCount(1)
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('.rail-filters') || document.activeElement === document.body)).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(filters).toBeFocused()
  // the sheet: a visible toggle with aria-expanded; collapsed hides the rows from keyboard and screen readers
  const toggle = page.locator('.sheet-btn')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.focus()
  await page.keyboard.press('Enter') // peek -> expanded
  await expect(page.locator('.explore')).toHaveClass(/sheet-expanded/)
  await page.keyboard.press('Enter') // expanded -> collapsed
  await expect(page.locator('.explore')).toHaveClass(/sheet-collapsed/)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.ranked li').first()).toBeHidden()
  // the sheet never covers the zoom buttons
  const zoom = await page.locator('#zoomctl').boundingBox()
  await page.keyboard.press('Enter') // collapsed -> peek
  await page.keyboard.press('Enter') // peek -> expanded
  const sheet = await page.locator('.rail-list').boundingBox()
  expect(zoom && sheet && zoom.y + zoom.height <= sheet.y).toBe(true)
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  const running = (page: Page) => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.effect as KeyframeEffect | null)?.target?.className ?? 'unknown'))
  test('list re-sort and sheet are instant', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('./#/?from=SEA&q=3&go=1&temp=40-75')
    await expect(page.locator('.ranked li').first()).toBeVisible()
    const before = await page.locator('.ranked li .name').allTextContents()
    await page.getByRole('button', { name: 'Expand the ranked list' }).click()
    await page.getByRole('button', { name: 'Collapse the ranked list' }).click()
    await page.getByRole('button', { name: 'Show the ranked list' }).click()
    expect(await running(page)).toEqual([]) // the sheet changed height without a transition
    const h = await page.locator('.rail-list').evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(h).toBe('0s')
    // change quarter through the filters sheet: the list re-sorts at once
    await page.getByRole('button', { name: /Filters/ }).click()
    await page.getByRole('button', { name: /^Q1/ }).click()
    await page.getByRole('button', { name: 'Close filters' }).click()
    await expect(page.locator('.ranked li').first()).toBeVisible()
    expect(await page.locator('.ranked li .name').allTextContents()).not.toEqual(before)
    expect(await running(page)).toEqual([])
  })
  test('control: with motion allowed the sheet does animate (so the test above can fail)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('./#/?from=SEA&q=3&go=1')
    await expect(page.locator('.ranked li').first()).toBeVisible()
    await page.getByRole('button', { name: 'Expand the ranked list' }).click()
    expect((await running(page)).length).toBeGreaterThan(0)
  })
})
