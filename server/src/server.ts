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
app.use('/api', CodeRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log('\nAvailable routes:')
  console.log('\nLLM Routes:')
  console.log('- POST /api/llm/chat')
  console.log('  Body: { message: string, config: LLMConfig }')
  console.log('- POST /api/llm/generate-code')
  console.log('  Body: { prompt: string, config: LLMConfig }')
  
  console.log('\nCode Execution Routes:')
  console.log('- POST /api/run-code')
  console.log('  Body: { code: string }')
  console.log('- GET /api/plots/:filename')
  console.log('  Serves plot images')
  console.log('- DELETE /api/plots/:filename')
  console.log('  Deletes plot files')
}) 