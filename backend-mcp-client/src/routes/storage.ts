import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { LoggingService } from '../services/logging';
// import pdfParse from 'pdf-parse';
import { FileMetadata as FullFileMetadata } from '@charm-mcp/shared';

// Simplified FileMetadata interface that makes all fields optional
interface FileMetadata extends Partial<FullFileMetadata> {
  description?: string;
  [key: string]: any;
}

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename using UUID
    const id = randomUUID();
    cb(null, id);
  }
});

// Accept all file types - no restrictions
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  cb(null, true); // Accept all files
};

const upload = multer({ 
  storage,
  fileFilter
});

// POST /api/storage/files - Upload a file
router.post('/files', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const loggingService = req.app.locals.loggingService as LoggingService;
    loggingService.log('info', 'File upload request received');
    console.log('[STORAGE] Request headers:', req.headers);
    console.log('[STORAGE] Request body:', req.body);
    console.log('[STORAGE] Uploaded file:', req.file);

    if (!req.file) {
      loggingService.log('error', 'No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) as FileMetadata : {};
    console.log('[STORAGE] Parsed metadata:', metadata);
    console.log('[STORAGE] File tags:', metadata.tags || []);
    const fileId = path.basename(req.file.path);
    console.log('[STORAGE] Generated fileId:', fileId);

    // Ensure tags array exists
    if (!metadata.tags) {
      metadata.tags = [];
    }

    // Store metadata
    const metadataDir = path.join(process.cwd(), 'uploads', 'metadata');
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }
    const metadataPath = path.join(metadataDir, `${fileId}.json`);
    console.log('[STORAGE] Writing metadata to:', metadataPath);
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2)
    );

    loggingService.log('info', `File uploaded successfully: ${fileId} with tags: ${metadata.tags.join(', ')}`);
    res.status(201).json({ id: fileId });
  } catch (error) {
    const loggingService = req.app.locals.loggingService as LoggingService;
    console.error('[STORAGE] Error details:', error);
    loggingService.logError(error as Error);
    res.status(500).json({ error: 'Failed to upload file', details: error instanceof Error ? error.message : String(error) });
  }
});

// PUT /api/storage/files/:id/metadata - Update file metadata
router.put('/files/:id/metadata', express.json(), async (req: Request, res: Response) => {
  try {
    const loggingService = req.app.locals.loggingService as LoggingService;
    const { id } = req.params;
    const metadata = req.body;

    const metadataPath = path.join(process.cwd(), 'uploads', 'metadata', `${id}.json`);
    if (!fs.existsSync(metadataPath)) {
      loggingService.log('error', `Metadata not found for file: ${id}`);
      return res.status(404).json({ error: 'File not found' });
    }

    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    loggingService.log('info', `Metadata updated for file: ${id}`);
    res.json(metadata);
  } catch (error) {
    const loggingService = req.app.locals.loggingService as LoggingService;
    loggingService.logError(error as Error);
    res.status(500).json({ error: 'Failed to update metadata' });
  }
});

