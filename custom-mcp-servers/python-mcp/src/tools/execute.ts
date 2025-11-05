import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import { setupPythonEnvironment, cleanupPythonEnvironment, TEMP_DIR, LOGS_DIR } from './env.js';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createRunLogger, Logger, ProcessedFile, ExecuteArgs, ExecuteResult, CreatedFile, CONTAINER_TEMP_DIR, CONTAINER_LOGS_DIR, processDataFiles, postExecution, UPLOADS_DIR } from "../shared/mcpCodeUtils.js";


const execAsync = promisify(exec);

// Docker configuration
const DOCKER_IMAGE = 'my-python-mcp';

// Ensure log directory exists
try {
  fsSync.mkdirSync(LOGS_DIR, { recursive: true });
  console.error('Created/verified log directory:', LOGS_DIR); // Debug log
} catch (error) {
  console.error('Error creating log directory:', error);
}

// Ensure temp directory exists (for PNG files and scripts)
try {
  fsSync.mkdirSync(TEMP_DIR, { recursive: true });
  console.error('Created/verified temp directory:', TEMP_DIR); // Debug log
} catch (error) {
  console.error('Error creating temp directory:', error);
}

// Add helper function for Python file resolution utilities
function getPythonHelperCode(): string {
  return `
import os
import json
import pandas as pd
from pathlib import Path

# File resolution helper
def _load_file_mapping():
    """Load mapping of original filenames to UUIDs from metadata"""
    metadata_dir = '/app/metadata'
    uploads_dir = '/app/uploads'
    mapping = {}
    
    if not os.path.exists(metadata_dir):
        return mapping
    
    for meta_file in os.listdir(metadata_dir):
        if meta_file.endswith('.json'):
            try:
                with open(os.path.join(metadata_dir, meta_file), 'r') as f:
                    metadata = json.load(f)
                    original_name = metadata.get('description') or metadata.get('originalFilename')
                    if original_name:
                        file_id = meta_file.replace('.json', '')
                        file_path = os.path.join(uploads_dir, file_id)
                        if os.path.exists(file_path):
                            mapping[original_name] = file_path
            except:
                continue
    
    return mapping

# Global file mapping
_FILE_MAPPING = _load_file_mapping()

def resolve_file(filename):
    """Resolve a filename to its actual path (supports both UUID and original name)"""
    # If it's already a valid path, return it
    if os.path.exists(filename):
        return filename
    
    # Check if it's in the mapping
    if filename in _FILE_MAPPING:
        return _FILE_MAPPING[filename]
    
    # Check uploads directory directly
    uploads_path = os.path.join('/app/uploads', filename)
    if os.path.exists(uploads_path):
        return uploads_path
    
    # Not found - provide helpful error message
    available_files = list(_FILE_MAPPING.keys())
    filename_repr = repr(filename)
    parts = []
    parts.append("File not found: " + str(filename_repr))
    parts.append("")
    parts.append("🔍 DEBUGGING INFO:")
    parts.append("- Looking for file: " + str(filename_repr))
    parts.append("- Search locations:")
    parts.append("  1. Direct path: " + str(filename_repr))
    parts.append("  2. File mapping: " + str(filename in _FILE_MAPPING))
    parts.append("  3. Uploads directory: /app/uploads/" + str(filename_repr))
    parts.append("- Available files (" + str(len(available_files)) + " total):")
    for i, file in enumerate(available_files[:10], 1):
        parts.append("  " + str(i) + ". " + str(repr(file)))
    if len(available_files) > 10:
        parts.append("  ... and " + str(len(available_files) - 10) + " more files")
    parts.append("")
    parts.append("💡 SUGGESTIONS:")
    parts.append("- Use list_available_files() to see all available files")
    parts.append("- Check if the filename is spelled correctly")
    parts.append("- Make sure the file was uploaded through the UI")
    newline = chr(10)
    error_msg = newline.join(parts)
    raise FileNotFoundError(error_msg)

def list_available_files():
    """List all available files with their original names"""
    print("Available files:")
    for original_name, path in _FILE_MAPPING.items():
        size = os.path.getsize(path)
        print(f"  - {original_name} ({size:,} bytes)")
    return list(_FILE_MAPPING.keys())

# Override pandas read functions to use resolve_file
_original_read_csv = pd.read_csv
_original_read_excel = pd.read_excel

def read_csv(filepath_or_buffer, *args, **kwargs):
    """Pandas read_csv with automatic file resolution"""
    if isinstance(filepath_or_buffer, str):
        try:
            resolved_path = resolve_file(filepath_or_buffer)
            filepath_or_buffer = resolved_path
        except FileNotFoundError as e:
            print(str(e))
            raise
    return _original_read_csv(filepath_or_buffer, *args, **kwargs)

def read_excel(io, *args, **kwargs):
    """Pandas read_excel with automatic file resolution"""
    if isinstance(io, str):
        try:
            resolved_path = resolve_file(io)
            io = resolved_path
        except FileNotFoundError as e:
            print(str(e))
            raise
    return _original_read_excel(io, *args, **kwargs)

# Monkey-patch pandas
pd.read_csv = read_csv
pd.read_excel = read_excel

`;
}

