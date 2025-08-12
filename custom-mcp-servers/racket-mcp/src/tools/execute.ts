import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { setupRacketEnvironment, cleanupRacketEnvironment, validateRacketCode, TEMP_DIR, LOGS_DIR } from './env.js';
import { appendFileSync, mkdirSync } from 'fs';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Docker configuration
const DOCKER_IMAGE = 'my-racket-mcp';
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
  
  const logMessage = `${timestamp} ${color}[RACKET-MCP ${type}]\x1b[0m ${message}\n`;
  const fileMessage = `${timestamp} [RACKET-MCP ${type}] ${message}\n`;
  
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
  type?: 'text' | 'racket.list' | 'racket.hash' | 'racket.plot' | 'binary' | 'json';
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
function transformRacketCode(code: string, logger: Logger): string {
  console.error(`RACKET SERVER LOGS: Original Racket code:\n${code}`);
  
  // Check if code contains file operations but no file library
  if ((code.includes('write-to-file') || code.includes('call-with-output-file') || 
       code.includes('with-output-to-file')) && !code.includes('(require racket/file)')) {
    code = '#lang racket\n(require racket/file)\n' + code;
    console.error(`RACKET SERVER LOGS: Added racket/file require to code`);
  }

  // Replace relative paths in common file operations with OUTPUT_DIR
  const fileOperations = [
    {
      // Match Racket file operations with relative paths
      pattern: /\(write-to-file\s+[^\s]+\s+["']([^"']+)["']\)/g,
      replacement: (match: string, filename: string): string => {
        const result = `(write-to-file data (build-path (getenv "OUTPUT_DIR") "${filename}"))`;
        console.error(`RACKET SERVER LOGS: Transformed write-to-file from "${match}" to "${result}"`);
        return result;
      }
    },
    {
      pattern: /\(call-with-output-file\s+["']([^"']+)["']/g,
      replacement: (match: string, filename: string): string => {
        const result = `(call-with-output-file (build-path (getenv "OUTPUT_DIR") "${filename}")`;
        console.error(`RACKET SERVER LOGS: Transformed call-with-output-file from "${match}" to "${result}"`);
        return result;
      }
    },
    {
      pattern: /\(with-output-to-file\s+["']([^"']+)["']/g,
      replacement: (match: string, filename: string): string => {
        const result = `(with-output-to-file (build-path (getenv "OUTPUT_DIR") "${filename}")`;
        console.error(`RACKET SERVER LOGS: Transformed with-output-to-file from "${match}" to "${result}"`);
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

  // Add cleanup for plotting if present (not applicable to basic Racket but keeping structure)
  if (code.includes('plot') && !code.includes('(void)')) {
    code += '\n(void)  ; Auto-added for cleanup';
    console.error(`RACKET SERVER LOGS: Added void for cleanup to code`);
  }

  console.error(`RACKET SERVER LOGS: Transformed Racket code:\n${code}`);
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
      '--memory', '512m',  // Memory limit (increased for plotting)
      '--cpus', '2.0',     // CPU limit (increased for better performance)
      // Add environment variables, but map OUTPUT_DIR to container path
      ...Object.entries({
        ...envConfig.env,
        OUTPUT_DIR: CONTAINER_TEMP_DIR  // Override OUTPUT_DIR to use container path
      })
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ['-e', `${key}=${value}`])
        .flat(),
      DOCKER_IMAGE,
      '/app/start-with-xvfb.sh', scriptName
    ];

    logger.log(`Running Docker command: docker ${dockerArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      const dockerProcess = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

      dockerProcess.stdout.on('data', (data) => {
        const message = data.toString();
        if (!logger.isClosed) logger.log(`Racket output: ${message}`);
        output += message;
      });

      dockerProcess.stderr.on('data', (data) => {
        const message = data.toString();
        if (!logger.isClosed) logger.log(`Racket stderr: ${message}`);
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
    // Validate Racket code before transformation
    validateRacketCode(originalCode);
    logger.log('Racket code validation passed');
    
    // Transform code to handle file operations
    const code = transformRacketCode(originalCode, logger);
    
    // Log if code was transformed
    if (code !== originalCode) {
      logger.log('Code was transformed to use OUTPUT_DIR for file operations');
      logger.log(`Original code: ${originalCode}`);
      logger.log(`Transformed code: ${code}`);
    }

    // Log the Racket code being executed
    logger.log(code);
    
    // Set up Racket environment with security settings
    const envConfig = await setupRacketEnvironment();
    
    // Ensure Docker image exists
    await ensureDockerImage();
    
    // Create a temporary Racket file with the code
    scriptPath = path.join(TEMP_DIR, `script_${Date.now()}.rkt`);
    logger.log(`Script path: ${scriptPath}`);
    
    // Write the code to the temporary file
    await fs.writeFile(scriptPath, code, 'utf-8');
    logger.log('Racket code written to temporary file');

    // Run the code in Docker and collect output
    const output = await runInDocker(scriptPath, envConfig, logger);

    // Check for binary output files in the temp directory
    logger.log('Checking temp directory for files...');
    const files = await fs.readdir(TEMP_DIR);
    logger.log(`Files in temp directory: ${files.join(', ')}`);
    console.error(`RACKET SERVER LOGS: Files found in temp directory: ${files.join(', ')}`);
    
    let binaryOutput: ExecuteResult['binaryOutput'] | undefined;

    for (const file of files) {
      logger.log(`Processing file: ${file}`);
      console.error(`RACKET SERVER LOGS: Processing file: ${file}`);
      
      if (file.endsWith('.png')) {
        logger.log(`Found PNG file: ${file}`);
        console.error(`RACKET SERVER LOGS: Found PNG file: ${file}`);
        const filePath = path.join(TEMP_DIR, file);
        logger.log(`Full file path: ${filePath}`);
        console.error(`RACKET SERVER LOGS: Full PNG path: ${filePath}`);
        
        try {
          const fileContent = await fs.readFile(filePath);
          logger.log(`File size: ${fileContent.length} bytes`);
          console.error(`RACKET SERVER LOGS: PNG file size: ${fileContent.length} bytes`);
          const base64Data = fileContent.toString('base64');
          console.error(`RACKET SERVER LOGS: Converted PNG to base64 (starts with: ${base64Data.substring(0, 30)}...)`);
          
          // Extract PNG dimensions from the IHDR chunk
          const width = fileContent.readUInt32BE(16);
          const height = fileContent.readUInt32BE(20);
          logger.log(`Image dimensions: ${width}x${height}`);
          console.error(`RACKET SERVER LOGS: PNG dimensions: ${width}x${height}`);
          
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
          console.error('RACKET SERVER LOGS: Binary output prepared successfully');
          
          // Clean up the binary file
          await fs.unlink(filePath).catch(error => {
            logger.log(`Error cleaning up PNG file: ${error}`);
            console.error(`RACKET SERVER LOGS: Error cleaning up PNG file: ${error}`);
          });
          break;  // Only handle the first PNG for now
        } catch (error) {
          logger.log(`Error processing PNG file: ${error}`);
          console.error(`RACKET SERVER LOGS: ERROR processing PNG file: ${error}`);
        }
      }
    }

    // Clean up after execution
    await cleanupRacketEnvironment();
    try {
      logger.log(`Cleaning up script file: ${scriptPath}`);
      await fs.unlink(scriptPath);
    } catch (error) {
      // Ignore file not found errors during cleanup
      if (error instanceof Error && !error.message.includes('ENOENT')) {
        logger.log(`Error cleaning up temp file: ${error}`);
        console.error(`RACKET SERVER LOGS: Error cleaning up temp file: ${error}`);
      }
    }

    // Return output with type information and binary data if present
    const result: ExecuteResult = { 
      output, 
      code,
      type: binaryOutput ? 'racket.plot' as const : 'text' as const,
      metadata: binaryOutput ? { hasBinaryOutput: true } : {},
      binaryOutput
    };
    
    logger.log(`Execution completed successfully`);
    console.error(`RACKET SERVER LOGS: Execution completed successfully`);
    logger.log(`Result type: ${result.type}`);
    console.error(`RACKET SERVER LOGS: Result type: ${result.type}`);
    if (binaryOutput) {
      logger.log(`Binary output size: ${binaryOutput.metadata.size} bytes`);
      console.error(`RACKET SERVER LOGS: Binary output included in result, size: ${binaryOutput.metadata.size} bytes`);
    } else {
      console.error(`RACKET SERVER LOGS: No binary output included in result`);
    }
    
    return result;

  } catch (error) {
    // Attempt cleanup even if execution failed
    logger.log(`Execution error: ${error}`);
    try {
      await cleanupRacketEnvironment();
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