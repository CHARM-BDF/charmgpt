# Python Files System Documentation

## Overview

The Python Files system provides seamless integration between uploaded files and the Python-MCP server, enabling data analysis workflows with automatic file discovery and access. This document covers the complete file lifecycle from upload to Python analysis.

## File Upload Process

### 1. Upload Interface
Files are uploaded through the chat interface using the paperclip icon in the input area:

- **Location**: Chat input area (paperclip icon)
- **Supported Types**: All file types accepted
- **Max Files**: 5 files per upload (configurable)
- **Drag & Drop**: Supported

### 2. Upload Workflow
```typescript
// File upload process
1. User selects files via UI
2. Files converted to Uint8Array
3. Metadata created with basic information
4. Files stored in /backend-mcp-client/uploads/
5. UUID generated for each file
6. Metadata stored in /backend-mcp-client/uploads/metadata/
7. Files become available to Python-MCP
```

### 3. File Storage Structure
```
/backend-mcp-client/uploads/
├── {uuid-1}                    # Actual file content
├── {uuid-2}                    # Actual file content
└── metadata/
    ├── {uuid-1}.json          # File metadata
    └── {uuid-2}.json          # File metadata
```

## Python-MCP Integration

### 1. Persistent File Access
The Python-MCP server has been enhanced to provide persistent access to all uploaded files:

- **Docker Volume Mounts**: Uploads directory mounted as read-only
- **Automatic Discovery**: Files accessible by original filename
- **No dataFiles Parameter**: Files automatically available in Python code

### 2. File Resolution System
```python
# Python helper functions automatically injected
def resolve_file(filename):
    """Resolve filename to actual path (supports UUID and original name)"""
    # 1. Check if it's already a valid path
    # 2. Check filename mapping from metadata
    # 3. Check uploads directory directly
    # 4. Raise FileNotFoundError if not found

def list_available_files():
    """List all available files with their original names"""
    # Returns list of original filenames

# Enhanced pandas functions with automatic file resolution
pd.read_csv('filename.csv')  # Automatically resolves to UUID path
pd.read_excel('filename.xlsx')  # Automatically resolves to UUID path
```

### 3. Enhanced Pandas Integration
```python
# Pandas functions automatically resolve filenames
import pandas as pd

# These work with original filenames
df = pd.read_csv('allergies.csv')        # ✅ Works
df = pd.read_excel('patients.xlsx')      # ✅ Works
df = pd.read_json('data.json')           # ✅ Works

# Also works with UUIDs
df = pd.read_csv('93397255-8d1d-4aa8-abd2-03b5f5ecea21')  # ✅ Works
```

## UI Integration

### 1. Python Files Drawer Section
A new collapsible section in the ConversationDrawer displays available files:

- **Location**: Below Graph Mode section in navigation drawer
- **Icon**: CpuChipIcon (represents Python processing)
- **Features**:
  - File count badge
  - Collapsible/expandable list
  - File size display
  - Hover effects
  - Auto-refresh every 30 seconds

### 2. File Display
```
┌─────────────────────────────────┐
│  Python Files (16)          ▼   │
│    📄 allergies.csv    5 KB     │
│    📄 patients.csv    12 KB     │
│    📄 data.json        3 KB     │
│    📄 analysis.xlsx    8 KB     │
└─────────────────────────────────┘
```

### 3. Supported File Types
The drawer only displays files that Python-MCP can process:
- `.csv` - CSV data files
- `.xlsx` - Excel spreadsheets  
- `.json` - JSON data files
- `.txt` - Text files
- `.parquet` - Parquet data files

## File Metadata Structure

### 1. Core File Information (FileEntry)
```typescript
interface FileEntry {
  id: string;                 // UUID identifier
  name: string;               // Original filename
  path: string;               // Storage path
  mimeType: string;           // MIME type
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
  tags: string[];             // Searchable tags
  llmNotes: string;           // Notes for LLM
  metadata: FileMetadata;     // Additional metadata
  artifact?: Artifact;        // Associated artifact
}
```

