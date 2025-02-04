import { PythonShell, Options } from 'python-shell';
import path from 'path';
import fs from 'fs/promises';
import { setupPythonEnvironment, cleanupPythonEnvironment, validatePythonCode } from './env';

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (args: any) => Promise<{ output: string; code: string }>;
}

export const pythonExecutionTool: Tool = {
  name: 'execute_python',
  description: 'Execute Python code with data file integration',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Python code to execute'
      },
      dataFiles: {
        type: 'object',
        description: 'Map of file aliases to file IDs',
        optional: true
      },
      timeout: {
        type: 'number',
        description: 'Execution timeout in seconds',
        default: 30
      }
    },
    required: ['code']
  },

  async execute(args: { code: string, dataFiles?: Record<string, string>, timeout?: number }) {
    const { code, timeout = 30 } = args;
    
    try {
      // Validate code before execution
      validatePythonCode(code);
      
      // Set up Python environment with security settings
      const envConfig = await setupPythonEnvironment();
      
      // Create a temporary Python file with the code
      const tempDir = path.join(process.cwd(), 'temp');
      const scriptPath = path.join(tempDir, `script_${Date.now()}.py`);
      
      // Write the code to the temporary file
      await fs.writeFile(scriptPath, code, 'utf-8');

      // Set up Python shell options with security settings
      const options: Options = {
        mode: 'text' as const,
        pythonPath: path.join(process.cwd(), 'venv', 'bin', 'python3'),
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
        await fs.unlink(scriptPath).catch(() => {}); // Ignore cleanup errors
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }

      // Let the error propagate up to be handled by the MCP server
      throw error;
    }
  }
};

export const execute = pythonExecutionTool.execute; 