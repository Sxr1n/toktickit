import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../prisma'

declare module 'express-serve-static-core' {
  interface Request {
    requesterId?: number
  }
}

export async function requireRequester(req: Request, res: Response, next: NextFunction) {
  const header = req.header('X-Dev-Requester-Id')
  const id = header ? Number(header) : NaN

  if (!header || Number.isNaN(id)) {
    return res.status(401).json({ error: 'MISSING_REQUESTER', message: 'X-Dev-Requester-Id header is required' })
  }

  const requester = await prisma.requesterUser.findUnique({ where: { id } })
  if (!requester || !requester.isActive) {
    return res.status(401).json({ error: 'INVALID_REQUESTER', message: 'Development Requester is not active' })
  }

  req.requesterId = requester.id
  next()
}
