import { PythonShell, Options } from 'python-shell';
import path from 'path';
import fs from 'fs/promises';
import { setupPythonEnvironment, cleanupPythonEnvironment, validatePythonCode } from './env.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExecuteArgs {
  code: string;
  dataFiles?: Record<string, string>;
  timeout?: number;
}

export async function execute(args: ExecuteArgs): Promise<{ output: string; code: string }> {
  const { code, timeout = 30 } = args;
  let scriptPath = '';
  
  try {
    // Set up Python environment with security settings
    const envConfig = await setupPythonEnvironment();
    
    // Create a temporary Python file with the code
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    scriptPath = path.join(tempDir, `script_${Date.now()}.py`);
    
    // Write the code to the temporary file
    await fs.writeFile(scriptPath, code, 'utf-8');

    // Set up Python shell options with security settings
    const options: Options = {
      mode: 'text' as const,
      pythonPath: path.join(__dirname, '../../venv/bin/python3'),
      pythonOptions: ['-u'], // unbuffered output
      scriptPath: tempDir,
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
        result += message + '\n';
      });

      pyshell.on('stderr', (stderr) => {
        result += stderr + '\n';
      });

      pyshell.on('error', (err) => {
        reject(err);
      });

      pyshell.on('close', () => {
        resolve(result.trim());
      });

      // End the shell - the code is already in the file
      pyshell.end((err) => {
        if (err) reject(err);
      });
    });

    // Clean up after execution
    await cleanupPythonEnvironment();
    try {
      await fs.unlink(scriptPath);
    } catch (error) {
      // Ignore file not found errors during cleanup
      if (error instanceof Error && !error.message.includes('ENOENT')) {
        console.error('Error cleaning up temp file:', error);
      }
    }

    // Return just the output and code
    return { output, code };

  } catch (error) {
    // Attempt cleanup even if execution failed
    try {
      await cleanupPythonEnvironment();
      if (scriptPath) {
        await fs.unlink(scriptPath).catch(() => {}); // Ignore cleanup errors
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    // Let the error propagate up to be handled by the MCP server
    throw error;
  }
} 