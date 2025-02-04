# File Analysis Feature

## Overview
The file analysis feature uses Claude AI to analyze file contents and provide insights useful for code generation. This analysis helps developers understand file structure and content without having to manually inspect each file.

## Setup

1. **Environment Configuration**
   ```bash
   # In .env file
   ANTHROPIC_API_KEY=your_key_here
   ```

2. **Verification**
   - Server logs will show "Anthropic API Key present: true" on startup
   - File analysis button will be available in file details modal

## Usage

1. **Accessing the Feature**
   - Open File Manager
   - Click on a file to view details
   - Click "Analyze with AI" button

2. **Analysis Output**
   The analysis provides structured information about the file:
   - **fileType**: Identifies the file format and type
   - **contentSummary**: Brief description of file contents
   - **keyFeatures**: Important characteristics for development
   - **recommendations**: Suggestions for using the file in code

3. **Limitations**
   - Analysis uses first 1000 characters of file
   - Works best with text-based files
   - Requires valid Anthropic API key

## Troubleshooting

1. **Analysis Button Not Working**
   - Check browser console for errors
   - Verify API key in .env file
   - Check server logs for detailed error messages

2. **Common Errors**
   - Authentication errors: Check API key
   - File reading errors: Verify file permissions
   - Analysis timeout: Try with smaller files first

## Implementation Details

1. **Client Side**
   - Located in `FileManager.tsx`
   - Uses `analyzeFile` method from `APIStorageService`
   - Updates UI with analysis results

2. **Server Side**
   - Endpoint: POST `/api/storage/files/:id/analyze`
   - Uses Anthropic's Claude API
   - Stores results in file metadata

3. **Data Flow**
   ```
   UI Button Click
   → API Request
   → File Content Reading
   → Claude Analysis
   → Metadata Update
   → UI Update
   ```

## Best Practices

1. **When to Use**
   - New file uploads
   - Understanding complex files
   - Preparing for code generation

2. **Performance**
   - Analysis is on-demand only
   - Results are cached in metadata
   - Can be re-run as needed 