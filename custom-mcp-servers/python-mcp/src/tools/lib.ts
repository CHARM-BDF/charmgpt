import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONTAINER_TEMP_DIR = '/app/temp';
export const CONTAINER_LOGS_DIR = '/app/logs';
export const CONTAINER_UPLOADS_DIR = '/app/uploads';

// Get uploads directory path (relative to project root)
export const UPLOADS_DIR = path.join(__dirname, '../../../../backend-mcp-client/uploads');


export function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.csv': return 'text/csv';
      case '.json': return 'application/json';
      case '.txt': return 'text/plain';
      case '.png': return 'image/png';
      case '.jpg': case '.jpeg': return 'image/jpeg';
      case '.parquet': return 'application/octet-stream';
      case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default: return 'application/octet-stream';
    }
  }
  
  export async function storeFileInServerStorage(
    tempFilePath: string, 
    originalFilename: string, 
    sourceCode: string,
    logger: Logger
  ): Promise<{fileId: string, size: number}> {
    try {
      // Generate UUID for the file
      const fileId = randomUUID();
      
      // Move file to uploads directory (same as storage API)
      const uploadsDir = path.resolve(__dirname, '../../../../backend-mcp-client/uploads');
      if (!fsSync.existsSync(uploadsDir)) {
        fsSync.mkdirSync(uploadsDir, { recursive: true });
      }
      const permanentFilePath = path.join(uploadsDir, fileId);
      await fs.rename(tempFilePath, permanentFilePath);
      
      // Create metadata (same format as storage API)
      const stats = await fs.stat(permanentFilePath);
      const metadata = {
        description: originalFilename,
        schema: {
          type: 'tabular' as const,
          format: getMimeType(originalFilename),
          encoding: 'utf-8',
          sampleData: ''
        },
        tags: ['python-output', 'auto-generated'],
        originalFilename,
        generatedBy: 'python-mcp',
        generatedAt: new Date().toISOString(),
        sourceCode,
        size: stats.size
      };
      
      // Store metadata (same as storage API)
      const metadataDir = path.join(uploadsDir, 'metadata');
      if (!fsSync.existsSync(metadataDir)) {
        fsSync.mkdirSync(metadataDir, { recursive: true });
      }
      const metadataPath = path.join(metadataDir, `${fileId}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      logger.log(`Stored file in server storage: ${originalFilename} -> ${fileId}`);
      return {fileId, size: stats.size}; // Return both fileId and size
      
    } catch (error) {
      logger.log(`Error storing file in server storage: ${error}`);
      throw error;
    }
  }

  // Logger type definition
export interface Logger {
    log: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
    close: () => void;
    isClosed: boolean;
}

export function makeLogger(x: any): Logger {
    const log_type = x.log_type;
    const close = x.close || (() => {});
    const isClosed = x.isClosed || false;
    return {
      log: (message: string, ...args: any[]) => {
        log_type("LOG", message, ...args);
      },
      info: (message: string, ...args: any[]) => {
        log_type("INFO", message, ...args);
      },
      error: (message: string, ...args: any[]) => {
        log_type("ERROR", message, ...args);
      },
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          log_type("DEBUG", message, ...args);
        }
      },
      close,
      isClosed
    }
}

export function createRunLogger(LOGS_DIR: string, TEMP_DIR: string): Logger {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `run_${timestamp}.log`;
    const logFilePath = path.join(LOGS_DIR, logFileName);
    
    // Create write stream for logging
    const logStream = fsSync.createWriteStream(logFilePath, { flags: 'a' });
    let isClosed = false;
    
    // Log the paths being used
    logStream.write(`Log file path: ${logFilePath}\n`);
    logStream.write(`Temp directory path: ${TEMP_DIR}\n`);
    
    return makeLogger({
      log_type: (type: string, message: string, ...args: any[]) => {
        if (!isClosed) {
          const timestamp = new Date().toISOString();
          const logMessage = `[${timestamp}] ${message}\n`;
          logStream.write(logMessage);
        }
      },
      close: () => {
        if (!isClosed) {
          isClosed = true;
          logStream.end();
        }
      },
      isClosed
    });
  }

  // import { getArtifactTypeForFile, canViewAsArtifact, getLanguageForFile } from '../../../frontend-client/src/utils/fileArtifactMapping.js';
// Add these local functions instead:
export function getArtifactTypeForFile(fileName: string, mimeType: string): string {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    
    // Direct MIME type mappings
    if (mimeType.startsWith('image/svg')) return 'image/svg+xml';
    if (mimeType.startsWith('image/png')) return 'image/png';
    if (mimeType === 'text/html') return 'html';
    if (mimeType === 'application/json') return 'application/json';
    if (mimeType === 'text/markdown') return 'text/markdown';
    
    // Extension-based mappings
    switch (extension) {
      case 'json': return 'application/json';
      case 'md': case 'markdown': return 'text/markdown';
      case 'html': case 'htm': return 'html';
      case 'png': return 'image/png';
      case 'py': return 'application/python';
      case 'csv': case 'tsv': return 'text/markdown'; // CSV displayed as table
      case 'txt': case 'log': return 'text';
      default: return 'text';
    }
  }
  
  export function canViewAsArtifact(fileName: string, mimeType: string): boolean {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    const unsupportedExtensions = ['exe', 'bin', 'dll', 'so', 'zip', 'rar', '7z'];
    return !unsupportedExtensions.includes(extension);
  }
  
  export function getLanguageForFile(fileName: string, mimeType: string): string | undefined {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    switch (extension) {
      case 'py': return 'python';
      case 'js': return 'javascript';
      case 'json': return 'json';
      case 'html': return 'html';
      case 'md': return 'markdown';
      default: return undefined;
    }
  }

  export interface ExecuteArgs {
    code: string;
    dataFiles?: Record<string, string>;
    timeout?: number;
  }
  
  export interface ExecuteResult {
    output: string;
    code: string;
    type?: 'text' | 'numpy.array' | 'pandas.dataframe' | 'matplotlib.figure' | 'binary' | 'json';
    metadata?: Record<string, any>;
    binaryOutput?: {
      data: string;  // base64 encoded
      type: string;  // MIME type
      metadata: {
        filename: string;
        size: number;
        dimensions: {
          width: number;
          height: number;
        };
        sourceCode: string;  // Source code that generated the output
      };
    };
    createdFiles?: CreatedFile[];
  }
  
  export interface CreatedFile {
    fileId: string;
    originalFilename: string;
    size: number; // Add this field
  }
  
  // File processing functions
  export interface ProcessedFile {
    varName: string;
    filePath: string;
    fileType: string;
    originalName: string;
  }
  
  export function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
  
  export async function resolveFileId(fileReference: string): Promise<{ filePath: string; metadata: any } | null> {
    try {
      // First, try as a UUID (file ID)
      if (isValidUUID(fileReference)) {
        const filePath = path.join(UPLOADS_DIR, fileReference);
        const metadataPath = path.join(UPLOADS_DIR, 'metadata', `${fileReference}.json`);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Try to read metadata
        let metadata = {};
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
        } catch (error) {
          // Metadata not required, continue without it
        }
        
        return { filePath, metadata };
      }
      
      // If not a UUID, try to find by filename in the uploads directory
      const metadataDir = path.join(UPLOADS_DIR, 'metadata');
      const metadataFiles = await fs.readdir(metadataDir);
      
      for (const metadataFile of metadataFiles) {
        if (metadataFile.endsWith('.json')) {
          try {
            const metadataPath = path.join(metadataDir, metadataFile);
            const metadataContent = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            
            // Check if this file matches the requested filename
            if (metadata.description === fileReference) {
              const fileId = metadataFile.replace('.json', '');
              const filePath = path.join(UPLOADS_DIR, fileId);
              
              // Verify the file exists
              await fs.access(filePath);
              
              return { filePath, metadata };
            }
          } catch (error) {
            // Skip this metadata file if it's invalid
            continue;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  export function detectFileType(filePath: string, metadata: any): string {
    const ext = path.extname(filePath).toLowerCase();
    
    // Use metadata if available
    if (metadata.schema?.format) {
      return metadata.schema.format;
    }
    
    // Fall back to extension detection
    switch (ext) {
      case '.csv': return 'csv';
      case '.json': return 'json';
      case '.xlsx': case '.xls': return 'excel';
      case '.txt': return 'text';
      case '.parquet': return 'parquet';
      default: return 'unknown';
    }
  }
  
  export async function processDataFiles(TEMP_DIR: string, dataFiles: Record<string, string>, logger: Logger): Promise<ProcessedFile[]> {
    const processedFiles: ProcessedFile[] = [];
    
    for (const [varName, fileReference] of Object.entries(dataFiles)) {
      logger.log(`Processing dataFile: ${varName} -> ${fileReference}`);
      
      let sourceFilePath: string;
      let metadata: any = {};
      let originalName: string;
      
      // Try to resolve the file reference (either UUID or filename)
      logger.log(`Resolving file reference: ${fileReference}`);
      const resolved = await resolveFileId(fileReference);
      
      if (resolved) {
        // Successfully resolved (either by UUID or filename)
        sourceFilePath = resolved.filePath;
        metadata = resolved.metadata;
        originalName = metadata.description || fileReference;
      } else {
        // Fallback: treat as direct file path (backward compatibility)
        logger.log(`File reference not found in uploads, treating as direct path: ${fileReference}`);
        sourceFilePath = fileReference;
        originalName = path.basename(fileReference);
      }
      
      // Copy file to temp directory with original name
      const tempFilePath = path.join(TEMP_DIR, originalName);
      
      logger.log(`Copying file from ${sourceFilePath} to ${tempFilePath}`);
      await fs.copyFile(sourceFilePath, tempFilePath);
      
      // Set proper permissions for Docker
      await fs.chmod(tempFilePath, 0o644);
      
      const fileType = detectFileType(sourceFilePath, metadata);
      
      processedFiles.push({
        varName,
        filePath: tempFilePath,
        fileType,
        originalName
      });
      
      logger.log(`Processed file: ${varName} (${fileType}) -> ${tempFilePath}`);
    }
    
    return processedFiles;
  }

  export function getResponse(lang: string, result: ExecuteResult, logger: Logger) {
    const artifacts = [];
    const content = [];
    let metadata = null;

    artifacts.push({
      type: "code",
      title: lang+" Code",
      content: result.code,
      language: lang.toLowerCase(),
      metadata: {
        editorView: true,
        executable: true,
        sourceCode: result.code
      }
    })
    // Handle binary output if present
    if (result.binaryOutput) {
        console.error("PYTHON SERVER LOGS: Binary output detected!");
        console.error(`PYTHON SERVER LOGS: Binary type: ${result.binaryOutput.type}`);
        console.error(`PYTHON SERVER LOGS: Binary size: ${result.binaryOutput.metadata.size} bytes`);
        console.error(`PYTHON SERVER LOGS: Binary dimensions: ${result.binaryOutput.metadata.dimensions.width}x${result.binaryOutput.metadata.dimensions.height}`);
        console.error(`PYTHON SERVER LOGS: Binary content starts with: ${result.binaryOutput.data.substring(0, 50)}...`);
        
        logger.info("Binary output detected:");
        logger.info(`- Type: ${result.binaryOutput.type}`);
        logger.info(`- Size: ${result.binaryOutput.metadata.size} bytes`);
        logger.info(`- Metadata: ${JSON.stringify(result.binaryOutput.metadata, null, 2)}`);
  
        content.push(
          {
            type: "text",
            text: `Generated ${result.binaryOutput.type} output (${result.binaryOutput.metadata.size} bytes)`,
          }
        );
        artifacts.push(
          {
            type: result.binaryOutput.type,
            title: `Python Generated ${result.binaryOutput.type.split('/')[1].toUpperCase()}`,
            content: result.binaryOutput.data,
            metadata: {
              ...result.binaryOutput.metadata,
              sourceCode: result.code
            }
          }
        );
        metadata = {
            hasBinaryOutput: true,
            binaryType: result.binaryOutput.type,
        }
      } else {
        console.error("PYTHON SERVER LOGS: No binary output detected in execution result");
      }
  
      // Log standard output result
      console.error(`PYTHON SERVER LOGS: Standard output result (${result.output.length} chars):`);
      console.error(`PYTHON SERVER LOGS: Output type: ${result.type || 'text'}`);
      console.error(`PYTHON SERVER LOGS: Output preview: ${result.output.substring(0, 100)}...`);
      
      logger.info("Standard output result:");
      logger.info(`- Type: ${result.type || 'text'}`);
      logger.info(`- Output length: ${result.output.length} characters`);
      if (result.metadata) {
        logger.info(`- Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
      }
      
      if (result.output.length > 1 || result.output.includes('\n')) {
        console.error("PYTHON SERVER LOGS: Creating text/markdown artifact for output");
        artifacts.push({
          type: "text/markdown",
          title: "Python Output",
          content: "```\n" + result.output + "\n```"
        });
        console.error(`PYTHON SERVER LOGS: Created markdown artifact with length ${artifacts[artifacts.length - 1].content.length}`);
      } else {
        console.error("PYTHON SERVER LOGS: Output too short, not creating output artifact");
      }
  
      // Handle created files if present
      if (result.createdFiles && result.createdFiles.length > 0) {
        console.error("PYTHON SERVER LOGS: Created files detected in result");
        console.error(`PYTHON SERVER LOGS: Created ${result.createdFiles.length} files`);
        
        for (const createdFile of result.createdFiles) {
          console.error(`PYTHON SERVER LOGS: Processing created file: ${createdFile.originalFilename} (${createdFile.fileId})`);
          
          // Determine MIME type from filename
          const mimeType = getMimeType(createdFile.originalFilename);
          
          // Check if file can be viewed as artifact
          if (canViewAsArtifact(createdFile.originalFilename, mimeType)) {
            const artifactType = getArtifactTypeForFile(createdFile.originalFilename, mimeType);
            
            artifacts.push({
              id: crypto.randomUUID(),
              artifactId: crypto.randomUUID(),
              type: artifactType,
              title: `Generated: ${createdFile.originalFilename}`,
              content: '', // Empty content - will be loaded dynamically
              timestamp: new Date(),
              position: artifacts.length,
              language: getLanguageForFile(createdFile.originalFilename, mimeType),
              metadata: {
                fileReference: {
                  fileId: createdFile.fileId,
                  fileName: createdFile.originalFilename,
                  fileType: mimeType,
                  fileSize: createdFile.size
                }
              }
            });
            
            console.error(`PYTHON SERVER LOGS: Created file reference artifact for: ${createdFile.originalFilename}`);
          } else {
            console.error(`PYTHON SERVER LOGS: File type not suitable for artifact viewing: ${createdFile.originalFilename}`);
          }
        }
      }
  
      return {
        content: [{
          type: "text",
          text: result.output || "Code executed successfully with no text output.",
        }],
        artifacts,
        metadata: metadata || result.metadata,
        isError: false,
      };
  }