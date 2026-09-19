import type { Prisma } from '../../generated/prisma/client'
import type { RequestHandler } from 'express'
import { Router } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'

const router = Router()
const requireStaffAuth: [RequestHandler, RequestHandler] = [requireAuth, requireRole('IT_STAFF', 'ADMINISTRATOR')]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
const STATUSES = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const
const SORT_FIELDS = ['createdAt', 'itPriority', 'currentStatus'] as const
const PAGE_SIZES = [10, 20, 50] as const
const DEFAULT_PAGE_SIZE = 10

// BR-21: permitted from -> to Ticket status transitions. Any pair not listed here is rejected.
const TRANSITIONS: Record<(typeof STATUSES)[number], (typeof STATUSES)[number][]> = {
  NEW: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
}

function validationError(message: string) {
  return { error: { code: 'VALIDATION_FAILED', message } }
}

const ATTACHMENT_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  isRemoved: true,
  removedReason: true,
} as const

router.get('/staff/tickets', ...requireStaffAuth, async (req, res) => {
  const q = req.query

  const page = Math.max(1, Number.parseInt(String(q.page ?? '1'), 10) || 1)

  let pageSize: (typeof PAGE_SIZES)[number] = DEFAULT_PAGE_SIZE
  if (q.pageSize !== undefined) {
    const rawPageSize = Number.parseInt(String(q.pageSize), 10)
    if (!PAGE_SIZES.includes(rawPageSize as (typeof PAGE_SIZES)[number])) {
      return res.status(400).json(validationError('pageSize must be 10, 20, or 50.'))
    }
    pageSize = rawPageSize as (typeof PAGE_SIZES)[number]
  }

  let sortBy: (typeof SORT_FIELDS)[number] = 'createdAt'
  if (q.sortBy !== undefined) {
    if (!SORT_FIELDS.includes(q.sortBy as (typeof SORT_FIELDS)[number])) {
      return res.status(400).json(validationError('sortBy must be createdAt, itPriority, or currentStatus.'))
    }
    sortBy = q.sortBy as (typeof SORT_FIELDS)[number]
  }
  const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc'

  const where: Prisma.TicketWhereInput = {}

  if (typeof q.search === 'string' && q.search.trim() !== '') {
    where.OR = [
      { ticketNumber: { contains: q.search, mode: 'insensitive' } },
      { summary: { contains: q.search, mode: 'insensitive' } },
    ]
  }

  if (typeof q.status === 'string' && q.status !== '') {
    if (!STATUSES.includes(q.status as (typeof STATUSES)[number])) {
      return res.status(400).json(validationError('Invalid status value.'))
    }
    where.currentStatus = q.status as (typeof STATUSES)[number]
  }

  if (typeof q.itPriority === 'string' && q.itPriority !== '') {
    if (!PRIORITIES.includes(q.itPriority as (typeof PRIORITIES)[number])) {
      return res.status(400).json(validationError('Invalid itPriority value.'))
    }
    where.itPriority = q.itPriority as (typeof PRIORITIES)[number]
  }

  if (typeof q.ticketOwnerId === 'string' && q.ticketOwnerId !== '') {
    if (q.ticketOwnerId === 'unassigned') {
      where.ticketOwnerId = null
    } else if (Number.isInteger(Number(q.ticketOwnerId))) {
      where.ticketOwnerId = Number(q.ticketOwnerId)
    } else {
      return res.status(400).json(validationError('Invalid ticketOwnerId value.'))
    }
  }

  try {
    const [rows, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: [{ [sortBy]: sortDir }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          category: { select: { name: true } },
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          ticketOwnerId: true,
          ticketOwner: { select: { name: true } },
          requester: { select: { name: true } },
          createdAt: true,
        },
      }),
      prisma.ticket.count({ where }),
    ])

    const items = rows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      categoryName: t.category.name,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      currentStatus: t.currentStatus,
      ticketOwnerId: t.ticketOwnerId,
      ticketOwnerName: t.ticketOwner?.name ?? null,
      requesterName: t.requester.name,
      createdAt: t.createdAt,
    }))

    res.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    })
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to load the Ticket Queue.' } })
  }
})

router.get('/staff/users', ...requireStaffAuth, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['IT_STAFF', 'ADMINISTRATOR'] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })
    res.json(users)
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to load Staff users.' } })
  }
})

