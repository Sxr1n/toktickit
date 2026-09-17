import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth'
import { prisma } from '../prisma'
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, passwordRuleFailures, signSessionToken } from '../lib/auth'

const router = Router()

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_SECONDS * 1000,
  path: '/',
}

router.post('/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Email and password are required.' } })
  }

  // BR-07: identical response for unknown email, wrong password, and inactive account.
  const invalidCredentials = () =>
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } })

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !user.isActive) {
    return invalidCredentials()
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatches) {
    return invalidCredentials()
  }

  const token = signSessionToken(user.id, user.tokenVersion)
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions)
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })
})

router.post('/auth/logout', requireAuth, async (req, res) => {
  // Clearing the cookie only tells a compliant client to drop it -- a replayed old token would
  // otherwise keep authenticating forever. Bumping tokenVersion invalidates every token issued
  // before this moment server-side (BR-10).
  await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } })
  res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: undefined })
  res.json({ ok: true })
})

router.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user)
})

router.post('/auth/change-password', requireAuth, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Current and new password are required.' } })
  }

  const failures = passwordRuleFailures(newPassword)
  if (failures.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'Password does not meet the required rules.', details: { failures } },
    })
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!currentMatches) {
    return res.status(401).json({ error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect.' } })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  })

  res.json({ ok: true })
})

export default router
