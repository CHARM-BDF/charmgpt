export interface BinaryOutput {
  type: string;
  data: string;
  metadata: {
    size?: number;
    sourceCode?: string;
    [key: string]: any;
  };
}

export interface ProcessedArtifact {
  id: string;
  artifactId?: string;
  type: string;
  title: string;
  content: string;
  position: number;
  language?: string;
}

export class ArtifactService {
  private readonly validTypes = [
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

  /**
   * Validate and normalize artifact type
   */
  validateArtifactType(type: string): string {
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

    if (this.validTypes.includes(normalizedType)) {
      return normalizedType;
    }

    // Default to text/markdown for unknown types
    return 'text/markdown';
  }

  /**
   * Process binary output into artifact format
   */
  processBinaryOutput(output: BinaryOutput, position: number): ProcessedArtifact[] {
    const artifacts: ProcessedArtifact[] = [];
    const type = this.validateArtifactType(output.type);

    // Add main binary artifact
    artifacts.push({
      id: crypto.randomUUID(),
      type,
      title: `Generated ${output.type.split('/')[1].toUpperCase()}`,
      content: output.data,
      position
    });

    // Add source code if available
    if (output.metadata?.sourceCode) {
      artifacts.push({
        id: crypto.randomUUID(),
        type: 'application/vnd.ant.python',
        title: 'Source Code',
        content: output.metadata.sourceCode,
        language: 'python',
        position: position + 1
      });
    }

    return artifacts;
  }

  /**
   * Get language from artifact type
   */
  getLanguageFromType(type: string): string | undefined {
    if (type.startsWith('code/')) {
      return type.split('/')[1];
    }
    
    const typeToLanguage: Record<string, string> = {
      'application/python': 'python',
      'application/javascript': 'javascript',
      'application/vnd.ant.python': 'python',
      'application/vnd.react': 'jsx'
    };

    return typeToLanguage[type];
  }

  /**
   * Check if artifact type is binary
   */
  isBinaryType(type: string): boolean {
    return [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'application/pdf'
    ].includes(type);
  }
} 