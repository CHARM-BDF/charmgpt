# MCP Server Naming Pattern Analysis

## Overview
This document analyzes the naming patterns and transformations that occur between the MCP server configuration and the tool names sent to Claude. The analysis reveals potential issues in how tool names are handled across different parts of the system.

## Server and Tool Name Patterns

| Server Config Name | Original Tool Names | Our Modified Names | Expected Format | Notes |
|-------------------|---------------------|-------------------|-----------------|--------|
| filesystem | read_file, write_file, edit_file, etc. | Unchanged (kept as is) | filesystem:read_file, filesystem:write_file | Should add server prefix with colon |
| brave-search | brave:web_search, brave:local_search | brave_web_search, brave_local_search | brave-search:web_search, brave-search:local_search | Should keep original server name with hyphen |
| pubmed | pubmed:search, pubmed:get-details | pubmed_search, pubmed_get-details | pubmed:search, pubmed:get-details | Should keep original format with colon |
| server-sequential-thinking | server-sequential-thinking:sequentialthinking | server-sequential-thinking_sequentialthinking | server-sequential-thinking:sequentialthinking | Should keep original format with colon |
| memory | (tools not visible in logs) | (tools not visible in logs) | memory:tool_name | Should follow server:tool_name pattern |
| puppeteer | puppeteer_navigate, puppeteer_screenshot, etc. | Unchanged (kept as is) | puppeteer:navigate, puppeteer:screenshot | Should use colon instead of underscore for server separation |
| string-db | string-db:get-protein-interactions, string-db:get-pathway-enrichment | string-db_get-protein-interactions, string-db_get-pathway-enrichment | string-db:get-protein-interactions | Should keep original format with colon |

## Current Transformation Logic
```typescript
// Current logic in getAllAvailableTools()
if (toolName.includes('_') && !toolName.includes(':')) {
    // Keep original name
} else if (!toolName.includes(':')) {
    tool.name = `${serverName}_${toolName}`;
} else {
    tool.name = toolName.replace(/:/g, '_');
}
```

## Issues Identified

1. **Inconsistent Separator Usage**
   - Config uses hyphens for server names
   - Tools use both colons and underscores
   - Our transformation converts colons to underscores

2. **Server Name Mismatch**
   - When Claude calls a tool, it uses the full tool name
   - System tries to find server using the full tool name
   - No mapping back to original server names

3. **Naming Pattern Inconsistencies**
   - Some tools come with server prefixes (e.g., `brave:web_search`)
   - Others come with underscores already (e.g., `puppeteer_navigate`)
   - Some have hyphens in server names that are preserved

## Impact on Tool Usage

1. **Tool Call Failure**
   ```typescript
   // When Claude calls brave_web_search:
   const serverName = content.name.split(':')[0];  // Gets "brave_web_search"
   const client = mcpClients.get(serverName);      // Fails (should be "brave-search")
   ```

2. **Anthropic Format Requirements**
   - Tool names must match pattern: ^[a-zA-Z0-9_-]{1,64}$
   - Our transformations aim to meet this but create server lookup issues

## Recommendations

1. **Standardize Naming Convention**
   - Keep server names with hyphens in config
   - Use consistent separator (either colon or underscore) for tool names
   - Maintain mapping of transformed names to server names

2. **MCP SDK Enhancement**
   - SDK should handle name transformations consistently
   - Provide utility functions for name mapping
   - Maintain server identity through transformations

3. **Tool Name Resolution**
   - Create mapping function to resolve tool names to server names
   - Consider keeping original server names in tool metadata
   - Implement reverse mapping for tool calls

## Next Steps

1. Create server name resolution function
2. Update tool name transformation logic
3. Maintain bidirectional mapping of names
4. Consider submitting SDK enhancement proposal 