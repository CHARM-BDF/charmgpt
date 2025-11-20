# Kappa Writer MCP Server

A Model Context Protocol (MCP) server that provides Kappa syntax validation and writing guidance.

## Overview

This MCP server helps users write correct Kappa code by providing:
- Complete syntax validation guide
- Automated code validation
- Common error detection
- Best practices guidance

## Features

### 1. Syntax Guide Tool (`get-kappa-syntax-guide`)
Returns the complete Kappa syntax validation guide with examples of correct and incorrect syntax.

**Parameters:**
- `section` (optional): Specific section to retrieve
  - `agent-declarations`: Agent declaration syntax
  - `initial-conditions`: Initial condition syntax  
  - `observables`: Observable syntax
  - `rules`: Rule syntax
  - `checklist`: Pre-submission checklist
  - `common-errors`: Common error patterns
  - `template`: Validation template

### 2. Code Validation Tool (`validate-kappa-code`)
Validates Kappa code for syntax errors and provides specific feedback.

**Parameters:**
- `code` (required): The Kappa code to validate
- `check_syntax` (optional): Whether to perform syntax validation (default: true)

## Installation

```bash
cd custom-mcp-servers/kappa-writer-mcp
npm install
npm run build
```

## Usage

### Get Complete Syntax Guide
```json
{
  "name": "get-kappa-syntax-guide"
}
```

### Get Specific Section
```json
{
  "name": "get-kappa-syntax-guide",
  "arguments": {
    "section": "agent-declarations"
  }
}
```

### Validate Kappa Code
```json
{
  "name": "validate-kappa-code",
  "arguments": {
    "code": "%agent: Wnt(binding[.], lipid{u.m})\n%init: 100 Wnt(binding[.], lipid{u})",
    "check_syntax": true
  }
}
```

## Validation Rules

The server checks for:

### Agent Declarations
- ✅ Multiple states separated by dots: `{u.m}`
- ❌ Spaces between states: `{u m}`

### Initial Conditions  
- ✅ Single state per site: `{u}`
- ❌ Multiple states: `{u.m}`

### Observables
- ✅ Pipe delimiters: `|pattern|`
- ❌ Missing delimiters: `pattern`

### Rules
- ✅ Quoted rule names: `'Rule_Name'`
- ✅ Arrow syntax: `->`
- ✅ Rate constants: `@ rate`

## Common Errors Detected

1. **State Separation**: Spaces instead of dots
2. **Observable Delimiters**: Missing pipe characters
3. **Rule Labels**: Unquoted rule names
4. **Initial States**: Multiple states in initial conditions
5. **Site Binding**: Incorrect bracket syntax

## Development

```bash
# Watch mode for development
npm run dev

# Build
npm run build

# Start production server
npm start
```

## Integration

This MCP server is designed to be used by AI assistants when:
- Users ask for help writing Kappa code
- Code validation is needed
- Syntax guidance is requested
- Common errors need to be avoided

The server provides both human-readable guidance and programmatic validation to ensure correct Kappa syntax.
