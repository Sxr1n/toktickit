import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let requesterAId: number
let requesterBId: number
let requesterACookie: string
let requesterBCookie: string
let staffCookie: string
let ticketOwnedByAId: number

beforeAll(async () => {
  const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 })
  requesterAId = requesters[0].id
  requesterBId = requesters[1].id
  requesterACookie = await loginAs(app, requesters[0].email)
  requesterBCookie = await loginAs(app, requesters[1].email)

  const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
  staffCookie = await loginAs(app, staff.email)

  const category = await prisma.category.findFirstOrThrow()
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `SEED-COMMENTS-${Math.random().toString(36).slice(2, 8)}`,
      requesterId: requesterAId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: 'Ticket owned by Requester A for Public Comments tests',
      description: 'Seed ticket used to exercise Public Comments and confirm-resolved behavior.',
      requestedPriority: 'LOW',
      itPriority: 'LOW',
    },
  })
  ticketOwnedByAId = ticket.id
})

describe('POST /api/tickets/:id/public-comments (API-29)', () => {
  it('posts a valid comment and it appears in a subsequent GET', async () => {
    const postRes = await request(app)
      .post(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', requesterACookie)
      .send({ body: 'Any update on this issue?' })

    expect(postRes.status).toBe(201)
    expect(postRes.body.body).toBe('Any update on this issue?')
    expect(postRes.body.authorName).toBeDefined()

    const getRes = await request(app)
      .get(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', requesterACookie)

    expect(getRes.status).toBe(200)
    expect(getRes.body.some((c: { id: number }) => c.id === postRes.body.id)).toBe(true)
  })
})

describe('POST /api/tickets/:id/public-comments - validation (API-30)', () => {
  it('rejects an empty/whitespace-only body', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', requesterACookie)
      .send({ body: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects a body over 2000 characters', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', requesterACookie)
      .send({ body: 'x'.repeat(2001) })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('Public Comments ownership (API-31)', () => {
  it('returns 404 when a Requester posts on a Ticket they do not own', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', requesterBCookie)
      .send({ body: 'I should not be able to post here.' })

    expect(res.status).toBe(404)
  })

  it('returns 404 when a Requester reads Public Comments on a Ticket they do not own', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', requesterBCookie)

    expect(res.status).toBe(404)
  })
})

describe('Public Comment author and timestamp (API-33)', () => {
  it('ignores a client-supplied authorId/createdAt and always uses the server-verified caller', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', requesterACookie)
      .send({ body: 'Trying to spoof my identity', authorId: 999999, createdAt: '2000-01-01T00:00:00.000Z' })

    expect(res.status).toBe(201)
    expect(res.body.authorId).toBe(requesterAId)
    expect(new Date(res.body.createdAt).getFullYear()).not.toBe(2000)
  })
})

describe('IT Staff access to Public Comments (BR-26, part of API-32)', () => {
  it('IT Staff can post and read Public Comments on a Ticket they do not own', async () => {
    const postRes = await request(app)
      .post(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', staffCookie)
      .send({ body: 'Looking into this now.' })

    expect(postRes.status).toBe(201)
    expect(postRes.body.authorRole).toBe('IT_STAFF')

    const getRes = await request(app)
      .get(`/api/tickets/${ticketOwnedByAId}/public-comments`)
      .set('Cookie', staffCookie)

    expect(getRes.status).toBe(200)
    expect(getRes.body.some((c: { id: number }) => c.id === postRes.body.id)).toBe(true)
  })
})

describe('PATCH /api/tickets/:id/confirm-resolved', () => {
  it("sets requesterConfirmedResolved to true on the caller's own Ticket", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketOwnedByAId}/confirm-resolved`)
      .set('Cookie', requesterACookie)

    expect(res.status).toBe(200)
    expect(res.body.requesterConfirmedResolved).toBe(true)
  })

  it('returns 404 for a Ticket the caller does not own', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketOwnedByAId}/confirm-resolved`)
      .set('Cookie', requesterBCookie)

    expect(res.status).toBe(404)
  })
})
