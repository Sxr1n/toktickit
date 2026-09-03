import cors from 'cors'
import express from 'express'
import categoriesRouter from './routes/categories'
import devRequestersRouter from './routes/devRequesters'
import healthRouter from './routes/health'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', healthRouter)
app.use('/api', categoriesRouter)
app.use('/api', devRequestersRouter)

export default app
