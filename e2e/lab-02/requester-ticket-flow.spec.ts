import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Only the "desktop" project runs this file (see playwright.config.ts testMatch) - the
// functional flow doesn't need to repeat once per viewport.

// Every seeded Requester has mustChangePassword: true (BR-08), so a real login always detours
// through Change Password first. TEMP_PASSWORD is a throwaway new password used only within a
// single test; each test restores the account back to DevPass123! afterward so the seed's
// documented state holds for the next run (mirrors e2e/lab-03/authentication.spec.ts's E2E-02).
const TEMP_PASSWORD = 'E2eTemp123!'

async function loginAsRequester(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill('DevPass123!')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/change-password')
  if (new URL(page.url()).pathname === '/change-password') {
    await page.getByLabel('Current (temporary) password').fill('DevPass123!')
    await page.getByLabel('New password', { exact: true }).fill(TEMP_PASSWORD)
    await page.getByLabel('Confirm new password').fill(TEMP_PASSWORD)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('/')
  }
}

async function restoreSeedPassword(page: Page) {
  await page
    .request.post('http://localhost:4000/api/auth/change-password', {
      data: { currentPassword: TEMP_PASSWORD, newPassword: 'DevPass123!' },
      headers: { 'Content-Type': 'application/json' },
    })
    .catch(() => {})
}

test.describe('E2E-01: full Requester ticket flow', () => {
  test.afterEach(async ({ page }) => {
    await restoreSeedPassword(page)
  })

  test('log in, create a Ticket, find it in My Tickets, open Detail, add and remove an Attachment', async ({
    page,
  }) => {
    const marker = `E2E ${Date.now()}`

    await loginAsRequester(page, 'michael.brown@example.com')
    await expect(page.getByText('Michael Brown', { exact: false })).toBeVisible()

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

    await page.getByRole('navigation').getByRole('link', { name: 'My Tickets' }).click()
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

test.describe('E2E-02: Requester ownership isolation across real sessions', () => {
  // Lab 2's fake "Change Requester" mid-session switch no longer exists under real auth -- the
  // real-auth equivalent of "another Requester cannot see my Ticket" is two separate login
  // sessions (log out, log in as someone else), not a same-session identity swap.
  test.afterEach(async ({ page }) => {
    await restoreSeedPassword(page)
  })

  test("a different Requester's Ticket does not appear after logging out and logging in as someone else", async ({
    page,
  }) => {
    const marker = `E2E-isolation ${Date.now()}`

    await loginAsRequester(page, 'sarah.wilson@example.com')
    await page.getByRole('link', { name: 'Create Ticket' }).click()
    await page.getByLabel('Category').selectOption({ index: 1 })
    await page.getByLabel('Related System').selectOption({ index: 1 })
    await page.getByLabel('Requested Priority').selectOption('LOW')
    await page.getByLabel(/Summary/).fill(marker)
    await page.getByLabel(/Description/).fill('Created to verify Requester ownership isolation across sessions.')
    await page.getByRole('button', { name: 'Submit Ticket' }).click()
    await expect(page.getByText('Ticket created')).toBeVisible()
    const ticketNumber = await page.locator('strong').innerText()

    await page.getByRole('navigation').getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(marker)
    await expect(page.locator('a:visible', { hasText: ticketNumber }).first()).toBeVisible()

    await restoreSeedPassword(page)
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    await loginAsRequester(page, 'david.lee@example.com')
    await page.getByRole('navigation').getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(marker)
    await expect(page.getByText('No tickets match your search/filters.')).toBeVisible()
    await expect(page.getByText(marker)).not.toBeVisible()
  })
})
