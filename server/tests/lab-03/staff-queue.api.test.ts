import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let staffCookie: string
let requesterCookie: string
let requesterAId: number
let requesterBId: number
let staffId: number
let categoryId: number
let relatedSystemId: number

const MARKER = `Queue${Date.now()}`

beforeAll(async () => {
  const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 })
  requesterAId = requesters[0].id
  requesterBId = requesters[1].id
  requesterCookie = await loginAs(app, requesters[0].email)

  const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
  staffId = staff.id
  staffCookie = await loginAs(app, staff.email)

  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id

  const makeTicket = (overrides: {
    requesterId: number
    summary: string
    itPriority: 'LOW' | 'MEDIUM' | 'HIGH'
    currentStatus: 'NEW' | 'OPEN' | 'IN_PROGRESS'
    ticketOwnerId?: number | null
  }) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `SEED-QUEUE-${Math.random().toString(36).slice(2, 8)}`,
        requesterId: overrides.requesterId,
        categoryId,
        relatedSystemId,
        summary: overrides.summary,
        description: 'Seed ticket used to exercise the IT Staff Ticket Queue.',
        requestedPriority: 'MEDIUM',
        itPriority: overrides.itPriority,
        currentStatus: overrides.currentStatus,
        ticketOwnerId: overrides.ticketOwnerId ?? null,
      },
    })

  await Promise.all([
    makeTicket({ requesterId: requesterAId, summary: `${MARKER} from Requester A`, itPriority: 'LOW', currentStatus: 'NEW' }),
    makeTicket({ requesterId: requesterBId, summary: `${MARKER} from Requester B`, itPriority: 'HIGH', currentStatus: 'OPEN', ticketOwnerId: staffId }),
    makeTicket({ requesterId: requesterBId, summary: `${MARKER} unassigned high`, itPriority: 'HIGH', currentStatus: 'NEW' }),
  ])
})

describe('GET /api/staff/tickets - role gate', () => {
  it('rejects a Requester with 403', async () => {
    const res = await request(app).get('/api/staff/tickets').set('Cookie', requesterCookie)
    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get('/api/staff/tickets')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/staff/tickets (API-18)', () => {
  it("returns Tickets across multiple Requesters, not just the caller's own", async () => {
    const res = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    const requesterNames = res.body.items.map((t: { requesterName: string }) => t.requesterName)
    expect(new Set(requesterNames).size).toBeGreaterThanOrEqual(2)
  })
})

describe('GET /api/staff/tickets - search (API-19)', () => {
  it('matches Ticket Number or Summary, case-insensitive', async () => {
    const res = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER.toLowerCase(), pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(3)
  })
})

describe('GET /api/staff/tickets - filters (API-20)', () => {
  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, status: 'OPEN', pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    expect(res.body.items.every((t: { currentStatus: string }) => t.currentStatus === 'OPEN')).toBe(true)
  })

  it('filters by itPriority', async () => {
    const res = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, itPriority: 'HIGH', pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(2)
    expect(res.body.items.every((t: { itPriority: string }) => t.itPriority === 'HIGH')).toBe(true)
  })

  it('filters by ticketOwnerId=unassigned', async () => {
    const res = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, ticketOwnerId: 'unassigned', pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(2)
    expect(res.body.items.every((t: { ticketOwnerId: number | null }) => t.ticketOwnerId === null)).toBe(true)
  })

  it('combines filters conjunctively', async () => {
    const res = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, itPriority: 'HIGH', ticketOwnerId: 'unassigned', pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].summary).toBe(`${MARKER} unassigned high`)
  })

  it('rejects an invalid status value', async () => {
    const res = await request(app)
      .get('/api/staff/tickets')
      .query({ status: 'NOT_A_STATUS' })
      .set('Cookie', staffCookie)

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('GET /api/staff/tickets - sort (API-21)', () => {
  it('sorts by itPriority ascending and descending', async () => {
    const asc = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, sortBy: 'itPriority', sortDir: 'asc', pageSize: 10 })
      .set('Cookie', staffCookie)
    const desc = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, sortBy: 'itPriority', sortDir: 'desc', pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(asc.status).toBe(200)
    expect(desc.status).toBe(200)
    const ascPriorities = asc.body.items.map((t: { itPriority: string }) => t.itPriority)
    const descPriorities = desc.body.items.map((t: { itPriority: string }) => t.itPriority)
    expect(ascPriorities).toEqual([...descPriorities].reverse())
  })

  it('sorts by currentStatus ascending and descending', async () => {
    const asc = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, sortBy: 'currentStatus', sortDir: 'asc', pageSize: 10 })
      .set('Cookie', staffCookie)
    const desc = await request(app)
      .get('/api/staff/tickets')
      .query({ search: MARKER, sortBy: 'currentStatus', sortDir: 'desc', pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(asc.status).toBe(200)
    expect(desc.status).toBe(200)
    const ascStatuses = asc.body.items.map((t: { currentStatus: string }) => t.currentStatus)
    const descStatuses = desc.body.items.map((t: { currentStatus: string }) => t.currentStatus)
    expect(ascStatuses).toEqual([...descStatuses].reverse())
    // Sanity check this isn't vacuously true because every seeded status is identical.
    expect(new Set(ascStatuses).size).toBeGreaterThan(1)
  })
})

