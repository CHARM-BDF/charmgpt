import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import { LLMRouter } from './routes/llm'
import CodeRouter from './routes/code'
import uploadRouter from './routes/upload'
import artifactsRouter from './routes/artifacts'

config() // Load environment variables

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Routes
app.use('/api/llm', LLMRouter)
app.use('/api', CodeRouter)
app.use('/api', uploadRouter)
app.use('/api/artifacts', artifactsRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log('\nAvailable routes:')
  console.log('\nLLM Routes:')
  console.log('- POST /api/llm/chat')
  console.log('  Body: { message: string, config: LLMConfig }')
  
  console.log('\nCode Execution Routes:')
  console.log('- POST /api/run-code')
  console.log('  Body: { code: string }')
  console.log('- GET /api/plots/:filename')
  console.log('  Serves plot images')
  console.log('- DELETE /api/plots/:filename')
  console.log('  Deletes plot files')
  
  console.log('\nFile Upload Routes:')
  console.log('- POST /api/upload')
  console.log('  Form data: { file: File }')
}) 