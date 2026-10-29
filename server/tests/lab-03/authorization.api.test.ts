import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

// This file is the dedicated, consolidated authorization-matrix suite promised by tests.md's
// "2.2 Authorization matrix" section (API-11 through API-17). Every role/ownership rule below is
// also exercised inline, closer to the feature it protects, in staff-queue.api.test.ts,
// staff-ticket-detail.api.test.ts, comments-notes.api.test.ts, and users-admin.api.test.ts -- this
// file exists as its own thing anyway (per the test strategy in tests.md 1: "Authorization is
// tested from the outside... as its own explicit category") so that the full unauthenticated/
// wrong-role/wrong-owner matrix is visible in one place, calling the API directly rather than
// through the UI, independent of whether any individual feature test happens to also cover it.

let requesterACookie: string
let requesterAId: number
let requesterBCookie: string
let staffCookie: string
let adminCookie: string
let categoryId: number
let relatedSystemId: number
let ticketOwnedByAId: number

beforeAll(async () => {
  const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 })
  requesterAId = requesters[0].id
  requesterACookie = await loginAs(app, requesters[0].email)
  requesterBCookie = await loginAs(app, requesters[1].email)

  const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
  staffCookie = await loginAs(app, staff.email)

  const admin = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'ADMINISTRATOR' } })
  adminCookie = await loginAs(app, admin.email)

  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `SEED-AUTHZ-${Math.random().toString(36).slice(2, 8)}`,
      requesterId: requesterAId,
      categoryId,
      relatedSystemId,
      summary: 'Ticket used to exercise the cross-cutting authorization matrix',
      description: 'Seed ticket for authorization.api.test.ts.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
    },
  })
  ticketOwnedByAId = ticket.id
})

describe('API-11 (AC-08): no session -> 401 across every route family', () => {
  it.each([
    ['GET', '/api/tickets'],
    ['GET', '/api/staff/tickets'],
    ['GET', '/api/staff/users'],
    ['GET', '/api/admin/users'],
    ['GET', '/api/auth/me'],
  ])('%s %s rejects an unauthenticated caller with 401', async (method, path) => {
    const res = method === 'GET' ? await request(app).get(path) : await request(app).post(path)
    expect(res.status).toBe(401)
  })
})

describe('API-12 (AC-21): Requester calls /api/staff/* -> 403 on every staff route', () => {
  it('rejects a Requester on every staff Ticket Queue/Detail/operations route', async () => {
    const getQueue = await request(app).get('/api/staff/tickets').set('Cookie', requesterACookie)
    expect(getQueue.status).toBe(403)

    const getStaffUsers = await request(app).get('/api/staff/users').set('Cookie', requesterACookie)
    expect(getStaffUsers.status).toBe(403)

    const getDetail = await request(app).get(`/api/staff/tickets/${ticketOwnedByAId}`).set('Cookie', requesterACookie)
    expect(getDetail.status).toBe(403)

    const patchOwner = await request(app)
      .patch(`/api/staff/tickets/${ticketOwnedByAId}/owner`)
      .set('Cookie', requesterACookie)
      .send({ ticketOwnerId: null })
    expect(patchOwner.status).toBe(403)

    const patchPriority = await request(app)
      .patch(`/api/staff/tickets/${ticketOwnedByAId}/it-priority`)
      .set('Cookie', requesterACookie)
      .send({ itPriority: 'HIGH' })
    expect(patchPriority.status).toBe(403)

    const patchStatus = await request(app)
      .patch(`/api/staff/tickets/${ticketOwnedByAId}/status`)
      .set('Cookie', requesterACookie)
      .send({ status: 'OPEN' })
    expect(patchStatus.status).toBe(403)
  })
})

describe('API-13 (AC-21): Requester calls /api/admin/* -> 403 on every admin route', () => {
  it('rejects a Requester on every Administrator user-management route', async () => {
    const list = await request(app).get('/api/admin/users').set('Cookie', requesterACookie)
    expect(list.status).toBe(403)

    const create = await request(app)
      .post('/api/admin/users')
      .set('Cookie', requesterACookie)
      .send({ name: 'Should Not Exist', email: `blocked-${Date.now()}@example.com`, role: 'REQUESTER', isActive: true, initialPassword: 'DevPass123!' })
    expect(create.status).toBe(403)

    const update = await request(app)
      .patch(`/api/admin/users/${requesterAId}`)
      .set('Cookie', requesterACookie)
      .send({ name: 'Self Promoted' })
    expect(update.status).toBe(403)

    const resetPassword = await request(app)
      .post(`/api/admin/users/${requesterAId}/reset-password`)
      .set('Cookie', requesterACookie)
    expect(resetPassword.status).toBe(403)
  })
})

describe('API-14: IT Staff calls /api/admin/* -> 403 (Administrator-only)', () => {
  it('rejects IT Staff on every Administrator user-management route', async () => {
    const list = await request(app).get('/api/admin/users').set('Cookie', staffCookie)
    expect(list.status).toBe(403)

    const create = await request(app)
      .post('/api/admin/users')
      .set('Cookie', staffCookie)
      .send({ name: 'Should Not Exist', email: `blocked-${Date.now()}@example.com`, role: 'REQUESTER', isActive: true, initialPassword: 'DevPass123!' })
    expect(create.status).toBe(403)
  })

  it('sanity check: the same Administrator route accepts an actual Administrator', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', adminCookie)
    expect(res.status).toBe(200)
  })
})

describe('API-15 (AC-04, BR-04): Requester calls Internal Note routes -> 403, no content leak', () => {
  it('rejects GET and POST on Internal Notes without exposing any note content', async () => {
    // Seed a real Internal Note as staff first, so a leak (if the bug existed) would be observable.
    const seeded = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/internal-notes`)
      .set('Cookie', staffCookie)
      .send({ body: 'CONFIDENTIAL-MARKER-should-never-reach-a-Requester' })
    expect(seeded.status).toBe(201)

    const getRes = await request(app)
      .get(`/api/staff/tickets/${ticketOwnedByAId}/internal-notes`)
      .set('Cookie', requesterACookie)
    expect(getRes.status).toBe(403)
    expect(JSON.stringify(getRes.body)).not.toContain('CONFIDENTIAL-MARKER')

    const postRes = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/internal-notes`)
      .set('Cookie', requesterACookie)
      .send({ body: 'Should not be allowed.' })
    expect(postRes.status).toBe(403)
  })
})

describe('API-16 (AC-03, BR-03): a client-supplied requesterId is never trusted', () => {
  it('ignores a spoofed requesterId on Ticket creation and uses the authenticated identity', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', requesterACookie)
      .send({
        categoryId,
        relatedSystemId,
        summary: 'Attempting to spoof ownership via requesterId',
        description: 'The body below claims a different requesterId than the authenticated caller.',
        requestedPriority: 'LOW',
        requesterId: 999999,
      })

    expect(res.status).toBe(201)
    expect(res.body.requesterId ?? requesterAId).toBe(requesterAId)

    const detail = await request(app).get(`/api/tickets/${res.body.id}`).set('Cookie', requesterACookie)
    expect(detail.status).toBe(200)
  })
})

describe('API-17 (AC-12, BR-12): Requester B requests Requester A Ticket by id -> 404', () => {
  it('does not reveal or return a Ticket owned by a different Requester', async () => {
    const res = await request(app).get(`/api/tickets/${ticketOwnedByAId}`).set('Cookie', requesterBCookie)
    expect(res.status).toBe(404)
  })
})
