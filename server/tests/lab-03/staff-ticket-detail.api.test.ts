import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let staffCookie: string
let staffId: number
let otherStaffId: number
let inactiveStaffId: number
let requesterCookie: string
let requesterId: number
let categoryId: number
let relatedSystemId: number

async function makeTicket(overrides: {
  currentStatus?: 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED'
  requesterConfirmedResolved?: boolean
}) {
  return prisma.ticket.create({
    data: {
      ticketNumber: `SEED-DETAIL-STAFF-${Math.random().toString(36).slice(2, 8)}`,
      requesterId,
      categoryId,
      relatedSystemId,
      summary: 'Ticket used to exercise IT Staff Ticket Detail operations',
      description: 'Seed ticket for staff-ticket-detail.api.test.ts.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      currentStatus: overrides.currentStatus ?? 'NEW',
      requesterConfirmedResolved: overrides.requesterConfirmedResolved ?? false,
    },
  })
}

beforeAll(async () => {
  const staff = await prisma.user.findMany({ where: { isActive: true, role: 'IT_STAFF' }, take: 2 })
  staffId = staff[0].id
  otherStaffId = staff[1].id
  staffCookie = await loginAs(app, staff[0].email)

  const inactiveStaff = await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: false } })
  inactiveStaffId = inactiveStaff.id

  const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
  requesterId = requester.id
  requesterCookie = await loginAs(app, requester.email)

  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id
})

describe('GET /api/staff/tickets/:id', () => {
  it('returns full Ticket detail including Requester, priorities, and attachments', async () => {
    const ticket = await makeTicket({})

    const res = await request(app).get(`/api/staff/tickets/${ticket.id}`).set('Cookie', staffCookie)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(ticket.id)
    expect(res.body.requester.id).toBe(requesterId)
    expect(res.body.requestedPriority).toBe('MEDIUM')
    expect(res.body.itPriority).toBe('MEDIUM')
    expect(Array.isArray(res.body.attachments)).toBe(true)
  })

  it('returns 404 for a Ticket id that does not exist', async () => {
    const res = await request(app).get('/api/staff/tickets/9999999').set('Cookie', staffCookie)
    expect(res.status).toBe(404)
  })

  it('rejects a Requester with 403', async () => {
    const ticket = await makeTicket({})
    const res = await request(app).get(`/api/staff/tickets/${ticket.id}`).set('Cookie', requesterCookie)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/staff/tickets/:id/owner - claim (API-23)', () => {
  it('claims an unassigned Ticket, setting ticketOwnerId to the caller', async () => {
    const ticket = await makeTicket({})

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ticketOwnerId: staffId })

    expect(res.status).toBe(200)
    expect(res.body.ticketOwnerId).toBe(staffId)
  })

  it('reassigns an already-owned Ticket to a different active IT Staff member', async () => {
    const ticket = await makeTicket({})
    await prisma.ticket.update({ where: { id: ticket.id }, data: { ticketOwnerId: staffId } })

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ticketOwnerId: otherStaffId })

    expect(res.status).toBe(200)
    expect(res.body.ticketOwnerId).toBe(otherStaffId)
  })

  it('unassigns a Ticket when ticketOwnerId is null', async () => {
    const ticket = await makeTicket({})
    await prisma.ticket.update({ where: { id: ticket.id }, data: { ticketOwnerId: staffId } })

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ticketOwnerId: null })

    expect(res.status).toBe(200)
    expect(res.body.ticketOwnerId).toBeNull()
  })
})

describe('PATCH /api/staff/tickets/:id/owner - invalid targets (API-24)', () => {
  it('rejects reassigning to an inactive IT Staff user', async () => {
    const ticket = await makeTicket({})

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ticketOwnerId: inactiveStaffId })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects reassigning to a Requester id', async () => {
    const ticket = await makeTicket({})

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ticketOwnerId: requesterId })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('PATCH /api/staff/tickets/:id/it-priority (API-25)', () => {
  it('updates IT Priority independently of Requested Priority', async () => {
    const ticket = await makeTicket({})

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set('Cookie', staffCookie)
      .send({ itPriority: 'HIGH' })

    expect(res.status).toBe(200)
    expect(res.body.itPriority).toBe('HIGH')
    // BR-19: Requested Priority is never editable after creation, by any role -- confirm the
    // closest related endpoint leaves it untouched rather than silently also changing it.
    expect(res.body.requestedPriority).toBe('MEDIUM')
  })

  it('rejects an invalid itPriority value', async () => {
    const ticket = await makeTicket({})

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set('Cookie', staffCookie)
      .send({ itPriority: 'URGENT' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('PATCH /api/staff/tickets/:id/status - permitted and invalid transitions (API-26)', () => {
  it('allows New -> Open', async () => {
    const ticket = await makeTicket({ currentStatus: 'NEW' })
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'OPEN' })
    expect(res.status).toBe(200)
    expect(res.body.currentStatus).toBe('OPEN')
  })

  it('allows Reopened -> In Progress', async () => {
    const ticket = await makeTicket({ currentStatus: 'REOPENED' })
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'IN_PROGRESS' })
    expect(res.status).toBe(200)
    expect(res.body.currentStatus).toBe('IN_PROGRESS')
  })

  it('rejects New -> Closed with INVALID_TRANSITION and leaves the status unchanged', async () => {
    const ticket = await makeTicket({ currentStatus: 'NEW' })
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'CLOSED' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')

    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(reloaded.currentStatus).toBe('NEW')
  })

  it('rejects any transition out of Cancelled (terminal)', async () => {
    const ticket = await makeTicket({ currentStatus: 'CANCELLED' })
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'OPEN' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')
  })

  it('rejects an unrecognized status value', async () => {
    const ticket = await makeTicket({ currentStatus: 'NEW' })
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'NOT_A_STATUS' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('PATCH /api/staff/tickets/:id/status - Requester forbidden (API-27)', () => {
  it('rejects a Requester attempting a status PATCH on their own Ticket', async () => {
    const ticket = await makeTicket({ currentStatus: 'NEW' })
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', requesterCookie)
      .send({ status: 'OPEN' })

    expect(res.status).toBe(403)
  })
})

describe('requesterConfirmedResolved resets when work resumes (API-28)', () => {
  it('resets to false when IT Staff moves a confirmed-resolved Ticket back to In Progress', async () => {
    const ticket = await makeTicket({ currentStatus: 'WAITING_FOR_REQUESTER', requesterConfirmedResolved: true })

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'IN_PROGRESS' })

    expect(res.status).toBe(200)
    expect(res.body.requesterConfirmedResolved).toBe(false)
  })

  it('resets to false when moved back to Waiting for Requester', async () => {
    const ticket = await makeTicket({ currentStatus: 'IN_PROGRESS', requesterConfirmedResolved: true })

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'WAITING_FOR_REQUESTER' })

    expect(res.status).toBe(200)
    expect(res.body.requesterConfirmedResolved).toBe(false)
  })

  it('does not reset the flag for a transition that is not a return to active work', async () => {
    const ticket = await makeTicket({ currentStatus: 'IN_PROGRESS', requesterConfirmedResolved: true })

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'RESOLVED' })

    expect(res.status).toBe(200)
    expect(res.body.requesterConfirmedResolved).toBe(true)
  })
})

