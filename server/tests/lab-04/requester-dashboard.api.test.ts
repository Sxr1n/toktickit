import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let requesterACookie: string
let requesterAId: number
let requesterBCookie: string
let requesterBId: number
let staffCookie: string
let categoryId: number
let relatedSystemId: number
const MARKER = `ReqDash${Date.now()}`

beforeAll(async () => {
  const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 })
  requesterAId = requesters[0].id
  requesterACookie = await loginAs(app, requesters[0].email)
  requesterBId = requesters[1].id
  requesterBCookie = await loginAs(app, requesters[1].email)

  const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
  staffCookie = await loginAs(app, staff.email)

  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id

  const makeTicket = (
    requesterId: number,
    status: 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED',
  ) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `SEED-REQDASH-${Math.random().toString(36).slice(2, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `${MARKER} ticket`,
        description: 'Seed ticket for requester-dashboard.api.test.ts.',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        currentStatus: status,
      },
    })

  await Promise.all([
    makeTicket(requesterAId, 'NEW'),
    makeTicket(requesterAId, 'OPEN'),
    makeTicket(requesterAId, 'IN_PROGRESS'),
    makeTicket(requesterAId, 'WAITING_FOR_REQUESTER'),
    makeTicket(requesterAId, 'RESOLVED'),
    makeTicket(requesterAId, 'CLOSED'),
    makeTicket(requesterBId, 'OPEN'),
  ])
})

describe('GET /api/dashboard/requester - role gate', () => {
  it('rejects IT Staff with 403', async () => {
    const res = await request(app).get('/api/dashboard/requester').set('Cookie', staffCookie)
    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get('/api/dashboard/requester')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/dashboard/requester - scoped to caller only (API-26, AC-08, BR-12)', () => {
  it("never includes another Requester's Tickets", async () => {
    const resA = await request(app).get('/api/dashboard/requester').set('Cookie', requesterACookie)
    const resB = await request(app).get('/api/dashboard/requester').set('Cookie', requesterBCookie)

    const idsInA = [...resA.body.recentTickets, ...resA.body.waitingForRequester].map((t: { id: number }) => t.id)
    const bTicket = await prisma.ticket.findFirstOrThrow({ where: { requesterId: requesterBId, summary: `${MARKER} ticket` } })
    expect(idsInA).not.toContain(bTicket.id)

    expect(resB.body.counts.open).toBeGreaterThanOrEqual(1)
  })
})

describe('GET /api/dashboard/requester - counts.open combines NEW + OPEN (API-27)', () => {
  it('matches a direct count of both statuses together', async () => {
    const res = await request(app).get('/api/dashboard/requester').set('Cookie', requesterACookie)
    const expectedOpen = await prisma.ticket.count({
      where: { requesterId: requesterAId, currentStatus: { in: ['NEW', 'OPEN'] } },
    })
    expect(res.body.counts.open).toBe(expectedOpen)
  })

  it('counts inProgress/resolved/closed independently', async () => {
    const res = await request(app).get('/api/dashboard/requester').set('Cookie', requesterACookie)
    const [expectedInProgress, expectedResolved, expectedClosed] = await Promise.all([
      prisma.ticket.count({ where: { requesterId: requesterAId, currentStatus: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { requesterId: requesterAId, currentStatus: 'RESOLVED' } }),
      prisma.ticket.count({ where: { requesterId: requesterAId, currentStatus: 'CLOSED' } }),
    ])
    expect(res.body.counts.inProgress).toBe(expectedInProgress)
    expect(res.body.counts.resolved).toBe(expectedResolved)
    expect(res.body.counts.closed).toBe(expectedClosed)
  })
})

describe('GET /api/dashboard/requester - attention-required callout (API-28)', () => {
  it('waitingForRequester contains only the caller\'s own WAITING_FOR_REQUESTER Tickets', async () => {
    const res = await request(app).get('/api/dashboard/requester').set('Cookie', requesterACookie)
    expect(res.body.waitingForRequester.length).toBeGreaterThan(0)
    for (const t of res.body.waitingForRequester) {
      expect(t.currentStatus).toBe('WAITING_FOR_REQUESTER')
    }
  })
})

describe('GET /api/dashboard/requester - caller with zero Tickets (API-29, AC-10)', () => {
  it('every count is 0 and both lists are empty for a freshly-created Requester', async () => {
    const email = `dash-empty-${Date.now()}@example.com`
    const admin = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'ADMINISTRATOR' } })
    const adminCookie = await loginAs(app, admin.email)
    await request(app)
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Dashboard Empty Requester', email, role: 'REQUESTER', isActive: true, initialPassword: 'DevPass123!' })
    const freshCookie = await loginAs(app, email)

    const res = await request(app).get('/api/dashboard/requester').set('Cookie', freshCookie)
    expect(res.status).toBe(200)
    expect(res.body.counts).toEqual({ open: 0, inProgress: 0, resolved: 0, closed: 0 })
    expect(res.body.waitingForRequester).toEqual([])
    expect(res.body.recentTickets).toEqual([])
  })
})