### 2. Detailed Metadata (FileMetadata)
```typescript
interface FileMetadata {
  description: string;        // Human-readable description
  schema: SchemaInfo;        // Schema information
  origin: {                  // Origin information
    type: "upload" | "derived";
    sourceId?: string;
    operation?: OperationType;
    parameters?: Record<string, unknown>;
    timestamp: Date;
  };
  version: {                // Version control
    major: number;
    minor: number;
    patch: number;
    branch: BranchInfo;
    history: VersionHistory[];
  };
  analysisInfo: {           // Analysis data
    rowCount?: number;
    summary: StatisticalSummary;
    quality: QualityMetrics;
  };
  textExtraction?: {        // Text extraction (optional)
    status: 'pending' | 'completed' | 'failed';
    content?: string;
    format: string;
    metadata?: TextMetadata;
  };
}
```

### 3. Schema Information
```typescript
interface SchemaInfo {
  type: "tabular" | "json";
  format: string;            // File format (csv, parquet, json)
  encoding: string;          // File encoding (utf-8)
  sampleData: string;        // Sample for LLM analysis
  
  // For tabular data
  tabular?: {
    rowCount: number;
    columns: ColumnInfo[];
    hasHeader: boolean;
    delimiter?: string;
  };
  
  // For JSON data
  json?: {
    rootType: "object" | "array";
    schema: object;
    keyPaths: string[];
    sampleKeys: KeySample[];
  };
}
```

### 4. Currently Populated Metadata
In practice, uploaded files have simplified metadata:

```typescript
{
  description: "filename.csv",           // Original filename
  schema: {
    type: "tabular",
    format: "text/csv",
    encoding: "utf-8",
    sampleData: ""
  },
  tags: ["uploaded", "chat"]            // Upload context tags
}
```

## Usage Examples

### 1. Basic File Access
```python
# List all available files
files = list_available_files()
print(f"Available files: {files}")

# Load files by original name (automatic resolution)
allergies = pd.read_csv('allergies.csv')
patients = pd.read_csv('patients.csv')
conditions = pd.read_csv('conditions.csv')

# Files are automatically resolved
print(f"Loaded {len(allergies)} allergy records")
print(f"Loaded {len(patients)} patient records")
print(f"Loaded {len(conditions)} condition records")
```

### 2. LLM-Friendly Usage Pattern
The Python-MCP tool description now includes clear instructions for LLMs with a recommended workflow:

```python
# Step 1: Check available files
files = list_available_files()
print(f"Available files: {len(files)}")

# Step 2: Load your data
patients = pd.read_csv('patients.csv')
conditions = pd.read_csv('conditions.csv')
observations = pd.read_csv('observations.csv')

# Step 3: Perform analysis
print(f"Loaded {len(patients)} patients")
```

**Key Features for LLMs:**
- Common libraries (pandas, numpy, matplotlib, seaborn) are pre-loaded
- Clear step-by-step workflow guidance
- Emphasis on checking available files first
- Practical examples with real data loading patterns

### 3. Data Analysis Workflow
```python
# Load multiple files
allergies = pd.read_csv('allergies.csv')
patients = pd.read_csv('patients.csv')
medications = pd.read_csv('medications.csv')

# Perform analysis
merged_data = patients.merge(allergies, on='patient_id', how='left')
analysis = merged_data.groupby('allergy_type').size()

# Save results
analysis.to_csv('allergy_analysis.csv')
```

### 4. File Discovery
```python
# Check what files are available
available_files = list_available_files()
print("Available files for analysis:")
for file in available_files:
    print(f"  - {file}")

# Load all CSV files
csv_files = [f for f in available_files if f.endswith('.csv')]
for file in csv_files:
    df = pd.read_csv(file)
    print(f"{file}: {df.shape[0]} rows, {df.shape[1]} columns")
```

