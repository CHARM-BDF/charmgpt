import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import { LLMRouter } from './routes/llm'
import { CodeRouter } from './routes/code'

config() // Load environment variables

const app = express()
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/llm', LLMRouter)
app.use('/api/run-code', CodeRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
}) 