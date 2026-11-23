import { expect, test, type Page } from '@playwright/test'

// The hike page and About, in a real browser against the production build (lane 4).
const URL = './#/hike/angels-landing?from=SEA&q=3&temp=60-85&smoke=3&go=1'
test.beforeEach(async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
})
const ready = async (page: Page) => { await expect(page.locator('.elevchart')).toBeVisible() }
const readoutTime = (page: Page) => page.locator('.ro-time b').innerText()

test('header: NPS numbers, gear with words, photo credit, 3D walk link, back link', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('.hp-head h1')).toHaveText('Angels Landing')
  await expect(page.locator('.facts')).toContainText('5.4 mi')
  await expect(page.locator('.facts')).toContainText('5,790 ft')
  await expect(page.locator('.facts')).toContainText('Summit elevation')
  await expect(page.locator('.gear li')).toHaveCount(3)
  await expect(page.locator('.gear')).toContainText('Chains')
  await expect(page.locator('.hp-photo figcaption')).toContainText(/CC0|CC BY/)
  await expect(page.locator('.hp-photo figcaption a', { hasText: 'Wikimedia Commons' })).toHaveAttribute('href', /.+/)
  await expect(page.getByRole('link', { name: /Walk it in 3D/ })).toHaveAttribute('href', /walks\/angels_landing\/index\.html\?season=summer/) // Q3 = summer
  await page.getByRole('link', { name: /Back to map/ }).first().click()
  await expect(page.locator('#mapPane')).not.toHaveClass(/blurred/) // returns to the same map state
})

test('a hike without a 3D walk has no 3D button', async ({ page }) => {
  await page.goto('./#/hike/half-dome?q=3&go=1')
  await expect(page.locator('.hp-head h1')).toBeVisible()
  await expect(page.getByRole('link', { name: /Walk it in 3D/ })).toHaveCount(0)
})

test('fit for you: four quarters, one best, a breakdown that follows the chosen quarter', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('.qcards .qcard')).toHaveCount(4)
  await expect(page.locator('.qcard em', { hasText: 'Best fit' })).toHaveCount(1)
  await expect(page.locator('.fitbox h3')).toContainText('Q3')
  await expect(page.locator('.fitrow')).toHaveCount(5)
  const temp = page.locator('.fitrow', { hasText: 'Typical high' })
  await expect(temp).toContainText('Your limit 60–85°F')
  await expect(temp).toContainText(/Over by \d+°F/) // 95°F in summer is past the limit, in words
  await page.locator('.qcards').getByRole('button', { name: /Q1/ }).click()
  await expect(page).toHaveURL(/q=1/)
  await expect(page.locator('.fitbox h3')).toContainText('Q1')
})

test('month by month: 12 columns, the chosen quarter framed, past-limit cells marked in words', async ({ page }) => {
  await page.goto(URL)
  const strip = page.locator('table.strip')
  await expect(strip.locator('thead th[scope="col"]')).toHaveCount(12)
  await expect(strip.locator('thead th.inq')).toHaveCount(3)
  await expect(strip.locator('thead th.inq')).toContainText(['Jul', 'Aug', 'Sep'])
  await expect(strip.locator('td.past .cv-note').first()).toHaveText('Past limit') // icon + words, not colour alone
  await expect(strip.locator('tbody tr')).toHaveCount(6) // five measures and the hazard row
  await expect(strip.locator('tr.hazard-row')).toContainText(/Heat/)
  await page.locator('.qcards').getByRole('button', { name: /Q1/ }).click()
  await expect(strip.locator('thead th.inq')).toContainText(['Jan', 'Feb', 'Mar'])
})

test('month by month: the "Advice vs data" card shows when the hike has one', async ({ page }) => {
  await page.goto(URL)
  await expect(page.locator('.advice')).toContainText('Advice vs data')
  await expect(page.locator('.advice a')).toHaveAttribute('href', /.+/)
})

