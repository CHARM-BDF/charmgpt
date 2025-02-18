# Python MCP Current Phase Strategy

## Overview
This document outlines the immediate implementation strategy for Python output types, focusing on matplotlib PNG outputs and basic data handling.

## Current Implementation Focus

### 1. Core Functionality
- PNG image output from matplotlib
- Basic error handling
- Integration with artifact system
- Proper file handling in temp directories

### 2. Type Mapping
```typescript
interface TypeMapping {
  "matplotlib.figure": "image/png",
  "text": "text/plain"  // fallback for other types
}
```

### 3. Response Format
```typescript
interface ArtifactResponse {
  content: [{
    type: ArtifactType;          // Mapped from Python type
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

### 4. Matplotlib Figure Implementation
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

## Implementation Steps

### 1. Python Code Execution
- Save matplotlib figures to temp directory with absolute path
- Use proper file naming to avoid conflicts
- Close figures to free memory
- Include statistical output if relevant

### 2. File Processing
- Scan temp directory for PNG files
- Convert found PNGs to base64
- Extract image dimensions
- Clean up temp files after processing

### 3. Response Handling
- Format response according to type mapping
- Include all necessary metadata
- Ensure proper error handling
- Clean up resources

### 4. Error Handling
- Handle file not found
- Handle conversion errors
- Handle memory limits
- Provide clear error messages

## File Management

### 1. Temporary Directory
- Use absolute paths
- Create if doesn't exist
- Clean up old files
- Handle concurrent access

### 2. File Operations
- Save files with unique names
- Read files as binary
- Convert to base64
- Clean up after processing

## Security Considerations

### 1. File Operations
- Validate file types
- Check file sizes
- Clean up temp files
- Restrict directory access

### 2. Resource Limits
- Set memory limits
- Set timeout values
- Monitor file sizes
- Track resource usage

## Testing Strategy

### 1. Basic Tests
- PNG file creation
- Base64 conversion
- Metadata extraction
- Error handling

### 2. Edge Cases
- Large images
- Multiple plots
- Missing directories
- Concurrent access

## Next Steps
1. Implement absolute path handling
2. Add proper file scanning
3. Implement base64 conversion
4. Add metadata extraction
5. Enhance error handling
6. Add resource monitoring 