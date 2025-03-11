import { Artifact, getDisplayName, dataHeader } from '../contexts/ArtifactContext.types';

/**
 * Formats an artifact with a consistent, comprehensive style
 * @param artifact The artifact to format
 * @returns A formatted string representation of the artifact
 */
export function formatArtifact(artifact: Artifact, output_only: boolean = false): string {
  let artifactSummary = `## Artifact`;
  
  if (output_only) {
    // When output_only is true, only include content before "__RESULTS__"
    let output = artifact.output || '';
    const resultsMarkerIndex = output.indexOf('__RESULTS__');
    
    // If the marker exists, only include content before it
    if (resultsMarkerIndex !== -1) {
      output = output.substring(0, resultsMarkerIndex).trim();
    }
    
    artifactSummary += `\n` + output + `\n`;
    return artifactSummary;
  } else {
    artifactSummary += `  ${getDisplayName(artifact)}`;
  }
  
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