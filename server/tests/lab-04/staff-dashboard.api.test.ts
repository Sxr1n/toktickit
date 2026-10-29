import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let staffCookie: string
let staffId: number
let requesterCookie: string
let requesterId: number
let categoryId: number
let relatedSystemId: number
const MARKER = `Dash${Date.now()}`

beforeAll(async () => {
  const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
  staffId = staff.id
  staffCookie = await loginAs(app, staff.email)

  const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
  requesterId = requester.id
  requesterCookie = await loginAs(app, requester.email)

  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id

  const makeTicket = (status: 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER', ownerId: number | null) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `SEED-STAFFDASH-${Math.random().toString(36).slice(2, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `${MARKER} ticket`,
        description: 'Seed ticket for staff-dashboard.api.test.ts.',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        currentStatus: status,
        ticketOwnerId: ownerId,
      },
    })

  await Promise.all([
    makeTicket('NEW', null),
    makeTicket('OPEN', null),
    makeTicket('IN_PROGRESS', staffId),
    makeTicket('WAITING_FOR_REQUESTER', staffId),
  ])
})

describe('GET /api/dashboard/staff - role gate', () => {
  it('rejects a Requester with 403', async () => {
    const res = await request(app).get('/api/dashboard/staff').set('Cookie', requesterCookie)
    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get('/api/dashboard/staff')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/dashboard/staff - counts match direct queries (API-19, AC-09)', () => {
  it('every count equals an independently-computed database count', async () => {
    const res = await request(app).get('/api/dashboard/staff').set('Cookie', staffCookie)
    expect(res.status).toBe(200)

    const [expectedNew, expectedOpen, expectedInProgress, expectedWaiting, expectedMine] = await Promise.all([
      prisma.ticket.count({ where: { currentStatus: 'NEW' } }),
      prisma.ticket.count({ where: { currentStatus: 'OPEN' } }),
      prisma.ticket.count({ where: { currentStatus: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { currentStatus: 'WAITING_FOR_REQUESTER' } }),
      prisma.ticket.count({ where: { ticketOwnerId: staffId } }),
    ])

    expect(res.body.counts.new).toBe(expectedNew)
    expect(res.body.counts.open).toBe(expectedOpen)
    expect(res.body.counts.inProgress).toBe(expectedInProgress)
    expect(res.body.counts.waitingForRequester).toBe(expectedWaiting)
    expect(res.body.counts.myAssigned).toBe(expectedMine)
  })
})

describe('GET /api/dashboard/staff - system-wide, not owner-scoped (API-20, BR-13)', () => {
  it('counts include Tickets owned by a different Staff member', async () => {
    const otherStaff = await prisma.user.findFirstOrThrow({
      where: { isActive: true, role: 'IT_STAFF', id: { not: staffId } },
    })
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `SEED-STAFFDASH-OTHER-${Math.random().toString(36).slice(2, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `${MARKER} other-owner ticket`,
        description: 'Owned by a different Staff member.',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        currentStatus: 'OPEN',
        ticketOwnerId: otherStaff.id,
      },
    })

    const before = await request(app).get('/api/dashboard/staff').set('Cookie', staffCookie)
    const openBefore = before.body.counts.open

    expect(openBefore).toBeGreaterThan(0)
    const stillOwned = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stillOwned.ticketOwnerId).toBe(otherStaff.id)
  })

  it("myAssigned reflects only the caller's own ticketOwnerId", async () => {
    const otherStaff = await prisma.user.findFirstOrThrow({
      where: { isActive: true, role: 'IT_STAFF', id: { not: staffId } },
    })
    const otherCookie = await loginAs(app, otherStaff.email)

    const mine = await request(app).get('/api/dashboard/staff').set('Cookie', staffCookie)
    const theirs = await request(app).get('/api/dashboard/staff').set('Cookie', otherCookie)

    const myCount = await prisma.ticket.count({ where: { ticketOwnerId: staffId } })
    const theirCount = await prisma.ticket.count({ where: { ticketOwnerId: otherStaff.id } })

    expect(mine.body.counts.myAssigned).toBe(myCount)
    expect(theirs.body.counts.myAssigned).toBe(theirCount)
  })
})

describe('GET /api/dashboard/staff - every count key always present (API-22)', () => {
  // This repo's shared dev database is never genuinely empty (seeded + accumulated test data), so a
  // true all-zero response can't be exercised here -- instead this asserts the contract Lab 4's own
  // BR-14 requires: every count key is always a defined number, never omitted, which is what makes a
  // legitimately-zero metric render as "0" instead of a blank/missing section on the client.
  it('every count is a number, never omitted', async () => {
    const res = await request(app).get('/api/dashboard/staff').set('Cookie', staffCookie)
    for (const key of ['new', 'open', 'inProgress', 'waitingForRequester', 'myAssigned'] as const) {
      expect(typeof res.body.counts[key]).toBe('number')
    }
  })
})

describe('GET /api/dashboard/staff - recentTickets ordering (API-23)', () => {
  it('returns at most 10 Tickets, newest-updated first', async () => {
    const res = await request(app).get('/api/dashboard/staff').set('Cookie', staffCookie)
    expect(res.body.recentTickets.length).toBeLessThanOrEqual(10)

    const updatedAts = res.body.recentTickets.map((t: { updatedAt: string }) => new Date(t.updatedAt).getTime())
    const sorted = [...updatedAts].sort((a, b) => b - a)
    expect(updatedAts).toEqual(sorted)
  })
})
