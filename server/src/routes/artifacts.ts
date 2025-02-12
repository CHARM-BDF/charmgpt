import express from 'express'
import * as fs from 'fs/promises'
import * as path from 'path'
import { DockerService } from '../services/docker'
import { Artifact } from '../types'

const router = express.Router()
const docker = new DockerService()

const ARTIFACTS_FILE = path.join(docker.getTempDir(), 'artifacts.json')

// Ensure artifacts file exists
async function ensureArtifactsFile() {
  try {
    await fs.access(ARTIFACTS_FILE)
  } catch {
    // File doesn't exist, create it with empty array
    await fs.writeFile(ARTIFACTS_FILE, '[]')
  }
}

// Initialize artifacts file
ensureArtifactsFile()

// Load pinned artifacts
async function loadPinnedArtifacts(): Promise<Artifact[]> {
  try {
    // First check if file exists
    try {
      await fs.access(ARTIFACTS_FILE)
    } catch {
      // If file doesn't exist, return empty array
      return []
    }

    const data = await fs.readFile(ARTIFACTS_FILE, 'utf-8')
    
    // Handle empty file case
    if (!data.trim()) {
      return []
    }

    try {
      const artifacts = JSON.parse(data)
      // Validate that artifacts is an array
      if (!Array.isArray(artifacts)) {
        console.error('Invalid artifacts data format:', artifacts)
        return []
      }
      return artifacts
    } catch (parseError) {
      console.error('Failed to parse artifacts JSON:', parseError)
      return []
    }
  } catch (error) {
    console.error('Failed to load artifacts:', error)
    return []
  }
}

// Save pinned artifacts
async function savePinnedArtifacts(artifacts: Artifact[]) {
  try {
    // Ensure directory exists
    const dir = path.dirname(ARTIFACTS_FILE)
    await fs.mkdir(dir, { recursive: true })

    // Only save artifacts that are marked as pinned
    const pinnedArtifacts = artifacts.filter(a => a.pinned)
    await fs.writeFile(ARTIFACTS_FILE, JSON.stringify(pinnedArtifacts, null, 2))
  } catch (error) {
    console.error('Failed to save artifacts:', error)
    throw error
  }
}

router.get('/pinned', async (req, res) => {
  try {
    const artifacts = await loadPinnedArtifacts()
    res.json(artifacts)
  } catch (error) {
    void error
    res.status(500).json({ error: 'Failed to load pinned artifacts' })
  }
})

router.post('/pin', async (req, res) => {
  try {
    const { artifactId, pinned, artifact } = req.body as {
      artifactId: number
      pinned: boolean
      artifact: Artifact
    }
    let pinnedArtifacts = await loadPinnedArtifacts()
    
    if (pinned) {
      // Add to pinned artifacts if not already there
      if (!pinnedArtifacts.find((a) => a.id === artifactId)) {
        pinnedArtifacts.push({
          ...artifact,
          pinned: true
        })
      }
    } else {
      // Remove from pinned artifacts
      pinnedArtifacts = pinnedArtifacts.filter(a => a.id !== artifactId)
    }
    
    // Save only once
    await savePinnedArtifacts(pinnedArtifacts)
    res.json({ success: true })
  } catch (error) {
    console.error('Failed to update pin status:', error)
    res.status(500).json({ error: 'Failed to update pinned status' })
  }
})

router.post('/plan', async (req, res) => {
  try {
    const { content } = req.body
    const planFile = path.join(docker.getTempDir(), 'plan.md')
    await fs.writeFile(planFile, content)
    res.json({ success: true })
  } catch (error) {
    void error
    res.status(500).json({ error: 'Failed to save plan' })
  }
})

router.get('/plan', async (req, res) => {
  try {
    const planFile = path.join(docker.getTempDir(), 'plan.md')
    try {
      const content = await fs.readFile(planFile, 'utf-8')
      res.json({ content })
    } catch (err) {
      void err
      // If file doesn't exist, return empty content
      res.json({ content: '' })
    }
  } catch (error) {
    void error
    res.status(500).json({ error: 'Failed to load plan' })
  }
})

export default router 