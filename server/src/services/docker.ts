import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'  // Regular fs for sync operations
import * as fsPromises from 'fs/promises'  // Promise-based fs for async operations
import * as path from 'path'

interface DockerRunResult {
  success: boolean
  output: string
  visualization?: string  // JSON string for visualization data
  plotFile?: string      // Name of the plot file if generated
  dataFile?: string      // Name of the CSV file if generated
}

interface DataFileInfo {
  originalPath: string
  displayName: string
  timestamp: number
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

  private async prepareDataFiles(): Promise<void> {
    // Create data directory if it doesn't exist
    const dataDir = path.join(this.getTempDir(), 'data')
    await fsPromises.mkdir(dataDir, { recursive: true })

    try {
      // Clean up old symlinks first
      const existingLinks = await fsPromises.readdir(dataDir)
      for (const link of existingLinks) {
        await fsPromises.unlink(path.join(dataDir, link))
      }

      // Collect all data files from artifacts
      const artifactsPath = path.join(this.getTempDir(), 'artifacts.json')
      const artifacts = await fsPromises.readFile(artifactsPath, 'utf-8')
        .then(data => JSON.parse(data))
        .catch(() => [])

      // Map to track latest version of each display name
      const latestFiles = new Map<string, DataFileInfo>()

      // Process each artifact's data file
      for (const artifact of artifacts) {
        if (artifact.dataFile) {
          const originalPath = path.join(this.getTempDir(), artifact.dataFile)
          const displayName = artifact.name.endsWith('.csv') 
            ? artifact.name 
            : artifact.dataFile.replace(/^[^_]+_/, '')

          // Only keep the most recent version of each display name
          if (!latestFiles.has(displayName) || 
              latestFiles.get(displayName)!.timestamp < artifact.timestamp) {
            latestFiles.set(displayName, {
              originalPath,
              displayName,
              timestamp: artifact.timestamp
            })
          }
        }
      }

      // Create symlinks for all latest files
      for (const fileInfo of latestFiles.values()) {
        const linkPath = path.join(dataDir, fileInfo.displayName)
        
        // Create symlink if original file exists
        if (await fsPromises.access(fileInfo.originalPath).then(() => true).catch(() => false)) {
          await fsPromises.symlink(fileInfo.originalPath, linkPath)
          console.log(`Created symlink: ${linkPath} -> ${fileInfo.originalPath}`)
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
      // Prepare data files before running code
      await this.prepareDataFiles()

      const tempDir = this.getTempDir()

      // Save the code to a temporary file
      const codeDir = path.join(tempDir, runId)
      await fsPromises.mkdir(codeDir, { recursive: true })
      
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
      console.log('Plot file status:', { plotPath, exists: hasPlot })

      const dataFilename = `${runId}_data.csv`
      const dataPath = path.join(tempDir, dataFilename)
      const hasData = fs.existsSync(dataPath)
      console.log('Data file status:', { dataPath, exists: hasData })

      if (hasPlot) console.log('Found plot file:', plotFilename)
      if (hasData) console.log('Found data file:', dataFilename)

      return {
        success: true,
        output: stdout,
        plotFile: hasPlot ? plotFilename : undefined,
        dataFile: hasData ? dataFilename : undefined
      }
    } catch (error) {
      console.error('Error running code:', error)
      return {
        success: false,
        output: error instanceof Error ? error.message : 'Unknown error occurred'
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
from io import StringIO
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# Set the runId for the plot filename
runId = '${runId}'

# Add data directory to Python path
sys.path.append('/app/data')

# Capture print output
output_buffer = StringIO()
sys.stdout = output_buffer

# Execute user code
try:
    # Execute user code
    import user_code
    
    # Check if there's a plot to save
    if plt.get_fignums():
        print("\\nFound plot, saving...")
        plt.savefig(f'/app/output/{runId}_plot.png')
        print(f"Saved plot as {runId}_plot.png")
    
    # Check for any CSV files in the current directory
    import glob
    csv_files = glob.glob('*.csv')
    if csv_files:
        print(f"\\nFound CSV files: {csv_files}")
        import shutil
        for csv_file in csv_files:
            output_path = f'/app/output/{runId}_data.csv'
            shutil.move(csv_file, output_path)
            print(f"Moved {csv_file} to {output_path}")
    
except Exception as e:
    print(f"Error: {str(e)}")

# Restore stdout and get output
sys.stdout = sys.__stdout__
print(output_buffer.getvalue())
`
  }

  private async runDocker(runId: string, codeDir: string): Promise<{ stdout: string }> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', [
        'run',
        '--name', runId,
        '-v', `${codeDir}:/app/code:ro`,  // Code directory (read-only)
        '-v', `${this.getTempDir()}:/app/output`,  // Output directory
        '-v', `${this.getTempDir()}:/app/data:ro`,  // Data directory (read-only)
        '--network', 'none',
        '--memory', '512m',
        '--cpus', '0.5',
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
