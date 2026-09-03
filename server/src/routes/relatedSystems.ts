import { Router } from 'express'
import { prisma } from '../prisma'

const router = Router()

router.get('/related-systems', async (_req, res) => {
  try {
    const relatedSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    })
    res.json(relatedSystems)
  } catch {
    res.status(500).json({ error: 'Unable to load Related Systems' })
  }
})

export default router
