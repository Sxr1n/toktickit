import { expect, test } from '@playwright/test'

// Only the "desktop" project runs this file (matches the Lab 2 convention).
//
// Covers: an unauthenticated direct-access redirect, a full login, and the mandatory first-login
// password change. Logout's server-side invalidation is covered directly by
// server/tests/lab-03/auth.api.test.ts (API-06).

test.describe('E2E-01: direct access blocked while unauthenticated (AC-08)', () => {
  test('visiting a protected route with no session redirects to Login', async ({ page }) => {
    await page.goto('/change-password')
    await page.waitForURL('/login')
    await expect(page.getByRole('heading', { name: 'TokTickIT' })).toBeVisible()
  })
})

test.describe('E2E-02: first login forces a password change (AC-01, AC-02)', () => {
  test('logging in with a temporary password redirects to Change Password, and only reaches the app after a valid change', async ({
    page,
    request,
  }) => {
    const newPassword = `E2ePass${Date.now()}!`

    // A dedicated throwaway Requester, created fresh via the Administrator API (Issue 31), rather
    // than a shared seeded account -- every seeded Requester's mustChangePassword flag gets
    // permanently cleared the first time ANY spec drives it through a real browser login+change,
    // and reseeding can't restore it once the password is for-real changed (see tests.md's Known
    // Limitations). This was a real, repeatedly-hit flakiness source before this fix.
    const email = `e2e-auth-${Date.now()}@example.com`
    await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'taylor.admin@example.com', password: 'DevPass123!' },
    })
    await request.post('http://localhost:4000/api/admin/users', {
      data: { name: 'E2E Auth User', email, role: 'REQUESTER', isActive: true, initialPassword: 'DevPass123!' },
    })

    await page.goto('/login')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill('DevPass123!')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.waitForURL('/change-password')
    await expect(page.getByRole('heading', { name: 'Change Your Password' })).toBeVisible()

    await page.getByLabel('Current (temporary) password').fill('DevPass123!')
    await page.getByLabel('New password', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirm new password').fill(newPassword)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.waitForURL('/')
    await expect(page.getByRole('heading', { name: 'TokTickIT IT Service Desk' })).toBeVisible()
  })
})
