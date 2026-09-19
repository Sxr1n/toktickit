import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let requesterId: number
let requesterCookie: string
let categoryId: number
let relatedSystemId: number

beforeAll(async () => {
  const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
  const category = await prisma.category.findFirstOrThrow()
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  requesterId = requester.id
  requesterCookie = await loginAs(app, requester.email)
  categoryId = category.id
  relatedSystemId = relatedSystem.id
})

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    categoryId,
    relatedSystemId,
    summary: 'Laptop battery drains quickly',
    description: 'Battery drains fast even when idle, started after last update.',
    requestedPriority: 'MEDIUM',
    ...overrides,
  }
}

describe('POST /api/tickets (API-01)', () => {
  it('creates a Ticket for a valid payload and returns a unique Ticket Number', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', requesterCookie)
      .send(validPayload())

    expect(res.status).toBe(201)
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/)
    expect(res.body.currentStatus).toBe('NEW')
    expect(res.body.requesterId).toBe(requesterId)
  })

  it('rejects requests without a session cookie', async () => {
    const res = await request(app).post('/api/tickets').send(validPayload())
    expect(res.status).toBe(401)
  })
})

describe('POST /api/tickets - validation (API-02, API-03)', () => {
  it('rejects a Ticket missing Summary (AC-04)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', requesterCookie)
      .send(validPayload({ summary: '' }))

    expect(res.status).toBe(400)
    expect(res.body.fields).toHaveProperty('summary')
  })

  it('rejects a Ticket with a too-short Description (AC-05)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Cookie', requesterCookie)
      .send(validPayload({ description: 'short' }))

    expect(res.status).toBe(400)
    expect(res.body.fields).toHaveProperty('description')
  })
})
