import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define separate paths for logs and temp files
export const LOGS_DIR = path.join(__dirname, '../../../../logs/racket-mcp');
export const TEMP_DIR = path.join(__dirname, '../../temp');  // Keep temp files close to the server

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