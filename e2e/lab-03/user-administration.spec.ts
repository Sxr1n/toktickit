import { expect, test } from '@playwright/test'

// Only the "desktop" project runs this file (matches the Lab 2 convention).

test.describe('E2E-04: Administrator creates a user, forced through Change Password (AC-18, AC-19)', () => {
  test('a newly-created user must change their temporary password at first login', async ({ page }) => {
    // A throwaway user, never touching any shared seeded account -- no password/flag drift risk.
    const email = `e2e-newuser-${Date.now()}@example.com`
    const tempPassword = 'TempPass9!'
    const finalPassword = 'FinalPass9!'

    await page.goto('/login')
    await page.getByLabel('Email address').fill('taylor.admin@example.com')
    await page.getByLabel('Password').fill('DevPass123!')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')

    await page.getByRole('navigation').getByRole('link', { name: 'Users' }).click()
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()

    await page.getByRole('button', { name: 'New User' }).click()
    await page.getByLabel('Name').fill('E2E New User')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Initial Password').fill(tempPassword)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('E2E New User was created.')).toBeVisible()

    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('/login')

    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(tempPassword)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.waitForURL('/change-password')
    await expect(page.getByRole('heading', { name: 'Change Your Password' })).toBeVisible()

    await page.getByLabel('Current (temporary) password').fill(tempPassword)
    await page.getByLabel('New password', { exact: true }).fill(finalPassword)
    await page.getByLabel('Confirm new password').fill(finalPassword)
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.waitForURL('/')
    await expect(page.getByText('E2E New User (REQUESTER)')).toBeVisible()
  })
})