test('on the trail: checkpoint times going up and coming back, and a before-dark verdict', async ({ page }) => {
  await page.goto(URL)
  await ready(page)
  await expect(page.locator('.starttime input')).toHaveValue(/^\d\d:\d\d$/)
  const rows = page.locator('table.cptable').first().locator('tbody tr')
  expect(await rows.count()).toBeGreaterThanOrEqual(2)
  await expect(rows.first()).toContainText('C0')
  const first = (await rows.first().locator('td').allInnerTexts())
  expect(first[0]).toMatch(/\d+:\d\d (am|pm)/) // going up
  expect(first[1]).toMatch(/\d+:\d\d (am|pm)/) // coming back
  await expect(page.locator('.trail-verdict')).toContainText(/Reach the summit at about/)
  await expect(page.locator('.trail-verdict')).toContainText(/Before dark|After dark/)
  await expect(page.locator('.elevchart .cp-up').first()).toBeVisible()
  await expect(page.locator('.elevchart .cp-down').first()).toBeVisible()
})

test('start time: 7 am shows the summit time and a verdict in every quarter; a late start warns in words', async ({ page }) => {
  await page.goto(URL)
  await ready(page)
  await page.locator('.starttime input').fill('07:00')
  await expect(page.locator('.trail-verdict')).toContainText('Start 7:00 am')
  const q = page.locator('table.qtable tbody tr')
  await expect(q).toHaveCount(4)
  for (let i = 0; i < 4; i++) {
    await expect(q.nth(i)).toContainText(/Yes, .* to spare|No, .* after sunset/)
    await expect(q.nth(i).locator('td').nth(2)).toHaveText(/\d+:\d\d (am|pm)/) // summit time
  }
  await page.locator('.starttime input').fill('17:30')
  await expect(page.locator('.trail-verdict')).toContainText('After dark')
  await expect(page.locator('.trail-verdict')).toContainText(/headlamp/)
  await expect(page.locator('.daylightband')).toContainText('After dark')
  await page.getByRole('button', { name: /Use sunrise \+ 1 h/ }).click()
  await expect(page.locator('.trail-verdict')).toContainText('Before dark')
})

test('changing the quarter changes the fit, the strip frame, the daylight and the default start', async ({ page }) => {
  await page.goto(URL)
  await ready(page)
  const startQ3 = await page.locator('.starttime input').inputValue()
  const sunsetQ3 = await page.locator('table.qtable tbody tr.current td').nth(1).innerText()
  await page.locator('.qcards').getByRole('button', { name: /Q1/ }).click()
  await expect(page.locator('.fitbox h3')).toContainText('Q1')
  await expect(page.locator('table.strip thead th.inq')).toContainText(['Jan'])
  await expect(page.locator('table.qtable tbody tr.current')).toContainText('Q1')
  expect(await page.locator('.starttime input').inputValue()).not.toBe(startQ3) // sunrise + 1 h moved
  expect(await page.locator('table.qtable tbody tr.current td').nth(1).innerText()).not.toBe(sunsetQ3)
  await expect(page.locator('.trail-verdict')).toContainText('Q1')
})

test('scrubber: the slider, Back / Forward and arrow keys move the hiker between checkpoints', async ({ page }) => {
  await page.goto(URL)
  await ready(page)
  const t0 = await readoutTime(page)
  await expect(page.getByRole('button', { name: /Back/ }).first()).toBeDisabled() // at the start
  await page.getByRole('button', { name: /Forward/ }).click()
  const t1 = await readoutTime(page)
  expect(t1).not.toBe(t0)
  // Forward lands exactly on checkpoint C1's going-up time in the table
  const c1 = await page.locator('table.cptable').first().locator('tbody tr').nth(1).locator('td').first().innerText()
  expect(t1).toBe(c1)
  await expect(page.locator('.ro-stop h3')).toContainText('C1')
  await page.getByRole('button', { name: /Back/ }).first().click()
  expect(await readoutTime(page)).toBe(t0)

  // arrow keys on the chart do the same
  await page.locator('.chartbox').focus()
  await page.keyboard.press('ArrowRight')
  expect(await readoutTime(page)).toBe(t1)
  await page.keyboard.press('ArrowLeft')
  expect(await readoutTime(page)).toBe(t0)
  await page.keyboard.press('End')
  await expect(page.locator('.ro-time span')).toHaveText('Finished')
  await expect(page.locator('.ro-next')).toContainText('finished')
  await page.keyboard.press('Home')
  await expect(page.locator('.ro-time span')).toHaveText('At the start')

  // the native slider is operable with the keyboard and speaks its value
  const slider = page.locator('.scrub-range input')
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuetext', /\d+:\d\d (am|pm), going up, .* walked/)
})

