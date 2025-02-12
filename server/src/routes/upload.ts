import express from 'express'
import multer from 'multer'
import { DockerService } from '../services/docker'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

const router = express.Router()
const docker = new DockerService()

// Ensure temp directory exists
const tempDir = docker.getTempDir()
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir)
  },
  filename: (req, file, cb) => {
    // Use runId_filename format to match generated files
    const runId = uuidv4()
    cb(null, `${runId}_${file.originalname}`)
  }
})

const upload = multer({ storage })

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    // Handle file copy case
    if (req.body.copy && req.body.filename) {
      const sourceFile = path.join(tempDir, req.body.copy)
      const runId = uuidv4()
      const targetFile = path.join(tempDir, `${runId}_${req.body.filename}`)

      if (!fs.existsSync(sourceFile)) {
        res.status(404).json({ error: 'Source file not found' })
        return
      }

      await fs.promises.copyFile(sourceFile, targetFile)
      res.json({
        filepath: `${runId}_${req.body.filename}`,
        filename: req.body.filename,
        viewMode: 'data'
      })
      return
    }

    // Handle regular file upload case
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const file = req.file
    console.log('File uploaded:', file)

    res.json({
      filepath: file.filename,  // Contains the runId_filename
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      viewMode: file.mimetype === 'text/csv' ? 'data' : 'output'
    })
  } catch (error) {
    next(error)
  }
})

export default router 