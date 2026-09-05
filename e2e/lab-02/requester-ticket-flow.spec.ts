import { expect, test } from '@playwright/test'

// Only the "desktop" project runs this file (see playwright.config.ts testMatch) - the
// functional flow doesn't need to repeat once per viewport.

async function selectRequester(page: import('@playwright/test').Page, name: string) {
  await page.goto('/select-requester')
  const select = page.getByLabel('Development Requester')
  const value = await select.locator('option', { hasText: name }).getAttribute('value')
  await select.selectOption(value!)
  await page.getByRole('button', { name: 'Continue' }).click()
}

test.describe('E2E-01: full Requester ticket flow', () => {
  test('select Requester, create a Ticket, find it in My Tickets, open Detail, add and remove an Attachment', async ({
    page,
  }) => {
    const marker = `E2E ${Date.now()}`

    await selectRequester(page, 'Jennifer Anderson')
    await expect(page.getByText('Jennifer Anderson')).toBeVisible()

    await page.getByRole('link', { name: 'Create Ticket' }).click()
    await page.getByLabel('Category').selectOption({ index: 1 })
    await page.getByLabel('Related System').selectOption({ index: 1 })
    await page.getByLabel('Requested Priority').selectOption('MEDIUM')
    await page.getByLabel(/Summary/).fill(marker)
    await page
      .getByLabel(/Description/)
      .fill('Created by the Lab 2 end-to-end test to verify the full Requester ticket flow.')
    await page.getByRole('button', { name: 'Submit Ticket' }).click()

    await expect(page.getByText('Ticket created')).toBeVisible()
    const ticketNumber = await page.locator('strong').innerText()
    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/)

    await page.getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(marker)
    const ticketLink = page.locator('a:visible', { hasText: ticketNumber }).first()
    await expect(ticketLink).toBeVisible()
    await ticketLink.click()

    await expect(page.getByRole('heading', { name: ticketNumber })).toBeVisible()
    await expect(page.getByText(marker)).toBeVisible()

    await page.getByLabel('Add attachment').setInputFiles({
      name: 'evidence.png',
      mimeType: 'image/png',
      buffer: Buffer.from('e2e-test-file-contents'),
    })
    await expect(page.getByText('evidence.png')).toBeVisible()

    await page.getByRole('button', { name: 'Remove' }).click()
    await page.getByLabel('Reason for removal').fill('No longer needed for this test')
    await page.getByRole('button', { name: 'Confirm Removal' }).click()

    await expect(page.getByText(/evidence.png.*Removed/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download' })).not.toBeVisible()
  })
})

test.describe('E2E-02: switching Requester', () => {
  test("Requester A's Ticket disappears from My Tickets after switching to Requester B", async ({ page }) => {
    const marker = `E2E-switch ${Date.now()}`

    await selectRequester(page, 'Sarah Wilson')
    await page.getByRole('link', { name: 'Create Ticket' }).click()
    await page.getByLabel('Category').selectOption({ index: 1 })
    await page.getByLabel('Related System').selectOption({ index: 1 })
    await page.getByLabel('Requested Priority').selectOption('LOW')
    await page.getByLabel(/Summary/).fill(marker)
    await page.getByLabel(/Description/).fill('Created to verify Requester-switch ownership isolation.')
    await page.getByRole('button', { name: 'Submit Ticket' }).click()
    await expect(page.getByText('Ticket created')).toBeVisible()
    const ticketNumber = await page.locator('strong').innerText()

    await page.getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(marker)
    await expect(page.locator('a:visible', { hasText: ticketNumber }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Change Requester' }).click()
    await selectRequester(page, 'David Lee')

    await page.getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(marker)
    await expect(page.getByText('No tickets match your search/filters.')).toBeVisible()
    await expect(page.getByText(marker)).not.toBeVisible()
  })
})
