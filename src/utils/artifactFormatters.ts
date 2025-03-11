import { Artifact, getDisplayName, dataHeader } from '../contexts/ArtifactContext.types';

/**
 * Formats an artifact with a consistent, comprehensive style
 * @param artifact The artifact to format
 * @param quoted Whether to wrap the output in Python triple quotes (for code insertion)
 * @returns A formatted string representation of the artifact
 */
export function formatArtifact(artifact: Artifact): string {
  let artifactSummary = `## Artifact ${getDisplayName(artifact)}`;
  
  if (artifact.dataFile) {
    artifactSummary += `\n### Data Columns\n${dataHeader(artifact.dataFile)}\n`;
  }
  
  if (artifact.chatInput) {
    artifactSummary += `\n### Chat Input\n${artifact.chatInput}\n`;
  }
  
  if (artifact.code) {
    artifactSummary += `\n### Code\n\`\`\`${artifact.language || 'python'}\n${artifact.code}\`\`\`\n`;
  }
  
  if (artifact.output && !artifact.dataFile) {
    artifactSummary += `\n### Output\n\`\`\`\n${artifact.output}\`\`\`\n`;
  }
  
  if (artifact.plotFile) {
    artifactSummary += `\n### Plot\n![Plot](${artifact.plotFile})\n`;
  }
  
  return artifactSummary;
}