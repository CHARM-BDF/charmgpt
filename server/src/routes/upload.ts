import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { DockerService } from '../services/docker'

const router = express.Router()
const docker = new DockerService()

// Configure multer to use the same temp directory as the code route
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tempDir = docker.getTempDir()
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    cb(null, tempDir)
  },
  filename: (_req, file, cb) => {
    // Keep original name but make it unique
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
    const ext = path.extname(file.originalname)
    const basename = path.basename(file.originalname, ext)
    cb(null, `${basename}-${uniqueSuffix}${ext}`)
  }
})

const upload = multer({ storage })

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    // Return file information
    res.json({
      filepath: req.file.filename, // Just return the filename, not the full path
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router 