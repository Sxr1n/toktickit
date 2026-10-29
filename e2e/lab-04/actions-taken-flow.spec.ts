import { expect, test } from '@playwright/test'

const DEV_PASSWORD = 'DevPass123!'
const FINAL_PASSWORD = 'E2eFinalPass9!'

test.describe('E2E-01: Actions Taken full flow (AC-01, AC-02, AC-05, AC-06)', () => {
  test('Staff creates, edits an Action Taken with Follow-Up Required, and the Requester sees it read-only', async ({
    page,
    request,
  }) => {
    const ts = Date.now()

    await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'taylor.admin@example.com', password: DEV_PASSWORD },
    })
    const email = `e2e-lab4-actions-${ts}@example.com`
    await request.post('http://localhost:4000/api/admin/users', {
      data: { name: 'E2E Lab4 Actions Requester', email, role: 'REQUESTER', isActive: true, initialPassword: DEV_PASSWORD },
    })

    // Requester creates the Ticket.
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

    await page.getByRole('link', { name: 'Create Ticket' }).click()
    await page.getByLabel('Category').selectOption({ index: 1 })
    await page.getByLabel('Related System').selectOption({ index: 1 })
    await page.getByLabel('Requested Priority').selectOption('MEDIUM')
    await page.getByLabel(/Summary/).fill(`E2E Actions Taken ${ts}`)
    await page.getByLabel(/Description/).fill('Full Actions Taken flow verification.')
    await page.getByRole('button', { name: 'Submit Ticket' }).click()
    await page.getByText('Ticket created').waitFor()
    const ticketNumber = (await page.locator('strong').innerText()).trim()

    const toggle0 = page.getByRole('button', { name: 'Toggle navigation menu' })
    if (await toggle0.isVisible()) await toggle0.click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    // Staff claims it, records an Action Taken with Follow-Up Required, then edits it.
    await page.getByLabel('Email address').fill('carlos.mendez@example.com')
    await page.getByLabel('Password').fill(DEV_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')

    await page.getByRole('link', { name: 'My Queue' }).click()
    await page.getByLabel('Search').fill(ticketNumber)
    await page.locator('a:visible', { hasText: ticketNumber }).first().click()
    await page.getByRole('heading', { name: ticketNumber }).waitFor()

    await page.getByLabel('Description').fill('Investigated the reported issue.')
    await page.getByLabel('Result').fill('Root cause identified; fix pending vendor confirmation.')
    await page.getByRole('checkbox', { name: 'Follow-Up Required' }).check()
    await page.getByLabel(/Follow-up Note/).fill('Check back with vendor in 2 business days.')
    await page.getByRole('button', { name: 'Add Action Taken' }).click()
    const actionItem = page.getByText('Investigated the reported issue.').locator('xpath=ancestor::li')
    await expect(actionItem).toBeVisible()
    await expect(actionItem.getByText('Follow-Up Required')).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()
    const editItem = page.getByRole('button', { name: 'Save' }).locator('xpath=ancestor::li')
    await editItem.getByLabel('Description').fill('Investigated the reported issue. Resolved.')
    await editItem.getByRole('checkbox', { name: 'Follow-Up Required' }).uncheck()
    await page.getByRole('button', { name: 'Save' }).click()
    const savedItem = page.getByText('Investigated the reported issue. Resolved.').locator('xpath=ancestor::li')
    await expect(savedItem).toBeVisible()
    await expect(savedItem.getByText('Follow-Up Required')).not.toBeVisible()

    const toggle1 = page.getByRole('button', { name: 'Toggle navigation menu' })
    if (await toggle1.isVisible()) await toggle1.click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    // Requester sees the final edited Action Taken, read-only.
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(FINAL_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')

    await page.getByRole('link', { name: 'My Tickets' }).click()
    await page.getByLabel('Search').fill(ticketNumber)
    await page.locator('a:visible', { hasText: ticketNumber }).first().click()
    await expect(page.getByText('Investigated the reported issue. Resolved.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  })
})
