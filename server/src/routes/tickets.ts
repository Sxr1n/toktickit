import type { Prisma } from '../../generated/prisma/client'
import type { RequestHandler } from 'express'
import { Router } from 'express'
import { prisma } from '../prisma'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'

const router = Router()
const requireRequesterAuth: [RequestHandler, RequestHandler] = [requireAuth, requireRole('REQUESTER')]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
const SORT_FIELDS = ['createdAt', 'currentStatus'] as const
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

router.get('/tickets', ...requireRequesterAuth, async (req, res) => {
  const q = req.query

  const page = Math.max(1, Number.parseInt(String(q.page ?? '1'), 10) || 1)
  const rawPageSize = Number.parseInt(String(q.pageSize ?? DEFAULT_PAGE_SIZE), 10)
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize >= 1 && rawPageSize <= MAX_PAGE_SIZE
      ? rawPageSize
      : DEFAULT_PAGE_SIZE

  const sortBy = SORT_FIELDS.includes(q.sortBy as never) ? (q.sortBy as 'createdAt' | 'currentStatus') : 'createdAt'
  const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc'

  const where: Prisma.TicketWhereInput = { requesterId: req.user!.id }

  if (typeof q.search === 'string' && q.search.trim() !== '') {
    where.OR = [
      { ticketNumber: { contains: q.search, mode: 'insensitive' } },
      { summary: { contains: q.search, mode: 'insensitive' } },
    ]
  }
  if (typeof q.categoryId === 'string' && Number.isInteger(Number(q.categoryId))) {
    where.categoryId = Number(q.categoryId)
  }
  if (typeof q.relatedSystemId === 'string' && Number.isInteger(Number(q.relatedSystemId))) {
    where.relatedSystemId = Number(q.relatedSystemId)
  }
  if (typeof q.requestedPriority === 'string' && PRIORITIES.includes(q.requestedPriority as never)) {
    where.requestedPriority = q.requestedPriority as (typeof PRIORITIES)[number]
  }

  try {
    const [items, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: [{ [sortBy]: sortDir }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          categoryId: true,
          relatedSystemId: true,
          requestedPriority: true,
          currentStatus: true,
          createdAt: true,
        },
      }),
      prisma.ticket.count({ where }),
    ])

    res.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    })
  } catch {
    res.status(500).json({ error: 'Unable to load Tickets' })
  }
})

router.get('/tickets/:id', ...requireRequesterAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, requesterId: req.user!.id },
    include: {
      attachments: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
          isRemoved: true,
          removedReason: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!ticket) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }

  res.json(ticket)
})

function validateCreateTicket(body: unknown) {
  const fields: Record<string, string> = {}
  const b = (body ?? {}) as Record<string, unknown>

  const summary = typeof b.summary === 'string' ? b.summary.trim() : ''
  const description = typeof b.description === 'string' ? b.description.trim() : ''
  const requestedPriority = b.requestedPriority

  if (summary.length < 5 || summary.length > 150) {
    fields.summary = 'Summary is required and must be 5-150 characters'
  }
  if (description.length < 10 || description.length > 2000) {
    fields.description = 'Description is required and must be 10-2000 characters'
  }
  if (typeof requestedPriority !== 'string' || !PRIORITIES.includes(requestedPriority as never)) {
    fields.requestedPriority = 'Requested Priority must be LOW, MEDIUM, or HIGH'
  }
  if (typeof b.categoryId !== 'number') {
    fields.categoryId = 'Category is required'
  }
  if (typeof b.relatedSystemId !== 'number') {
    fields.relatedSystemId = 'Related System is required'
  }

  return { fields, summary, description, requestedPriority: requestedPriority as string }
}

router.post('/tickets', ...requireRequesterAuth, async (req, res) => {
  const { fields, summary, description, requestedPriority } = validateCreateTicket(req.body)

  if (Object.keys(fields).length > 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', fields })
  }

  const { categoryId, relatedSystemId } = req.body as { categoryId: number; relatedSystemId: number }

  const [category, relatedSystem] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId } }),
    prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } }),
  ])

  if (!category) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', fields: { categoryId: 'Category not found' } })
  }
  if (!relatedSystem || !relatedSystem.isActive) {
    return res
      .status(400)
      .json({ error: 'VALIDATION_ERROR', fields: { relatedSystemId: 'Related System not found' } })
  }

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `PENDING-${Date.now()}`,
          requesterId: req.user!.id,
          categoryId,
          relatedSystemId,
          summary,
          description,
          requestedPriority: requestedPriority as 'LOW' | 'MEDIUM' | 'HIGH',
          itPriority: requestedPriority as 'LOW' | 'MEDIUM' | 'HIGH', // BR-18: initialized from Requested Priority
        },
      })
      const ticketNumber = `TKT-${created.createdAt.getFullYear()}-${String(created.id).padStart(6, '0')}`
      return tx.ticket.update({ where: { id: created.id }, data: { ticketNumber } })
    })

    res.status(201).json(ticket)
  } catch {
    res.status(500).json({ error: 'Unable to create Ticket' })
  }
})

async function findOwnedTicket(ticketId: number, requesterId: number) {
  return prisma.ticket.findFirst({ where: { id: ticketId, requesterId } })
}

// BR-26: a Requester may only post/read Public Comments on Tickets they own; IT Staff/Administrator
// may post/read on any Ticket.
const requireCommentAuth: [RequestHandler, RequestHandler] = [
  requireAuth,
  requireRole('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'),
]

async function findTicketVisibleForComment(ticketId: number, user: { id: number; role: string }) {
  if (user.role === 'REQUESTER') {
    return findOwnedTicket(ticketId, user.id)
  }
  return prisma.ticket.findUnique({ where: { id: ticketId } })
}

router.get('/tickets/:id/public-comments', ...requireCommentAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  if (!Number.isInteger(ticketId)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })
  }

  const ticket = await findTicketVisibleForComment(ticketId, req.user!)
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })
  }

  const comments = await prisma.publicComment.findMany({
    where: { ticketId },
    orderBy: { id: 'asc' },
    include: { author: { select: { name: true, role: true } } },
  })

  res.json(
    comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.author.name,
      authorRole: c.author.role,
      body: c.body,
      createdAt: c.createdAt,
    })),
  )
})

router.post('/tickets/:id/public-comments', ...requireCommentAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  if (!Number.isInteger(ticketId)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })
  }

  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  if (body.length < 3 || body.length > 2000) {
    return res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'Comment must be 3-2000 characters.' },
    })
  }

  const ticket = await findTicketVisibleForComment(ticketId, req.user!)
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })
  }

  const comment = await prisma.publicComment.create({
    data: { ticketId, authorId: req.user!.id, body },
    include: { author: { select: { name: true, role: true } } },
  })

  res.status(201).json({
    id: comment.id,
    ticketId: comment.ticketId,
    authorId: comment.authorId,
    authorName: comment.author.name,
    authorRole: comment.author.role,
    body: comment.body,
    createdAt: comment.createdAt,
  })
})

router.patch('/tickets/:id/confirm-resolved', ...requireRequesterAuth, async (req, res) => {
  const ticketId = Number(req.params.id)
  if (!Number.isInteger(ticketId)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })
  }

  const ticket = await findOwnedTicket(ticketId, req.user!.id)
  if (!ticket) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } })
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { requesterConfirmedResolved: true },
  })

  res.json(updated)
})

export default router
