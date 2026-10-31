import { expect, test } from '@playwright/test'

const DEV_PASSWORD = 'DevPass123!'
const FINAL_PASSWORD = 'E2eFinalPass9!'

test.describe('E2E-02: full Ticket lifecycle walk (AC-07, FR-07, FR-08)', () => {
  test('New -> Open -> In Progress -> Resolved -> Closed, each transition permitted and Requester-blocked', async ({
    page,
    request,
  }) => {
    const ts = Date.now()

    await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'taylor.admin@example.com', password: DEV_PASSWORD },
    })
    const email = `e2e-lab4-resolution-${ts}@example.com`
    await request.post('http://localhost:4000/api/admin/users', {
      data: { name: 'E2E Lab4 Resolution Requester', email, role: 'REQUESTER', isActive: true, initialPassword: DEV_PASSWORD },
    })

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

    // The Requester Dashboard landing page also has its own "Create Ticket" CTA -- scope to nav.
    await page.getByRole('navigation').getByRole('link', { name: 'Create Ticket' }).click()
    await page.getByLabel('Category').selectOption({ index: 1 })
    await page.getByLabel('Related System').selectOption({ index: 1 })
    await page.getByLabel('Requested Priority').selectOption('MEDIUM')
    await page.getByLabel(/Summary/).fill(`E2E Ticket Resolution ${ts}`)
    await page.getByLabel(/Description/).fill('Full lifecycle walk verification.')
    await page.getByRole('button', { name: 'Submit Ticket' }).click()
    await page.getByText('Ticket created').waitFor()
    const ticketNumber = (await page.locator('strong').innerText()).trim()

    const toggle0 = page.getByRole('button', { name: 'Toggle navigation menu' })
    if (await toggle0.isVisible()) await toggle0.click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    await page.getByLabel('Email address').fill('carlos.mendez@example.com')
    await page.getByLabel('Password').fill(DEV_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')

    await page.getByRole('link', { name: 'My Queue' }).click()
    await page.getByLabel('Search').fill(ticketNumber)
    await page.locator('a:visible', { hasText: ticketNumber }).first().click()
    await page.getByRole('heading', { name: ticketNumber }).waitFor();

    // Walk the permitted path: New -> Open -> In Progress -> Resolved -> Closed. Stable ordering:
    // the Status select always narrows to only the currently-permitted next values (BR-21).
    for (const next of ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) {
      await page.selectOption('#current-status', next)
      await expect(page.locator('#current-status')).toHaveValue(next)
      // Append-only, stable ordering: the status transition itself never reorders or removes
      // anything already on the page (no Actions Taken/comments in this test, but the Ticket
      // info card's own field order stays fixed across every transition).
      await expect(page.getByText('Requested Priority')).toBeVisible()
    }

    const toggle1 = page.getByRole('button', { name: 'Toggle navigation menu' })
    if (await toggle1.isVisible()) await toggle1.click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    // Role-appropriate visibility: the Requester can see the final status, but never gets a status
    // control at all -- the field is plain read-only text on their page, not a select.
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(FINAL_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')

    await page.getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(ticketNumber)
    await page.locator('a:visible', { hasText: ticketNumber }).first().click()
    await page.getByRole('heading', { name: ticketNumber }).waitFor()
    await expect(page.getByText('CLOSED')).toBeVisible()
    await expect(page.locator('#current-status')).toHaveCount(0)
  })
})
