import bcrypt from 'bcryptjs'
import type { RequestHandler } from 'express'
import { Router } from 'express'
import type { Prisma } from '../../generated/prisma/client'
import { passwordRuleFailures } from '../lib/auth'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'
import { prisma } from '../prisma'

const router = Router()
const requireAdminAuth: [RequestHandler, RequestHandler] = [requireAuth, requireRole('ADMINISTRATOR')]

const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class LastAdministratorError extends Error {}
class EmailTakenError extends Error {}

function validationError(fields: Record<string, string>) {
  return { error: { code: 'VALIDATION_FAILED', message: 'Please correct the highlighted fields.', details: { fields } } }
}

type Db = typeof prisma | Prisma.TransactionClient

async function emailTaken(db: Db, email: string, excludeUserId?: number) {
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  return !!existing && existing.id !== excludeUserId
}

router.get('/admin/users', ...requireAdminAuth, async (req, res) => {
  const q = req.query
  const where: {
    role?: (typeof ROLES)[number]
    OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' } }>
  } = {}

  if (typeof q.search === 'string' && q.search.trim() !== '') {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { email: { contains: q.search, mode: 'insensitive' } },
    ]
  }
  if (typeof q.role === 'string' && q.role !== '') {
    if (!ROLES.includes(q.role as (typeof ROLES)[number])) {
      return res.status(400).json(validationError({ role: 'Invalid role filter.' }))
    }
    where.role = q.role as (typeof ROLES)[number]
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { name: 'asc' },
  })

  res.json(users)
})

router.post('/admin/users', ...requireAdminAuth, async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  const role = b.role
  const isActive = typeof b.isActive === 'boolean' ? b.isActive : true
  const initialPassword = typeof b.initialPassword === 'string' ? b.initialPassword : ''

  const fields: Record<string, string> = {}
  if (name.length < 1) fields.name = 'Name is required.'
  if (!EMAIL_RE.test(email)) fields.email = 'A valid email address is required.'
  if (typeof role !== 'string' || !ROLES.includes(role as (typeof ROLES)[number])) {
    fields.role = 'Role must be Requester, IT Staff, or Administrator.'
  }
  const passwordFailures = passwordRuleFailures(initialPassword)
  if (passwordFailures.length > 0) {
    fields.initialPassword = `Password must include ${passwordFailures.join(', ')}.`
  }
  if (Object.keys(fields).length > 0) {
    return res.status(400).json(validationError(fields))
  }

  if (await emailTaken(prisma, email)) {
    return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'That email address is already in use.' } })
  }

  const passwordHash = await bcrypt.hash(initialPassword, 10)
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: role as (typeof ROLES)[number],
      isActive,
      mustChangePassword: true,
    },
  })

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  })
})

router.patch('/admin/users/:id', ...requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } })

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } })

  const b = (req.body ?? {}) as Record<string, unknown>
  const fields: Record<string, string> = {}

  const hasName = typeof b.name === 'string'
  const hasEmail = typeof b.email === 'string'
  const hasRole = b.role !== undefined
  const hasIsActive = typeof b.isActive === 'boolean'

  if (!hasName && !hasEmail && !hasRole && !hasIsActive) {
    return res.status(400).json(validationError({ _: 'At least one field must be provided.' }))
  }

  const name = hasName ? (b.name as string).trim() : target.name
  const email = hasEmail ? (b.email as string).trim().toLowerCase() : target.email
  const role = hasRole ? b.role : target.role
  const isActive = hasIsActive ? (b.isActive as boolean) : target.isActive

  if (hasName && name.length < 1) fields.name = 'Name is required.'
  if (hasEmail && !EMAIL_RE.test(email)) fields.email = 'A valid email address is required.'
  if (hasRole && !ROLES.includes(role as (typeof ROLES)[number])) {
    fields.role = 'Role must be Requester, IT Staff, or Administrator.'
  }
  if (Object.keys(fields).length > 0) {
    return res.status(400).json(validationError(fields))
  }

  // BR-29: an Administrator can never deactivate their own account, unconditionally.
  if (hasIsActive && isActive === false && target.id === req.user!.id) {
    return res
      .status(409)
      .json({ error: { code: 'SELF_DEACTIVATION', message: 'You cannot deactivate your own account.' } })
  }

  // BR-30: the system must always retain at least one active Administrator. The check and the
  // write happen inside one Serializable transaction so two concurrent requests that would each,
  // in isolation, see "another active Administrator still exists" can never both succeed and
  // leave zero -- Postgres aborts one of them as a serialization conflict instead (caught below
  // as P2034 and surfaced as a clean, retryable 409).
  const removesActiveAdminStatus =
    target.role === 'ADMINISTRATOR' &&
    target.isActive &&
    ((hasIsActive && isActive === false) || (hasRole && role !== 'ADMINISTRATOR'))

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        if (removesActiveAdminStatus) {
          const otherActiveAdmins = await tx.user.count({
            where: { role: 'ADMINISTRATOR', isActive: true, id: { not: target.id } },
          })
          if (otherActiveAdmins === 0) {
            throw new LastAdministratorError()
          }
        }

        if (hasEmail && (await emailTaken(tx, email, target.id))) {
          throw new EmailTakenError()
        }

        return tx.user.update({
          where: { id },
          data: {
            ...(hasName ? { name } : {}),
            ...(hasEmail ? { email } : {}),
            ...(hasRole ? { role: role as (typeof ROLES)[number] } : {}),
            ...(hasIsActive ? { isActive } : {}),
          },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        })
      },
      { isolationLevel: 'Serializable' },
    )

    res.json(updated)
  } catch (err) {
    if (err instanceof LastAdministratorError) {
      return res.status(409).json({
        error: { code: 'LAST_ADMINISTRATOR', message: 'At least one active Administrator must remain.' },
      })
    }
    if (err instanceof EmailTakenError) {
      return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'That email address is already in use.' } })
    }
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'This user was changed concurrently. Please retry.' },
      })
    }
    throw err
  }
})

router.post('/admin/users/:id/reset-password', ...requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } })

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } })

  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
  const failures = passwordRuleFailures(newPassword)
  if (failures.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'Password does not meet the required rules.', details: { failures } },
    })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  })

  res.json({ ok: true })
})

export default router