test('scrubber: going all the way round shows "Coming back", and out-and-back steps through every checkpoint twice', async ({ page }) => {
  await page.goto(URL)
  await ready(page)
  const n = await page.locator('table.cptable').first().locator('tbody tr').count()
  await page.locator('.chartbox').focus()
  const seen: string[] = []
  for (let i = 0; i < 2 * (n - 1); i++) {
    await page.keyboard.press('ArrowRight')
    seen.push((await page.locator('.ro-time span').textContent()) ?? '') // the label is shown in capitals by CSS
  }
  expect(seen.filter((s) => s === 'Going up').length).toBeGreaterThanOrEqual(n - 2)
  expect(seen.filter((s) => s === 'Coming back').length).toBeGreaterThanOrEqual(n - 2)
  expect(seen[seen.length - 1]).toBe('Finished')
})

test('scrubber: dragging the chart moves the hiker marker', async ({ page }) => {
  await page.goto(URL)
  await ready(page)
  const svg = page.locator('.elevchart')
  await svg.scrollIntoViewIfNeeded() // the mouse only reaches what is inside the viewport
  const box = (await svg.boundingBox())!
  const before = await page.locator('.elevchart .hiker').getAttribute('cx')
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.6)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.6, { steps: 6 })
  await page.mouse.up()
  const after = await page.locator('.elevchart .hiker').getAttribute('cx')
  expect(Number(after)).toBeGreaterThan(Number(before))
  expect(await readoutTime(page)).toMatch(/\d+:\d\d (am|pm)/)
  await expect(page.locator('.ro-facts')).toContainText('Walked')
})

test('metric units reach the strip, the profile axes and the facts', async ({ page }) => {
  await page.goto(URL + '&units=metric')
  await ready(page)
  await expect(page.locator('.facts')).toContainText(/km/)
  await expect(page.locator('.facts')).toContainText(/ m/)
  await expect(page.locator('table.strip tbody tr').first()).toContainText('°C')
  await expect(page.locator('.elevchart')).toContainText('Distance walked (km)')
  await expect(page.locator('.elevchart')).toContainText('Elevation (m)')
})

test('what it costs still works: click a segment for its line items and source', async ({ page }) => {
  await page.goto(URL)
  await expect(page.getByRole('heading', { name: 'What it costs' })).toBeVisible()
  await expect(page.locator('svg.costbars')).toBeVisible()
  await expect(page.getByText('Typical, from past data. Not a price quote.')).toBeVisible()
  await page.locator('svg.costbars .seg').first().click()
  await expect(page.locator('.costdetail')).toContainText('Source:')
})

test('About: sources with dates, the worked match example, honest limits, and a way in from the hike page', async ({ page }) => {
  await page.goto(URL)
  await page.getByRole('link', { name: /About the data/ }).click()
  await expect(page).toHaveURL(/#\/about/)
  await expect(page.getByRole('heading', { name: 'About the data' })).toBeVisible()
  await expect(page.locator('.about-sources li').first()).toContainText('as of')
  await expect(page.locator('.worked')).toContainText('Worked example')
  await expect(page.locator('.worked')).toContainText('60 to 85°F')
  await expect(page.locator('.worked')).toContainText('hollow grey peak') // Angels Landing Q3: temperature scores 0
  await expect(page.locator('.worked')).toContainText(/= \d+%/)
  for (const h of ['Sources', 'How match % works', 'How costs are made', 'How hike times are made', 'Honest limits', 'Advice vs data']) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible()
  }
  await expect(page.locator('#limits')).toContainText(/whole park/)
  await expect(page.locator('#limits')).toContainText(/county/)
  await expect(page.locator('#times')).toContainText(/Global time correction/)
  await page.getByRole('button', { name: 'Honest limits' }).click() // the on-page navigation works under the hash router
  await expect(page).toHaveURL(/#\/about/)
  await page.getByRole('link', { name: /Back to map/ }).click()
  await expect(page.locator('.explore')).toBeVisible()
})
