import type { RequestHandler } from 'express'
import { Router } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'

const router = Router()
const requireStaffAuth: [RequestHandler, RequestHandler] = [requireAuth, requireRole('IT_STAFF', 'ADMINISTRATOR')]
const requireRequesterAuth: [RequestHandler, RequestHandler] = [requireAuth, requireRole('REQUESTER')]

const RECENT_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  itPriority: true,
  ticketOwner: { select: { name: true } },
  updatedAt: true,
} as const

function serializeRecent(t: {
  id: number
  ticketNumber: string
  summary: string
  currentStatus: string
  itPriority: string
  ticketOwner: { name: string } | null
  updatedAt: Date
}) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    summary: t.summary,
    currentStatus: t.currentStatus,
    itPriority: t.itPriority,
    ticketOwnerName: t.ticketOwner?.name ?? null,
    updatedAt: t.updatedAt,
  }
}

// BR-11/BR-13: every count is calculated system-wide (not owner-scoped) from the live Ticket table
// at request time -- same unscoped visibility the Ticket Queue already has.
router.get('/dashboard/staff', ...requireStaffAuth, async (req, res) => {
  const [newCount, open, inProgress, waitingForRequester, myAssigned, recent] = await Promise.all([
    prisma.ticket.count({ where: { currentStatus: 'NEW' } }),
    prisma.ticket.count({ where: { currentStatus: 'OPEN' } }),
    prisma.ticket.count({ where: { currentStatus: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { currentStatus: 'WAITING_FOR_REQUESTER' } }),
    prisma.ticket.count({ where: { ticketOwnerId: req.user!.id } }),
    prisma.ticket.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: RECENT_SELECT,
    }),
  ])

  res.json({
    counts: { new: newCount, open, inProgress, waitingForRequester, myAssigned },
    recentTickets: recent.map(serializeRecent),
  })
})

// BR-12: scoped to the caller's own Tickets only, identically to GET /api/tickets.
router.get('/dashboard/requester', ...requireRequesterAuth, async (req, res) => {
  const where = { requesterId: req.user!.id }

  const [open, inProgress, resolved, closed, waitingForRequester, recent] = await Promise.all([
    prisma.ticket.count({ where: { ...where, currentStatus: { in: ['NEW', 'OPEN'] } } }),
    prisma.ticket.count({ where: { ...where, currentStatus: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { ...where, currentStatus: 'RESOLVED' } }),
    prisma.ticket.count({ where: { ...where, currentStatus: 'CLOSED' } }),
    prisma.ticket.findMany({
      where: { ...where, currentStatus: 'WAITING_FOR_REQUESTER' },
      orderBy: { updatedAt: 'desc' },
      select: RECENT_SELECT,
    }),
    prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: RECENT_SELECT,
    }),
  ])

  res.json({
    counts: { open, inProgress, resolved, closed },
    waitingForRequester: waitingForRequester.map(serializeRecent),
    recentTickets: recent.map(serializeRecent),
  })
})

export default router
