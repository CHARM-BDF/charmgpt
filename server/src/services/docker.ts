import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'  // Regular fs for sync operations
import * as fsPromises from 'fs/promises'  // Promise-based fs for async operations
import * as path from 'path'

interface ImmediateValue {
  type: 'immediate'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
}

interface FileValue {
  type: 'file'
  value: string  // filename
}

interface DockerRunResult {
  success: boolean
  output: string
  visualization?: string  // JSON string for visualization data
  plotFile?: string      // Name of the plot file if generated
  var2val: Record<string, ImmediateValue | FileValue>
  var2line: Record<string, number>
  var2line_end: Record<string, number>
}

export class DockerService {
  private tempDir: string
  private readonly imageTag: string

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp')
    this.imageTag = 'my-python-app'
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  public getTempDir(): string {
    return this.tempDir
  }

  private async prepareDataFiles(dataDir: string): Promise<void> {
    try {
      // Remove any existing symlinks in the run directory
      try {
        const files = await fsPromises.readdir(dataDir)
        for (const file of files) {
          const filePath = path.join(dataDir, file)
          const stats = await fsPromises.lstat(filePath)
          if (stats.isSymbolicLink()) {
            await fsPromises.unlink(filePath)
          }
        }
      } catch (err) {
        console.error('Error cleaning run directory:', err)
      }

      // Get list of pinned artifacts
      const pinnedArtifactsFile = path.join(this.tempDir, 'artifacts.json')
      const pinnedArtifacts = JSON.parse(await fsPromises.readFile(pinnedArtifactsFile, 'utf-8'))
      const files: Set<string> = new Set(
        pinnedArtifacts
          .filter((a: { dataFile?: string, pinned?: boolean }) => a.dataFile && a.pinned)  // Only use pinned artifacts
          .map((a: { dataFile: string }) => path.basename(a.dataFile))
      )

      
      // Group files by their original name (removing runId prefix)
      const fileGroups = new Map<string, { file: string, timestamp: number }[]>()
      
      for (const file of files) {
        if (file.includes('_') && file.endsWith('.csv')) {
          const originalName = file.split('_').slice(1).join('_') // Remove runId prefix
          const stats = await fsPromises.stat(path.join(this.getTempDir(), file))
          
          if (!fileGroups.has(originalName)) {
            fileGroups.set(originalName, [])
          }
          fileGroups.get(originalName)!.push({
            file,  // Just store the filename
            timestamp: stats.mtimeMs
          })
        }
      }

      // Create relative symlinks for the latest version of each file
      for (const [originalName, versions] of fileGroups) {
        versions.sort((a, b) => b.timestamp - a.timestamp)
        const latest = versions[0]
        const linkPath = path.join(dataDir, originalName)
        const targetPath = path.join('..', 'temp', latest.file)  // Relative path to temp dir
        
        try {
          await fsPromises.symlink(targetPath, linkPath)
          console.log(`Created symlink: ${originalName} -> ${targetPath}`)
        } catch (error) {
          console.error(`Failed to create symlink for ${originalName}:`, error)
        }
      }
    } catch (error) {
      console.error('Error preparing data files:', error)
    }
  }

  async runCode(code: string): Promise<DockerRunResult> {
    const runId = uuidv4()
    console.log('Starting code run:', runId)

    try {
      const tempDir = this.getTempDir()
      const codeDir = path.join(tempDir, runId)
      await fsPromises.mkdir(codeDir, { recursive: true })
      
      await this.prepareDataFiles(codeDir);

      const userCodePath = path.join(codeDir, 'user_code.py')
      const wrapperPath = path.join(codeDir, 'wrapper.py')
      
      await fsPromises.writeFile(userCodePath, code)
      await fsPromises.writeFile(wrapperPath, this.wrapCode(runId))
      
      console.log('Running code with ID:', runId)
      console.log('Temp directory:', tempDir)

      // Run the code in Docker
      const { stdout } = await this.runDocker(runId, codeDir)
      console.log('Docker execution result:', stdout)

      // Check for generated files
      const plotFilename = `${runId}_plot.png`
      const plotPath = path.join(tempDir, plotFilename)
      const hasPlot = fs.existsSync(plotPath)

      // Look for any CSV files with this runId
      const files = await fsPromises.readdir(tempDir)
      const csvFile = files.find(f => f.startsWith(runId) && f.endsWith('.csv'))
      const hasData = !!csvFile

      if (hasPlot) console.log('Found plot file:', plotFilename)
      if (hasData) console.log('Found data file:', csvFile)

      // Parse the results from the output
      const resultsMatch = stdout.match(/__RESULTS__\n(.*)/);
      let var2val = {}
      let var2line = {}
      let var2line_end = {}


      if (resultsMatch) {
        try {
          const results = JSON.parse(resultsMatch[1]);
          var2val = results.var2val;
          var2line = results.var2line;
          var2line_end = results.var2line_end;
        } catch (e) {
          console.error('Failed to parse results:', e);
        }
      }

      const result = {
        success: true,
        output: stdout,
        plotFile: hasPlot ? plotFilename : undefined,
        var2val,
        var2line,
        var2line_end
      }
      console.log('Returning result:', result);
      return result
    } catch (error) {
      console.error('Error running code:', error)
      return {
        success: false,
        output: error instanceof Error ? error.message : 'Unknown error occurred',
        var2val: {},
        var2line: {},
        var2line_end: {}
      }
    }
  }

