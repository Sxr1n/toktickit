import { expect, test } from '@playwright/test'

// Only the "desktop" project runs this file (matches the Lab 2 convention).
//
// AppShell/nav are not yet auth-aware (that lands in Issue 28 alongside the Requester-page
// migration), so there is no Logout button to click yet -- logout's server-side invalidation is
// already covered directly by server/tests/lab-03/auth.api.test.ts (API-06). What's covered here
// is what's real today: an unauthenticated direct-access redirect, a full login, and the
// mandatory first-login password change.

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
  }) => {
    const newPassword = `E2ePass${Date.now()}!`

    await page.goto('/login')
    await page.getByLabel('Email address').fill('jennifer.anderson@example.com')
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

    // Restore the seeded account back to its documented state so re-runs and other suites keep
    // seeing mustChangePassword: true for Jennifer, matching the seed's own promise.
    await page.request.post('http://localhost:4000/api/auth/change-password', {
      data: { currentPassword: newPassword, newPassword: 'DevPass123!' },
      headers: { 'Content-Type': 'application/json' },
    })
  })
})
