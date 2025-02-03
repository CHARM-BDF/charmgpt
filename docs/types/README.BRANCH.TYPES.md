# Branch Types Reference

## Purpose
This document defines all branch and version control related type definitions used in the file management system.

## Core Branch Types

### BranchInfo
Primary structure for branch information.

```typescript
interface BranchInfo {
  name: string;            // Branch name
  created: Date;           // Creation timestamp
  creator: string;         // User who created the branch
  description: string;     // Branch purpose
  parent: {               // Parent branch information
    name: string;         // Parent branch name
    version: string;      // Parent version ID at branch point
  };
  status: "active" | "merged" | "abandoned";
  tags: string[];         // Branch-specific tags
  llmNotes: string;      // Notes for LLM about branch purpose
  history: BranchHistory[];
}
```

### BranchHistory
History tracking for branches.

```typescript
interface BranchHistory {
  timestamp: Date;
  action: "created" | "merged" | "updated" | "abandoned";
  user: string;
  message: string;
  metadata?: Record<string, unknown>;
}
```

### Version Control Types

#### VersionInfo
Detailed version information.

```typescript
interface VersionInfo {
  id: string;             // Version identifier
  major: number;          // Major version number
  minor: number;          // Minor version number
  patch: number;          // Patch version number
  branch: string;         // Branch name
  created: Date;          // Creation timestamp
  creator: string;        // User who created version
  message: string;        // Version message
  parent?: string;        // Parent version ID
  tags: string[];         // Version-specific tags
  changes: ChangeInfo[];  // List of changes
}
```

#### ChangeInfo
Information about changes in a version.

```typescript
interface ChangeInfo {
  type: "added" | "modified" | "removed";
  path: string;           // Path to changed element
  description: string;    // Change description
  metadata?: {
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
  };
}
```

### Merge Types

#### MergeInfo
Information about merge operations.

```typescript
interface MergeInfo {
  id: string;            // Merge identifier
  source: string;        // Source branch name
  target: string;        // Target branch name
  created: Date;         // Merge timestamp
  creator: string;       // User who performed merge
  status: "pending" | "completed" | "failed" | "conflict";
  conflicts?: MergeConflict[];
  resolution?: MergeResolution;
  llmNotes?: string;    // Notes for LLM about merge
}
```

#### MergeConflict
Structure for merge conflicts.

```typescript
interface MergeConflict {
  path: string;          // Path to conflicting element
  type: "content" | "metadata" | "schema";
  source: {
    version: string;
    value: unknown;
  };
  target: {
    version: string;
    value: unknown;
  };
  resolution?: {
    strategy: "source" | "target" | "custom";
    value?: unknown;
    reason?: string;
  };
}
```

### Branch Operations

#### BranchOperation
Operations that can be performed on branches.

```typescript
interface BranchOperation {
  type: "create" | "merge" | "update" | "abandon";
  branch: string;
  timestamp: Date;
  user: string;
  parameters?: Record<string, unknown>;
  result?: {
    success: boolean;
    error?: string;
    warnings?: string[];
  };
}
```

## Related Documentation
- [Data Types](./README.DATA.TYPES.md)
- [Metadata Types](./README.METADATA.TYPES.md)
- [Operation Types](./README.OPERATION.TYPES.md)

## Usage Notes
1. Branch names should be unique within the system
2. Version numbers should follow semantic versioning
3. All branch operations should maintain data consistency
4. Merge conflicts should be clearly documented for LLM understanding 