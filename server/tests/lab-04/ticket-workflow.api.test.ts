import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

let staffCookie: string
let requesterCookie: string
let requesterId: number
let categoryId: number
let relatedSystemId: number

type TicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED'

// BR-09: this sprint re-confirms Lab 3's BR-21 matrix is unchanged and still the sole authority.
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
}
const ALL_STATUSES = Object.keys(TRANSITIONS) as TicketStatus[]

async function makeTicket(status: TicketStatus, overrides: { requesterConfirmedResolved?: boolean } = {}) {
  return prisma.ticket.create({
    data: {
      ticketNumber: `SEED-WORKFLOW-${Math.random().toString(36).slice(2, 8)}`,
      requesterId,
      categoryId,
      relatedSystemId,
      summary: 'Ticket used to exercise the Lab 4 workflow re-confirmation',
      description: 'Seed ticket for ticket-workflow.api.test.ts.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      currentStatus: status,
      requesterConfirmedResolved: overrides.requesterConfirmedResolved ?? false,
    },
  })
}

beforeAll(async () => {
  const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
  staffCookie = await loginAs(app, staff.email)

  const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
  requesterId = requester.id
  requesterCookie = await loginAs(app, requester.email)

  categoryId = (await prisma.category.findFirstOrThrow()).id
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id
})

describe('BR-21 transition matrix re-verified end to end (API-15)', () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const permitted = TRANSITIONS[from].includes(to)
      it(`${permitted ? 'allows' : 'rejects'} ${from} -> ${to}`, async () => {
        const ticket = await makeTicket(from)
        const res = await request(app)
          .patch(`/api/staff/tickets/${ticket.id}/status`)
          .set('Cookie', staffCookie)
          .send({ status: to })

        if (permitted) {
          expect(res.status).toBe(200)
          expect(res.body.currentStatus).toBe(to)
        } else {
          expect(res.status).toBe(400)
          const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
          expect(reloaded.currentStatus).toBe(from)
        }
      })
    }
  }
})

describe('Requester cannot bypass the resolution gate (API-16, FR-08)', () => {
  it('rejects a Requester status PATCH with 403 regardless of the target status', async () => {
    const ticket = await makeTicket('IN_PROGRESS')
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set('Cookie', requesterCookie)
      .send({ status: 'RESOLVED' })

    expect(res.status).toBe(403)
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(reloaded.currentStatus).toBe('IN_PROGRESS')
  })
})

describe('Recording an Action Taken never itself changes status (API-17, BR-09)', () => {
  it('leaves Current Status unchanged after posting an Action Taken', async () => {
    const ticket = await makeTicket('OPEN')
    const res = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Recorded work.', result: 'In progress.', followUpRequired: false })
    expect(res.status).toBe(201)

    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(reloaded.currentStatus).toBe('OPEN')
  })
})

describe('requesterConfirmedResolved stays advisory regardless of Actions Taken (API-18, BR-10)', () => {
  it('does not change Current Status when the Requester confirms resolved, even with Actions Taken present', async () => {
    const ticket = await makeTicket('WAITING_FOR_REQUESTER')
    await request(app)
      .post(`/api/staff/tickets/${ticket.id}/actions-taken`)
      .set('Cookie', staffCookie)
      .send({ description: 'Work recorded before confirmation.', result: 'Done for now.', followUpRequired: false })

    const res = await request(app).patch(`/api/tickets/${ticket.id}/confirm-resolved`).set('Cookie', requesterCookie)

    expect(res.status).toBe(200)
    expect(res.body.requesterConfirmedResolved).toBe(true)
    expect(res.body.currentStatus).toBe('WAITING_FOR_REQUESTER')
  })
})
