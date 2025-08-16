# Using Specific Aims Files in the MCP System

## Overview

The MCP system provides comprehensive support for working with NIH Specific Aims documents, allowing you to:
1. Upload and store Specific Aims files as markdown
2. Reference them in the chat interface
3. Use them with MCP servers for automated analysis

## System Components

### File Management
- Upload through the `FileManager` component
- Automatic markdown format recognition
- Secure storage with metadata
- Easy retrieval and reference

### Chat Interface Integration
- Markdown rendering with `ReactMarkdown`
- Support for tables and formatting
- Real-time preview and editing
- Direct file references in chat

### MCP Server Integration
- Automated analysis through aims-review-mcp
- Integration with other MCP services
- Results returned as markdown artifacts

## How to Use

### 1. Uploading Specific Aims

Use the File Manager to upload your Specific Aims document:
1. Click the file upload button in the `FileManager` component
2. Select your markdown (.md) file
3. The system will automatically:
   - Recognize the markdown format
   - Store with appropriate metadata
   - Make it available for reference

### 2. Viewing in Chat

Your Specific Aims file will be:
- Displayed as an artifact in the chat
- Rendered with proper markdown formatting
- Available for quick reference
- Searchable and accessible

### 3. Using with MCP Servers

The aims-review-mcp server can:
- Access your Specific Aims file
- Perform automated review
- Provide detailed feedback
- Generate new markdown artifacts with analysis

## File Format Requirements

For best results, your Specific Aims file should:
1. Use standard markdown syntax
2. Include clear section headers
3. Maintain proper formatting
4. Follow NIH guidelines for content

Example structure:
```markdown
# Specific Aims

## Background and Significance
[Your content here]

## Aim 1: [Title]
[Description]

## Aim 2: [Title]
[Description]

## Aim 3: [Title]
[Description]

## Impact Statement
[Your content here]
```

## Best Practices

1. **File Organization**
   - Use clear, descriptive filenames
   - Include version information if needed
   - Keep files in appropriate directories

2. **Content Structure**
   - Follow NIH formatting guidelines
   - Use consistent heading levels
   - Include all required sections
   - Maintain clear organization

3. **Version Control**
   - Track changes through the system
   - Keep previous versions if needed
   - Use clear version naming

4. **Integration Tips**
   - Reference files consistently in chat
   - Use appropriate commands for analysis
   - Review automated feedback carefully
   - Maintain file organization

## Troubleshooting

Common issues and solutions:

> 🚨 **File Not Uploading**
> - Check file format (.md)
> - Verify file size limits
> - Ensure proper permissions

> 💡 **Formatting Issues**
> - Validate markdown syntax
> - Check for unsupported elements
> - Review NIH guidelines

> ℹ️ **MCP Server Access**
> - Verify file permissions
> - Check server status
> - Review error messages

## Additional Resources

1. NIH Specific Aims Guidelines
2. Markdown Writing Guide
3. MCP System Documentation
4. Chat Interface Guide

## Support

For additional help:
1. Check system documentation
2. Review error messages
3. Contact system administrators
4. Submit support tickets 