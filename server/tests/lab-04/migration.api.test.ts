import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

// API-31 (AC-12): the additive ActionTaken migration must not break the FK chain spanning every prior
// lab's schema. Mirrors Lab 3's API-42, extended with the Lab 4 Action Taken and dashboard steps.
describe('API-31: full Lab 1+2+3+4 flow still works end-to-end after the ActionTaken migration', () => {
  it('creates a Ticket, Attachment, Public Comment, Internal Note, and Action Taken in one sequence', async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
    const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
    const requesterCookie = await loginAs(app, requester.email)
    const staffCookie = await loginAs(app, staff.email)
    const category = await prisma.category.findFirstOrThrow()
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

    const ticketRes = await request(app).post('/api/tickets').set('Cookie', requesterCookie).send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: 'API-31 full-chain migration smoke test',
      description: 'Exercises Lab 1, 2, 3 and 4 schema additions in one request sequence.',
      requestedPriority: 'LOW',
    })
    expect(ticketRes.status).toBe(201)
    const ticketId = ticketRes.body.id

    const attachmentRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Cookie', requesterCookie)
      .attach('file', Buffer.from('migration-smoke-test'), { filename: 'smoke.png', contentType: 'image/png' })
    expect(attachmentRes.status).toBe(201)

    const commentRes = await request(app)
      .post(`/api/tickets/${ticketId}/public-comments`)
      .set('Cookie', requesterCookie)
      .send({ body: 'Full-chain smoke test comment.' })
    expect(commentRes.status).toBe(201)

    const noteRes = await request(app)
      .post(`/api/staff/tickets/${ticketId}/internal-notes`)
      .set('Cookie', staffCookie)
      .send({ body: 'Full-chain smoke test internal note.' })
    expect(noteRes.status).toBe(201)

    const actionRes = await request(app)
      .post(`/api/staff/tickets/${ticketId}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Full-chain smoke test action.', result: 'Chain intact.', followUpRequired: false })
    expect(actionRes.status).toBe(201)

    const requesterActions = await request(app).get(`/api/tickets/${ticketId}/actions-taken`).set('Cookie', requesterCookie)
    expect(requesterActions.status).toBe(200)
    expect(requesterActions.body.map((a: { id: number }) => a.id)).toContain(actionRes.body.id)

    const dashRes = await request(app).get('/api/dashboard/requester').set('Cookie', requesterCookie)
    expect(dashRes.status).toBe(200)
    expect(dashRes.body.counts.open).toBeGreaterThan(0)
  })
})
