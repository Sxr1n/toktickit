import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let staffCookie: string
let staffId: number
let requesterACookie: string
let requesterAId: number
let requesterBCookie: string
let categoryId: number
let relatedSystemId: number
let ticketOwnedByAId: number

async function makeTicket(requesterId: number) {
  return prisma.ticket.create({
    data: {
      ticketNumber: `SEED-ACTIONS-${Math.random().toString(36).slice(2, 8)}`,
      requesterId,
      categoryId,
      relatedSystemId,
      summary: 'Ticket used to exercise Actions Taken',
      description: 'Seed ticket for actions-taken.api.test.ts.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
    },
  })
}

beforeAll(async () => {
  const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
  staffId = staff.id
  staffCookie = await loginAs(app, staff.email)

  const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 })
  requesterAId = requesters[0].id
  requesterACookie = await loginAs(app, requesters[0].email)
  requesterBCookie = await loginAs(app, requesters[1].email)

  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id

  ticketOwnedByAId = (await makeTicket(requesterAId)).id
})

describe('POST /api/staff/tickets/:id/actions-taken (API-01)', () => {
  it('creates a valid Action Taken with the authenticated creator as Performed By', async () => {
    const res = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Checked the device logs.', result: 'Found a relevant error.', followUpRequired: false })

    expect(res.status).toBe(201)
    expect(res.body.ticketId).toBe(ticketOwnedByAId)
    expect(res.body.performedById).toBe(staffId)
    expect(res.body.followUpNote).toBeNull()
  })
})

describe('Follow-Up Required validation (API-02, API-03)', () => {
  it('rejects followUpRequired=true with no Follow-up Note', async () => {
    const res = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Investigated further.', result: 'Needs more time.', followUpRequired: true })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('discards a supplied Follow-up Note when followUpRequired is false', async () => {
    const res = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({
        description: 'Closed out this line of investigation.',
        result: 'No further action needed.',
        followUpRequired: false,
        followUpNote: 'This should be discarded.',
      })

    expect(res.status).toBe(201)
    expect(res.body.followUpNote).toBeNull()
  })

  it('accepts followUpRequired=true with a valid Follow-up Note', async () => {
    const res = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({
        description: 'Escalated to vendor support.',
        result: 'Vendor is investigating.',
        followUpRequired: true,
        followUpNote: 'Check back with vendor in 3 business days.',
      })

    expect(res.status).toBe(201)
    expect(res.body.followUpRequired).toBe(true)
    expect(res.body.followUpNote).toBe('Check back with vendor in 3 business days.')
  })
})

describe('Field length validation (API-04, API-05)', () => {
  it('rejects a Description/Result outside 3-2000 characters', async () => {
    const tooShort = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'ab', result: 'Valid result text here.', followUpRequired: false })
    expect(tooShort.status).toBe(400)

    const tooLong = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Valid description text.', result: 'x'.repeat(2001), followUpRequired: false })
    expect(tooLong.status).toBe(400)
  })

  it('rejects Attachment Notes over 500 characters', async () => {
    const res = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({
        description: 'Valid description text.',
        result: 'Valid result text.',
        followUpRequired: false,
        attachmentNotes: 'x'.repeat(501),
      })
    expect(res.status).toBe(400)
  })
})

describe('Server-derived fields (API-06)', () => {
  it('ignores a client-supplied performedById/createdAt and uses the authenticated caller instead', async () => {
    const res = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({
        description: 'Trying to spoof the author.',
        result: 'Should not work.',
        followUpRequired: false,
        performedById: 999999,
        createdAt: '2000-01-01T00:00:00.000Z',
      })

    expect(res.status).toBe(201)
    expect(res.body.performedById).toBe(staffId)
    expect(new Date(res.body.createdAt).getFullYear()).not.toBe(2000)
  })
})