describe('Internal Notes (API-32, API-33)', () => {
  it('IT Staff can post an Internal Note, visible via the staff GET, absent from the Requester Public Comments endpoint', async () => {
    const ticket = await makeTicket({})

    const postRes = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/internal-notes`)
      .set('Cookie', staffCookie)
      .send({ body: 'Internal-only triage notes.', authorId: 999999, createdAt: '2000-01-01T00:00:00.000Z' })

    expect(postRes.status).toBe(201)
    expect(postRes.body.authorId).toBe(staffId)
    expect(new Date(postRes.body.createdAt).getFullYear()).not.toBe(2000)

    const staffGet = await request(app)
      .get(`/api/staff/tickets/${ticket.id}/internal-notes`)
      .set('Cookie', staffCookie)
    expect(staffGet.status).toBe(200)
    expect(staffGet.body.some((n: { id: number }) => n.id === postRes.body.id)).toBe(true)

    const requesterPublicComments = await request(app)
      .get(`/api/tickets/${ticket.id}/public-comments`)
      .set('Cookie', requesterCookie)
    expect(requesterPublicComments.status).toBe(200)
    expect(
      requesterPublicComments.body.some((c: { body: string }) => c.body === 'Internal-only triage notes.'),
    ).toBe(false)
  })

  it('rejects a Requester with 403 on both Internal Note routes', async () => {
    const ticket = await makeTicket({})

    const getRes = await request(app)
      .get(`/api/staff/tickets/${ticket.id}/internal-notes`)
      .set('Cookie', requesterCookie)
    expect(getRes.status).toBe(403)

    const postRes = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/internal-notes`)
      .set('Cookie', requesterCookie)
      .send({ body: 'Should not be allowed.' })
    expect(postRes.status).toBe(403)
  })

  it('rejects an empty/whitespace-only or too-long Internal Note body', async () => {
    const ticket = await makeTicket({})

    const empty = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/internal-notes`)
      .set('Cookie', staffCookie)
      .send({ body: '  ' })
    expect(empty.status).toBe(400)

    const tooLong = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/internal-notes`)
      .set('Cookie', staffCookie)
      .send({ body: 'x'.repeat(2001) })
    expect(tooLong.status).toBe(400)
  })
})

describe('IT Staff attachment view/download access (FR-13)', () => {
  it('IT Staff can view attachment metadata and download the file on a Ticket they do not own', async () => {
    const ticket = await makeTicket({})

    const uploadRes = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set('Cookie', requesterCookie)
      .attach('file', Buffer.from('staff-can-view-this'), { filename: 'staff-view.png', contentType: 'image/png' })
    expect(uploadRes.status).toBe(201)
    const attachmentId = uploadRes.body.id

    const metaRes = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachmentId}`)
      .set('Cookie', staffCookie)
    expect(metaRes.status).toBe(200)
    expect(metaRes.body.originalName).toBe('staff-view.png')

    const downloadRes = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachmentId}/download`)
      .set('Cookie', staffCookie)
    expect(downloadRes.status).toBe(200)
  })

  it('IT Staff cannot upload or remove an attachment (stays Requester-only)', async () => {
    const ticket = await makeTicket({})

    const uploadRes = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set('Cookie', staffCookie)
      .attach('file', Buffer.from('x'), { filename: 'blocked.png', contentType: 'image/png' })
    expect(uploadRes.status).toBe(403)

    const seedUpload = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set('Cookie', requesterCookie)
      .attach('file', Buffer.from('x'), { filename: 'seed.png', contentType: 'image/png' })

    const removeRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/attachments/${seedUpload.body.id}/remove`)
      .set('Cookie', staffCookie)
      .send({ reason: 'Should not be allowed' })
    expect(removeRes.status).toBe(403)
  })
})
