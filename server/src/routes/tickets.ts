import { Router } from 'express'
import { prisma } from '../prisma'
import { requireRequester } from '../middleware/requireRequester'

const router = Router()

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const

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
