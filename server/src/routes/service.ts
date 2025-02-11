import { Router } from 'express'
import axios from 'axios'
import multer from 'multer'
import FormData from 'form-data'
import fs from 'fs'

const router = Router()
const upload = multer({ dest: 'uploads/' })

const CHARMONATOR_URL = process.env.CHARMONATOR_URL || 'http://localhost:5002/ai2'

router.post('/charmonator/conversion/file', upload.single('file'), async (req, res) => {
  try {
    const targetUrl = `${CHARMONATOR_URL}/api/charmonator/v1/conversion/file`
    console.log('Proxying request to:', targetUrl)
    
    if (!req.file) {
      throw new Error('No file uploaded')
    }

    // Create form data with the file
    const form = new FormData()
    form.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    const response = await axios.post(targetUrl, form, {
      headers: {
        ...form.getHeaders(),
        'host': new URL(CHARMONATOR_URL).host
      },
      responseType: 'json'
    })

    // Clean up the temporary file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error cleaning up temp file:', err)
    })

    res.status(response.status).json(response.data)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Proxy error:', error.response?.status, error.response?.data)
      res.status(error.response?.status || 500).json({ error: error.message })
    } else {
      console.error('Proxy error:', error)
      res.status(500).json({ error: 'Failed to proxy request' })
    }
  }
})

// Keep the general proxy for other routes
router.all('/charmonator/*', async (req, res) => {
  try {
    const targetUrl = `${CHARMONATOR_URL}/api/charmonator/v1${req.url.replace('/charmonator', '')}`
    console.log('Proxying request to:', targetUrl)
    
    const isFileUpload = req.headers['content-type']?.includes('multipart/form-data')
    
    const headers: Record<string, string> = {
      'host': new URL(CHARMONATOR_URL).host
    }

    if (!isFileUpload) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await axios({
      url: targetUrl,
      method: req.method,
      headers,
      data: isFileUpload ? req.body : 
            req.method !== 'GET' ? req.body : undefined,
      responseType: 'text'
    })

    res.status(response.status).send(response.data)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Proxy error:', error.response?.status, error.response?.data)
      res.status(error.response?.status || 500).json({ error: error.message })
    } else {
      console.error('Proxy error:', error)
      res.status(500).json({ error: 'Failed to proxy request' })
    }
  }
})

export default router 