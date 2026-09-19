import { expect, test } from '@playwright/test'

// Only the "desktop" project runs this file - the functional flow doesn't need to repeat per
// viewport (matches the Lab 2 convention).

test.describe('E2E-03: IT Staff Ticket flow (AC-13, AC-14, AC-15, AC-17)', () => {
  test('IT Staff claims a Ticket, sets IT Priority, transitions status, posts a Public Comment and an Internal Note', async ({
    page,
    request,
  }) => {
    const marker = `E2E-staff ${Date.now()}`

    // Seed a fresh, unclaimed Ticket directly via the API as a Requester, so this flow can focus
    // purely on IT Staff's browser actions -- every seeded Requester has mustChangePassword: true,
    // and logging in via the API (unlike the UI) never detours through Change Password, so this
    // never touches that account's password/flag state.
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
        description: 'Seed ticket for the IT Staff E2E flow, created via the API.',
        requestedPriority: 'MEDIUM',
      },
    })

    // IT Staff has no forced password change (mustChangePassword: false), so login is a single step.
    await page.goto('/login')
    await page.getByLabel('Email address').fill('carlos.mendez@example.com')
    await page.getByLabel('Password').fill('DevPass123!')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('/')

    await page.getByRole('navigation').getByRole('link', { name: 'My Queue' }).click()
    await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()

    const row = page.locator('tr', { hasText: marker })
    await row.getByRole('link').click()
    await expect(page.getByRole('heading', { name: /^TKT-/ })).toBeVisible()

    // Claim: Ticket Owner select lists real names, values are user ids.
    const ownerSelect = page.getByLabel('Ticket Owner')
    const carlosOptionValue = await ownerSelect.locator('option', { hasText: 'Carlos Mendez' }).getAttribute('value')
    await ownerSelect.selectOption(carlosOptionValue!)
    await expect(ownerSelect).toHaveValue(carlosOptionValue!)

    // IT Priority, independent of Requested Priority.
    await page.getByLabel('IT Priority').selectOption('HIGH')
    await expect(page.getByLabel('IT Priority')).toHaveValue('HIGH')

    // Status transition: New -> Open is permitted (BR-21).
    await page.getByLabel('Current Status').selectOption('OPEN')
    await expect(page.getByLabel('Current Status')).toHaveValue('OPEN')

    // Public Comment (shared with the Requester).
    await page.getByLabel('Add a comment').fill('Looking into this now.')
    await page.getByRole('button', { name: 'Post Comment' }).click()
    await expect(page.getByText('Looking into this now.')).toBeVisible()

    // Internal Note (staff-only).
    await page.getByLabel(/Add an Internal Note/).fill('Internal triage notes for the E2E run.')
    await page.getByRole('button', { name: 'Post Internal Note' }).click()
    await expect(page.getByText('Internal triage notes for the E2E run.')).toBeVisible()

    // Reload and confirm every change actually persisted server-side, not just an optimistic
    // client-side illusion.
    await page.reload()
    await expect(page.getByLabel('Ticket Owner')).toHaveValue(carlosOptionValue!)
    await expect(page.getByLabel('IT Priority')).toHaveValue('HIGH')
    await expect(page.getByLabel('Current Status')).toHaveValue('OPEN')
    await expect(page.getByText('Looking into this now.')).toBeVisible()
    await expect(page.getByText('Internal triage notes for the E2E run.')).toBeVisible()
  })
})
