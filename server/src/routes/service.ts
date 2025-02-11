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

interface DocumentObject {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    date?: string;
    pages?: number;
  };
  chunks?: {
    text: string;
    page?: number;
    position?: number;
  }[];
}

interface SummaryResult {
  annotations: {
    summary?: string;
    key_points?: string[];
    topics?: string[];
  };
  document: DocumentObject;
  metadata: {
    model: string;
    method: string;
    chunk_group: string;
    temperature: number;
  };
}

async function pollJobUntilComplete<T>(url: string, maxAttempts = 30, delayMs = 2000): Promise<T> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await axios.get(url);
    const job = response.data;

    if (job.status === 'complete') {
      return (await axios.get(`${url}/result`)).data;
    }
    
    if (job.status === 'error') {
      throw new Error(`Job failed: ${job.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
    attempts++;
  }

  throw new Error('Job timed out');
}

router.post('/summarize-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Step 1: Convert the document
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

    // Poll until conversion is complete
    const documentObject = await pollJobUntilComplete<DocumentObject>(
      `${CHARMONIZER_BASE_URL}/conversions/documents/${conversionResponse.data.job_id}`
    );

    // Step 2: Generate summary
    const summaryResponse = await axios.post<SummaryJob>(
      `${CHARMONIZER_BASE_URL}/summaries`,
      {
        document: documentObject,
        model: 'my-ollama-model',
        method: 'fold',
        chunk_group: 'pages',
        guidance: 'Provide a concise summary/cheatsheet that helps using the datasets described in the document.',
        temperature: 0.7,
        ocr_threshold: 0.0
      }
    );

    // Poll until summary is complete
    const summaryResult = await pollJobUntilComplete<SummaryResult>(
      `${CHARMONIZER_BASE_URL}/summaries/${summaryResponse.data.job_id}`
    );

    // Return the final summary
    res.json({
      summary: summaryResult.annotations?.summary || 'No summary generated',
      document: summaryResult
    });
  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({ 
      error: 'Failed to process document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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