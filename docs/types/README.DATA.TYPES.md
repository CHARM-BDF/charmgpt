# Data Types Reference

## Purpose
This document contains all data structure definitions used in the file management system. These types are referenced by other documentation files and implementation code.

## File Entry Types

### FileEntry
Core file entry structure that represents a single file in the system.

```typescript
interface FileEntry {
  id: string;                 // Unique identifier (UUID v4)
  name: string;               // Original filename
  path: string;               // Relative storage path
  mimeType: string;           // File type
  size: number;               // File size in bytes
  hash: {                     // Content hash
    algorithm: "sha256" | "sha512";
    value: string;
  };
  status: "active" | "deleted" | "archived";
  owner: string;              // Owner identifier
  created: Date;              // Creation timestamp
  modified: Date;             // Last modified timestamp
  lastAccessed: Date;         // Last accessed timestamp
  tags: string[];             // Required searchable tags
  llmNotes: string;          // Notes for LLM understanding
  metadata: FileMetadata;     // Additional metadata
}
```

### SchemaInfo
Schema information for data files. Currently supports tabular and JSON formats.

```typescript
interface SchemaInfo {
  type: "tabular" | "json";  // Limited to tabular and JSON
  format: string;            // File format (e.g., "csv", "parquet", "json")
  encoding: string;          // File encoding (default: "utf-8")
  sampleData: string;        // Representative sample for LLM analysis
  
  // For tabular data
  tabular?: {
    rowCount: number;
    columns: Array<{
      name: string;
      type: string;          // Data type
      nullable: boolean;
      description?: string;  // Column description for LLM
      sample?: string[];     // Sample values for LLM understanding
    }>;
    hasHeader: boolean;
    delimiter?: string;      // For CSV-like files
  };
  
  // For JSON data
  json?: {
    rootType: "object" | "array";
    schema: object;          // JSON schema
    keyPaths: string[];      // Available key paths
    sampleKeys: {           // Sample key-value pairs for LLM
      path: string;
      samples: string[];
    }[];
  };
}
```

For complete type definitions, see:
- [Metadata Types](./README.METADATA.TYPES.md)
- [Operation Types](./README.OPERATION.TYPES.md)
- [Branch Types](./README.BRANCH.TYPES.md) 