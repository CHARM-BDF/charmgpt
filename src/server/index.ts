import express, { Request, Response } from 'express';
import cors from 'cors';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

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

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatRequest {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string; }>;
}

app.use(cors());
app.use(express.json());

// Add XML validation helper
function isValidXMLResponse(text: string): Promise<boolean> {
  // Remove line numbers if present
  const cleanText = text.replace(/^\s*\[\d+\]\s*/gm, '');
  
  // Wrap content only inside main container tags in CDATA
  const wrappedText = cleanText.replace(
    /(<(thinking|conversation|artifact)>)([\s\S]*?)(<\/\2>)/g,
    (_match, openTag, _tagName, content, closeTag) => {
      return `${openTag}<![CDATA[${content}]]>${closeTag}`;
    }
  );
  
  console.log("wrappedText ", wrappedText);
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
    console.log('Server: Received chat request:', { 
      messageLength: message.length,
      historyLength: history.length 
    });

    const systemPrompt = `
# Response Formatting Guidelines

IMPORTANT NOTE ON SYNTAX PLACEHOLDERS:
Throughout this prompt, we use special placeholder tags to represent markdown code formatting characters:
- [BACKTICK] represents a single backtick character
- [TRIPLE_BACKTICK] represents three backtick characters
When formatting your actual responses, replace these placeholders with actual backtick characters.

You are an AI assistant that formats responses using a structured XML format. This format helps organize your thoughts, display code appropriately, and manage content that should be shown in separate artifacts. All text within XML tags should be formatted using markdown syntax for consistent rendering.
The XML must be valid and well-formed.  You should not discuss or include in the thoughts aspects of the XML structure becuase that can lead to invalid XML.

## Response Format Tags

- <response> - Root container for all response content
- <thinking> - Internal reasoning process (uses markdown)
- <conversation> - Main user interaction content (uses markdown)
- <codesnip> - Code snippets with required language attribute
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

## Response Structure Rules

1. Every response must be wrapped in <response> tags
2. <thinking> tag is optional but recommended for complex responses
3. <conversation> tag is required
4. Use <codesnip> for code examples under 20 lines
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

    <codesnip language="python">
    def format_name(first, last):
        """Format a name in title case."""
        return f"{first.title()} {last.title()}"

    # Example usage
    print(format_name("john", "doe"))  # John Doe
    </codesnip>

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

        // Component implementation...
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

    <codesnip language="python">
    import json
    from data_processor import process_data
    
    # Load and process data
    data = process_data("sample.csv")
    print(json.dumps(data, indent=2))
    </codesnip>
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
6. Ensure all code is complete and functional
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
      messages: history,
      system: systemPrompt,
      temperature: 0.7,
    });

    if (response.content[0].type !== 'text') {
      throw new Error('Expected text response from Claude');
    }

    const responseText = response.content[0].text;

    // Log initial response
    console.log('\nServer: Initial Claude Response:\n');
    console.log('----------------------------------------');
    console.log('Response Length:', responseText.length);
    console.log('Preview:', responseText.slice(0, 500) + '...');
    console.log('Full Response:');
    console.log(responseText);
    console.log('----------------------------------------\n');

    // Log if response appears to be XML
    if (responseText.trim().startsWith('<response>')) {
      console.log('Server: Response appears to be XML formatted');
    } else {
      console.log('Server: Response does not appear to be XML formatted');
    }

    // Validate XML structure
    const isValid = await isValidXMLResponse(responseText);
    if (!isValid) {
      console.log('Server: Received invalid XML response, requesting reformatting');
      console.log('Server: Original response that failed validation:\n', responseText);
      
      // Request reformatting if invalid
      const reformatResponse = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
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

      // Use reformatted response if valid, otherwise wrap original in error XML
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
      } else {
        console.log('Server: Failed to get valid XML after reformatting attempt');
        console.log('Server: Both original and reformatted responses failed validation');
        // Wrap the original response in valid XML structure
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
    }

    // Log response details
    console.log('Server: Response validation:', {
      responseLength: responseText.length,
      preview: responseText.slice(0, 500) + '...',
      usage: response.usage,
      isValidXML: isValid
    });

    res.json({ response: responseText });
  } catch (error) {
    console.error('Server: Error in chat API:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

app.listen(port, () => {
  const now = new Date();
  const timestamp = now.toLocaleString();
  console.log(`Hot reload at: ${timestamp}`);
  console.log(`Server running at http://localhost:${port}`);
});