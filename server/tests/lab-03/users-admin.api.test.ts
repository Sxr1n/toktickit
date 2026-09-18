import bcrypt from 'bcryptjs'
import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

const DEV_PASSWORD = 'DevPass123!'

let adminCookie: string
let requesterCookie: string

async function createUser(overrides: {
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  isActive?: boolean
  mustChangePassword?: boolean
}) {
  const email = `admin-test-${Math.random().toString(36).slice(2, 10)}@example.com`
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10)
  return prisma.user.create({
    data: {
      name: 'Admin Test User',
      email,
      passwordHash,
      role: overrides.role,
      isActive: overrides.isActive ?? true,
      mustChangePassword: overrides.mustChangePassword ?? false,
    },
  })
}

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'ADMINISTRATOR' } })
  adminCookie = await loginAs(app, admin.email)

  const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
  requesterCookie = await loginAs(app, requester.email)
})

describe('GET /api/admin/users - role gate', () => {
  it('rejects a Requester with 403', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', requesterCookie)
    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get('/api/admin/users')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/admin/users (API-34)', () => {
  it('searches by name or email, case-insensitive', async () => {
    const marker = `SearchMarker${Date.now()}`
    const user = await createUser({ role: 'REQUESTER' })
    await prisma.user.update({ where: { id: user.id }, data: { name: `${marker} Person` } })

    const res = await request(app).get('/api/admin/users').query({ search: marker.toLowerCase() }).set('Cookie', adminCookie)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].id).toBe(user.id)
  })

  it('filters by role', async () => {
    const res = await request(app).get('/api/admin/users').query({ role: 'ADMINISTRATOR' }).set('Cookie', adminCookie)

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
    expect(res.body.every((u: { role: string }) => u.role === 'ADMINISTRATOR')).toBe(true)
  })

  it('returns no pagination metadata -- a plain array', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', adminCookie)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /api/admin/users (API-35)', () => {
  it('creates a user with a temporary password that forces Change Password at next login', async () => {
    const email = `create-test-${Date.now()}@example.com`

    const createRes = await request(app).post('/api/admin/users').set('Cookie', adminCookie).send({
      name: 'New Hire',
      email,
      role: 'REQUESTER',
      isActive: true,
      initialPassword: DEV_PASSWORD,
    })

    expect(createRes.status).toBe(201)
    expect(createRes.body.mustChangePassword).toBe(true)

    const loginRes = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD })
    expect(loginRes.status).toBe(200)
    expect(loginRes.body.mustChangePassword).toBe(true)
  })

  it('rejects an initial password that fails the password rules', async () => {
    const res = await request(app).post('/api/admin/users').set('Cookie', adminCookie).send({
      name: 'Weak Password User',
      email: `weak-${Date.now()}@example.com`,
      role: 'REQUESTER',
      isActive: true,
      initialPassword: 'weak',
    })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('Duplicate email is rejected (API-36)', () => {
  it('rejects creating a user with an existing email, case-insensitively', async () => {
    const existing = await createUser({ role: 'REQUESTER' })

    const res = await request(app).post('/api/admin/users').set('Cookie', adminCookie).send({
      name: 'Duplicate Email',
      email: existing.email.toUpperCase(),
      role: 'REQUESTER',
      isActive: true,
      initialPassword: DEV_PASSWORD,
    })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })

  it('rejects editing a user to an email already used by someone else', async () => {
    const userA = await createUser({ role: 'REQUESTER' })
    const userB = await createUser({ role: 'REQUESTER' })

    const res = await request(app)
      .patch(`/api/admin/users/${userB.id}`)
      .set('Cookie', adminCookie)
      .send({ email: userA.email.toUpperCase() })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })
})

describe('PATCH /api/admin/users/:id (API-37)', () => {
  it('edits name, email, role, and isActive', async () => {
    const user = await createUser({ role: 'REQUESTER' })
    const newEmail = `edited-${Date.now()}@example.com`

    const res = await request(app).patch(`/api/admin/users/${user.id}`).set('Cookie', adminCookie).send({
      name: 'Edited Name',
      email: newEmail,
      role: 'IT_STAFF',
      isActive: false,
    })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Edited Name')
    expect(res.body.email).toBe(newEmail)
    expect(res.body.role).toBe('IT_STAFF')
    expect(res.body.isActive).toBe(false)
  })

  it('rejects a PATCH with no fields', async () => {
    const user = await createUser({ role: 'REQUESTER' })
    const res = await request(app).patch(`/api/admin/users/${user.id}`).set('Cookie', adminCookie).send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for a user id that does not exist', async () => {
    const res = await request(app).patch('/api/admin/users/9999999').set('Cookie', adminCookie).send({ name: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/users/:id/reset-password (API-38)', () => {
  it("resets a user's password and sets mustChangePassword", async () => {
    const user = await createUser({ role: 'REQUESTER', mustChangePassword: false })
    const newPassword = 'BrandNewPass9!'

    const res = await request(app)
      .post(`/api/admin/users/${user.id}/reset-password`)
      .set('Cookie', adminCookie)
      .send({ newPassword })

    expect(res.status).toBe(200)

    const loginRes = await request(app).post('/api/auth/login').send({ email: user.email, password: newPassword })
    expect(loginRes.status).toBe(200)
    expect(loginRes.body.mustChangePassword).toBe(true)
  })

  it('rejects a new password that fails the password rules', async () => {
    const user = await createUser({ role: 'REQUESTER' })
    const res = await request(app)
      .post(`/api/admin/users/${user.id}/reset-password`)
      .set('Cookie', adminCookie)
      .send({ newPassword: 'weak' })
    expect(res.status).toBe(400)
  })
})

describe('Self-deactivation is always rejected (API-39)', () => {
  it('rejects an Administrator deactivating their own account, unconditionally', async () => {
    // A dedicated throwaway Administrator, not the shared seeded taylor.admin -- this assertion
    // must hold true regardless of how many other active Administrators exist.
    const self = await createUser({ role: 'ADMINISTRATOR' })
    const selfCookie = await loginAs(app, self.email)

    const res = await request(app)
      .patch(`/api/admin/users/${self.id}`)
      .set('Cookie', selfCookie)
      .send({ isActive: false })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SELF_DEACTIVATION')
  })
})

describe('The last active Administrator cannot lose Administrator status (API-40)', () => {
  it('rejects the sole active Administrator changing their own role away from Administrator', async () => {
    const soleAdmin = await createUser({ role: 'ADMINISTRATOR' })
    const soleAdminCookie = await loginAs(app, soleAdmin.email)

    // Every OTHER currently-active Administrator in this database (the seeded taylor.admin, plus
    // any throwaway admins other tests in this file created) is temporarily deactivated so
    // soleAdmin genuinely is the last one -- restored in the finally block no matter what.
    const otherActiveAdmins = await prisma.user.findMany({
      where: { role: 'ADMINISTRATOR', isActive: true, id: { not: soleAdmin.id } },
    })

    try {
      await prisma.user.updateMany({
        where: { id: { in: otherActiveAdmins.map((u) => u.id) } },
        data: { isActive: false },
      })

      const res = await request(app)
        .patch(`/api/admin/users/${soleAdmin.id}`)
        .set('Cookie', soleAdminCookie)
        .send({ role: 'IT_STAFF' })

      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('LAST_ADMINISTRATOR')
    } finally {
      await prisma.user.updateMany({
        where: { id: { in: otherActiveAdmins.map((u) => u.id) } },
        data: { isActive: true },
      })
    }
  })

  it('allows deactivating an Administrator when another active Administrator remains', async () => {
    const adminA = await createUser({ role: 'ADMINISTRATOR' })
    const adminB = await createUser({ role: 'ADMINISTRATOR' })
    const adminBCookie = await loginAs(app, adminB.email)

    const res = await request(app)
      .patch(`/api/admin/users/${adminA.id}`)
      .set('Cookie', adminBCookie)
      .send({ isActive: false })

    expect(res.status).toBe(200)
    expect(res.body.isActive).toBe(false)
  })
})

describe('POST /api/admin/users - invalid role (API-41)', () => {
  it('rejects a missing role', async () => {
    const res = await request(app).post('/api/admin/users').set('Cookie', adminCookie).send({
      name: 'No Role',
      email: `no-role-${Date.now()}@example.com`,
      isActive: true,
      initialPassword: DEV_PASSWORD,
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects an invalid role value', async () => {
    const res = await request(app).post('/api/admin/users').set('Cookie', adminCookie).send({
      name: 'Bad Role',
      email: `bad-role-${Date.now()}@example.com`,
      role: 'SUPERUSER',
      isActive: true,
      initialPassword: DEV_PASSWORD,
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})
