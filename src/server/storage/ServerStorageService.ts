import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { FileEntry, FileMetadata } from '../../types/fileManagement';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, path.join(__dirname, '../../../storage/content'));
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  }
});

// Store metadata in a separate directory
const metadataDir = path.join(__dirname, '../../../storage/metadata');
const relationshipsDir = path.join(__dirname, '../../../storage/relationships');
const contentDir = path.join(__dirname, '../../../storage/content');

// Ensure storage directories exist
async function initializeStorage() {
  try {
    await fs.mkdir(contentDir, { recursive: true });
    await fs.mkdir(metadataDir, { recursive: true });
    await fs.mkdir(relationshipsDir, { recursive: true });
    console.log('Storage directories initialized successfully');
  } catch (error) {
    console.error('Error initializing storage directories:', error);
    throw error;
  }
}

// Initialize storage on module load
initializeStorage().catch(error => {
  console.error('Failed to initialize storage:', error);
  process.exit(1);
});

// File upload endpoint
router.post('/files', upload.single('file'), async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const metadata = JSON.parse(req.body.metadata || '{}');
    const fileStats = await fs.stat(file.path);
    const fileContent = await fs.readFile(file.path);
    const hash = createHash('sha256').update(fileContent).digest('hex');

    const fileEntry: FileEntry = {
      id: path.basename(file.filename, path.extname(file.filename)),
      name: file.originalname,
      path: file.path,
      mimeType: file.mimetype,
      size: fileStats.size,
      hash: {
        algorithm: 'sha256',
        value: hash
      },
      status: 'active',
      owner: 'system',
      created: fileStats.birthtime,
      modified: fileStats.mtime,
      lastAccessed: fileStats.atime,
      tags: metadata.tags || [],
      llmNotes: metadata.llmNotes || '',
      metadata: {
        description: metadata.description || file.originalname,
        schema: metadata.schema || {
          type: 'json',
          format: file.mimetype,
          encoding: 'utf-8',
          sampleData: ''
        },
        origin: {
          type: 'upload',
          timestamp: new Date()
        },
        version: {
          major: 1,
          minor: 0,
          patch: 0,
          branch: {
            name: 'main',
            parent: '',
            created: new Date(),
            description: 'Initial version'
          },
          history: [{
            id: uuidv4(),
            timestamp: new Date(),
            message: 'Initial upload',
            user: 'system',
            branch: 'main',
            parent: ''
          }]
        },
        analysisInfo: {
          summary: {},
          quality: {
            nullCount: 0,
            duplicateCount: 0,
            errorCount: 0,
            completeness: 100
          }
        }
      }
    };

    // Save metadata
    await fs.writeFile(
      path.join(metadataDir, `${fileEntry.id}.json`),
      JSON.stringify(fileEntry, null, 2)
    );

    res.json(fileEntry);
  } catch (error) {
    console.error('Error handling file upload:', error);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// List files endpoint
router.get('/files', async (_req: Request, res: Response): Promise<void> => {
  try {
    const files = await fs.readdir(metadataDir);
    const fileEntries = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const content = await fs.readFile(path.join(metadataDir, file), 'utf-8');
          return JSON.parse(content) as FileEntry;
        })
    );
    res.json(fileEntries);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Get file content endpoint
router.get('/files/:id/content', async (req: Request, res: Response): Promise<void> => {
  try {
    const metadataPath = path.join(metadataDir, `${req.params.id}.json`);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as FileEntry;
    const filePath = metadata.path;
    
    res.download(filePath, metadata.name);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Get file metadata endpoint
router.get('/files/:id/metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const metadataPath = path.join(metadataDir, `${req.params.id}.json`);
    const metadata = await fs.readFile(metadataPath, 'utf-8');
    res.json(JSON.parse(metadata));
  } catch (error) {
    console.error('Error getting file metadata:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Delete file
router.delete('/files/:id', async (req, res) => {
  try {
    const metadataPath = path.join(metadataDir, `${req.params.id}.json`);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    
    // Soft delete - update status
    metadata.status = 'deleted';
    metadata.modified = new Date();
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Search files endpoint
router.post('/files/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, tags, metadata, dateRange } = req.body as {
      text?: string;
      tags?: string[];
      metadata?: Partial<FileMetadata>;
      dateRange?: { start: Date; end: Date };
    };
    
    // Get all files
    const files = await fs.readdir(metadataDir);
    const fileEntries = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const content = await fs.readFile(path.join(metadataDir, file), 'utf-8');
          return JSON.parse(content) as FileEntry;
        })
    );

    // Filter files based on search criteria
    const results = fileEntries.filter(file => {
      // Text search in name and description
      if (text && !(
        file.name.toLowerCase().includes(text.toLowerCase()) ||
        file.metadata.description.toLowerCase().includes(text.toLowerCase())
      )) {
        return false;
      }

      // Tags search
      if (tags && tags.length > 0) {
        const hasAllTags = tags.every((tag: string) => file.tags.includes(tag));
        if (!hasAllTags) return false;
      }

      // Metadata search
      if (metadata) {
        // Check if all provided metadata values match
        const metadataMatches = Object.entries(metadata).every(([key, value]) => {
          if (key in file.metadata) {
            return JSON.stringify(file.metadata[key as keyof FileMetadata]) === JSON.stringify(value);
          }
          return false;
        });
        if (!metadataMatches) return false;
      }

      // Date range search
      if (dateRange) {
        const fileDate = new Date(file.created);
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        if (fileDate < start || fileDate > end) {
          return false;
        }
      }

      return true;
    });

    res.json(results);
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ error: 'Failed to search files' });
  }
});

// Update file content endpoint
router.put('/files/:id/content', upload.single('file'), async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const metadataPath = path.join(metadataDir, `${req.params.id}.json`);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as FileEntry;

    // Update file content
    const fileStats = await fs.stat(file.path);
    const fileContent = await fs.readFile(file.path);
    const hash = createHash('sha256').update(fileContent).digest('hex');

    // Update metadata
    metadata.path = file.path;
    metadata.size = fileStats.size;
    metadata.hash = {
      algorithm: 'sha256',
      value: hash
    };
    metadata.modified = new Date();
    metadata.lastAccessed = new Date();

    // Save updated metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    res.json(metadata);
  } catch (error) {
    console.error('Error updating file content:', error);
    res.status(500).json({ error: 'Failed to update file content' });
  }
});

