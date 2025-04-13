# Text Extraction Implementation Plan

## Overview
Add capability to extract text from various file types (PDF, Word, etc.) during upload, making the content accessible to LLMs for chat interactions.

## Project Structure
```
src/
├── server/
│   ├── routes/
│   │   └── storage.ts       # File management endpoints including text extraction
│   └── services/
│       └── fileManagement/  # Storage service implementations
├── types/
│   └── fileManagement.ts    # File metadata and storage types
└── components/
    └── projects/
        └── ProjectView.tsx   # UI for file listing and management
```

## Key Routes
- `POST /api/storage/files/:id/extract` - Text extraction (temporarily disabled)
- `GET /api/storage/files` - List all files
- `POST /api/storage/files` - Upload new file
- `GET /api/storage/files/:id/content` - Get file content
- `GET /api/storage/files/:id/metadata` - Get file metadata

## Phase 1: Setup and Basic Infrastructure ✅
1. Add necessary dependencies ✅
   - `pdf-parse` for PDF files
   - `mammoth` for Word documents
   - Consider `textract` for broader file type support (future)

2. Update FileMetadata type to include extracted text ✅
   ```typescript
   interface FileMetadata {
     textExtraction?: {
       status: 'pending' | 'completed' | 'failed';
       content?: string;
       error?: string;
       format: string;
       extractedAt?: Date;
       metadata?: {
         pageCount?: number;   // For PDFs
         wordCount?: number;   // For text-based documents
         charCount?: number;   // For text-based documents
       };
     };
   }
   ```

## Phase 2: Text Extraction Implementation (In Progress)
1. Create text extraction service ⚠️
   - Server endpoint: POST /api/storage/files/:id/extract (temporarily disabled)
   - Handlers for different file types:
     - PDF using pdf-parse (needs fix)
     - Word docs using mammoth ✅
     - Plain text/markdown ✅
   - Error handling and metadata updates ✅

   **Note**: Text extraction endpoint temporarily disabled due to pdf-parse initialization issues. Basic file listing and management functionality restored.

2. Modify file upload process (Next Step)
   - Client-side:
     - Add extraction request after successful upload
     - Handle extraction status in UI
     - Show progress/loading state
   - Server-side:
     - Consider automatic extraction on upload
     - Queue system for large files (future)

3. Test with various file types and sizes
   - Small/large PDFs
   - Word documents with different formatting
   - Error cases (corrupted files, unsupported formats)

## Phase 3: LLM Integration
1. Update chat interface to access extracted text
   - Add ability to reference uploaded files in chat
   - Handle cases where text extraction failed
   - Consider chunking for large texts

2. Add text preview/validation
   - Allow users to verify extracted text
   - Provide editing capability for corrections
   - Show extraction quality warnings if needed

## Phase 4: UI/UX Improvements
1. Add progress indicators
   - Show extraction status in file list
   - Add warning icons for failed extractions
   - Show processing state during upload

2. Improve error handling
   - Clear error messages for users
   - Retry options for failed extractions
   - Fallback options for unsupported formats

## Implementation Order
1. ✅ Phase 1 - infrastructure changes
2. 🔄 Phase 2 - text extraction service
   - ✅ Server endpoint (temporarily disabled)
   - ⏳ Upload integration
   - ⏳ Testing
3. Phase 3 - LLM integration
4. Phase 4 - UI improvements

## Next Steps
1. Fix pdf-parse initialization issues
   - Investigate test file dependency
   - Consider alternative PDF parsing libraries if needed
   - Re-enable text extraction endpoint once fixed

## Considerations
- Large file handling
- Memory usage during extraction
- Error recovery
- User feedback
- Storage implications
- Performance impact

## Success Criteria
- [ ] Text successfully extracted from PDFs and Word docs
- [ ] Extracted text available in chat context
- [ ] Clear error handling and user feedback
- [ ] Performance within acceptable limits
- [ ] Reliable extraction from various file formats

## Future Enhancements
- Support for additional file types
- OCR for scanned documents
- Better handling of document structure
- Improved text cleaning and formatting
- Automatic summarization of extracted text
- Background job queue for large files
- Caching of extracted text 