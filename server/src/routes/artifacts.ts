import express from 'express'
import * as fs from 'fs/promises'
import * as path from 'path'
import { DockerService } from '../services/docker'
import { Artifact } from '../types'

const router = express.Router()
const docker = new DockerService()

const ARTIFACTS_FILE = path.join(docker.getTempDir(), 'artifacts.json')
const ALL_ARTIFACTS_FILE = path.join(docker.getTempDir(), 'all_artifacts.json')

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

// Load all artifacts
async function loadAllArtifacts(): Promise<Artifact[]> {
  try {
    // First check if file exists
    try {
      await fs.access(ALL_ARTIFACTS_FILE)
    } catch {
      // If file doesn't exist, return empty array
      return []
    }

    const data = await fs.readFile(ALL_ARTIFACTS_FILE, 'utf-8')
    
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

// Save all artifacts
async function saveAllArtifacts(artifacts: Artifact[]) {
  try {
    // Ensure directory exists
    const dir = path.dirname(ALL_ARTIFACTS_FILE)
    await fs.mkdir(dir, { recursive: true })

    // Save all artifacts
    await fs.writeFile(ALL_ARTIFACTS_FILE, JSON.stringify(artifacts, null, 2))
  } catch (error) {
    console.error('Failed to save all artifacts:', error)
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
    const allArtifacts = await loadAllArtifacts()
    
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
    
    // Update the artifact in the all artifacts list
    const existingIndex = allArtifacts.findIndex(a => a.id === artifactId)
    if (existingIndex >= 0) {
      allArtifacts[existingIndex] = {
        ...artifact,
        pinned
      }
    } else {
      allArtifacts.push({
        ...artifact,
        pinned
      })
    }
    
    // Save both lists
    await savePinnedArtifacts(pinnedArtifacts)
    await saveAllArtifacts(allArtifacts)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Failed to update pin status:', error)
    res.status(500).json({ error: 'Failed to update pinned status' })
  }
})

// Add a new endpoint to save an artifact (for non-pinned artifacts)
router.post('/save', async (req, res) => {
  try {
    const { artifact } = req.body as {
      artifact: Artifact
    }
    
    const allArtifacts = await loadAllArtifacts()
    
    // Update or add the artifact
    const existingIndex = allArtifacts.findIndex(a => a.id === artifact.id)
    if (existingIndex >= 0) {
      allArtifacts[existingIndex] = artifact
    } else {
      allArtifacts.push(artifact)
    }
    
    // Save all artifacts
    await saveAllArtifacts(allArtifacts)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Failed to save artifact:', error)
    res.status(500).json({ error: 'Failed to save artifact' })
  }
})

// Add a new endpoint to get all artifacts
router.get('/all', async (req, res) => {
  try {
    const artifacts = await loadAllArtifacts()
    res.json(artifacts)
  } catch (error) {
    void error
    res.status(500).json({ error: 'Failed to load all artifacts' })
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

// Check if permalink exists
router.get('/permalinks/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const permalinkDir = path.join(docker.getTempDir(), 'permalinks', name);
    
    try {
      await fs.access(permalinkDir);
      res.json({ exists: true });
    } catch {
      res.json({ exists: false });
    }
  } catch (error) {
    void error;
    res.status(500).json({ error: 'Failed to check permalink' });
  }
});

// Load permalink content
router.get('/permalinks/:name/load', async (req, res) => {
  try {
    const { name } = req.params;
    const permalinkDir = path.join(docker.getTempDir(), 'permalinks', name);
    
    // Read pinned.json and plan.md
    const [pinnedContent, planContent] = await Promise.all([
      fs.readFile(path.join(permalinkDir, 'pinned.json'), 'utf-8'),
      fs.readFile(path.join(permalinkDir, 'plan.md'), 'utf-8')
    ]);
    
    res.json({
      pinned: JSON.parse(pinnedContent),
      plan: planContent
    });
  } catch (error) {
    void error;
    res.status(500).json({ error: 'Failed to load permalink' });
  }
});

// Save permalink
router.post('/permalinks/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const permalinkDir = path.join(docker.getTempDir(), 'permalinks', name);
    
    // Create permalink directory
    await fs.mkdir(permalinkDir, { recursive: true });
    
    // Get current pinned artifacts and plan
    const [pinnedArtifacts, planContent] = await Promise.all([
      fs.readFile(ARTIFACTS_FILE, 'utf-8'),
      fs.readFile(path.join(docker.getTempDir(), 'plan.md'), 'utf-8')
    ]);
    
    // Save to permalink directory
    await Promise.all([
      fs.writeFile(path.join(permalinkDir, 'pinned.json'), pinnedArtifacts),
      fs.writeFile(path.join(permalinkDir, 'plan.md'), planContent),
      fs.writeFile(path.join(permalinkDir, 'metadata.json'), JSON.stringify({
        createdAt: Date.now(),
        name
      }))
    ]);
    
    res.json({ success: true });
  } catch (error) {
    void error;
    res.status(500).json({ error: 'Failed to save permalink' });
  }
});

export default router 