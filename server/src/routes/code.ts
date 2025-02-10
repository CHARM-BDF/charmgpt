import express, { Router } from 'express'
import path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'  // Promise-based fs for async operations
import { DockerService } from '../services/docker'

const router: Router = express.Router()
const docker = new DockerService()

interface FileParams {
  filename: string;
}

// Log all requests to this router
router.use((req, res, next) => {
  console.log('Code Router:', {
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  })
  next()
})

// Serve plot files
router.get<FileParams>('/plots/:filename', (req, res) => {
  const plotPath = path.join(docker.getTempDir(), req.params.filename)
  console.log('Serving plot:', {
    requestedFile: req.params.filename,
    fullPath: plotPath,
    exists: fs.existsSync(plotPath)
  })
  res.sendFile(plotPath)
})

// Serve data files
router.get<FileParams>('/data/:filename', (req, res) => {
  const dataPath = path.join(docker.getTempDir(), req.params.filename)
  console.log('Serving data:', {
    requestedFile: req.params.filename,
    fullPath: dataPath,
    exists: fs.existsSync(dataPath)
  })
  res.sendFile(dataPath)
})

// Cleanup endpoint
router.delete<FileParams>('/plots/:filename', async (req, res) => {
  try {
    const plotPath = path.join(docker.getTempDir(), req.params.filename)
    await fsPromises.unlink(plotPath)
    res.json({ success: true })
  } catch (error) {
    void error;
    res.status(500).json({ error: 'Failed to delete plot file' })
  }
})

router.post('/run-code', async (req, res) => {
  try {
    const { code, artifacts } = req.body
    
    // Save artifacts info if provided
    if (artifacts) {
      await fsPromises.writeFile(
        path.join(docker.getTempDir(), 'artifacts.json'),
        JSON.stringify(artifacts)
      )
    }

    const result = await docker.runCode(code)
    res.json(result)
  } catch (error) {
    console.error('Error running code:', error)
    res.status(500).json({ error: 'Failed to run code' })
  }
})

export default router 