# Metadata Types Reference

## Purpose
This document defines all metadata-related type definitions used in the file management system.

## Core Metadata Types

### FileMetadata
Primary metadata structure for file entries.

```typescript
interface FileMetadata {
  description: string;        // Required description
  schema: SchemaInfo;        // Schema information (required)
  origin: {                  // Required origin information
    type: "upload" | "derived";
    sourceId?: string;       // Parent file ID if derived
    operation?: OperationType; // Operation that created this file
    parameters?: Record<string, unknown>; // Operation parameters
    timestamp: Date;         // When the operation occurred
  };
  version: {                // Required version information
    major: number;          // Major version
    minor: number;          // Minor version
    patch: number;          // Patch version
    branch: {              // Branch information
      name: string;        // Branch name
      parent: string;      // Parent branch name
      created: Date;       // Branch creation date
      description: string; // Branch purpose
    };
    history: Array<{       // Version history
      id: string;          // Version identifier
      timestamp: Date;     // Version timestamp
      message: string;     // Version message
      user: string;        // User who created version
      branch: string;      // Branch name
      parent: string;      // Parent version ID
    }>;
  };
  analysisInfo: {           // Required analysis information
    rowCount?: number;      // For tabular data
    summary: {              // Statistical or structural summary
      numeric?: Record<string, {
        min: number;
        max: number;
        mean: number;
        nullCount: number;
      }>;
      categorical?: Record<string, {
        uniqueCount: number;
        topValues: string[];
        nullCount: number;
      }>;
    };
    quality: {              // Data quality metrics
      nullCount: number;
      duplicateCount: number;
      errorCount: number;
      completeness: number; // Percentage of non-null values
    };
  };
}
```

### RelationshipMetadata
Metadata for file relationships.

```typescript
interface RelationshipMetadata {
  sourceId: string;         // ID of the source file
  targetId: string;         // ID of the target file
  type: string;            // Type of relationship (e.g., "references", "depends-on", "derived-from")
  created: Date;           // When the relationship was created
  description?: string;    // Optional description of the relationship
  metadata?: Record<string, unknown>; // Additional relationship metadata
}
```

### FileRelationship
Structure for storing file relationships.

```typescript
interface FileRelationship {
  targetId: string;        // ID of the target file
  type: string;           // Type of relationship
}
```

### RelatedFile
Extended FileEntry with relationship type.

```typescript
interface RelatedFile extends FileEntry {
  type: string;           // Type of relationship to the source file
}
```

### AnalysisMetadata
Detailed analysis information for data files.

```typescript
interface AnalysisMetadata {
  timestamp: Date;           // When analysis was performed
  tool: string;             // Tool used for analysis
  metrics: {
    rowCount?: number;
    columnCount?: number;
    memoryUsage: number;
    processingTime: number;
  };
  insights?: string[];      // LLM-generated insights
  recommendations?: string[]; // LLM-generated recommendations
}
```

### ValidationMetadata
Metadata for data validation results.

```typescript
interface ValidationMetadata {
  timestamp: Date;
  validator: string;
  rules: Array<{
    type: string;
    field?: string;
    condition: string;
    passed: boolean;
    failures?: number;
  }>;
  summary: {
    totalRules: number;
    passedRules: number;
    failedRules: number;
    warningCount: number;
  };
}
```

## Related Documentation
- [Data Types](./README.DATA.TYPES.md)
- [Operation Types](./README.OPERATION.TYPES.md)
- [Branch Types](./README.BRANCH.TYPES.md)

## Usage Notes
1. All timestamps should be in UTC
2. Descriptions should be clear and LLM-friendly
3. Analysis information should be updated after each operation
4. Version information must be maintained consistently
5. Relationships are stored in separate files in the relationships directory
6. Relationship types should be descriptive and consistent across the system 