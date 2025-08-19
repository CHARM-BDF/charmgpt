import { ArtifactType } from '@charm-mcp/shared';

/**
 * Maps file MIME types and extensions to the best artifact viewer type
 */
export function getArtifactTypeForFile(fileName: string, mimeType: string): ArtifactType {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  // Direct MIME type mappings
  if (mimeType.startsWith('image/svg')) return 'image/svg+xml';
  if (mimeType.startsWith('image/png')) return 'image/png';
  if (mimeType === 'text/html' || mimeType === 'application/html') return 'html';
  if (mimeType === 'application/json') return 'application/json';
  if (mimeType === 'text/markdown') return 'text/markdown';
  
  // Extension-based mappings
  switch (extension) {
    case 'json':
      return 'application/json';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'html':
    case 'htm':
      return 'html';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'py':
      return 'application/python';
    case 'js':
    case 'jsx':
      return 'application/javascript';
    case 'ts':
    case 'tsx':
      return 'application/javascript'; // TypeScript displayed as JavaScript
    case 'csv':
    case 'tsv':
      return 'text/markdown'; // CSV will be displayed as markdown table
    case 'txt':
    case 'log':
      return 'text';
    case 'xml':
      return 'code'; // XML as code with syntax highlighting
    case 'yaml':
    case 'yml':
      return 'code';
    default:
      // For unknown types, try to infer from MIME type
      if (mimeType.startsWith('text/')) return 'text';
      if (mimeType.startsWith('application/')) return 'code';
      return 'text'; // Fallback to plain text
  }
}

/**
 * Determines if a file type is suitable for artifact viewing
 */
export function canViewAsArtifact(fileName: string, mimeType: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  // Exclude binary files that can't be meaningfully displayed
  const unsupportedExtensions = ['exe', 'bin', 'dll', 'so', 'zip', 'rar', '7z', 'tar', 'gz'];
  const unsupportedMimeTypes = ['application/octet-stream', 'application/x-binary'];
  
  if (unsupportedExtensions.includes(extension)) return false;
  if (unsupportedMimeTypes.includes(mimeType)) return false;
  
  // Large files might be too big to display comfortably
  // This check would need file size, which we don't have here
  // Could be added as a parameter if needed
  
  return true;
}

/**
 * Gets a language identifier for code syntax highlighting
 */
export function getLanguageForFile(fileName: string, mimeType: string): string | undefined {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  switch (extension) {
    case 'py': return 'python';
    case 'js': return 'javascript';
    case 'jsx': return 'jsx';
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'json': return 'json';
    case 'xml': return 'xml';
    case 'yaml':
    case 'yml': return 'yaml';
    case 'sql': return 'sql';
    case 'sh': return 'bash';
    case 'md': return 'markdown';
    case 'r': return 'r';
    case 'java': return 'java';
    case 'cpp':
    case 'cc': return 'cpp';
    case 'c': return 'c';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'php': return 'php';
    case 'rb': return 'ruby';
    default: return undefined;
  }
}
