# Operation Types Reference

## Purpose
This document defines all operation-related type definitions used in the file management system.

## Core Operation Types

### OperationType
Enumeration of all possible operation types.

```typescript
type OperationType = 
  | "transform"             // Data transformation
  | "aggregate"             // Data aggregation
  | "filter"               // Data filtering
  | "merge"                // Data merging
  | "split"                // Data splitting
  | "clean"                // Data cleaning
  | "analyze"              // Data analysis
  | "branch"               // Branch creation
  | "custom";              // Custom operation
```

### OperationMetadata
Metadata structure for operations.

```typescript
interface OperationMetadata {
  type: OperationType;
  description: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  user: string;
  llmNotes?: string;       // Notes for LLM about the operation
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;       // Operation duration in milliseconds
  resources?: {
    memoryUsage: number;
    cpuUsage: number;
  };
}
```

### Operation Parameters

#### Transform Operation
```typescript
interface TransformParameters {
  type: "transform";
  transformations: Array<{
    field: string;
    operation: string;
    parameters?: Record<string, unknown>;
  }>;
  outputFormat?: string;
}
```

#### Aggregate Operation
```typescript
interface AggregateParameters {
  type: "aggregate";
  groupBy: string[];
  aggregations: Array<{
    field: string;
    function: "sum" | "avg" | "min" | "max" | "count";
    alias?: string;
  }>;
}
```

#### Filter Operation
```typescript
interface FilterParameters {
  type: "filter";
  conditions: Array<{
    field: string;
    operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "nin";
    value: unknown;
  }>;
  combineOperator: "and" | "or";
}
```

#### Merge Operation
```typescript
interface MergeParameters {
  type: "merge";
  sources: string[];      // File IDs to merge
  strategy: "inner" | "outer" | "left" | "right";
  keys: string[];        // Keys to merge on
  conflictResolution?: "first" | "last" | "error";
}
```

### Operation Results

#### OperationResult
Base structure for operation results.

```typescript
interface OperationResult {
  success: boolean;
  timestamp: Date;
  duration: number;
  outputFileId?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metrics?: {
    inputRows: number;
    outputRows: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  warnings?: string[];
}
```

## Operation Flow Types

### OperationQueue
Structure for managing operation queues.

```typescript
interface OperationQueue {
  id: string;
  operations: Array<{
    id: string;
    type: OperationType;
    status: "pending" | "running" | "completed" | "failed";
    dependencies?: string[];  // Operation IDs this depends on
    metadata: OperationMetadata;
  }>;
  status: "pending" | "running" | "completed" | "failed";
  created: Date;
  updated: Date;
}
```

## Related Documentation
- [Data Types](./README.DATA.TYPES.md)
- [Metadata Types](./README.METADATA.TYPES.md)
- [Branch Types](./README.BRANCH.TYPES.md)

## Usage Notes
1. All operations should be idempotent when possible
2. Operations should include clear LLM notes
3. Resource usage should be monitored and logged
4. Operation queues should handle dependencies correctly 