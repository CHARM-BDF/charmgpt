import { Router } from 'express'
import { DockerService } from '../services/docker'
import * as path from 'path'
import * as fs from 'fs/promises'

const router = Router()
const dockerService = new DockerService()

// Serve static files from temp directory
router.get('/plots/:filename', (req, res) => {
  const plotPath = path.join(process.cwd(), 'temp', req.params.filename)
  res.sendFile(plotPath)
})

// Cleanup endpoint
router.delete('/plots/:filename', async (req, res) => {
  try {
    const plotPath = path.join(process.cwd(), 'temp', req.params.filename)
    await fs.unlink(plotPath)
    res.json({ success: true })
  } catch (error) {
    void error;
    res.status(500).json({ error: 'Failed to delete plot file' })
  }
})

router.post('/run-code', async (req, res) => {
  try {
    const { code, timestamp } = req.body
    console.log('Running code at:', new Date(timestamp))
    const result = await dockerService.runCode(code)
    res.json({
      ...result,
      timestamp  // Return the timestamp to confirm we're getting fresh results
    })
  } catch (error) {
    console.error('Error running code:', error)
    res.status(500).json({ error: 'Failed to run code' })
  }
})

export { router as CodeRouter } 