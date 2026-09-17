import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import attachmentsRouter from './routes/attachments'
import authRouter from './routes/auth'
import categoriesRouter from './routes/categories'
import devRequestersRouter from './routes/devRequesters'
import healthRouter from './routes/health'
import relatedSystemsRouter from './routes/relatedSystems'
import ticketsRouter from './routes/tickets'

const app = express()

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.use('/api', healthRouter)
app.use('/api', categoriesRouter)
app.use('/api', devRequestersRouter)
app.use('/api', relatedSystemsRouter)
app.use('/api', ticketsRouter)
app.use('/api', attachmentsRouter)
app.use('/api', authRouter)

export default app
