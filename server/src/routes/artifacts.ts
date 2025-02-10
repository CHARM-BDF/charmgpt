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
    const data = await fs.readFile(ARTIFACTS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    void error
    console.error('Failed to load artifacts:', error)
    return []
  }
}

// Save pinned artifacts
async function savePinnedArtifacts(artifacts: Artifact[]) {
  // Only save artifacts that are marked as pinned
  const pinnedArtifacts = artifacts.filter(a => a.pinned)
  await fs.writeFile(ARTIFACTS_FILE, JSON.stringify(pinnedArtifacts, null, 2))
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
    const artifacts = await loadPinnedArtifacts()
    
    if (pinned) {
      // Add to pinned artifacts if not already there
      if (!artifacts.find((a) => a.id === artifactId)) {
        artifacts.push(artifact)
      }
    } else {
      // Remove from pinned artifacts
      const index = artifacts.findIndex((a) => a.id === artifactId)
      if (index !== -1) {
        artifacts.splice(index, 1)
      }
    }
    
    await savePinnedArtifacts(artifacts)
    res.json({ success: true })
  } catch (error) {
    void error
    res.status(500).json({ error: 'Failed to update pinned status' })
  }
})

export default router 