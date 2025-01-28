import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'

interface DockerRunResult {
  success: boolean
  output: string
  visualization?: string // JSON string for visualization data
}

export class DockerService {
  private readonly tempDir: string
  private readonly imageTag: string

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp')
    this.imageTag = 'my-python-app'
    this.initTempDir()
  }

  private async initTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create temp directory:', error)
    }
  }

  async runCode(code: string): Promise<DockerRunResult> {
    const runId = uuidv4()
    const wrapperPath = path.join(this.tempDir, `${runId}_wrapper.py`)
    const userCodePath = path.join(this.tempDir, `${runId}_user_code.py`)
    const outputPath = path.join(this.tempDir, `${runId}_output.json`)

    try {
      // Save both files
      const wrappedCode = this.wrapCode(code)
      await Promise.all([
        fs.writeFile(wrapperPath, wrappedCode),
        fs.writeFile(userCodePath, code)
      ])

      // Run the code in Docker
      const result = await this.runDocker(runId, wrapperPath, userCodePath)
      
      // Check for visualization output
      let vizData: string | undefined
      try {
        vizData = await fs.readFile(outputPath, 'utf-8')
      } catch {
        // No visualization data available
      }

      // Cleanup
      await Promise.all([
        fs.unlink(wrapperPath).catch(() => {}),
        fs.unlink(userCodePath).catch(() => {}),
        fs.unlink(outputPath).catch(() => {})
      ])

      return {
        success: true,
        output: result,
        visualization: vizData
      }
    } catch (error) {
      console.error('Error running code:', error)
      return {
        success: false,
        output: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private wrapCode(code: string): string {
    void code;
    return `
import sys
import json
from io import StringIO
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# Capture print output
output_buffer = StringIO()
sys.stdout = output_buffer

# Execute user code
try:
    import user_code
    
    # Check if there's a plot to save
    if plt.get_fignums():
        # Save plot as PNG
        plt.savefig('/app/output/plot.png')
        
        # Also save data for interactive visualization
        fig = plt.gcf()
        data = []
        for ax in fig.axes:
            for line in ax.lines:
                x_data = line.get_xdata().tolist()
                y_data = line.get_ydata().tolist()
                data.extend([{"name": str(x), "value": y} for x, y in zip(x_data, y_data)])
        
        with open('/app/output/output.json', 'w') as f:
            json.dump(data, f)
        
    plt.close('all')
    
except Exception as e:
    print(f"Error: {str(e)}")

# Restore stdout and get output
sys.stdout = sys.__stdout__
print(output_buffer.getvalue())
`
  }

  private runDocker(runId: string, wrapperPath: string, userCodePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', [
        'run',
        '--rm',
        '-v', `${wrapperPath}:/app/wrapper.py:ro`,
        '-v', `${userCodePath}:/app/user_code.py:ro`,
        '-v', `${this.tempDir}:/app/output`,
        '--network', 'none',
        '--memory', '512m',
        '--cpus', '0.5',
        this.imageTag,
        'python',
        '/app/wrapper.py'
      ])

      let output = ''
      let error = ''

      docker.stdout.on('data', (data) => {
        output += data.toString()
      })

      docker.stderr.on('data', (data) => {
        error += data.toString()
      })

      docker.on('close', (code) => {
        if (code === 0) {
          resolve(output)
        } else {
          reject(new Error(`Docker process failed: ${error}`))
        }
      })
    })
  }
} 