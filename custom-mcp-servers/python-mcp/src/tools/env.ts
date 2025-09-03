import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define separate paths for logs and temp files
export const LOGS_DIR = path.join(__dirname, '../../../../logs/racket-mcp');
export const TEMP_DIR = path.join(__dirname, '../../temp');  // Keep temp files close to the server


export async function setupPythonEnvironment() {
  // Create temp directory if it doesn't exist
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create temp directory: ${error.message}`);
    }
    throw new Error('Failed to create temp directory: Unknown error');
  }

  // Get the virtual environment path
  //const venvPath = path.join(__dirname, '../../venv');
  //const sitePackages = path.join(venvPath, 'lib', 'python3.11', 'site-packages');

  // Environment configuration with security settings
  return {
    env: {
      //PYTHONPATH: sitePackages,
      PYTHONUNBUFFERED: '1',
      MPLBACKEND: 'Agg',  // Non-interactive matplotlib backend
      OUTPUT_DIR: TEMP_DIR,  // Use the shared temp directory
      // Disable potentially dangerous environment variables
      PYTHONEXECUTABLE: undefined,
      PYTHONSTARTUP: undefined,
      PYTHONCASEOK: undefined,
      PYTHONIOENCODING: 'utf-8',
      // Memory limits
      PYTHONMEMORY: '256M',  // Set Python memory limit to 256MB
      PYTHONMALLOC: 'malloc'  // Use standard malloc
    },
    resourceLimits: {
      maxBuffer: 1024 * 1024 * 50, // 50MB output limit
      maxMemory: 1024 * 1024 * 256, // 256MB memory limit
      timeout: 30000, // 30 seconds default timeout,
      ulimit: ['-v', '268435456']  // Virtual memory limit (256MB in bytes)
    }
  };
}

export async function cleanupPythonEnvironment() {
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