import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { LoggingService } from '../services/logging';

interface FileMetadata {
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

const upload = multer({ storage });

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

    if (!fs.existsSync(uploadDir)) {
      return res.json([]);
    }

    const files = await fs.promises.readdir(uploadDir);
    const fileEntries = await Promise.all(
      files
        .filter(file => !file.endsWith('.json') && file !== 'metadata')
        .map(async file => {
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

export default router; 