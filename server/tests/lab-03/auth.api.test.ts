import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'

const DEV_PASSWORD = 'DevPass123!'
const SESSION_COOKIE_NAME = 'toktickit_session'

let testUserId: number
let testUserEmail: string

beforeAll(async () => {
  // A dedicated throwaway user for the destructive change-password test, so we never mutate the
  // shared seeded Jennifer Anderson row (other tests in this file rely on her mustChangePassword
  // staying true).
  testUserEmail = `auth-test-${Date.now()}@example.com`
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10)
  const user = await prisma.user.create({
    data: {
      name: 'Auth Test User',
      email: testUserEmail,
      passwordHash,
      role: 'REQUESTER',
      isActive: true,
      mustChangePassword: true,
    },
  })
  testUserId = user.id
})

afterAll(async () => {
  await prisma.user.delete({ where: { id: testUserId } })
})

function extractCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  const sessionCookie = cookies.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
  if (!sessionCookie) throw new Error('No session cookie in response')
  return sessionCookie.split(';')[0]
}

describe('POST /api/auth/login (API-01)', () => {
  it('authenticates a valid active user and sets a session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jennifer.anderson@example.com', password: DEV_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('REQUESTER')
    expect(res.body.email).toBe('jennifer.anderson@example.com')
    expect(res.headers['set-cookie']).toBeDefined()
    expect(extractCookie(res)).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=`))
  })
})

describe('POST /api/auth/login - failure cases (API-02, API-03, API-04)', () => {
  it('rejects a wrong password with a generic message (API-02)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jennifer.anderson@example.com', password: 'WrongPassword1!' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('rejects an inactive account with the identical response shape as a wrong password (API-03)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'former.employee@example.com', password: DEV_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('rejects an unknown email with the identical response shape (API-04)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody-here@example.com', password: DEV_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('mustChangePassword flag (API-05)', () => {
  it('round-trips mustChangePassword: true from login through GET /api/auth/me', async () => {
    // Uses the dedicated test user (mustChangePassword: true at creation) rather than a seeded
    // Requester, so this assertion never depends on -- or is broken by -- another suite (e.g. the
    // Playwright authentication spec) having since changed that seeded account's password.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: DEV_PASSWORD })
    expect(loginRes.body.mustChangePassword).toBe(true)

    const cookie = extractCookie(loginRes)
    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(meRes.status).toBe(200)
    expect(meRes.body.mustChangePassword).toBe(true)
  })
})

describe('POST /api/auth/logout (API-06)', () => {
  it('invalidates the session so the old cookie is rejected afterward', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'carlos.mendez@example.com', password: DEV_PASSWORD })
    const cookie = extractCookie(loginRes)

    const meBefore = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(meBefore.status).toBe(200)

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie)
    expect(logoutRes.status).toBe(200)

    const meAfter = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(meAfter.status).toBe(401)
  })
})

describe('Session expiry (API-07)', () => {
  it('rejects a token issued with a past expiry', async () => {
    const expiredToken = jwt.sign({ sub: testUserId, tv: 0 }, process.env.JWT_SECRET!, { expiresIn: -10 })
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE_NAME}=${expiredToken}`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me (API-08)', () => {
  it('returns 401 with no session', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns only the caller\'s own identity', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'taylor.admin@example.com', password: DEV_PASSWORD })
    const cookie = extractCookie(loginRes)

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('taylor.admin@example.com')
    expect(res.body.role).toBe('ADMINISTRATOR')
  })
})

describe('POST /api/auth/change-password (API-09, API-10)', () => {
  it('rejects a new password that fails the password rules (API-09)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: DEV_PASSWORD })
    const cookie = extractCookie(loginRes)

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: DEV_PASSWORD, newPassword: 'weak' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details.failures.length).toBeGreaterThan(0)
  })

  it('rejects the wrong current password (API-09)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: DEV_PASSWORD })
    const cookie = extractCookie(loginRes)

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'NotTheRealPassword1!', newPassword: 'BrandNewPass9!' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD')
  })

  it('accepts a valid change and clears mustChangePassword (API-10)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: DEV_PASSWORD })
    const cookie = extractCookie(loginRes)

    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: DEV_PASSWORD, newPassword: 'BrandNewPass9!' })
    expect(changeRes.status).toBe(200)

    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(meRes.body.mustChangePassword).toBe(false)

    // The new password now works for a fresh login.
    const reloginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: 'BrandNewPass9!' })
    expect(reloginRes.status).toBe(200)
  })
})