  private async copyFromContainer(runId: string, filename: string): Promise<boolean> {
    try {
       const containerPath = `/app/output/${filename}`
       const checkResult = await new Promise<boolean>((resolve) => {
       const check = spawn('docker', [
          'exec',
          runId,
          'test',
          '-f',
          containerPath
        ])
        
        check.on('close', (code) => {
          resolve(code === 0)
        })
      })

      if (!checkResult) {
        console.log(`File ${filename} not found in container`)
        return false
      }

      const hostPath = path.join(this.getTempDir(), filename)
      
      await new Promise<void>((resolve, reject) => {
        const cp = spawn('docker', [
          'cp',
          `${runId}:${containerPath}`,
          hostPath
        ])
        
        cp.on('close', (code) => {
          if (code === 0) {
            console.log(`Successfully copied ${filename} from container`)
            resolve()
          } else {
            reject(new Error(`Failed to copy ${filename} from container`))
          }
        })
        
        cp.on('error', reject)
      })
      return true
    } catch (error) {
      console.error(`Error copying ${filename} from container:`, error)
      return false
    }
  }

  private wrapCode(runId: string): string {
    return `
import sys
import json
import os
import ast
from io import StringIO
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import random

# Initialize tracking
var2val = {}
var2line = {}
var2line_end = {}
value_log_buffer = ""

def convert_value(value):
    """Recursively convert values to JSON-serializable types"""
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    elif isinstance(value, np.ndarray):
        return value.tolist()
    elif isinstance(value, range):
        return list(value)
    elif isinstance(value, list):
        return [convert_value(v) for v in value]
    elif isinstance(value, tuple):
        return tuple(convert_value(v) for v in value)
    elif isinstance(value, dict):
        return {k: convert_value(v) for k, v in value.items()}
    return value

def save_intermediate_value(value, var_name: str, line_start: int, line_end: int) -> None:
    global value_log_buffer
    if isinstance(value, pd.DataFrame):
        # Handle DataFrame by saving to file
        filename = f'${runId}_{var_name}.csv'
        value.to_csv(f'/app/output/{filename}', index=False)
        var2val[var_name] = {
            'type': 'file',
            'value': filename
        }
        var2line[var_name] = line_start
        var2line_end[var_name] = line_end
        value_log_buffer += f"\\nSaved DataFrame {var_name} to {filename}"
    else:
        # Handle immediate values (numbers, strings, lists, etc)
        try:
            # Convert value and all nested values
            converted_value = convert_value(value)
            
            # Test if value is JSON serializable
            json.dumps(converted_value)
            var2val[var_name] = {
                'type': 'immediate',
                'value': converted_value
            }
            var2line[var_name] = line_start
            var2line_end[var_name] = line_end
            value_log_buffer += f"\\nSaved value {var_name} = {converted_value}"
        except:
            value_log_buffer += f"\\nCould not serialize value for {var_name}"

def find_assignments(code):
    """Find all assignments and their line numbers using AST"""
    assignments = {}  # Use dict to keep only last occurrence of each variable
    tree = ast.parse(code)
    
    class AssignmentVisitor(ast.NodeVisitor):
        def visit_Assign(self, node):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    assignments[target.id] = {
                        'name': target.id,
                        'line_start': node.lineno,
                        'line_end': node.end_lineno or node.lineno
                    }
            self.generic_visit(node)
    
    AssignmentVisitor().visit(tree)
    return list(assignments.values())  # Convert back to list for the rest of the code

try:
    # Read and execute the code first
    with open('user_code.py', 'r') as f:
        code = f.read()
    
    # Create globals dict
    globals_dict = {'pd': pd, 'np': np, 'plt': plt, '__name__': '__main__'}
    
    # Execute the code once
    exec(code, globals_dict)
    
    # Find all assignments
    assignments = find_assignments(code)
    
    # Save values for all assignments found
    for assign in assignments:
        try:
            value = globals_dict.get(assign['name'])
            if value is not None:
                save_intermediate_value(
                    value, 
                    assign['name'],
                    assign['line_start'],
                    assign['line_end']
                )
        except:
            pass

    # Handle plot if any
    if plt.get_fignums():
        plt.savefig(f'/app/output/${runId}_plot.png')
        value_log_buffer += f"\\nSaved plot as ${runId}_plot.png"

    # Print program output and results
    print(value_log_buffer)
    print("\\n__RESULTS__")
    print(json.dumps({
        'var2val': var2val,
        'var2line': var2line,
        'var2line_end': var2line_end
    }))

except Exception as e:
    print(f"Error: {str(e)}")
`
  }

  private async runDocker(runId: string, codeDir: string): Promise<{ stdout: string }> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', [
        'run',
        '--name', runId,
        '-v', `${codeDir}:/app/code:rw`,
        '-v', `${this.getTempDir()}:/app/temp:rw`,
        '-v', `${this.getTempDir()}:/app/output:rw`,
        '--network', 'none',
        '--memory', '512m',
        '--cpus', '0.5',
        '--workdir', '/app/code',
        this.imageTag,
        'python',
        '/app/code/wrapper.py'
      ])

      let stdout = ''
      let stderr = ''

      docker.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      docker.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      docker.on('close', async (code) => {
        try {
          // Copy files from container before removing it
          if (code === 0) {
            // Only copy if the file exists
            const plotExists = await this.copyFromContainer(runId, `${runId}_plot.png`)
            const dataExists = await this.copyFromContainer(runId, `${runId}_data.csv`)
            console.log('File copy status:', { plotExists, dataExists })
          }
          
          // Remove the container
          await new Promise<void>((resolveRm, rejectRm) => {
            const rm = spawn('docker', ['rm', runId])
            rm.on('close', (rmCode) => {
              if (rmCode === 0) resolveRm()
              else rejectRm(new Error(`Failed to remove container: ${rmCode}`))
            })
          })

          if (code === 0) {
            resolve({ stdout })
          } else {
            reject(new Error(`Docker process failed: ${stderr}`))
          }
        } catch (error) {
          reject(error)
        }
      })
    })
  }
} 
