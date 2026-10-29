import { expect, test } from '@playwright/test'

const DEV_PASSWORD = 'DevPass123!'

// At mobile widths, AppShell collapses the nav behind a "Menu" toggle (same pattern as Lab 2/3).
async function clickNavLink(page: import('@playwright/test').Page, name: string) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle.isVisible()) {
    await toggle.click()
  }
  await page.getByRole('navigation').getByRole('link', { name }).click()
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, screen: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `${screen} has horizontal overflow`).toBeLessThanOrEqual(clientWidth)
}

test('capture Staff Dashboard, Requester Dashboard, and Actions Taken screenshots', async ({ page, request }, testInfo) => {
  const viewport = testInfo.project.name
  const ts = `${Date.now()}-${viewport}`

  await request.post('http://localhost:4000/api/auth/login', {
    data: { email: 'taylor.admin@example.com', password: DEV_PASSWORD },
  })
  const email = `visual4-${ts}@example.com`
  await request.post('http://localhost:4000/api/admin/users', {
    data: { name: 'Visual4 Requester', email, role: 'REQUESTER', isActive: true, initialPassword: DEV_PASSWORD },
  })

  // 1. Staff Dashboard.
  await page.goto('/login')
  await page.getByLabel('Email address').fill('carlos.mendez@example.com')
  await page.getByLabel('Password').fill(DEV_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/')
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Staff Dashboard')
  await page.screenshot({ path: `artifacts/lab-04/screenshots/staff-dashboard/${viewport}.png`, fullPage: true })

  // 2. Actions Taken -- staff side, with one recorded so the list isn't empty in the screenshot.
  // Create the Ticket as the throwaway Requester, through the real first-login flow.
  const toggle0 = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle0.isVisible()) await toggle0.click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(DEV_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/change-password')
  await page.getByLabel('Current (temporary) password').fill(DEV_PASSWORD)
  await page.getByLabel('New password', { exact: true }).fill('E2eFinalPass9!')
  await page.getByLabel('Confirm new password').fill('E2eFinalPass9!')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('/')

  await clickNavLink(page, 'Create Ticket')
  await page.getByLabel('Category').selectOption({ index: 1 })
  await page.getByLabel('Related System').selectOption({ index: 1 })
  await page.getByLabel('Requested Priority').selectOption('MEDIUM')
  await page.getByLabel(/Summary/).fill(`Visual4 Actions Taken ${ts}`)
  await page.getByLabel(/Description/).fill('Seed ticket for the Lab 4 visual checklist screenshots.')
  await page.getByRole('button', { name: 'Submit Ticket' }).click()
  await page.getByText('Ticket created').waitFor()
  const ticketNumber = (await page.locator('strong').innerText()).trim()

  const toggle1 = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle1.isVisible()) await toggle1.click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL('/login')
  await page.getByLabel('Email address').fill('carlos.mendez@example.com')
  await page.getByLabel('Password').fill(DEV_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/')

  await clickNavLink(page, 'My Queue')
  await page.getByLabel('Search').fill(ticketNumber)
  await page.locator('a:visible', { hasText: ticketNumber }).first().click()
  await page.getByRole('heading', { name: ticketNumber }).waitFor()

  await page.getByLabel('Description').fill('Checked the reported issue.')
  await page.getByLabel('Result').fill('Confirmed and applied a fix.')
  await page.getByRole('button', { name: 'Add Action Taken' }).click()
  await page.getByText('Checked the reported issue.').waitFor()
  await expectNoHorizontalOverflow(page, 'Staff Ticket Detail - Actions Taken')
  await page.screenshot({ path: `artifacts/lab-04/screenshots/actions-taken/${viewport}.png`, fullPage: true })

  // 3. Requester Dashboard.
  const toggle2 = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle2.isVisible()) await toggle2.click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill('E2eFinalPass9!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/')
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Requester Dashboard')
  await page.screenshot({ path: `artifacts/lab-04/screenshots/requester-dashboard/${viewport}.png`, fullPage: true })
})
