import { Router } from 'express'
import { prisma } from '../prisma'

const router = Router()

router.get('/categories', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    })
    res.json(categories)
  } catch {
    res.status(500).json({ error: 'Unable to load categories' })
  }
})

export default router