describe('GET /api/staff/tickets - pagination (API-22)', () => {
  it('returns exactly 10 items on page 1 and the remaining 1 on page 2, with no overlap', async () => {
    // The MARKER-tagged set only has 3 tickets, which can never actually exercise a page boundary
    // at pageSize=10 (flagged in PR #38 review). Seed a dedicated 11-ticket set instead.
    const pageMarker = `QueuePage${Date.now()}`
    await Promise.all(
      Array.from({ length: 11 }, (_, i) =>
        prisma.ticket.create({
          data: {
            ticketNumber: `SEED-QUEUE-PAGE-${Math.random().toString(36).slice(2, 8)}`,
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: `${pageMarker} ticket ${i}`,
            description: 'Seed ticket used to exercise Staff Ticket Queue pagination boundaries.',
            requestedPriority: 'MEDIUM',
            itPriority: 'MEDIUM',
            currentStatus: 'NEW',
          },
        }),
      ),
    )

    const page1 = await request(app)
      .get('/api/staff/tickets')
      .query({ search: pageMarker, page: 1, pageSize: 10 })
      .set('Cookie', staffCookie)
    const page2 = await request(app)
      .get('/api/staff/tickets')
      .query({ search: pageMarker, page: 2, pageSize: 10 })
      .set('Cookie', staffCookie)

    expect(page1.status).toBe(200)
    expect(page2.status).toBe(200)
    expect(page1.body.items).toHaveLength(10)
    expect(page2.body.items).toHaveLength(1)
    expect(page1.body.totalItems).toBe(11)
    const page1Ids = page1.body.items.map((t: { id: number }) => t.id)
    const page2Ids = page2.body.items.map((t: { id: number }) => t.id)
    expect(page1Ids.some((id: number) => page2Ids.includes(id))).toBe(false)
  })

  it('rejects an invalid pageSize with 400', async () => {
    const res = await request(app).get('/api/staff/tickets').query({ pageSize: 7 }).set('Cookie', staffCookie)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('GET /api/staff/users', () => {
  it('lists active IT Staff/Administrator users for the Ticket Owner filter', async () => {
    const res = await request(app).get('/api/staff/users').set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    expect(res.body.some((u: { id: number }) => u.id === staffId)).toBe(true)
    expect(res.body.every((u: { role: string }) => u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR')).toBe(true)
  })

  it('rejects a Requester with 403', async () => {
    const res = await request(app).get('/api/staff/users').set('Cookie', requesterCookie)
    expect(res.status).toBe(403)
  })
})