function serializeTicketDetail(ticket: Prisma.TicketGetPayload<{
  include: {
    requester: { select: { id: true; name: true; email: true } }
    category: { select: { id: true; name: true } }
    relatedSystem: { select: { id: true; name: true } }
    ticketOwner: { select: { id: true; name: true } }
    attachments: { select: typeof ATTACHMENT_SELECT }
  }
}>) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    requesterConfirmedResolved: ticket.requesterConfirmedResolved,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    ticketOwnerId: ticket.ticketOwnerId,
    ticketOwnerName: ticket.ticketOwner?.name ?? null,
    attachments: ticket.attachments,
  }
}

router.get('/staff/tickets/:id', ...requireStaffAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, name: true } },
      relatedSystem: { select: { id: true, name: true } },
      ticketOwner: { select: { id: true, name: true } },
      attachments: { select: ATTACHMENT_SELECT, orderBy: { id: 'asc' } },
    },
  })
  if (!ticket) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  res.json(serializeTicketDetail(ticket))
})

router.patch('/staff/tickets/:id/owner', ...requireStaffAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const raw = req.body?.ticketOwnerId
  let ticketOwnerId: number | null

  if (raw === null) {
    ticketOwnerId = null
  } else if (typeof raw === 'number' && Number.isInteger(raw)) {
    const owner = await prisma.user.findUnique({ where: { id: raw } })
    if (!owner || !owner.isActive || (owner.role !== 'IT_STAFF' && owner.role !== 'ADMINISTRATOR')) {
      return res
        .status(400)
        .json(validationError('ticketOwnerId must reference an active IT Staff or Administrator user.'))
    }
    ticketOwnerId = raw
  } else {
    return res.status(400).json(validationError('ticketOwnerId must be a number or null.'))
  }

  const updated = await prisma.ticket.update({ where: { id }, data: { ticketOwnerId } })
  res.json(updated)
})

router.patch('/staff/tickets/:id/it-priority', ...requireStaffAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const itPriority = req.body?.itPriority
  if (!PRIORITIES.includes(itPriority as (typeof PRIORITIES)[number])) {
    return res.status(400).json(validationError('itPriority must be LOW, MEDIUM, or HIGH.'))
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const updated = await prisma.ticket.update({
    where: { id },
    data: { itPriority: itPriority as (typeof PRIORITIES)[number] },
  })
  res.json(updated)
})

router.patch('/staff/tickets/:id/status', ...requireStaffAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const nextStatus = req.body?.status
  if (typeof nextStatus !== 'string' || !STATUSES.includes(nextStatus as (typeof STATUSES)[number])) {
    return res.status(400).json(validationError('status must be a valid Ticket status.'))
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const allowed = TRANSITIONS[ticket.currentStatus]
  if (!allowed.includes(nextStatus as (typeof STATUSES)[number])) {
    return res.status(400).json({
      error: {
        code: 'INVALID_TRANSITION',
        message: `Cannot transition from ${ticket.currentStatus} to ${nextStatus}.`,
        details: { from: ticket.currentStatus, to: nextStatus },
      },
    })
  }

  // BR-22: a Requester's earlier "looks resolved" signal no longer applies once IT Staff resumes work.
  const resumesWork = nextStatus === 'IN_PROGRESS' || nextStatus === 'WAITING_FOR_REQUESTER'

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      currentStatus: nextStatus as (typeof STATUSES)[number],
      ...(resumesWork ? { requesterConfirmedResolved: false } : {}),
    },
  })
  res.json(updated)
})

router.get('/staff/tickets/:id/internal-notes', ...requireStaffAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  if (!Number.isInteger(ticketId)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const notes = await prisma.internalNote.findMany({
    where: { ticketId },
    orderBy: { id: 'asc' },
    include: { author: { select: { name: true } } },
  })

  res.json(
    notes.map((n) => ({
      id: n.id,
      authorId: n.authorId,
      authorName: n.author.name,
      body: n.body,
      createdAt: n.createdAt,
    })),
  )
})

router.post('/staff/tickets/:id/internal-notes', ...requireStaffAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  if (!Number.isInteger(ticketId)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  if (body.length < 3 || body.length > 2000) {
    return res.status(400).json(validationError('Internal Note must be 3-2000 characters.'))
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })

  const note = await prisma.internalNote.create({
    data: { ticketId, authorId: req.user!.id, body },
    include: { author: { select: { name: true } } },
  })

  res.status(201).json({
    id: note.id,
    ticketId: note.ticketId,
    authorId: note.authorId,
    authorName: note.author.name,
    body: note.body,
    createdAt: note.createdAt,
  })
})

export default router
