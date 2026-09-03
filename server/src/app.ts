import cors from 'cors'
import express from 'express'
import attachmentsRouter from './routes/attachments'
import categoriesRouter from './routes/categories'
import devRequestersRouter from './routes/devRequesters'
import healthRouter from './routes/health'
import relatedSystemsRouter from './routes/relatedSystems'
import ticketsRouter from './routes/tickets'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', healthRouter)
app.use('/api', categoriesRouter)
app.use('/api', devRequestersRouter)
app.use('/api', relatedSystemsRouter)
app.use('/api', ticketsRouter)
app.use('/api', attachmentsRouter)

export default app
