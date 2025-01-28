import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'

interface DockerRunResult {
  success: boolean
  output: string
  visualization?: string  // JSON string for visualization data
  plotFile?: string      // Name of the plot file if generated
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
    const plotPath = path.join(this.tempDir, `${runId}_plot.png`)

    try {
      console.log('Running code with ID:', runId)
      
      // Save both files
      const wrappedCode = this.wrapCode(runId)
      await Promise.all([
        fs.writeFile(wrapperPath, wrappedCode),
        fs.writeFile(userCodePath, code)
      ])
      console.log('Saved code files')

      // Run the code in Docker
      const result = await this.runDocker(runId, wrapperPath, userCodePath)
      console.log('Docker execution result:', result)
      
      // Check for visualization output
      let vizData: string | undefined
      let plotFile: string | undefined
      
      try {
        vizData = await fs.readFile(outputPath, 'utf-8')
        console.log('Found visualization data')
      } catch (error) {
        console.log('No visualization data found:', error)
      }

      // Check if plot file exists
      try {
        await fs.access(plotPath)
        plotFile = `${runId}_plot.png`
        console.log('Found plot file:', plotFile)
      } catch (error) {
        void error;
        console.log('No plot file found at:', plotPath)
        // Try checking for generic plot files
        try {
          const genericPlotPath = path.join(this.tempDir, 'plot.png')
          await fs.access(genericPlotPath)
          // If found, rename it to include runId
          await fs.rename(genericPlotPath, plotPath)
          plotFile = `${runId}_plot.png`
          console.log('Found and renamed generic plot file:', plotFile)
        } catch (error) {
          void error;
          console.log('No generic plot file found either')
        }
      }

      // Only cleanup the Python files
      await Promise.all([
        fs.unlink(wrapperPath).catch(() => {}),
        fs.unlink(userCodePath).catch(() => {})
      ])

      const response = {
        success: true,
        output: result,
        visualization: vizData,
        plotFile
      }
      console.log('Returning response:', response)
      return response

    } catch (error) {
      console.error('Error running code:', error)
      return {
        success: false,
        output: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private wrapCode(runId: string): string {
    return `
import sys
import json
from io import StringIO
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# Set the runId for the plot filename
runId = '${runId}'

# Capture print output
output_buffer = StringIO()
sys.stdout = output_buffer

# Execute user code
try:
    import user_code
    
    # Check if there's a plot to save
    if plt.get_fignums():
        print("Found plot, saving...")
        # Save plot as PNG with unique name
        plot_path = f'/app/output/{runId}_plot.png'
        plt.savefig(plot_path)
        print(f"Saved plot to {plot_path}")
        
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
            print("Saved visualization data")
    else:
        print("No plots found")
        
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