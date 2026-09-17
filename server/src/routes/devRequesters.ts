import { Router } from 'express'
import { prisma } from '../prisma'

const router = Router()

router.get('/dev-requesters', async (_req, res) => {
  try {
    const requesters = await prisma.user.findMany({
      where: { isActive: true, role: 'REQUESTER' },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, email: true },
    })
    res.json(requesters)
  } catch {
    res.status(500).json({ error: 'Unable to load Development Requesters' })
  }
})

export default router
