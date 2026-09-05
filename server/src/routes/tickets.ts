import type { Prisma } from '../../generated/prisma/client'
import { Router } from 'express'
import { prisma } from '../prisma'
import { requireRequester } from '../middleware/requireRequester'

const router = Router()

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
const SORT_FIELDS = ['createdAt', 'currentStatus'] as const
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

router.get('/tickets', requireRequester, async (req, res) => {
  const q = req.query

  const page = Math.max(1, Number.parseInt(String(q.page ?? '1'), 10) || 1)
  const rawPageSize = Number.parseInt(String(q.pageSize ?? DEFAULT_PAGE_SIZE), 10)
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize >= 1 && rawPageSize <= MAX_PAGE_SIZE
      ? rawPageSize
      : DEFAULT_PAGE_SIZE

  const sortBy = SORT_FIELDS.includes(q.sortBy as never) ? (q.sortBy as 'createdAt' | 'currentStatus') : 'createdAt'
  const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc'

  const where: Prisma.TicketWhereInput = { requesterId: req.requesterId }

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

router.get('/tickets/:id', requireRequester, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, requesterId: req.requesterId },
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

router.post('/tickets', requireRequester, async (req, res) => {
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
          requesterId: req.requesterId!,
          categoryId,
          relatedSystemId,
          summary,
          description,
          requestedPriority: requestedPriority as 'LOW' | 'MEDIUM' | 'HIGH',
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

export default router