// Add helper function for code transformation
function transformPythonCode(code: string, logger: Logger): string {
  console.error(`PYTHON SERVER LOGS: Original Python code:\n${code}`);
  
  // Check if code contains file operations but no os import
  if ((code.includes('savefig') || code.includes('to_csv') || code.includes('to_excel') || 
       code.includes('json.dump') || code.includes('write')) && !code.includes('import os')) {
    code = 'import os\n' + code;
    console.error(`PYTHON SERVER LOGS: Added import os to code`);
  }

  // Replace relative paths in common file operations with OUTPUT_DIR
  const fileOperations = [
    {
      // Match both direct path and string concatenation patterns
      pattern: /plt\.savefig\(['"]([^'"]+)['"]\)|plt\.savefig\(os\.environ\['OUTPUT_DIR'\]\s*\+\s*['"]\/([^'"]+)['"]\)|plt\.savefig\(os\.environ\['OUTPUT_DIR'\]\s*\+\s*['"](\\[^'"]+)['"]\)/g,
      replacement: (match: string, p1: string | undefined, p2: string | undefined, p3: string | undefined): string => {
        const filename = p1 || p2 || (p3 ? p3.replace('\\', '') : null);
        if (!filename) return match;
        const result = `plt.savefig(os.path.join(os.environ['OUTPUT_DIR'], '${filename}'))`;
        console.error(`PYTHON SERVER LOGS: Transformed savefig from "${match}" to "${result}"`);
        return result;
      }
    },
    {
      pattern: /to_csv\(['"]([^'"]+)['"]\)/g,
      replacement: (match: string, filename: string): string => {
        const result = `to_csv(os.path.join(os.environ['OUTPUT_DIR'], '${filename}'))`;
        console.error(`PYTHON SERVER LOGS: Transformed to_csv from "${match}" to "${result}"`);
        return result;
      }
    },
    {
      pattern: /to_excel\(['"]([^'"]+)['"]\)/g,
      replacement: (match: string, filename: string): string => {
        const result = `to_excel(os.path.join(os.environ['OUTPUT_DIR'], '${filename}'))`;
        console.error(`PYTHON SERVER LOGS: Transformed to_excel from "${match}" to "${result}"`);
        return result;
      }
    },
    {
      pattern: /json\.dump\(.*?,\s*open\(['"]([^'"]+)['"],\s*['"]w['"]\)/g,
      replacement: (match: string, filename: string): string => {
        const result = match.replace(filename, `os.path.join(os.environ['OUTPUT_DIR'], '${filename}')`);
        console.error(`PYTHON SERVER LOGS: Transformed json.dump from "${match}" to "${result}"`);
        return result;
      }
    }
  ];

  // Apply transformations
  for (const op of fileOperations) {
    if (typeof op.replacement === 'string') {
      code = code.replace(op.pattern, op.replacement);
    } else {
      code = code.replace(op.pattern, op.replacement);
    }
  }

  // Add plt.close() after savefig if not present
  if (code.includes('savefig') && !code.includes('plt.close()')) {
    code += '\nplt.close()  # Auto-added to ensure cleanup';
    console.error(`PYTHON SERVER LOGS: Added plt.close() to code`);
  }

  console.error(`PYTHON SERVER LOGS: Transformed Python code:\n${code}`);
  return code;
}

// Add Docker-specific helper functions
async function ensureDockerImage(): Promise<void> {
  try {
    const { stdout } = await execAsync(`docker images ${DOCKER_IMAGE} -q`);
    if (!stdout.trim()) {
      throw new Error(`Docker image ${DOCKER_IMAGE} not found`);
    }
  } catch (error) {
    throw new Error(`Failed to check Docker image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface DockerEnvConfig {
  env: Record<string, string | undefined>;
  resourceLimits: {
    maxBuffer: number;
    maxMemory: number;
    timeout: number;
    ulimit: string[];
  };
}

async function runInDocker(scriptPath: string, envConfig: DockerEnvConfig, logger: Logger): Promise<string> {
  const hostScriptPath = path.resolve(scriptPath);
  const scriptName = path.basename(scriptPath);
  
  try {
    // Prepare Docker run arguments
    const dockerArgs = [
      'run',
      '--rm',  // Remove container after execution
      '-v', `${path.dirname(hostScriptPath)}:${CONTAINER_TEMP_DIR}`,
      '-v', `${LOGS_DIR}:${CONTAINER_LOGS_DIR}`,
      '-v', `${UPLOADS_DIR}:/app/uploads:ro`,  // Add this - read-only uploads
      '-v', `${path.join(UPLOADS_DIR, 'metadata')}:/app/metadata:ro`,  // Add this - read-only metadata
      '-w', CONTAINER_TEMP_DIR,  // Set working directory
      '--memory', '256m',  // Memory limit
      '--cpus', '1.0',     // CPU limit
      // Add environment variables, but map OUTPUT_DIR to container path
      ...Object.entries({
        ...envConfig.env,
        OUTPUT_DIR: CONTAINER_TEMP_DIR  // Override OUTPUT_DIR to use container path
      })
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ['-e', `${key}=${value}`])
        .flat(),
      DOCKER_IMAGE,
      'python', '-u', scriptName  // -u for unbuffered output
    ];

    logger.log(`Running Docker command: docker ${dockerArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      const dockerProcess = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

      dockerProcess.stdout.on('data', (data) => {
        const message = data.toString();
        if (!logger.isClosed) logger.log(`Python output: ${message}`);
        output += message;
      });

      dockerProcess.stderr.on('data', (data) => {
        const message = data.toString();
        if (!logger.isClosed) logger.log(`Python stderr: ${message}`);
        errorOutput += message;
      });

      dockerProcess.on('error', (error) => {
        const errorMessage = `Docker process error: ${error.message}\nCommand: docker ${dockerArgs.join(' ')}`;
        if (!logger.isClosed) logger.log(errorMessage);
        reject(new Error(errorMessage));
      });

      dockerProcess.on('close', (code) => {
        if (code === 0) {
          if (!logger.isClosed) logger.log('Docker container exited successfully');
          resolve(output.trim());
        } else {
          // Construct detailed error with all Python output
          // Prioritize stderr (Python errors/tracebacks) over stdout
          const pythonError = errorOutput || output || '(no error output)';
          
          // Build comprehensive error message
          let errorMessage = [
            '❌ Python Execution Error',
            `Exit code: ${code}`,
            '',
            '--- Python Error Output (stderr) ---',
            pythonError,
            '',
          ].join('\n');
          
          // Add stdout if it exists and is different from stderr
          if (output && output.trim() && output.trim() !== pythonError.trim()) {
            errorMessage += [
              '--- Standard Output (stdout) ---',
              output,
              '',
            ].join('\n');
          }

          if (!logger.isClosed) logger.log(`Docker execution failed:\n${errorMessage}`);
          
          // Create error with additional properties for better error handling
          const error = new Error(errorMessage) as any;
          error.pythonError = pythonError;
          error.stdout = output;
          error.stderr = errorOutput;
          error.exitCode = code;
          reject(error);
        }
      });

      // Handle timeout
      const timeoutId = setTimeout(() => {
        dockerProcess.kill();
        const pythonError = errorOutput || output || '(no error output)';
        const timeoutMessage = [
          '⏱️ Python Execution Timeout',
          'Execution exceeded 30 seconds and was terminated',
          '',
          '--- Partial Python Output ---',
          pythonError,
        ].join('\n');
        
        if (!logger.isClosed) logger.log(timeoutMessage);
        
        const error = new Error(timeoutMessage) as any;
        error.pythonError = pythonError;
        error.stdout = output;
        error.stderr = errorOutput;
        error.isTimeout = true;
        reject(error);
      }, 30000); // 30 seconds timeout

      // Clean up timeout on success or error
      dockerProcess.on('close', () => clearTimeout(timeoutId));
      dockerProcess.on('error', () => clearTimeout(timeoutId));
    });
  } catch (error) {
    const errorMessage = `Docker execution error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    if (!logger.isClosed) logger.log(errorMessage);
    throw new Error(errorMessage);
  }
}

export async function execute(args: ExecuteArgs): Promise<ExecuteResult> {
  const { code: originalCode, dataFiles, timeout = 30 } = args;
  
  // Create logger first
  const logger = createRunLogger(LOGS_DIR, TEMP_DIR);
  let scriptPath = '';
  let processedFiles: ProcessedFile[] = [];
  
  try {
    // Process dataFiles first
    if (dataFiles && Object.keys(dataFiles).length > 0) {
      logger.log('Processing dataFiles...');
      processedFiles = await processDataFiles(TEMP_DIR,dataFiles, logger);
      logger.log(`Processed ${processedFiles.length} files`);
    }
    
    // Transform code to handle file operations
    const transformedCode = transformPythonCode(originalCode, logger);
    
    // Prepend helper code
    const code = getPythonHelperCode() + '\n\n' + transformedCode;
    
    // Log if code was transformed or files were added
    if (code !== originalCode) {
      logger.log('Code was enhanced with file loading and/or transformations');
      logger.log(`Original code: ${originalCode}`);
      logger.log(`Final code: ${code}`);
    }

    // Log the Python code being executed
    logger.log(code);
    
    // Set up Python environment with security settings
    const envConfig = await setupPythonEnvironment();
    
    // Ensure Docker image exists
    await ensureDockerImage();
    
    // Create a temporary Python file with the code
    scriptPath = path.join(TEMP_DIR, `script_${Date.now()}.py`);
    logger.log(`Script path: ${scriptPath}`);
    
    // Write the code to the temporary file
    await fs.writeFile(scriptPath, code, 'utf-8');
    logger.log('Python code written to temporary file');

    // Take pre-execution snapshot of files in temp directory
    const preExecutionFiles = new Set(await fs.readdir(TEMP_DIR));
    logger.log(`Pre-execution files: ${Array.from(preExecutionFiles).join(', ')}`);

    // Run the code in Docker and collect output
    const output = await runInDocker(scriptPath, envConfig, logger);

    const createdFiles: CreatedFile[] = [];
    const binaryOutput = await postExecution("Python",createdFiles, TEMP_DIR, preExecutionFiles, logger, code);

    // Clean up after execution
    await cleanupPythonEnvironment();
    
    // Clean up script file
    try {
      logger.log(`Cleaning up script file: ${scriptPath}`);
      await fs.unlink(scriptPath);
    } catch (error) {
      // Ignore file not found errors during cleanup
      if (error instanceof Error && !error.message.includes('ENOENT')) {
        logger.log(`Error cleaning up temp file: ${error}`);
        console.error(`PYTHON SERVER LOGS: Error cleaning up temp file: ${error}`);
      }
    }
    
    // Clean up processed data files
    for (const file of processedFiles) {
      try {
        logger.log(`Cleaning up processed file: ${file.filePath}`);
        await fs.unlink(file.filePath);
      } catch (error) {
        // Ignore file not found errors during cleanup
        if (error instanceof Error && !error.message.includes('ENOENT')) {
          logger.log(`Error cleaning up processed file: ${error}`);
        }
      }
    }

    const result: ExecuteResult = { 
      output, 
      code,
      type: binaryOutput ? 'matplotlib.figure' as const : 'text' as const,
      metadata: binaryOutput ? { hasBinaryOutput: true } : {},
      binaryOutput,
      createdFiles
    };
    
    logger.log(`Execution completed successfully`);
    console.error(`PYTHON SERVER LOGS: Execution completed successfully`);
    logger.log(`Result type: ${result.type}`);
    console.error(`PYTHON SERVER LOGS: Result type: ${result.type}`);
    if (binaryOutput) {
      logger.log(`Binary output size: ${binaryOutput.metadata.size} bytes`);
      console.error(`PYTHON SERVER LOGS: Binary output included in result, size: ${binaryOutput.metadata.size} bytes`);
    } else {
      console.error(`PYTHON SERVER LOGS: No binary output included in result`);
    }
    
    return result;

  } catch (error) {
    // Attempt cleanup even if execution failed
    logger.log(`Execution error: ${error}`);
    
    // If it's already a Python error with details, preserve those
    const errorObj = error as any;
    if (errorObj.pythonError || errorObj.isTimeout) {
      // This is a Python execution error with full details - just propagate it
      throw error;
    }
    
    // For other errors (Docker setup, file I/O, etc.), add context
    try {
      await cleanupPythonEnvironment();
      if (scriptPath) {
        await fs.unlink(scriptPath).catch(() => {}); // Ignore cleanup errors
      }
      // Clean up processed files on error
      for (const file of processedFiles) {
        await fs.unlink(file.filePath).catch(() => {}); // Ignore cleanup errors
      }
    } catch (cleanupError) {
      logger.log(`Cleanup error: ${cleanupError}`);
    }

    // Enhance error message with context if it doesn't have Python details
    if (!errorObj.pythonError && !errorObj.isTimeout) {
      const enhancedError = new Error(
        `Python execution setup failed: ${error instanceof Error ? error.message : String(error)}`
      ) as any;
      enhancedError.originalError = error;
      throw enhancedError;
    }

    // For Python errors with details, just propagate them as-is
    throw error;
  } finally {
    logger.close();
  }
}