# Python MCP Server Strategy Document

## Overview
This document outlines both the immediate implementation strategy for Python output types (focusing on data tables and PNG outputs) and a comprehensive reference for future extensions.

## Part 1: Immediate Implementation

### 1. Current Scope
- Tables from pandas DataFrames
- PNG images from matplotlib
- Basic error handling
- Integration with existing artifact system

### 2. Type Mapping (Current)
```typescript
interface TypeMapping {
  // Current Implementation
  "pandas.dataframe": "application/vnd.ant.table",
  "matplotlib.figure": "image/png",
  "text": "text/plain"  // fallback for other types
}
```

### 3. Response Format (Current)
```typescript
interface ArtifactResponse {
  content: [{
    type: ArtifactType;          // Mapped from Python type
    text?: string;               // For table data (JSON)
    data?: string;               // For PNG (base64)
    metadata: {
      originalType: string;      // Original Python type
      dimensions?: {             // For images
        width: number;
        height: number;
      };
    };
  }];
  isError: boolean;
}
```

### 4. Current Type Implementations

1. **DataFrames (Current)**
```typescript
{
  type: "application/vnd.ant.table",
  text: JSON.stringify({
    columns: string[],
    rows: any[][]
  }),
  metadata: {
    originalType: "pandas.dataframe"
  }
}
```

2. **Matplotlib Figures (Current)**
```typescript
{
  type: "image/png",
  data: base64EncodedString,
  metadata: {
    originalType: "matplotlib.figure",
    dimensions: {
      width: number,
      height: number
    }
  }
}
```

### 5. Current Error Handling
- Basic Python execution errors
- Type conversion errors (table/PNG)
- Memory limits for small datasets
- Basic validation errors

## Part 2: Comprehensive Reference

### 1. Complete Type System

#### A. Supported Types
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

#### B. Complete Type Mapping
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

### 2. File Management System

#### A. Input File Processing
- Files passed to Python execution via `dataFiles` parameter:
```typescript
interface ExecuteArgs {
  code: string;
  dataFiles?: Record<string, string>;  // variable_name -> file_path
  timeout?: number;
}
```

#### B. File Types Support
- CSV/TSV files
- JSON data files
- Excel files (.xlsx, .xls)
- Text files
- Binary data files
- Image files
- Parquet files
- HDF5 files

#### C. File Loading Strategy
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

### 3. Complete Response Format
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

### 4. Comprehensive Error Handling

#### A. File-Related Errors
- File not found
- Permission denied
- Invalid file type
- File too large
- Corrupted file
- Concurrent access conflicts

#### B. Type-Related Errors
- Type conversion failures
- Invalid data format
- Memory overflow
- Rendering failures
- Display compatibility issues

### 5. Performance Considerations

#### A. File Handling
- Streaming for large files
- Partial loading
- Caching strategy
- Memory management
- Cleanup procedures

#### B. Data Processing
- Chunked processing
- Lazy evaluation
- Parallel processing
- Resource monitoring

### 6. Security Framework

#### A. File Security
- File type validation
- Content scanning
- Access control
- Secure storage
- Cleanup procedures

#### B. Data Security
- Input validation
- Output sanitization
- Type verification
- Size limits
- Resource limits

## Implementation Roadmap

### Phase 1 (Current)
1. Basic table display from pandas
2. Basic PNG display from matplotlib
3. Essential error handling
4. Integration with artifact system

### Phase 2 (Future)
1. File management system
2. Interactive displays
3. Large dataset support
4. Advanced features

### Phase 3 (Future)
1. Performance optimizations
2. Enhanced error handling
3. Advanced visualizations
4. Data exploration tools

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