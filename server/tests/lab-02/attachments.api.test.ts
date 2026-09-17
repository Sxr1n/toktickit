import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'

let requesterId: number
let ticketId: number
let removalTicketId: number

beforeAll(async () => {
  const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
  const category = await prisma.category.findFirstOrThrow()
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  requesterId = requester.id

  const makeTicket = (summary: string) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `SEED-ATTACH-${Math.random().toString(36).slice(2, 8)}`,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary,
        description: 'Seed ticket used to exercise attachment upload/download/remove behavior.',
        requestedPriority: 'MEDIUM',
      },
    })

  ticketId = (await makeTicket('Ticket for attachment tests')).id
  removalTicketId = (await makeTicket('Ticket for attachment removal test')).id
})

describe('POST /api/tickets/:id/attachments (API-10)', () => {
  it('accepts a valid image under the size limit', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('X-Dev-Requester-Id', String(requesterId))
      .attach('file', Buffer.from('fake-image-bytes'), { filename: 'photo.png', contentType: 'image/png' })

    expect(res.status).toBe(201)
    expect(res.body.originalName).toBe('photo.png')
    expect(res.body.isRemoved).toBe(false)
  })
})

describe('POST /api/tickets/:id/attachments - rejections (API-11, API-12)', () => {
  it('rejects a file larger than 5 MB', async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 1)
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('X-Dev-Requester-Id', String(requesterId))
      .attach('file', bigBuffer, { filename: 'big.png', contentType: 'image/png' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('FILE_TOO_LARGE')
  })

  it('rejects an unsupported file type', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('X-Dev-Requester-Id', String(requesterId))
      .attach('file', Buffer.from('not-an-image'), {
        filename: 'virus.exe',
        contentType: 'application/x-msdownload',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('UNSUPPORTED_TYPE')
  })
})

describe('POST /api/tickets/:id/attachments - limit (API-13)', () => {
  it('rejects a 6th active attachment on the same Ticket', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('X-Dev-Requester-Id', String(requesterId))
        .attach('file', Buffer.from('x'), { filename: `file${i}.png`, contentType: 'image/png' })
      expect(res.status).toBe(201)
    }
    // one attachment already exists from the API-10 test above, so this is the 6th
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('X-Dev-Requester-Id', String(requesterId))
      .attach('file', Buffer.from('x'), { filename: 'onemore.png', contentType: 'image/png' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ATTACHMENT_LIMIT_REACHED')
  })
})

describe('Attachment soft removal (API-14, API-15)', () => {
  it('soft-removes an attachment with a reason, and then blocks its download', async () => {
    const uploadRes = await request(app)
      .post(`/api/tickets/${removalTicketId}/attachments`)
      .set('X-Dev-Requester-Id', String(requesterId))
      .attach('file', Buffer.from('remove-me'), { filename: 'remove-me.pdf', contentType: 'application/pdf' })
    const attachmentId = uploadRes.body.id

    const removeRes = await request(app)
      .patch(`/api/tickets/${removalTicketId}/attachments/${attachmentId}/remove`)
      .set('X-Dev-Requester-Id', String(requesterId))
      .send({ reason: 'Wrong file, replacing it' })

    expect(removeRes.status).toBe(200)
    expect(removeRes.body.isRemoved).toBe(true)
    expect(removeRes.body.removedReason).toBe('Wrong file, replacing it')

    const downloadRes = await request(app)
      .get(`/api/tickets/${removalTicketId}/attachments/${attachmentId}/download`)
      .set('X-Dev-Requester-Id', String(requesterId))

    expect(downloadRes.status).toBe(404)
  })
})
