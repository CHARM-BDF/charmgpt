import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { setupPythonEnvironment, cleanupPythonEnvironment, validatePythonCode, TEMP_DIR, LOGS_DIR } from './env.js';
import { appendFileSync, mkdirSync } from 'fs';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Docker configuration
const DOCKER_IMAGE = 'my-python-mcp';
const CONTAINER_TEMP_DIR = '/app/temp';
const CONTAINER_LOGS_DIR = '/app/logs';

// Ensure log directory exists
try {
  mkdirSync(LOGS_DIR, { recursive: true });
  console.error('Created/verified log directory:', LOGS_DIR); // Debug log
} catch (error) {
  console.error('Error creating log directory:', error);
}

// Ensure temp directory exists (for PNG files and scripts)
try {
  mkdirSync(TEMP_DIR, { recursive: true });
  console.error('Created/verified temp directory:', TEMP_DIR); // Debug log
} catch (error) {
  console.error('Error creating temp directory:', error);
}

// Logger type definition
interface Logger {
  log: (message: string) => void;
  close: () => void;
  isClosed: boolean;
}

function createRunLogger(): Logger {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `run_${timestamp}.log`;
  const logFilePath = path.join(LOGS_DIR, logFileName);
  
  // Create write stream for logging
  const logStream = createWriteStream(logFilePath, { flags: 'a' });
  let isClosed = false;
  
  // Log the paths being used
  logStream.write(`Log file path: ${logFilePath}\n`);
  logStream.write(`Temp directory path: ${TEMP_DIR}\n`);
  
  return {
    log: (message: string) => {
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
  };
}

function log(type: string, message: string, color: string, logFile: string) {
  // Get timestamp in Central Time
  const timestamp = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
  
  const logMessage = `${timestamp} ${color}[PYTHON-MCP ${type}]\x1b[0m ${message}\n`;
  const fileMessage = `${timestamp} [PYTHON-MCP ${type}] ${message}\n`;
  
  // Write to console with color
  process.stderr.write(logMessage);
  
  // Write to run-specific log file without color
  try {
    appendFileSync(logFile, fileMessage);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

interface ExecuteArgs {
  code: string;
  dataFiles?: Record<string, string>;
  timeout?: number;
}

interface ExecuteResult {
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
          // Construct detailed error message
          const errorMessage = [
            `Docker container exited with code ${code}`,
            'Command:',
            `docker ${dockerArgs.join(' ')}`,
            '',
            'Error output:',
            errorOutput || '(no error output)',
            '',
            'Standard output:',
            output || '(no standard output)',
          ].join('\n');

          if (!logger.isClosed) logger.log(`Docker execution failed:\n${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      // Handle timeout
      const timeoutId = setTimeout(() => {
        dockerProcess.kill();
        const timeoutMessage = [
          'Docker execution timed out after 30 seconds',
          'Command:',
          `docker ${dockerArgs.join(' ')}`,
          '',
          'Partial output:',
          output || '(no output)',
          '',
          'Error output:',
          errorOutput || '(no error output)',
        ].join('\n');
        
        if (!logger.isClosed) logger.log(timeoutMessage);
        reject(new Error(timeoutMessage));
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
  const { code: originalCode, timeout = 30 } = args;
  
  // Create logger first
  const logger = createRunLogger();
  let scriptPath = '';
  
  try {
    // Validate Python code before transformation
    validatePythonCode(originalCode);
    logger.log('Python code validation passed');
    
    // Transform code to handle file operations
    const code = transformPythonCode(originalCode, logger);
    
    // Log if code was transformed
    if (code !== originalCode) {
      logger.log('Code was transformed to use OUTPUT_DIR for file operations');
      logger.log(`Original code: ${originalCode}`);
      logger.log(`Transformed code: ${code}`);
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

    // Run the code in Docker and collect output
    const output = await runInDocker(scriptPath, envConfig, logger);

    // Check for binary output files in the temp directory
    logger.log('Checking temp directory for files...');
    const files = await fs.readdir(TEMP_DIR);
    logger.log(`Files in temp directory: ${files.join(', ')}`);
    console.error(`PYTHON SERVER LOGS: Files found in temp directory: ${files.join(', ')}`);
    
    let binaryOutput: ExecuteResult['binaryOutput'] | undefined;

    for (const file of files) {
      logger.log(`Processing file: ${file}`);
      console.error(`PYTHON SERVER LOGS: Processing file: ${file}`);
      
      if (file.endsWith('.png')) {
        logger.log(`Found PNG file: ${file}`);
        console.error(`PYTHON SERVER LOGS: Found PNG file: ${file}`);
        const filePath = path.join(TEMP_DIR, file);
        logger.log(`Full file path: ${filePath}`);
        console.error(`PYTHON SERVER LOGS: Full PNG path: ${filePath}`);
        
        try {
          const fileContent = await fs.readFile(filePath);
          logger.log(`File size: ${fileContent.length} bytes`);
          console.error(`PYTHON SERVER LOGS: PNG file size: ${fileContent.length} bytes`);
          const base64Data = fileContent.toString('base64');
          console.error(`PYTHON SERVER LOGS: Converted PNG to base64 (starts with: ${base64Data.substring(0, 30)}...)`);
          
          // Extract PNG dimensions from the IHDR chunk
          const width = fileContent.readUInt32BE(16);
          const height = fileContent.readUInt32BE(20);
          logger.log(`Image dimensions: ${width}x${height}`);
          console.error(`PYTHON SERVER LOGS: PNG dimensions: ${width}x${height}`);
          
          binaryOutput = {
            data: base64Data,
            type: 'image/png',
            metadata: {
              filename: file,
              size: fileContent.length,
              dimensions: {
                width,
                height
              },
              sourceCode: code  // Add the source code to metadata
            }
          };
          
          logger.log('Binary output prepared successfully');
          console.error('PYTHON SERVER LOGS: Binary output prepared successfully');
          
          // Clean up the binary file
          await fs.unlink(filePath).catch(error => {
            logger.log(`Error cleaning up PNG file: ${error}`);
            console.error(`PYTHON SERVER LOGS: Error cleaning up PNG file: ${error}`);
          });
          break;  // Only handle the first PNG for now
        } catch (error) {
          logger.log(`Error processing PNG file: ${error}`);
          console.error(`PYTHON SERVER LOGS: ERROR processing PNG file: ${error}`);
        }
      }
    }

    // Clean up after execution
    await cleanupPythonEnvironment();
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

    // Return output with type information and binary data if present
    const result: ExecuteResult = { 
      output, 
      code,
      type: binaryOutput ? 'matplotlib.figure' as const : 'text' as const,
      metadata: binaryOutput ? { hasBinaryOutput: true } : {},
      binaryOutput
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
    try {
      await cleanupPythonEnvironment();
      if (scriptPath) {
        await fs.unlink(scriptPath).catch(() => {}); // Ignore cleanup errors
      }
    } catch (cleanupError) {
      logger.log(`Cleanup error: ${cleanupError}`);
    }

    // Let the error propagate up to be handled by the MCP server
    throw error;
  } finally {
    logger.close();
  }
}