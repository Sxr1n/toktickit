import { expect, test } from '@playwright/test'

const DEV_PASSWORD = 'DevPass123!'
const FINAL_PASSWORD = 'E2eFinalPass9!'

test.describe('E2E-04: Dashboard role routing and drill-down (AC-11)', () => {
  test('IT Staff lands on the Staff Dashboard and a metric tile drills down into a filtered Queue', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('carlos.mendez@example.com')
    await page.getByLabel('Password').fill(DEV_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()

    await page.getByRole('link', { name: /^New:/ }).click()
    await page.waitForURL(/\/staff\/tickets\?status=NEW/)
    await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
    await expect(page.getByLabel('Status')).toHaveValue('NEW')
  })

  test('an unauthenticated visitor loading / is redirected to Login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('/login')
    await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
  })

  test('Requester lands on the Requester Dashboard after first-login password change', async ({ page, request }) => {
    const ts = Date.now()
    await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'taylor.admin@example.com', password: DEV_PASSWORD },
    })
    const email = `e2e-lab4-dash-${ts}@example.com`
    await request.post('http://localhost:4000/api/admin/users', {
      data: { name: 'E2E Lab4 Dashboard Requester', email, role: 'REQUESTER', isActive: true, initialPassword: DEV_PASSWORD },
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

    await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible()
    await expect(page.getByText("You haven't created any Tickets yet.")).toBeVisible()
  })
})
