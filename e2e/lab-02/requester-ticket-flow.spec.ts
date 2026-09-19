import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

// Only the "desktop" project runs this file (see playwright.config.ts testMatch) - the
// functional flow doesn't need to repeat once per viewport.

const DEV_PASSWORD = 'DevPass123!'
const FINAL_PASSWORD = 'E2eFinalPass9!'

// Dedicated throwaway Requesters, created fresh via the Administrator API (Issue 31) rather than
// reusing shared seeded accounts. This replaced an earlier restore-via-API-call approach whose
// cleanup silently swallowed failures on error (flagged in PR #37 review) -- a throwaway account
// needs no restore step at all, since nothing shared is ever touched.
async function createThrowawayRequester(request: APIRequestContext, label: string): Promise<{ email: string; name: string }> {
  const email = `e2e-lab2-${label}-${Date.now()}@example.com`
  const name = `E2E Lab2 ${label}`
  await request.post('http://localhost:4000/api/auth/login', {
    data: { email: 'taylor.admin@example.com', password: DEV_PASSWORD },
  })
  await request.post('http://localhost:4000/api/admin/users', {
    data: { name, email, role: 'REQUESTER', isActive: true, initialPassword: DEV_PASSWORD },
  })
  return { email, name }
}

async function loginAsRequester(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(DEV_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Every freshly-created throwaway Requester has mustChangePassword: true, so login always
  // detours through Change Password first.
  await page.waitForURL('/change-password')
  await page.getByLabel('Current (temporary) password').fill(DEV_PASSWORD)
  await page.getByLabel('New password', { exact: true }).fill(FINAL_PASSWORD)
  await page.getByLabel('Confirm new password').fill(FINAL_PASSWORD)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('/')
}

test.describe('E2E-01: full Requester ticket flow', () => {
  test('log in, create a Ticket, find it in My Tickets, open Detail, add and remove an Attachment', async ({
    page,
    request,
  }) => {
    const marker = `E2E ${Date.now()}`
    const requester = await createThrowawayRequester(request, 'flow')

    await loginAsRequester(page, requester.email)
    await expect(page.getByText(requester.name, { exact: false })).toBeVisible()

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
  test("a different Requester's Ticket does not appear after logging out and logging in as someone else", async ({
    page,
    request,
  }) => {
    const marker = `E2E-isolation ${Date.now()}`
    const requesterA = await createThrowawayRequester(request, 'isolation-a')
    const requesterB = await createThrowawayRequester(request, 'isolation-b')

    await loginAsRequester(page, requesterA.email)
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

    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    await loginAsRequester(page, requesterB.email)
    await page.getByRole('navigation').getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(marker)
    await expect(page.getByText('No tickets match your search/filters.')).toBeVisible()
    await expect(page.getByText(marker)).not.toBeVisible()
  })
})