## Technical Implementation

### 1. Docker Configuration
```typescript
// Volume mounts in Python-MCP
const dockerArgs = [
  'run', '--rm',
  '-v', `${UPLOADS_DIR}:/app/uploads:ro`,           // Read-only uploads
  '-v', `${METADATA_DIR}:/app/metadata:ro`,         // Read-only metadata
  // ... other arguments
];
```

### 2. File Resolution Logic
```typescript
// File mapping from metadata
function _load_file_mapping() {
  // 1. Read all metadata files
  // 2. Extract original filename from description
  // 3. Map filename to UUID path
  // 4. Return mapping object
}
```

### 3. UI State Management
```typescript
// React state for file display
const [pythonFiles, setPythonFiles] = useState<FileEntry[]>([]);
const [showPythonFiles, setShowPythonFiles] = useState(false);

// Auto-refresh every 30 seconds
useEffect(() => {
  const intervalId = setInterval(loadPythonFiles, 30000);
  return () => clearInterval(intervalId);
}, []);
```

## Security Considerations

### 1. File Access
- **Read-Only Mounts**: Uploads directory mounted as read-only
- **Container Isolation**: Files only accessible within Docker container
- **No Write Access**: Python code cannot modify uploaded files

### 2. File Validation
- **Type Filtering**: Only specific file types shown in UI
- **Size Limits**: 256MB memory limit for Python execution
- **Timeout Protection**: 30-second execution limit

## Troubleshooting

### 1. Files Not Appearing
- Check if files are in correct format (CSV, Excel, JSON, TXT, Parquet)
- Verify files were uploaded through UI (not manually copied)
- Check browser console for API errors

### 2. Python Access Issues
- Ensure Python-MCP server is running
- Check Docker container logs
- Verify file permissions in uploads directory

### 3. File Not Found Errors
When you get a "File not found" error, the system now provides detailed debugging information:

```
❌ ERROR: Cannot load CSV file 'missing_file.csv'

File not found: 'missing_file.csv'

🔍 DEBUGGING INFO:
- Looking for file: 'missing_file.csv'
- Search locations:
  1. Direct path: missing_file.csv
  2. File mapping: False
  3. Uploads directory: /app/uploads/missing_file.csv
- Available files (17 total):
  1. allergies.csv
  2. patients.csv
  3. conditions.csv
  ... and 14 more files

💡 SUGGESTIONS:
- Use list_available_files() to see all available files
- Check if the filename is spelled correctly
- Make sure the file was uploaded through the UI
```

### 4. Metadata Issues
- Check metadata files exist in `/uploads/metadata/`
- Verify JSON format is valid
- Ensure description field contains original filename

## Future Enhancements

### 1. Planned Features
- **File Relationships**: Track file dependencies and relationships
- **Version Control**: Full versioning system for file changes
- **Advanced Analysis**: Automatic data quality analysis
- **Schema Detection**: Automatic column type detection
- **Data Validation**: Built-in data validation rules

### 2. Performance Optimizations
- **Lazy Loading**: Load file metadata on demand
- **Caching**: Cache file mappings for faster access
- **Chunked Processing**: Process large files in chunks
- **Parallel Loading**: Load multiple files simultaneously

## API Reference

### 1. Storage API Endpoints
- `GET /api/storage/files` - List all files
- `POST /api/storage/files` - Upload new file
- `GET /api/storage/files/:id` - Get file metadata
- `DELETE /api/storage/files/:id` - Delete file

### 2. Python Helper Functions
- `resolve_file(filename)` - Resolve filename to path
- `list_available_files()` - List all available files
- `pd.read_csv()` - Enhanced CSV reader
- `pd.read_excel()` - Enhanced Excel reader

This system provides a comprehensive solution for file management and Python data analysis, with seamless integration between the UI, storage system, and Python-MCP server.