describe('PATCH /api/staff/tickets/:id/actions-taken/:actionId - edit and stale-update detection (API-07, API-08, API-09)', () => {
  it('edits an existing Action Taken when updatedAt is current', async () => {
    const created = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Original description.', result: 'Original result.', followUpRequired: false })

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken/${created.body.id}`)
      .set('Cookie', staffCookie)
      .send({
        description: 'Edited description.',
        result: 'Edited result.',
        followUpRequired: false,
        updatedAt: created.body.updatedAt,
      })

    expect(res.status).toBe(200)
    expect(res.body.description).toBe('Edited description.')
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.body.updatedAt).getTime())
  })

  it('rejects an edit using a stale updatedAt with 409, leaving the row unchanged', async () => {
    const created = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Row that will be edited twice.', result: 'First result.', followUpRequired: false })

    const firstEdit = await request(app)
      .patch(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken/${created.body.id}`)
      .set('Cookie', staffCookie)
      .send({
        description: 'First editor won.',
        result: 'First result, edited.',
        followUpRequired: false,
        updatedAt: created.body.updatedAt,
      })
    expect(firstEdit.status).toBe(200)

    // Second editor still has the ORIGINAL (now stale) updatedAt from before the first edit landed.
    const secondEdit = await request(app)
      .patch(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken/${created.body.id}`)
      .set('Cookie', staffCookie)
      .send({
        description: 'Second editor should be rejected.',
        result: 'Should not be persisted.',
        followUpRequired: false,
        updatedAt: created.body.updatedAt,
      })

    expect(secondEdit.status).toBe(409)
    expect(secondEdit.body.error.code).toBe('CONFLICT')

    const reloaded = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(reloaded.description).toBe('First editor won.')
  })

  it('returns 404 when the Action Taken does not belong to the Ticket in the URL', async () => {
    const otherTicket = await makeTicket(requesterAId)
    const created = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Belongs to the first ticket.', result: 'Result.', followUpRequired: false })

    const res = await request(app)
      .patch(`/api/staff/tickets/${otherTicket.id}/actions-taken/${created.body.id}`)
      .set('Cookie', staffCookie)
      .send({ description: 'Mismatched ticket.', result: 'Result.', followUpRequired: false, updatedAt: created.body.updatedAt })

    expect(res.status).toBe(404)
  })
})

describe('Requester access (API-10, API-11, API-12, AC-04, AC-05, BR-07)', () => {
  it('rejects Requester create/edit with 403', async () => {
    const createRes = await request(app)
      .post(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken`)
      .set('Cookie', requesterACookie)
      .send({ description: 'Should not be allowed.', result: 'Blocked.', followUpRequired: false })
    expect(createRes.status).toBe(403)

    const editRes = await request(app)
      .patch(`/api/staff/tickets/${ticketOwnedByAId}/actions-taken/1`)
      .set('Cookie', requesterACookie)
      .send({ description: 'Should not be allowed.', result: 'Blocked.', followUpRequired: false, updatedAt: new Date().toISOString() })
    expect(editRes.status).toBe(403)
  })

  it('lets the owning Requester read Actions Taken on their own Ticket', async () => {
    const res = await request(app).get(`/api/tickets/${ticketOwnedByAId}/actions-taken`).set('Cookie', requesterACookie)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('returns 404 when a different Requester requests Actions Taken on a Ticket they do not own', async () => {
    const res = await request(app).get(`/api/tickets/${ticketOwnedByAId}/actions-taken`).set('Cookie', requesterBCookie)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/staff/tickets/:id/actions-taken - not found (API-13)', () => {
  it('returns 404 for a Ticket id that does not exist', async () => {
    const res = await request(app).get('/api/staff/tickets/9999999/actions-taken').set('Cookie', staffCookie)
    expect(res.status).toBe(404)
  })
})

describe('Any active Staff can act regardless of Ticket Owner (API-14, BR-02)', () => {
  it('lets a Staff member who is not the Ticket Owner record an Action Taken', async () => {
    const otherStaff = await prisma.user.findFirstOrThrow({
      where: { isActive: true, role: 'IT_STAFF', id: { not: staffId } },
    })
    const ticket = await makeTicket(requesterAId)
    await prisma.ticket.update({ where: { id: ticket.id }, data: { ticketOwnerId: otherStaff.id } })

    const res = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Recorded by a non-owner Staff member.', result: 'Succeeded.', followUpRequired: false })

    expect(res.status).toBe(201)
    expect(res.body.performedById).toBe(staffId)
  })
})
