import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const DEV_PASSWORD = 'DevPass123!'
const FINAL_PASSWORD = 'E2eFinalPass9!'

// A dedicated throwaway Requester, created fresh via the Administrator API (Issue 31) rather than
// reusing a shared seeded account -- see requester-ticket-flow.spec.ts for the full rationale
// (this replaced an earlier restore-via-API-call approach whose cleanup silently swallowed
// failures on error, flagged in PR #37 review).
async function createThrowawayRequester(request: APIRequestContext, viewport: string): Promise<string> {
  const email = `e2e-lab2-visual-${viewport}-${Date.now()}@example.com`
  await request.post('http://localhost:4000/api/auth/login', {
    data: { email: 'taylor.admin@example.com', password: DEV_PASSWORD },
  })
  await request.post('http://localhost:4000/api/admin/users', {
    data: { name: `E2E Lab2 Visual ${viewport}`, email, role: 'REQUESTER', isActive: true, initialPassword: DEV_PASSWORD },
  })
  return email
}

async function loginAsRequester(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(DEV_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.waitForURL('/change-password')
  await page.getByLabel('Current (temporary) password').fill(DEV_PASSWORD)
  await page.getByLabel('New password', { exact: true }).fill(FINAL_PASSWORD)
  await page.getByLabel('Confirm new password').fill(FINAL_PASSWORD)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('/')
}

async function clickNavLink(page: Page, name: string) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle.isVisible()) {
    await toggle.click()
  }
  // Scoped to the nav landmark: the Create Ticket success screen's "View My Tickets" link is
  // also a real <a role="link"> and its accessible name contains "My Tickets" as a substring,
  // which an unscoped locator would ambiguously match too.
  await page.getByRole('navigation').getByRole('link', { name }).click()
}

// Requested in PR #22 review (FramePongrit): screenshots alone don't fail the test on overflow,
// so assert it directly rather than relying on someone noticing it in an image.
async function expectNoHorizontalOverflow(page: Page, screen: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `${screen} has horizontal overflow`).toBeLessThanOrEqual(clientWidth)
}

test('capture Create Ticket, My Tickets, and Ticket Detail screenshots', async ({ page, request }, testInfo) => {
  const viewport = testInfo.project.name
  const marker = `Visual ${Date.now()}`

  const email = await createThrowawayRequester(request, viewport)
  await loginAsRequester(page, email)

  await clickNavLink(page, 'Create Ticket')
  await expect(page.getByRole('heading', { name: 'Create Ticket' })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Create Ticket')
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
  await expectNoHorizontalOverflow(page, 'My Tickets')
  await page.screenshot({ path: `artifacts/lab-02/screenshots/my-tickets/${viewport}.png`, fullPage: true })

  await ticketLink.click()
  await expect(page.getByRole('heading', { name: ticketNumber })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Ticket Detail')
  await page.screenshot({
    path: `artifacts/lab-02/screenshots/ticket-detail/${viewport}.png`,
    fullPage: true,
  })
})
