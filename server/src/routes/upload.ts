import express from 'express'
import multer from 'multer'
import { DockerService } from '../services/docker'

const router = express.Router()
const docker = new DockerService()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, docker.getTempDir())
  },
  filename: (req, file, cb) => {
    // Save uploaded files directly in temp dir with original name
    cb(null, file.originalname)
  }
})

const upload = multer({ storage })

router.post('/upload', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const file = req.file
    console.log('File uploaded:', file)

    res.json({
      filepath: file.filename,  // Just the filename, not the full path
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