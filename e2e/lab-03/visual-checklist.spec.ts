import { expect, test } from '@playwright/test'

// At mobile widths, AppShell collapses the nav behind a "Menu" toggle (matches Lab 2's
// visual-checklist.spec.ts pattern).
async function clickNavLink(page: import('@playwright/test').Page, name: string) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle.isVisible()) {
    await toggle.click()
  }
  await page.getByRole('navigation').getByRole('link', { name }).click()
}

// Requested in PR #22 review (FramePongrit): screenshots alone don't fail the test on overflow,
// so assert it directly rather than relying on someone noticing it in an image.
async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, screen: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `${screen} has horizontal overflow`).toBeLessThanOrEqual(clientWidth)
}

test('capture Login, Change Password, Staff Ticket Queue, Staff Ticket Detail, and User Management screenshots', async ({
  page,
  request,
}, testInfo) => {
  const viewport = testInfo.project.name
  const marker = `Visual3 ${Date.now()}-${viewport}`

  // Seed a Ticket via the API (not the UI) so the Queue/Detail screenshots always have something
  // to show, regardless of what other specs have left behind in the shared dev database.
  await request.post('http://localhost:4000/api/auth/login', {
    data: { email: 'michael.brown@example.com', password: 'DevPass123!' },
  })
  const categories = await (await request.get('http://localhost:4000/api/categories')).json()
  const systems = await (await request.get('http://localhost:4000/api/related-systems')).json()
  await request.post('http://localhost:4000/api/tickets', {
    data: {
      categoryId: categories[0].id,
      relatedSystemId: systems[0].id,
      summary: marker,
      description: 'Seed ticket for the Lab 3 visual checklist screenshots.',
      requestedPriority: 'MEDIUM',
    },
  })

  // Every seeded Requester's mustChangePassword flag gets permanently cleared the first time any
  // spec drives them through a real browser login+change (the flag never resets itself, and
  // reseeding can't restore it once the password is for-real changed -- see tests.md's Known
  // Limitations). Rather than depend on any seeded account still having mustChangePassword: true
  // by the time this spec runs in a full-suite pass, create a dedicated throwaway Requester via
  // the Administrator API, fresh every run.
  const changePasswordEmail = `visual-checklist-${Date.now()}-${viewport}@example.com`
  await request.post('http://localhost:4000/api/auth/login', {
    data: { email: 'taylor.admin@example.com', password: 'DevPass123!' },
  })
  await request.post('http://localhost:4000/api/admin/users', {
    data: {
      name: 'Visual Checklist User',
      email: changePasswordEmail,
      role: 'REQUESTER',
      isActive: true,
      initialPassword: 'DevPass123!',
    },
  })

  // 1. Login.
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Login')
  await page.screenshot({ path: `artifacts/lab-03/screenshots/login/${viewport}.png`, fullPage: true })

  // 2. Change Password -- reached via a real forced first login. Screenshotting the form itself
  // doesn't require submitting it, so this throwaway account is never actually changed either.
  await page.getByLabel('Email address').fill(changePasswordEmail)
  await page.getByLabel('Password').fill('DevPass123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/change-password')
  await expect(page.getByRole('heading', { name: 'Change Your Password' })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Change Password')
  await page.screenshot({ path: `artifacts/lab-03/screenshots/change-password/${viewport}.png`, fullPage: true })

  // 3. Staff Ticket Queue -- log in as IT Staff (no forced password change).
  await page.goto('/login')
  await page.getByLabel('Email address').fill('carlos.mendez@example.com')
  await page.getByLabel('Password').fill('DevPass123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/')

  await clickNavLink(page, 'My Queue')
  await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Staff Ticket Queue')
  await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-queue/${viewport}.png`, fullPage: true })

  // 4. Staff Ticket Detail. The Queue renders both a desktop table and a mobile card layout at
  // once (one hidden via CSS depending on viewport), each with its own link to
  // /staff/tickets/:id -- scope to :visible so this doesn't try to click the hidden one.
  await page.locator('a[href^="/staff/tickets/"]:visible').first().click()
  await expect(page.getByRole('heading', { name: /^TKT-/ })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'Staff Ticket Detail')
  await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/${viewport}.png`, fullPage: true })

  // 5. User Management -- log in as Administrator.
  const toggle = page.getByRole('button', { name: 'Toggle navigation menu' })
  if (await toggle.isVisible()) await toggle.click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL('/login')
  await page.getByLabel('Email address').fill('taylor.admin@example.com')
  await page.getByLabel('Password').fill('DevPass123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('/')

  await clickNavLink(page, 'Users')
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
  await expectNoHorizontalOverflow(page, 'User Management')
  await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/${viewport}.png`, fullPage: true })
})
