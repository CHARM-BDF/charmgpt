# Python MCP Server Strategy Document

## Overview
This document outlines the strategy for handling different Python output types and data files in the MCP server system, from Python execution through to React frontend display.

## Data Files Handling

### 1. Input File Processing
- Files passed to Python execution via `dataFiles` parameter:
  ```typescript
  interface ExecuteArgs {
    code: string;
    dataFiles?: Record<string, string>;  // variable_name -> file_path
    timeout?: number;
  }
  ```

- File Types Support:
  - CSV/TSV files
  - JSON data files
  - Excel files (.xlsx, .xls)
  - Text files
  - Binary data files
  - Image files
  - Parquet files
  - HDF5 files

### 2. File Loading Strategy
1. **Security**
   - Validate file types before loading
   - Check file sizes
   - Scan for malicious content
   - Enforce access restrictions

2. **Performance**
   - Stream large files
   - Chunk loading for big datasets
   - Caching frequently used files
   - Memory management for large files

3. **File Management**
   - Temporary file cleanup
   - Version tracking
   - File locking during operations
   - Concurrent access handling

### 3. Python Integration
```python
# Example structure for file handling
{
  "input_files": {
    "variable_name": {
      "path": "file_path",
      "type": "file_type",
      "size": size_in_bytes,
      "loaded": true/false
    }
  }
}
```

## Type System Implementation

### 1. Python Output Generation & Type Detection
- Python code generates different types of output
- Type detection system:
  ```python
  # Example structure
  {
    "type": "detected_type",
    "data": actual_data,
    "metadata": additional_info,
    "file_dependencies": {
      "input_files": ["file1", "file2"],
      "output_files": ["result1", "result2"]
    }
  }
  ```

### 2. Supported Types
1. **Basic Types**
   - Text (strings, print output)
   - Numbers
   - Boolean values

2. **Data Structures**
   - DataFrames (pandas)
   - NumPy Arrays
   - Lists/Dictionaries
   - JSON data

3. **Visual Output**
   - Matplotlib/Seaborn plots
   - Interactive plots (Plotly)
   - SVG graphics
   - Network graphs

4. **Binary Data**
   - Generated files
   - Image data
   - Binary arrays

5. **File Outputs**
   - Saved datasets
   - Generated reports
   - Export files

### 3. Communication Layer (Python to Node.js)
- Enhanced PythonShell communication:
  ```typescript
  interface PythonMessage {
    type: string;
    data: any;
    metadata: Record<string, any>;
    files?: {
      inputs: Record<string, string>;
      outputs: Record<string, string>;
    };
  }
  ```

### 4. MCP Server Response Format
```typescript
interface MCPResponse {
  content: [{
    type: string;
    data: any;
    metadata: {
      mimeType?: string;
      dimensions?: {width: number, height: number};
      schema?: object;
      fileInfo?: {
        name: string;
        size: number;
        type: string;
      };
    };
    files?: {
      inputs: Record<string, FileInfo>;
      outputs: Record<string, FileInfo>;
    };
  }];
  isError: boolean;
}
```

### 5. React Frontend Components

1. **File Handling Components**
```typescript
interface FileHandlerProps {
  files: {
    inputs: Record<string, FileInfo>;
    outputs: Record<string, FileInfo>;
  };
  onFileSelect: (files: FileList) => void;
  onFileDownload: (fileId: string) => void;
}
```

2. **Type-Specific Display Components**
```typescript
interface DisplayProps {
  content: {
    type: string;
    data: any;
    metadata: Record<string, any>;
    files?: {
      inputs: Record<string, FileInfo>;
      outputs: Record<string, FileInfo>;
    };
  }[];
}
```

### 6. Type-Specific Implementations

1. **DataFrame Display**
```typescript
interface DataFrameContent {
  type: "pandas.dataframe";
  data: {
    columns: string[];
    rows: any[][];
    source_files?: string[];  // Input files used
  };
  metadata: {
    rowCount: number;
    columnCount: number;
    dtypes?: Record<string, string>;
    fileInfo?: FileInfo;
  };
}
```

2. **Plot Display**
```typescript
interface PlotContent {
  type: "matplotlib.figure";
  data: string;  // base64
  metadata: {
    mimeType: string;
    width: number;
    height: number;
    dataSource?: string[];  // Input files used
  };
}
```

3. **File Output Display**
```typescript
interface FileContent {
  type: "file.output";
  data: {
    id: string;
    name: string;
    preview?: string;
  };
  metadata: {
    type: string;
    size: number;
    created: string;
    sourceFiles?: string[];
  };
}
```

## Artifact System Integration

### 1. Type Mapping Strategy
Map Python output types to existing artifact types for consistent display:

```typescript
interface TypeMapping {
  // Data Structure Types
  "pandas.dataframe": "application/vnd.ant.table",
  "numpy.array": "application/vnd.ant.data",
  "json": "application/json",
  
  // Visual Types
  "matplotlib.figure": "image/png",
  "plotly.figure": "application/vnd.plotly",
  "seaborn.figure": "image/png",
  
  // Text Types
  "text": "text/plain",
  "markdown": "text/markdown",
  
  // Binary Types
  "binary": "application/octet-stream",
  
  // Special Types
  "mermaid": "application/vnd.mermaid",
  "react": "application/vnd.react"
}
```

