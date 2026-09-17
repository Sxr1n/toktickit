import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'

let requesterAId: number
let requesterBId: number
let categoryId: number
let relatedSystemId: number

beforeAll(async () => {
  const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 })
  requesterAId = requesters[0].id
  requesterBId = requesters[1].id
  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id

  await prisma.ticket.deleteMany({ where: { requesterId: { in: [requesterAId, requesterBId] } } })

  const seedTickets = [
    { requesterId: requesterAId, summary: 'Requester A ticket one about a laptop' },
    { requesterId: requesterAId, summary: 'Requester A ticket two about wifi' },
    { requesterId: requesterBId, summary: 'Requester B ticket about email' },
  ]
  for (const t of seedTickets) {
    await prisma.ticket.create({
      data: {
        ticketNumber: `SEED-${t.requesterId}-${Math.random().toString(36).slice(2, 8)}`,
        requesterId: t.requesterId,
        categoryId,
        relatedSystemId,
        summary: t.summary,
        description: 'Seed description for my-tickets test, long enough to pass validation.',
        requestedPriority: 'MEDIUM',
      },
    })
  }
})

describe('GET /api/tickets (API-04)', () => {
  it('only returns the calling Requester\'s own Tickets', async () => {
    const res = await request(app).get('/api/tickets').set('X-Dev-Requester-Id', String(requesterAId))

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeGreaterThanOrEqual(2)
    expect(res.body.items.every((t: { summary: string }) => t.summary.startsWith('Requester A'))).toBe(true)
  })
})

describe('GET /api/tickets - search (API-05)', () => {
  it('matches Summary by keyword, case-insensitive', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .query({ search: 'WIFI' })
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].summary).toContain('wifi')
  })
})

describe('GET /api/tickets - pagination (API-06)', () => {
  it('returns pagination metadata and a bounded page size', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .query({ pageSize: 1, page: 1 })
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.pageSize).toBe(1)
    expect(res.body.totalItems).toBeGreaterThanOrEqual(2)
  })
})

describe('GET /api/tickets - invalid params (API-07)', () => {
  it('falls back to defaults for an out-of-range pageSize', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .query({ pageSize: 999 })
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(res.status).toBe(200)
    expect(res.body.pageSize).toBe(10)
  })
})
