import cors from 'cors'
import express from 'express'
import { prisma } from './prisma'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'TokTickIT API' })
})

app.get('/api/categories', async (_req, res) => {
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

export default app
