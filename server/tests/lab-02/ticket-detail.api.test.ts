import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'

let requesterAId: number
let requesterBId: number
let ticketOwnedByAId: number

beforeAll(async () => {
  const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 })
  requesterAId = requesters[0].id
  requesterBId = requesters[1].id
  const category = await prisma.category.findFirstOrThrow()
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `SEED-DETAIL-${Math.random().toString(36).slice(2, 8)}`,
      requesterId: requesterAId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: 'Ticket owned by Requester A for detail test',
      description: 'Seed ticket to verify ownership-scoped Ticket Detail retrieval.',
      requestedPriority: 'LOW',
    },
  })
  ticketOwnedByAId = ticket.id
})

describe('GET /api/tickets/:id (API-08)', () => {
  it("returns the owner's Ticket with its attachments array", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketOwnedByAId}`)
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(ticketOwnedByAId)
    expect(Array.isArray(res.body.attachments)).toBe(true)
  })
})

describe('GET /api/tickets/:id - ownership (API-09)', () => {
  it("does not return a Ticket owned by a different Requester", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketOwnedByAId}`)
      .set('X-Dev-Requester-Id', String(requesterBId))

    expect(res.status).toBe(404)
  })
})
