import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define separate paths for logs and temp files
export const LOGS_DIR = path.join(__dirname, '../../../../logs/racket-mcp');
export const TEMP_DIR = path.join(__dirname, '../../temp');  // Keep temp files close to the server

// Comprehensive list of allowed Racket libraries
const ALLOWED_LIBRARIES = new Set([
  // Core libraries
  'racket/base',
  'racket/list',
  'racket/string',
  'racket/math',
  'racket/file',
  'racket/path',
  
  // Data processing
  'json',
  'csv-reading',
  'data-frame',
  'statistics',
  
  // Visualization
  'plot',
  'plot/pict',
  'plot/utils',
  
  // Math and science
  'math/statistics',
  'math/distributions',
  'math/matrix',
  'math/number-theory',
  
  // Utilities
  'racket/date',
  'racket/random',
  'racket/hash',
  'racket/vector',
  'racket/set',
  'racket/format',
  'racket/port',
  'racket/system'  // Limited usage for process management
]);

// List of dangerous patterns to check for
const DANGEROUS_PATTERNS = [
  'eval',
  'system*',
  'system',
  'subprocess',
  'process*',
  'shell-execute',
  'dynamic-require',
  'load',
  'load-extension',
  'ffi-lib',
  'network',
  'tcp-connect',
  'udp-bind',
  'file-exists?',
  'delete-file',
  'delete-directory'
];

export function validateRacketCode(code: string): void {
  // Check for dangerous operations
  for (const pattern of DANGEROUS_PATTERNS) {
    if (code.includes(pattern)) {
      throw new Error(`Forbidden operation detected: ${pattern}`);
    }
  }

  // Check requires against allowed libraries
  const requireMatches = code.matchAll(/\(require\s+([\w\/\-]+)\)/gm);
  for (const match of requireMatches) {
    const library_name = match[1];
    if (!ALLOWED_LIBRARIES.has(library_name)) {
      throw new Error(`Library not allowed: ${library_name}. Please use standard libraries: ${Array.from(ALLOWED_LIBRARIES).join(', ')}`);
    }
  }

  // Additional check for system operations
  if (code.includes('racket/system')) {
    const systemOperations = code.match(/\([\w\-]+[^)]*\)/g) || [];
    const allowedSystemOperations = new Set([
      'getenv',
      'putenv',
      'current-directory',
      'build-path'
    ]);
    for (const op of systemOperations) {
      const opName = op.match(/\((\w[\w\-]*)/)?.[1];
      if (opName && opName.includes('system') && !allowedSystemOperations.has(opName)) {
        throw new Error(`Forbidden system operation: ${opName}. Only environment and path operations are allowed.`);
      }
    }
  }
}

export async function setupRacketEnvironment() {
  // Create temp directory if it doesn't exist
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create temp directory: ${error.message}`);
    }
    throw new Error('Failed to create temp directory: Unknown error');
  }

  // Environment configuration with security settings
  return {
    env: {
      OUTPUT_DIR: TEMP_DIR,  // Use the shared temp directory
      // X11 and display settings for headless GUI operations (optimized for lower memory)
      DISPLAY: ':99',
      XVFB_WHD: '800x600x16',
      // Disable potentially dangerous environment variables
      RACKET_USER_DIR: undefined,
      RACKET_ADDON_DIR: undefined,
      // Memory and resource limits (increased for plotting)
      RACKET_MEMORY: '512M',  // Set Racket memory limit to 512MB
      PLT_COMPILED_FILE_CHECK: 'modify-seconds'  // Standard compiled file checking
    },
    resourceLimits: {
      maxBuffer: 1024 * 1024 * 50, // 50MB output limit
      maxMemory: 1024 * 1024 * 512, // 512MB memory limit (increased for plotting)
      timeout: 45000, // 45 seconds timeout (increased for plotting operations)
      ulimit: ['-v', '536870912']  // Virtual memory limit (512MB in bytes)
    }
  };
}

export async function cleanupRacketEnvironment() {
  // Clean up temp directory
  try {
    const files = await fs.readdir(TEMP_DIR);
    await Promise.all(
      files.map(file => fs.unlink(path.join(TEMP_DIR, file)))
    );
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
    // Don't throw here, just log the error
  }
} 