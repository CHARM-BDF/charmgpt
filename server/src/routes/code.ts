import { Router } from 'express'
import { DockerService } from '../services/docker'

const router = Router()
const dockerService = new DockerService()

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