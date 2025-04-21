import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define separate paths for logs and temp files
export const LOGS_DIR = path.join(__dirname, '../../../../logs/python-mcp');
export const TEMP_DIR = path.join(__dirname, '../../temp');  // Keep temp files close to the server

// Comprehensive list of allowed Python packages
const ALLOWED_PACKAGES = new Set([
  // Core data science
  'numpy',
  'pandas',
  'scipy',
  'sklearn',
  'statsmodels',
  
  // Visualization
  'matplotlib',
  'seaborn',
  'plotly',
  'bokeh',
  
  // Machine Learning
  'tensorflow',
  'torch',
  'keras',
  'xgboost',
  'lightgbm',
  
  // Data Processing
  'nltk',
  'spacy',
  'gensim',
  'beautifulsoup4',
  'requests',
  
  // Utilities
  'datetime',
  'json',
  'csv',
  'math',
  'random',
  'collections',
  're',
  'itertools',
  'functools',
  'resource',  // For memory management
  'memory_profiler',  // For memory profiling
  'psutil',  // For process and system utilities
  'gc',  // For garbage collection
  'threading',  // For thread management
  'time',  // For time operations
  'os'  // Limited usage for process management
]);

// List of dangerous patterns to check for
const DANGEROUS_PATTERNS = [
  'import sys',
  'import subprocess',
  '__import__',
  'eval(',
  'exec(',
  'open(',
  'file(',
  'system(',
  'popen(',
  'subprocess',
  'import socket',
  'import shutil',
  'os.system',  // Block dangerous os operations
  'os.popen',
  'os.spawn',
  'os.exec'
];

export function validatePythonCode(code: string): void {
  // Check for dangerous imports and operations
  for (const pattern of DANGEROUS_PATTERNS) {
    if (code.includes(pattern)) {
      throw new Error(`Forbidden operation detected: ${pattern}`);
    }
  }

  // Check imports against allowed packages
  const importMatches = code.matchAll(/^import\s+(\w+)|^from\s+(\w+)/gm);
  for (const match of importMatches) {
    const package_name = match[1] || match[2];
    if (!ALLOWED_PACKAGES.has(package_name)) {
      throw new Error(`Package not allowed: ${package_name}. Please use standard data science packages: ${Array.from(ALLOWED_PACKAGES).join(', ')}`);
    }
  }

  // Additional check for os module usage
  if (code.includes('import os')) {
    const osOperations = code.match(/os\.\w+/g) || [];
    const allowedOsOperations = new Set([
      'os.getpid',
      'os._exit',
      'os.environ',
      'os.path',
      'os.path.join'
    ]);
    for (const op of osOperations) {
      if (!allowedOsOperations.has(op)) {
        throw new Error(`Forbidden os operation: ${op}. Only process management operations and path operations are allowed.`);
      }
    }
  }
}

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
  const venvPath = path.join(__dirname, '../../venv');
  const sitePackages = path.join(venvPath, 'lib', 'python3.11', 'site-packages');

  // Environment configuration with security settings
  return {
    env: {
      PYTHONPATH: sitePackages,
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