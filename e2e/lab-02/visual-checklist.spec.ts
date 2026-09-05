import { expect, test } from '@playwright/test'

async function clickNavLink(page: import('@playwright/test').Page, name: string) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle.isVisible()) {
    await toggle.click()
  }
  await page.getByRole('link', { name }).click()
}

test('capture Create Ticket, My Tickets, and Ticket Detail screenshots', async ({ page }, testInfo) => {
  const viewport = testInfo.project.name
  const marker = `Visual ${Date.now()}`

  await page.goto('/select-requester')
  await page.getByLabel('Development Requester').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Continue' }).click()

  await clickNavLink(page, 'Create Ticket')
  await expect(page.getByRole('heading', { name: 'Create Ticket' })).toBeVisible()
  await page.screenshot({
    path: `artifacts/lab-02/screenshots/create-ticket/${viewport}.png`,
    fullPage: true,
  })

  await page.getByLabel('Category').selectOption({ index: 1 })
  await page.getByLabel('Related System').selectOption({ index: 1 })
  await page.getByLabel('Requested Priority').selectOption('HIGH')
  await page.getByLabel(/Summary/).fill(marker)
  await page.getByLabel(/Description/).fill('Ticket created to capture the visual QA screenshot set.')
  await page.getByRole('button', { name: 'Submit Ticket' }).click()
  await expect(page.getByText('Ticket created')).toBeVisible()
  const ticketNumber = await page.locator('strong').innerText()

  await clickNavLink(page, 'My Tickets')
  await page.getByLabel('Search').fill(marker)
  const ticketLink = page.locator('a:visible', { hasText: ticketNumber }).first()
  await expect(ticketLink).toBeVisible()
  await page.screenshot({ path: `artifacts/lab-02/screenshots/my-tickets/${viewport}.png`, fullPage: true })

  await ticketLink.click()
  await expect(page.getByRole('heading', { name: ticketNumber })).toBeVisible()
  await page.screenshot({
    path: `artifacts/lab-02/screenshots/ticket-detail/${viewport}.png`,
    fullPage: true,
  })
})
