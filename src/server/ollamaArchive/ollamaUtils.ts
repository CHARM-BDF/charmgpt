/**
 * Utility functions for Ollama server implementation
 */

import net from 'net';
import { OllamaConfig } from './ollamaTypes';

/**
 * Configure and validate port for server
 * Attempts to use primary port, falls back to secondary if needed
 */
export async function configurePort(config: OllamaConfig): Promise<number> {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  };

  if (await isPortAvailable(config.port || 3001)) {
    return config.port || 3001;
  }

  if (await isPortAvailable(config.fallbackPort || 3002)) {
    console.log(`Primary port ${config.port || 3001} in use, using fallback port ${config.fallbackPort || 3002}`);
    return config.fallbackPort || 3002;
  }

  throw new Error('No available ports found');
}

/**
 * Format error response
 */
export function formatErrorResponse(error: Error): { error: { message: string; details?: any } } {
  return {
    error: {
      message: error.message,
      details: error.stack
    }
  };
}

/**
 * Validate and normalize artifact type
 */
export function validateArtifactType(type: string): string {
  const validTypes = [
    'code',
    'html',
    'image/svg+xml',
    'image/png',
    'text',
    'application/vnd.ant.mermaid',
    'text/markdown',
    'application/python',
    'application/javascript',
    'application/vnd.react',
    'application/vnd.bibliography',
    'application/vnd.ant.python'
  ];

  // Handle application/vnd.ant.code type
  if (type?.startsWith('application/vnd.ant.code')) {
    return 'code';
  }

  // Handle code snippets with language attribute
  if (type?.startsWith('code/')) {
    return 'code';
  }

  // Handle binary types explicitly
  if (type === 'image/png') {
    return 'image/png';
  }

  // If no type is specified or type is 'text', default to text/markdown
  if (!type || type === 'text') {
    return 'text/markdown';
  }

  const normalizedType = type;

  if (validTypes.includes(normalizedType)) {
    return normalizedType;
  }

  // Default to text/markdown for unknown types
  return 'text/markdown';
} 