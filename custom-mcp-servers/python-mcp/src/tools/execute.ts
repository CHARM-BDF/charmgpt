import { PythonShell, Options } from 'python-shell';
import path from 'path';
import fs from 'fs/promises';
import { setupPythonEnvironment, cleanupPythonEnvironment, validatePythonCode, TEMP_DIR, LOGS_DIR } from './env.js';
import { fileURLToPath } from 'url';
import { appendFileSync, mkdirSync } from 'fs';
import { createWriteStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function createRunLogger() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `run_${timestamp}.log`;
  const logFilePath = path.join(LOGS_DIR, logFileName);
  
  // Create write stream for logging
  const logStream = createWriteStream(logFilePath, { flags: 'a' });
  
  // Log the paths being used
  logStream.write(`Log file path: ${logFilePath}\n`);
  logStream.write(`Temp directory path: ${TEMP_DIR}\n`);
  
  return {
    log: (message: string) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}\n`;
      logStream.write(logMessage);
    },
    close: () => {
      logStream.end();
    }
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
    metadata: Record<string, any>;
  };
}

// Logger type definition
interface Logger {
  log: (message: string) => void;
  close: () => void;
}

// Add helper function for code transformation
function transformPythonCode(code: string, logger: Logger): string {
  // Check if code contains file operations but no os import
  if ((code.includes('savefig') || code.includes('to_csv') || code.includes('to_excel') || 
       code.includes('json.dump') || code.includes('write')) && !code.includes('import os')) {
    code = 'import os\n' + code;
  }

  // Replace relative paths in common file operations with OUTPUT_DIR
  const fileOperations = [
    {
      // Match both direct path and string concatenation patterns
      pattern: /plt\.savefig\(['"]([^'"]+)['"]\)|plt\.savefig\(os\.environ\['OUTPUT_DIR'\]\s*\+\s*['"]\/([^'"]+)['"]\)|plt\.savefig\(os\.environ\['OUTPUT_DIR'\]\s*\+\s*['"](\\[^'"]+)['"]\)/g,
      replacement: (match: string, p1: string | undefined, p2: string | undefined, p3: string | undefined): string => {
        const filename = p1 || p2 || (p3 ? p3.replace('\\', '') : null);
        if (!filename) return match;
        return `plt.savefig(os.path.join(os.environ['OUTPUT_DIR'], '${filename}'))`;
      }
    },
    {
      pattern: /to_csv\(['"]([^'"]+)['"]\)/g,
      replacement: "to_csv(os.path.join(os.environ['OUTPUT_DIR'], '$1'))"
    },
    {
      pattern: /to_excel\(['"]([^'"]+)['"]\)/g,
      replacement: "to_excel(os.path.join(os.environ['OUTPUT_DIR'], '$1'))"
    },
    {
      pattern: /json\.dump\(.*?,\s*open\(['"]([^'"]+)['"],\s*['"]w['"]\)/g,
      replacement: (match: string, filename: string): string => 
        match.replace(filename, `os.path.join(os.environ['OUTPUT_DIR'], '${filename}')`)
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
  }

  return code;
}

export async function execute(args: ExecuteArgs): Promise<ExecuteResult> {
  const { code: originalCode, timeout = 30 } = args;
  
  // Create logger first
  const logger = createRunLogger();
  
  // Transform code to handle file operations
  const code = transformPythonCode(originalCode, logger);
  
  // Log if code was transformed
  if (code !== originalCode) {
    logger.log('Code was transformed to use OUTPUT_DIR for file operations');
    logger.log(`Original code: ${originalCode}`);
    logger.log(`Transformed code: ${code}`);
  }

  let scriptPath = '';
  
  try {
    // Log the Python code being executed
    logger.log(code);
    
    // Set up Python environment with security settings
    const envConfig = await setupPythonEnvironment();
    
    // Create a temporary Python file with the code
    scriptPath = path.join(TEMP_DIR, `script_${Date.now()}.py`);
    logger.log(`Script path: ${scriptPath}`);
    
    // Write the code to the temporary file
    await fs.writeFile(scriptPath, code, 'utf-8');
    logger.log('Python code written to temporary file');

    // Set up Python shell options with security settings
    const options: Options = {
      mode: 'text' as const,
      pythonPath: path.join(__dirname, '../../venv/bin/python3'),
      pythonOptions: ['-u'], // unbuffered output
      scriptPath: TEMP_DIR,
      args: [],
      env: envConfig.env,
      ...envConfig.resourceLimits
    };

    // Create a new Python shell instance
    const pyshell = new PythonShell(path.basename(scriptPath), options);

    // Run the code and collect output
    const output = await new Promise<string>((resolve, reject) => {
      let result = '';
      
      pyshell.on('message', (message) => {
        logger.log(`Python output: ${message}`);
        result += message + '\n';
      });

      pyshell.on('stderr', (stderr) => {
        logger.log(`Python stderr: ${stderr}`);
        result += stderr + '\n';
      });

      pyshell.on('error', (err) => {
        logger.log(`Python error: ${err}`);
        reject(err);
      });

      pyshell.on('close', () => {
        logger.log('Python shell closed');
        resolve(result.trim());
      });

      // End the shell - the code is already in the file
      pyshell.end((err) => {
        if (err) {
          logger.log(`Python shell end error: ${err}`);
          reject(err);
        }
      });
    });

    // Check for binary output files in the temp directory
    logger.log('Checking temp directory for files...');
    const files = await fs.readdir(TEMP_DIR);
    logger.log(`Files in temp directory: ${files.join(', ')}`);
    
    let binaryOutput: ExecuteResult['binaryOutput'] | undefined;

    for (const file of files) {
      logger.log(`Processing file: ${file}`);
      if (file.endsWith('.png')) {
        logger.log(`Found PNG file: ${file}`);
        const filePath = path.join(TEMP_DIR, file);
        logger.log(`Full file path: ${filePath}`);
        
        try {
          const fileContent = await fs.readFile(filePath);
          logger.log(`File size: ${fileContent.length} bytes`);
          const base64Data = fileContent.toString('base64');
          
          // Extract PNG dimensions from the IHDR chunk
          const width = fileContent.readUInt32BE(16);
          const height = fileContent.readUInt32BE(20);
          logger.log(`Image dimensions: ${width}x${height}`);
          
          binaryOutput = {
            data: base64Data,
            type: 'image/png',
            metadata: {
              filename: file,
              size: fileContent.length,
              dimensions: {
                width,
                height
              }
            }
          };
          
          logger.log('Binary output prepared successfully');
          
          // Clean up the binary file
          await fs.unlink(filePath).catch(error => {
            logger.log(`Error cleaning up PNG file: ${error}`);
          });
          break;  // Only handle the first PNG for now
        } catch (error) {
          logger.log(`Error processing PNG file: ${error}`);
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
    logger.log(`Result type: ${result.type}`);
    if (binaryOutput) {
      logger.log(`Binary output size: ${binaryOutput.metadata.size} bytes`);
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