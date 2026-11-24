import { expect, test, type Page } from '@playwright/test'

// Explore interactions added with the restyle: quarter re-sort, the designed empty state, the guide.
const names = (page: Page) => page.locator('.ranked li .name').allTextContents()

test('changing the quarter keeps 38 rows and can change the order', async ({ page }) => {
  await page.goto('./#/?from=SEA&q=1&temp=60-80&go=1')
  await expect(page.locator('.ranked li')).toHaveCount(38)
  const q1 = await names(page)
  await page.getByRole('button', { name: /^Q3/ }).click()
  await expect(page).toHaveURL(/q=3/)
  await expect(page.locator('.ranked li')).toHaveCount(38)
  await expect.poll(() => names(page)).not.toEqual(q1) // the list re-sorts a moment after the URL changes
  const q3 = await names(page)
  expect([...q3].sort()).toEqual([...q1].sort()) // same hikes, new order
})

test('empty state offers a one-click fix that brings hikes back', async ({ page }) => {
  await page.goto('./#/?from=SEA&q=3&temp=0-5&crowd=0&smoke=0&rain=0&go=1')
  const empty = page.locator('.rail .empty')
  await expect(empty).toContainText('No hike fits all your limits')
  await expect(empty).toContainText(/Allowing .+ adds \d+/)
  await empty.getByRole('button', { name: 'Allow it' }).click()
  await expect(page.locator('#count b')).not.toHaveText('0')
})

test('guide steps tick off and Show hikes unblurs the map', async ({ page }) => {
  await page.goto('./')
  const guide = page.locator('.guide')
  await expect(guide.locator('.steps li')).toHaveCount(3)
  await expect(guide.locator('.steps li.now')).toHaveCount(1)
  await page.getByLabel('Home city').selectOption('SEA')
  await expect(guide.locator('.steps li.done')).toHaveCount(1)
  await guide.getByRole('button', { name: /Show hikes/ }).click()
  await expect(page.locator('#mapPane')).not.toHaveClass(/blurred/)
  await expect(guide).toHaveCount(0)
  await expect(page.locator('.tip')).toContainText('peak')
})
