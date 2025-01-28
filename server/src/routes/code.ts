import { Router } from 'express'
import { DockerService } from '../services/docker'
import * as path from 'path'

const router = Router()
const dockerService = new DockerService()

// Serve static files from temp directory
router.get('/plots/:filename', (req, res) => {
  const plotPath = path.join(process.cwd(), 'temp', req.params.filename)
  res.sendFile(plotPath)
})

router.post('/run-code', async (req, res) => {
  try {
    const { code } = req.body
    const result = await dockerService.runCode(code)
    res.json(result)
  } catch (error) {
    console.error('Error running code:', error)
    res.status(500).json({ error: 'Failed to run code' })
  }
})

export { router as CodeRouter } 