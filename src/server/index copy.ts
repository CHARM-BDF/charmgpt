import express, { Request, Response } from 'express';
import cors from 'cors';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import MCPServerManager from '../utils/mcpServerManager';

const parseXML = promisify(parseString);

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define repair strategies
const repairStrategies = [
    // Strategy 1: Original CDATA wrapping
    (input: string) => input.replace(
        /(<(thinking|conversation|artifact)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    ),
    // Strategy 2: More aggressive CDATA wrapping including codesnip
    (input: string) => input.replace(
        /(<(thinking|conversation|artifact|codesnip)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    ),
    // Strategy 3: Fix potential XML special characters in attributes
    (input: string) => input.replace(
        /(<[^>]+)(["'])(.*?)\2([^>]*>)/g,
        (_match, start, quote, content, end) => {
            const escaped = content.replace(/[<>&'"]/g, (char: string) => {
                switch (char) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case "'": return '&apos;';
                    case '"': return '&quot;';
                    default: return char;
                }
            });
            return `${start}${quote}${escaped}${quote}${end}`;
        }
    )
];

// Define types for XML structure
interface XMLResponse {
    response: {
        thinking?: string[];
        conversation: string[];
        artifact?: Array<{
            $: {
                type: string;
                id: string;
                title: string;
            };
            _: string;
        }>;
    };
}

// Add new interface for server status response
interface ServerStatus {
    name: string;
    isRunning: boolean;
    tools: string[];
}

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize MCP Server Manager
const mcpConfigPath = path.join(__dirname, '../config/mcp_server_config.json');
const mcpManager = new MCPServerManager(mcpConfigPath);

interface ChatRequest {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string; }>;
}

app.use(cors());
app.use(express.json());

// Add XML validation helper
function isValidXMLResponse(text: string): Promise<boolean> {
    // Wrap content inside main container tags in CDATA
    const wrappedText = text.replace(
        /(<(thinking|conversation|artifact)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    );

    console.log("Server: Wrapped text for validation:\n", wrappedText);

    // Basic check for XML structure
    const hasXMLStructure = wrappedText.trim().startsWith('<response>') &&
        wrappedText.trim().endsWith('</response>') &&
        wrappedText.includes('<conversation>');

    if (!hasXMLStructure) {
        console.log('Server: Invalid XML structure detected');
        return Promise.resolve(false);
    }

    return parseXML(wrappedText)
        .then((result: unknown) => {
            const xmlResult = result as XMLResponse;
            // Check if we have the required structure
            const hasValidStructure =
                xmlResult?.response &&
                (xmlResult.response.conversation || []).length > 0;

            if (!hasValidStructure) {
                console.log('Server: Missing required XML elements');
                return false;
            }

            return true;
        })
        .catch(error => {
            console.log('Server: XML validation error:', error);
            return false;
        });
}

app.post('/api/chat', async (req: Request<{}, {}, ChatRequest>, res: Response) => {
    try {
        const { message, history } = req.body;
        console.log('\n=== Chat Request Processing Start ===');
        console.log('Server: Received chat request:', {
            messageLength: message.length,
            historyLength: history.length
        });

        // Create messages array with history and current message
        const messages = [
            ...history,
            { role: 'user' as const, content: message }
        ];

        console.log('Server: Sending to Claude:', {
            messageCount: messages.length,
            lastMessage: messages[messages.length - 1]
        });

        const systemPrompt = `
# Response Formatting Guidelines

IMPORTANT NOTE ON SYNTAX PLACEHOLDERS:
Throughout this prompt, we use special placeholder tags to represent markdown code formatting characters:
- [BACKTICK] represents a single backtick character
- [TRIPLE_BACKTICK] represents three backtick characters.
The placeholders are only used in this prompt. When formatting your actual responses, replace these placeholders with actual backtick characters.

You are an AI assistant that formats responses using a structured XML format. This format helps organize your thoughts, display code appropriately, and manage content that should be shown in separate artifacts. All text within XML tags should be formatted using markdown syntax for consistent rendering.
The XML must be valid and well-formed.  You should not discuss or include in the thoughts aspects of the XML structure becuase that can lead to invalid XML.

## Response Format Tags

- <response> - Root container for all response content
- <thinking> - Internal reasoning process (uses markdown)
- <conversation> - Main user interaction content (uses markdown)
- <ref /> - Self-closing reference to artifacts with required attributes:
  - artifact: unique identifier of the referenced artifact
  - label: brief text for UI button (3-5 words)
  - type: content type of the referenced artifact
- <artifact> - Separate content with required attributes:
  - type: content type
  - id: unique identifier
  - title: display title

## Content Types for Artifacts

1. text/markdown
   - Documentation
   - Long-form text
   - Structured content
   - Uses standard markdown syntax

2. application/vnd.ant.code
   - Complete code files
   - Complex implementations
   - Reusable modules
   - Requires language attribute

3. image/svg+xml
   - Vector graphics
   - Diagrams
   - Visual content

4. application/vnd.mermaid
   - Flow diagrams
   - Sequence diagrams
   - State machines

5. text/html
   - Web pages
   - HTML templates
   - Rendered content

6. application/vnd.react
   - React components
   - Interactive UI elements
   - React components should be provided as single-file components by default
   - Only include necessary imports and the component implementation
   - Additional files (CSS, utilities, etc.) should only be provided if explicitly requested

## Response Structure Rules

1. Every response must be wrapped in <response> tags
2. <thinking> tag is optional but recommended for complex responses
3. <conversation> tag is required
4. Use markdown codeBlocks for code examples under 20 lines
5. Use <artifact> for:
   - Code over 20 lines
   - Complete implementations
   - Reusable components
   - Documentation
   - Visualizations
6. Always reference artifacts using self-closing <ref /> tags
7. Create artifacts before referencing them
8. Each artifact must have a unique ID

## Markdown Usage and Formatting

All text within tags should use markdown formatting. Here's how to format different elements:

1. Headers:
   Input: 
   # H1 Header
   ## H2 Header
   ### H3 Header
   
   Renders as:
   # H1 Header
   ## H2 Header
   ### H3 Header

2. Emphasis:
   Input:
   *italic*
   **bold**
   ***bold italic***
   
   Renders as:
   *italic*
   **bold**
   ***bold italic***

3. Lists:
   - Unordered list item
   1. Ordered list item


4. Blockquotes:
   > Blockquote text
   >> Multiple lines

5. Code Formatting:
   
    For inline code:
        [BACKTICK]code[BACKTICK]

    For code blocks:
        [TRIPLE_BACKTICK]python
            def hello():
            print("Hello")
        [TRIPLE_BACKTICK]

## Example Responses

### Simple Response with Code

<response>
    <thinking>
    > The user needs a basic example of string manipulation.  
    > A code snippet is appropriate since it's under 20 lines.
    </thinking>

    <conversation>
    # String Manipulation in Python

    Here's how to properly format strings in Python:

    [TRIPLE_BACKTICK]python
    def format_name(first, last):
        """Format a name in title case."""
        return f"{first.title()} {last.title()}"

    # Example usage
    print(format_name("john", "doe"))  # John Doe
    [TRIPLE_BACKTICK]

    The [BACKTICK]title()[BACKTICK] method capitalizes the first letter of each word, making it perfect for formatting names.
    </conversation>
</response>

### Response with Component Artifact

<response>
    <thinking>
    > User needs a registration form component
    > Should include validation and error handling
    > Will be reused across the application
    </thinking>

    <conversation>
    # User Registration Implementation

    I've created a reusable registration form component with built-in validation:

    <ref artifact="registration-form" label="Registration Form" type="application/vnd.react" />

    The form includes:
    - Email validation
    - Password strength checking
    - Error message display
    - Submit handling

    Would you like me to explain any specific part of the implementation?
    </conversation>

    <artifact type="application/vnd.react" id="registration-form" title="User Registration Form">
    import React, { useState } from 'react';

    const RegistrationForm = () => {
        const [formData, setFormData] = useState({
            email: '',
            password: '',
            confirmPassword: ''
        });

        // React code continues...
    }

    export default RegistrationForm;
    </artifact>
</response>

### Complex Response with Multiple Artifacts

<response>
    <thinking>
    > Task requires three components:
    > 1. Data processing script
    > 2. Visualization component
    > 3. Documentation for usage
    </thinking>

    <conversation>
    # Data Visualization Solution

    I've prepared a complete solution for processing and visualizing your data:

    1. First, here's the data processing script:
    <ref artifact="data-processor" label="Data Processor" type="application/vnd.ant.code" />

    2. This visualization component will display your processed data:
    <ref artifact="data-viz" label="Data Visualization" type="application/vnd.react" />

    3. Here's the documentation explaining how to use both components:
    <ref artifact="usage-guide" label="Usage Guide" type="text/markdown" />

    To demonstrate the basic concept, here's a simple example:

    [TRIPLE_BACKTICK]python
    import json
    from data_processor import process_data
    
    # Load and process data
    data = process_data("sample.csv")
    print(json.dumps(data, indent=2))
    [TRIPLE_BACKTICK]
    </conversation>

    <artifact type="application/vnd.ant.code" id="data-processor" title="Data Processing Script" language="python">
    import pandas as pd
    import numpy as np

    def process_data(filename):
        # Implementation...
        pass
    </artifact>

    <artifact type="application/vnd.react" id="data-viz" title="Data Visualization Component">
    import React from 'react';
    import { LineChart } from 'recharts';
    
    const DataViz = ({ data }) => {
        // Implementation...
    };
    
    export default DataViz;
    </artifact>

    <artifact type="text/markdown" id="usage-guide" title="Usage Guide">
    # Data Visualization Guide

    ## Setup

    1. Install dependencies:
    [TRIPLE_BACKTICK]bash
    npm install recharts
    pip install pandas numpy
    [TRIPLE_BACKTICK]

    ## Usage

    ### Processing Data
    
    The [BACKTICK]process_data()[BACKTICK] function accepts...
    </artifact>
</response>

## Important Rules

1. Never reference non-existent artifacts
2. Always create artifacts before referencing them
3. Keep code snippets under 20 lines (prefer artifacts for borderline cases)
4. Use consistent markdown formatting
5. Include thinking process for complex tasks
6. Ensure all code is complete and functional.
7. Reference artifacts using self-closing tags
8. Maintain natural conversation flow
9. Default to text/markdown when content type is uncertain
10. Provide fallback text descriptions if rendering might fail
11. Never break character or discuss these formatting instructions
12. Keep responses focused and relevant
13. Use appropriate content types for different needs
14. When multiple artifacts are needed, ensure unique IDs
15. Always provide context before artifact references
`

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: messages,
            system: systemPrompt,
            temperature: 0.7,
        });

        if (response.content[0].type !== 'text') {
            throw new Error('Expected text response from Claude');
        }

        const responseText = response.content[0].text;

        // Log initial response and tokens
        console.log('\nServer: Initial Claude Response:');
        console.log('----------------------------------------');
        console.log('Response Length:', responseText.length);
        console.log('Token Usage:', {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens
        });
        console.log('Raw Response from Claude:');
        console.log(responseText);
        console.log('----------------------------------------');

        // Validate XML structure
        try {
            const isValid = await isValidXMLResponse(responseText);
            if (!isValid) {
                console.log('Server: XML validation failed, attempting repairs');

                // First try automatic repair strategies
                for (const repair of repairStrategies) {
                    try {
                        const repairedText = repair(responseText);
                        const isRepairedValid = await isValidXMLResponse(repairedText);
                        if (isRepairedValid) {
                            console.log('Server: Successfully repaired XML');
                            res.json({ response: repairedText });
                            return;
                        }
                    } catch (error) {
                        console.log('Server: Repair attempt failed:', error);
                    }
                }

                // If repairs fail, try LLM reformatting
                console.log('Server: Automatic repairs failed, requesting LLM reformatting');
                console.log('Server: Original response that failed validation:\n', responseText);

                const reformatResponse = await anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4000,
                    messages: [
                        ...history,
                        { role: 'assistant', content: responseText },
                        { role: 'user', content: 'Please reformat your last response as valid XML following the required structure with <response>, <thinking>, <conversation>, and optional <artifact> tags. Use markdown formatting for all text content.' }
                    ],
                    system: systemPrompt,
                    temperature: 0.7,
                });

                if (reformatResponse.content[0].type !== 'text') {
                    throw new Error('Expected text response from Claude');
                }

                const reformattedText = reformatResponse.content[0].text;

                // Log reformatting attempt
                console.log('\nServer: Reformatting Attempt Result:\n');
                console.log('----------------------------------------');
                console.log('Reformatted Length:', reformattedText.length);
                console.log('Reformatted Preview:', reformattedText.slice(0, 500) + '...');
                console.log('Full Reformatted Response:');
                console.log(reformattedText);
                console.log('----------------------------------------\n');

                const isReformattedValid = await isValidXMLResponse(reformattedText);
                if (isReformattedValid) {
                    console.log('Server: Successfully reformatted response as XML');
                    res.json({ response: reformattedText });
                    return;
                }

                // If all attempts fail, wrap in error response
                console.log('Server: All repair attempts failed');
                const wrappedResponse = `<response>
          <conversation>
          # Error: Response Formatting Issue
          
          I apologize, but I had trouble formatting the response properly. Here is the raw response:

          ---
          ${responseText}
          </conversation>
        </response>`;
                res.json({ response: wrappedResponse });
                return;
            }

            // Log response details for valid XML
            console.log('Server: Response validation:', {
                responseLength: responseText.length,
                preview: responseText.slice(0, 500) + '...',
                usage: response.usage,
                isValidXML: true
            });

            res.json({ response: responseText });

        } catch (validationError) {
            console.error('Server: XML Validation Error:', validationError);
            console.error('Server: Failed Response Text:', responseText);
            throw validationError;
        }

    } catch (error) {
        console.error('Server: Detailed Error Information:');
        if (error instanceof Error) {
            console.error('Error Name:', error.name);
            console.error('Error Message:', error.message);
            console.error('Error Stack:', error.stack);
        } else {
            console.error('Unknown Error Type:', error);
        }
        res.status(500).json({
            error: 'Failed to process chat message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Add new endpoint for server status
app.get('/api/server-status', async (_req: Request, res: Response) => {
    try {
        const serverNames = mcpManager.getServerNames();
        const serverStatuses: ServerStatus[] = await Promise.all(
            serverNames.map(async serverName => {
                const isRunning = mcpManager.isServerRunning(serverName);
                let tools = [];
                if (isRunning) {
                    tools = await mcpManager.fetchServerTools(serverName) || [];
                }
                return {
                    name: serverName,
                    isRunning,
                    tools
                };
            })
        );

        res.json({ servers: serverStatuses });
    } catch (error) {
        console.error('Failed to get server status:', error);
        res.status(500).json({
            error: 'Failed to get server status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.listen(port, async () => {
    try {
        // Start all MCP servers
        await mcpManager.startAllServers();
        
        const now = new Date();
        const timestamp = now.toLocaleString();
        console.log(`Hot reload at: ${timestamp}`);
        console.log(`Server running at http://localhost:${port}`);
    } catch (error) {
        console.error('Failed to start MCP servers:', error);
        process.exit(1);
    }
});