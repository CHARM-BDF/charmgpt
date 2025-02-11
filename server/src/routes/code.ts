import express, { Router } from 'express'
import path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'  // Promise-based fs for async operations
import { DockerService } from '../services/docker'
import { createReadStream } from 'fs'
import readline from 'readline'

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

// Serve just the header for data files
router.get<FileParams>('/header/:filename', async (req, res) => {
  const dataPath = path.join(docker.getTempDir(), req.params.filename)
  
  if (!fs.existsSync(dataPath)) {
    console.log('Header request - file not found:', dataPath)
    res.status(404).send('File not found')
    return
  }

  try {
    const readStream = createReadStream(dataPath)
    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity
    })

    // Get just the first line
    for await (const line of rl) {
      rl.close()
      readStream.destroy()
      res.send(line)
      return
    }

    // If we get here, the file was empty
    res.send('')
  } catch (error) {
    console.error('Error reading header:', error)
    res.status(500).send('Error reading file header')
  }
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