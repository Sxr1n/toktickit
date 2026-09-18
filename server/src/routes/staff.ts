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

function validationError(message: string) {
  return { error: { code: 'VALIDATION_FAILED', message } }
}

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
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['IT_STAFF', 'ADMINISTRATOR'] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  res.json(users)
})

export default router