// GET /api/storage/files/:id/metadata - Get file metadata
router.get('/files/:id/metadata', async (req: Request, res: Response) => {
  try {
    const loggingService = req.app.locals.loggingService as LoggingService;
    const { id } = req.params;

    const metadataPath = path.join(process.cwd(), 'uploads', 'metadata', `${id}.json`);
    if (!fs.existsSync(metadataPath)) {
      loggingService.log('error', `Metadata not found for file: ${id}`);
      return res.status(404).json({ error: 'File not found' });
    }

    const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
    loggingService.log('info', `Metadata retrieved for file: ${id}`);
    res.json(metadata);
  } catch (error) {
    const loggingService = req.app.locals.loggingService as LoggingService;
    loggingService.logError(error as Error);
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

// GET /api/storage/files - List all files
router.get('/files', async (req: Request, res: Response) => {
  try {
    const loggingService = req.app.locals.loggingService as LoggingService;
    const uploadDir = path.join(process.cwd(), 'uploads');
    const metadataDir = path.join(uploadDir, 'metadata');
    const requestedTags = req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : [];
    const cleanupOrphaned = req.query.cleanupOrphaned === 'true';

    if (!fs.existsSync(uploadDir)) {
      return res.json([]);
    }

    const files = await fs.promises.readdir(uploadDir);
    const actualFileIds = new Set(
      files.filter(file => !file.endsWith('.json') && file !== 'metadata')
    );

    // Cleanup orphaned metadata files if requested
    if (cleanupOrphaned && fs.existsSync(metadataDir)) {
      try {
        const metadataFiles = await fs.promises.readdir(metadataDir);
        let cleanedCount = 0;
        for (const metadataFile of metadataFiles) {
          if (metadataFile.endsWith('.json')) {
            const fileId = metadataFile.replace('.json', '');
            if (!actualFileIds.has(fileId)) {
              const metadataPath = path.join(metadataDir, metadataFile);
              await fs.promises.unlink(metadataPath);
              cleanedCount++;
            }
          }
        }
        if (cleanedCount > 0) {
          loggingService.log('info', `Cleaned up ${cleanedCount} orphaned metadata files`);
        }
      } catch (error) {
        loggingService.logError(error as Error);
        // Continue even if cleanup fails
      }
    }

    const fileEntries = await Promise.all(
      Array.from(actualFileIds).map(async file => {
        const stats = await fs.promises.stat(path.join(uploadDir, file));
        let metadata: FileMetadata = {};
        try {
          const metadataContent = await fs.promises.readFile(
            path.join(metadataDir, `${file}.json`),
            'utf-8'
          );
          metadata = JSON.parse(metadataContent);
        } catch (error) {
          // Ignore metadata read errors
        }
        return {
          id: file,
          name: metadata.description || file,
          path: `/uploads/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          metadata,
          tags: metadata.tags || []
        };
      })
    );

    // Filter by tags if any are requested
    const filteredEntries = requestedTags.length > 0
      ? fileEntries.filter(entry => 
          requestedTags.every(tag => entry.tags.includes(tag))
        )
      : fileEntries;

    loggingService.log('info', `Listed ${filteredEntries.length} files (filtered from ${fileEntries.length})`);
    res.json(filteredEntries);
  } catch (error) {
    const loggingService = req.app.locals.loggingService as LoggingService;
    loggingService.logError(error as Error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// DELETE /api/storage/files/:id - Delete a file
router.delete('/files/:id', async (req: Request, res: Response) => {
  try {
    const loggingService = req.app.locals.loggingService as LoggingService;
    const { id } = req.params;
    const uploadDir = path.join(process.cwd(), 'uploads');
    const metadataDir = path.join(uploadDir, 'metadata');
    const filePath = path.join(uploadDir, id);
    const metadataPath = path.join(metadataDir, `${id}.json`);

    // Delete file if exists
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    // Delete metadata if exists
    if (fs.existsSync(metadataPath)) {
      await fs.promises.unlink(metadataPath);
    }

    loggingService.log('info', `File deleted: ${id}`);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    const loggingService = req.app.locals.loggingService as LoggingService;
    loggingService.logError(error as Error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET /api/storage/files/:id/content - Get file content
router.get('/files/:id/content', async (req: Request, res: Response) => {
  try {
    const loggingService = req.app.locals.loggingService as LoggingService;
    const { id } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', id);

    if (!fs.existsSync(filePath)) {
      loggingService.log('error', `File not found: ${id}`);
      return res.status(404).json({ error: 'File not found' });
    }

    const content = await fs.promises.readFile(filePath);
    loggingService.log('info', `File content retrieved: ${id}`);
    res.send(content);
  } catch (error) {
    const loggingService = req.app.locals.loggingService as LoggingService;
    loggingService.logError(error as Error);
    res.status(500).json({ error: 'Failed to get file content' });
  }
});

// GET /api/storage/files/:id/download - Download a file with proper headers
router.get('/files/:id/download', async (req: Request, res: Response) => {
  try {
    const loggingService = req.app.locals.loggingService as LoggingService;
    const { id } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', id);
    const metadataPath = path.join(process.cwd(), 'uploads', 'metadata', `${id}.json`);

    if (!fs.existsSync(filePath)) {
      loggingService.log('error', `File not found: ${id}`);
      return res.status(404).json({ error: 'File not found' });
    }

    // Get metadata to determine original filename and content type
    let filename = id; // fallback to file ID
    let contentType = 'application/octet-stream'; // fallback content type
    
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
        filename = metadata.originalFilename || metadata.description || id;
        contentType = metadata.schema?.format || contentType;
      } catch (error) {
        // Ignore metadata read errors, use defaults
      }
    }

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    
    const content = await fs.promises.readFile(filePath);
    loggingService.log('info', `File downloaded: ${id} as ${filename}`);
    res.send(content);
  } catch (error) {
    const loggingService = req.app.locals.loggingService as LoggingService;
    loggingService.logError(error as Error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// POST /api/storage/files/:id/extract - Extract text from a file
/*
router.post('/files/:id/extract', async (req: Request, res: Response) => {
    try {
        const loggingService = req.app.locals.loggingService as LoggingService;
        const { id } = req.params;
        
        // Get file path and metadata
        const filePath = path.join(process.cwd(), 'uploads', id);
        const metadataPath = path.join(process.cwd(), 'uploads', 'metadata', `${id}.json`);
        
        if (!fs.existsSync(filePath) || !fs.existsSync(metadataPath)) {
            loggingService.log('error', `File or metadata not found for: ${id}`);
            return res.status(404).json({ error: 'File not found' });
        }

        // Read metadata to get file type
        const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
        const fileContent = await fs.promises.readFile(filePath);

        // For now, only handle PDFs
        if (metadata.schema.format !== 'application/pdf') {
            return res.status(400).json({ 
                error: 'Unsupported file type',
                message: 'Currently only supporting PDF files while in testing'
            });
        }

        try {
            const pdfData = await pdfParse(fileContent);
            
            // Update metadata with extracted text
            metadata.textExtraction = {
                status: 'completed',
                content: pdfData.text,
                format: metadata.schema.format,
                extractedAt: new Date(),
                metadata: {
                    pageCount: pdfData.numpages,
                    charCount: pdfData.text.length,
                    wordCount: pdfData.text.split(/\s+/).length
                }
            };

            await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            
            loggingService.log('info', `Text extracted successfully from PDF: ${id}`);
            res.json({ success: true, metadata: metadata.textExtraction });

        } catch (extractError) {
            // Update metadata with error
            metadata.textExtraction = {
                status: 'failed',
                error: extractError instanceof Error ? extractError.message : 'Unknown error',
                format: metadata.schema.format,
                extractedAt: new Date()
            };
            await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            
            loggingService.log('error', `Text extraction failed for PDF: ${id}`, { error: extractError });
            res.status(500).json({ 
                error: 'Text extraction failed', 
                details: extractError instanceof Error ? extractError.message : 'Unknown error'
            });
        }

    } catch (error) {
        const loggingService = req.app.locals.loggingService as LoggingService;
        loggingService.logError(error as Error);
        res.status(500).json({ error: 'Failed to process text extraction' });
    }
});
*/

export default router; 