### 2. Response Format Integration
Maintain compatibility with existing artifact system:

```typescript
interface ArtifactResponse {
  content: [{
    type: ArtifactType;          // Mapped from Python type
    text: string;                // For text/JSON data
    data?: string;               // For binary/base64 data
    metadata: {
      originalType: string;      // Original Python type
      pythonMetadata: any;       // Any Python-specific metadata
      dimensions?: {
        width: number;
        height: number;
      };
      schema?: object;           // For data structures
      sourceFiles?: string[];    // Input files used
    };
  }];
  isError: boolean;
}
```

### 3. Artifact Window Integration
Leverage existing artifact window system:

1. **Window Management**
   - Use existing window positioning
   - Maintain size preferences
   - Keep z-index handling

2. **Content Rendering**
   - Use existing artifact renderers
   - Add specific renderers only if needed
   - Maintain consistent styling

3. **Metadata Display**
   - Show Python-specific metadata
   - Display source file information
   - Include type information

### 4. Type-Specific Handling

1. **DataFrames**
```typescript
{
  type: "application/vnd.ant.table",
  text: JSON.stringify({
    columns: string[],
    rows: any[][],
    index?: number[]
  }),
  metadata: {
    originalType: "pandas.dataframe",
    rowCount: number,
    columnCount: number,
    dtypes: Record<string, string>
  }
}
```

2. **Matplotlib/Seaborn Figures**
```typescript
{
  type: "image/png",
  data: base64EncodedString,
  metadata: {
    originalType: "matplotlib.figure",
    dimensions: {
      width: number,
      height: number
    },
    dpi?: number,
    format: "png"
  }
}
```

3. **NumPy Arrays**
```typescript
{
  type: "application/vnd.ant.data",
  text: JSON.stringify(arrayData),
  metadata: {
    originalType: "numpy.array",
    shape: number[],
    dtype: string,
    layout: "C" | "F"
  }
}
```

### 5. File Handling Integration

1. **Input Files**
   - Track in artifact metadata
   - Show in artifact info panel
   - Enable quick reloading

2. **Output Files**
   - Save through artifact system
   - Maintain file associations
   - Enable export options

### 6. Error Display

1. **Error Artifacts**
   - Use existing error styling
   - Show Python traceback
   - Include context information

2. **Warning Display**
   - Show conversion warnings
   - Display type mismatches
   - Indicate performance issues

## Error Handling

### 1. File-Related Errors
- File not found
- Permission denied
- Invalid file type
- File too large
- Corrupted file
- Concurrent access conflicts

### 2. Type-Related Errors
- Type conversion failures
- Invalid data format
- Memory overflow
- Rendering failures
- Display compatibility issues

## Performance Optimization

### 1. File Handling
- Streaming for large files
- Partial loading
- Caching strategy
- Memory management
- Cleanup procedures

### 2. Data Processing
- Chunked processing
- Lazy evaluation
- Parallel processing
- Resource monitoring

## Security Considerations

### 1. File Security
- File type validation
- Content scanning
- Access control
- Secure storage
- Cleanup procedures

### 2. Data Security
- Input validation
- Output sanitization
- Type verification
- Size limits
- Resource limits

## Implementation Phases

### Phase 1: Core Infrastructure
1. File handling system
2. Basic type detection
3. Security framework

### Phase 2: Type System
1. Type definitions
2. Conversion utilities
3. Validation system

### Phase 3: Communication
1. Enhanced PythonShell
2. Response formatting
3. Error handling

### Phase 4: Frontend
1. File components
2. Type displays
3. Error displays

### Phase 5: Optimization
1. Performance tuning
2. Caching system
3. Resource management

## Monitoring and Maintenance

### 1. Performance Monitoring
- File operation metrics
- Processing times
- Memory usage
- Error rates

### 2. System Health
- Resource usage
- Error patterns
- Performance bottlenecks
- Usage patterns

## Future Considerations

### 1. Extensibility
- New file types
- Custom type handlers
- Plugin system
- API versioning

### 2. Scalability
- Distributed processing
- Load balancing
- Resource scaling
- Storage optimization

## Documentation Requirements

### 1. Technical Documentation
- API specifications
- Type definitions
- File handling procedures
- Security protocols

### 2. User Documentation
- File requirements
- Type support
- Error resolution
- Best practices

## Testing Strategy

### 1. File Testing
- File type handling
- Size limits
- Error conditions
- Concurrent access

### 2. Type Testing
- Type detection
- Conversion accuracy
- Display rendering
- Error handling

## Deployment Considerations

### 1. Environment Setup
- File system requirements
- Python environment
- Node.js configuration
- React build setup

### 2. Monitoring Setup
- Logging system
- Metrics collection
- Error tracking
- Performance monitoring 