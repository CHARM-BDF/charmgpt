import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define separate paths for logs and temp files
export const LOGS_DIR = path.join(__dirname, '../../../../logs/r-mcp');
export const TEMP_DIR = path.join(__dirname, '../../temp');

// Comprehensive list of allowed R packages
const ALLOWED_PACKAGES = new Set([
  // Core data manipulation and visualization
  'tidyverse',
  'ggplot2',
  'dplyr',
  'tidyr',
  'readr',
  'purrr',
  'tibble',
  
  // Statistics and modeling
  'stats',
  'lme4',
  'nlme',
  'mgcv',
  'survival',
  
  // Machine Learning
  'caret',
  'randomForest',
  'xgboost',
  'e1071',
  
  // Data Import/Export
  'jsonlite',
  'readxl',
  'writexl',
  'haven',
  'arrow',
  
  // Visualization
  'plotly',
  'viridis',
  'RColorBrewer',
  'scales',
  
  // Utilities
  'lubridate',
  'stringr',
  'forcats',
  'magrittr',
  'tools',
  'base'
]);

// List of dangerous patterns to check for
const DANGEROUS_PATTERNS = [
  'system(',
  'shell(',
  'system2(',
  'eval(parse(',
  'source(',
  '.Internal(',
  '.Call(',
  '.External(',
  'download.file(',
  'url(',
  'pipe(',
  'socketConnection(',
  'RCurl::',
  'httr::'
];

export function validateRCode(code: string): void {
  // Check for dangerous operations
  for (const pattern of DANGEROUS_PATTERNS) {
    if (code.includes(pattern)) {
      throw new Error(`Forbidden operation detected: ${pattern}`);
    }
  }

  // Check library/require calls against allowed packages
  const libraryMatches = code.matchAll(/(?:library|require)\s*\(\s*['"]?(\w+)['"]?\s*\)/g);
  for (const match of Array.from(libraryMatches)) {
    const package_name = match[1];
    if (!ALLOWED_PACKAGES.has(package_name)) {
      throw new Error(`Package not allowed: ${package_name}. Please use standard data science packages: ${Array.from(ALLOWED_PACKAGES).join(', ')}`);
    }
  }

  // Additional security checks for file operations
  const fileOperations = code.match(/(?:read|write|save|load|sink|cat|print)\.[a-zA-Z]+\s*\(/g) || [];
  for (const op of fileOperations) {
    if (!code.includes('file.path(') && !code.includes('Sys.getenv("OUTPUT_DIR")')) {
      throw new Error(`File operations must use file.path() with OUTPUT_DIR environment variable. Example: file.path(Sys.getenv("OUTPUT_DIR"), "plot.png")`);
    }
  }
}

export async function setupREnvironment() {
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
      R_MAX_MEM: '256M',    // Set R memory limit
    },
    resourceLimits: {
      maxBuffer: 1024 * 1024 * 50,  // 50MB output limit
      maxMemory: 1024 * 1024 * 256, // 256MB memory limit
      timeout: 30000,               // 30 seconds default timeout
      ulimit: ['-v', '268435456']   // Virtual memory limit (256MB in bytes)
    }
  };
}

export async function cleanupREnvironment() {
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