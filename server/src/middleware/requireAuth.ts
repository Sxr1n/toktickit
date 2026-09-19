import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../prisma'
import { SESSION_COOKIE_NAME, verifySessionToken } from '../lib/auth'

export interface AuthenticatedUser {
  id: number
  name: string
  email: string
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  mustChangePassword: boolean
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME]
  const payload = token ? verifySessionToken(token) : null

  if (!payload) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } })
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } })
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  }
  next()
}