// Update file metadata endpoint
router.put('/files/:id/metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const metadataPath = path.join(metadataDir, `${req.params.id}.json`);
    const existingMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as FileEntry;
    const updatedMetadata = req.body;

    // Merge existing metadata with updates
    const newMetadata: FileEntry = {
      ...existingMetadata,
      ...updatedMetadata,
      modified: new Date()
    };

    // Save updated metadata
    await fs.writeFile(metadataPath, JSON.stringify(newMetadata, null, 2));

    res.json(newMetadata);
  } catch (error) {
    console.error('Error updating file metadata:', error);
    res.status(500).json({ error: 'Failed to update file metadata' });
  }
});

// Get relationships for a file
router.get('/files/:id/relationships', async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params.id;
    const relationshipsPath = path.join(relationshipsDir, `${fileId}.json`);
    
    try {
      const relationshipsData = await fs.readFile(relationshipsPath, 'utf-8');
      const relationships = JSON.parse(relationshipsData);
      
      // Get related file details
      const relatedFiles = await Promise.all(
        relationships.map(async (rel: { targetId: string; type: string }) => {
          try {
            const metadataPath = path.join(metadataDir, `${rel.targetId}.json`);
            const fileData = await fs.readFile(metadataPath, 'utf-8');
            const fileEntry = JSON.parse(fileData) as FileEntry;
            return {
              ...fileEntry,
              type: rel.type
            };
          } catch (error) {
            console.error(`Error loading related file ${rel.targetId}:`, error);
            return null;
          }
        })
      );

      // Filter out any null entries from failed loads
      res.json(relatedFiles.filter(Boolean));
    } catch (error) {
      // If the relationships file doesn't exist, return empty array
      if ((error as { code?: string }).code === 'ENOENT') {
        res.json([]);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error getting relationships:', error);
    res.status(500).json({ error: 'Failed to get relationships' });
  }
});

// Add a relationship between files
router.post('/files/:id/relationships', async (req: Request, res: Response): Promise<void> => {
  try {
    const sourceId = req.params.id;
    const { targetId, type } = req.body;

    if (!targetId || !type) {
      res.status(400).json({ error: 'Missing targetId or type' });
      return;
    }

    // Verify both files exist
    const sourceMetadataPath = path.join(metadataDir, `${sourceId}.json`);
    const targetMetadataPath = path.join(metadataDir, `${targetId}.json`);
    
    try {
      await fs.access(sourceMetadataPath);
      await fs.access(targetMetadataPath);
    } catch {
      res.status(404).json({ error: 'Source or target file not found' });
      return;
    }

    const relationshipsPath = path.join(relationshipsDir, `${sourceId}.json`);
    let relationships = [];
    
    try {
      const existingData = await fs.readFile(relationshipsPath, 'utf-8');
      relationships = JSON.parse(existingData);
    } catch (error) {
      // If file doesn't exist, start with empty array
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error;
      }
    }

    // Add new relationship if it doesn't exist
    if (!relationships.some((rel: any) => rel.targetId === targetId && rel.type === type)) {
      relationships.push({ targetId, type });
      await fs.writeFile(relationshipsPath, JSON.stringify(relationships, null, 2));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding relationship:', error);
    res.status(500).json({ error: 'Failed to add relationship' });
  }
});

// Remove a relationship
router.delete('/files/:sourceId/relationships/:targetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceId, targetId } = req.params;
    const relationshipsPath = path.join(relationshipsDir, `${sourceId}.json`);
    
    try {
      const relationshipsData = await fs.readFile(relationshipsPath, 'utf-8');
      let relationships = JSON.parse(relationshipsData);
      
      // Remove the relationship
      relationships = relationships.filter((rel: any) => rel.targetId !== targetId);
      
      await fs.writeFile(relationshipsPath, JSON.stringify(relationships, null, 2));
      res.json({ success: true });
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        res.json({ success: true }); // If file doesn't exist, consider it a success
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error removing relationship:', error);
    res.status(500).json({ error: 'Failed to remove relationship' });
  }
});

export default router; 