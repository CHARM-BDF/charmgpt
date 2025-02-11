import { Router } from 'express'
import axios from 'axios'
import multer from 'multer'
import FormData from 'form-data'
import fs from 'fs'

const router = Router()
const upload = multer({ dest: 'uploads/' })

const CHARMONATOR_URL = process.env.CHARMONATOR_URL || 'http://localhost:5002/ai2'
const CHARMONIZER_BASE_URL = CHARMONATOR_URL + '/api/charmonizer/v1';

interface ConversionJob {
  job_id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  error: string | null;
  pages_total?: number;
  pages_converted?: number;
}

interface SummaryJob {
  job_id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  chunks_total?: number;
  chunks_completed?: number;
}

router.post('/summarize-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Step 1: Start document conversion
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    
    const conversionResponse = await axios.post<ConversionJob>(
      `${CHARMONIZER_BASE_URL}/conversions/documents`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    // Clean up the temporary file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error cleaning up temp file:', err);
    });

    // Return the conversion job ID immediately
    res.json({
      conversionJobId: conversionResponse.data.job_id,
      status: 'processing'
    });
  } catch (error) {
    console.error('Error starting document processing:', error);
    res.status(500).json({ 
      error: 'Failed to start document processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add endpoint to check conversion status and start summary if ready
router.get('/document-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const response = await axios.get(
      `${CHARMONIZER_BASE_URL}/conversions/documents/${jobId}`
    );

    const conversionJob = response.data;
    
    if (conversionJob.status === 'complete') {
      // Get the converted document
      const documentResult = await axios.get(
        `${CHARMONIZER_BASE_URL}/conversions/documents/${jobId}/result`
      );
      
      // Start the summary job
      const summaryResponse = await axios.post<SummaryJob>(
        `${CHARMONIZER_BASE_URL}/summaries`,
        {
          document: documentResult.data,
          model: 'my-ollama-model',
          method: 'fold',
          chunk_group: 'pages',
          guidance: 'Provide a concise summary/cheatsheet that helps using the datasets described in the document.',
          temperature: 0.7,
          ocr_threshold: 0.0
        }
      );

      res.json({
        conversionStatus: 'complete',
        summaryJobId: summaryResponse.data.job_id,
        status: 'processing'
      });
    } else {
      res.json({
        conversionStatus: conversionJob.status,
        progress: {
          pagesTotal: conversionJob.pages_total,
          pagesConverted: conversionJob.pages_converted
        }
      });
    }
  } catch (error) {
    void error;
    res.status(500).json({ error: 'Failed to check document status' });
  }
});

// Optional: Endpoint to check status of a running job
router.get('/job-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Try both conversion and summary endpoints since we don't know which type of job it is
    try {
      const conversionStatus = await axios.get(
        `${CHARMONIZER_BASE_URL}/conversions/documents/${jobId}`
      );
      res.json(conversionStatus.data);
      return;
    } catch {
      const summaryStatus = await axios.get(
        `${CHARMONIZER_BASE_URL}/summaries/${jobId}`
      );
      res.json(summaryStatus.data);
      return;
    }
  } catch (error) {
    res.status(404).json({ error: 'Job not found: ' + error });
  }
});

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