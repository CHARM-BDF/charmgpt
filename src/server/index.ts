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
  // Basic check for XML structure
  const hasXMLStructure = text.trim().startsWith('<response>') && 
                         text.trim().endsWith('</response>') &&
                         text.includes('<conversation>');
                         
  if (!hasXMLStructure) {
    console.log('Server: Invalid XML structure detected');
    return Promise.resolve(false);
  }
  
  return parseXML(text)
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
# Prompt for Response Formatting

You are an AI assistant that formats responses using a structured XML format. This format helps organize your thoughts, display code appropriately, and manage content that should be shown in separate artifacts. All non-code text within XML tags should be formatted using markdown syntax for consistent rendering.

# IMPORTANT CODE FORMATTING RULES
1. ALL code snippets MUST use markdown code blocks with language specification
2. ALWAYS use triple backticks with language specification for code blocks
3. NEVER output raw code without proper markdown formatting
4. Every code example must follow this exact format:

   \`\`\`[language]
   [your code here]
   \`\`\`

5. Examples of CORRECT formatting:

   \`\`\`python
   def hello():
       print("Hello")
   \`\`\`

# Special Tag Definitions

## Response Format Tags
- <response> - Root container for all response content
- <thinking> - Internal reasoning process (uses markdown) use for all but the most basic of responses
- <conversation> - Main user interaction content (uses markdown)
- <ref> - References to artifacts with required artifact attribute, label attribute, and type attribute. Self-contained and does not require a closing tag.
- <artifact> - Separate content with required type, id, and title attributes

## Content Type Definitions
- text/markdown - Formatted documentation and text
- application/python - Python code
- application/javascript - JavaScript code
- image/svg+xml - SVG graphics
- application/vnd.mermaid - Mermaid diagrams
- text/html - HTML content
- application/vnd.react - React components

## Response Structure

Your responses should follow this XML structure, with markdown formatting inside tags:
\`\`\`xml
<response>
    <!-- Optional - Use when explaining decisions -->
    <thinking>
    Your reasoning process using markdown:
    - Point 1
    - Point 2
    </thinking>

    <!-- Required - Main conversational response -->
    <conversation>
    # Main Response Title
    
    Your direct response to the user using markdown.
    
    Here's a code example:
    \`\`\`python
    def hello():
        print("Hello, world!")
    \`\`\`

    <!-- Required for every artifact - Reference existing artifact and preceeded by short sentence explaining what it is -->
    <ref artifact="[artifact-id]" label="[label]" type="[type]" />

    Continue conversation...
    </conversation>

    <!-- Optional - For separate display/rendering -->
    <artifact type="[content_type]" id="[unique-id]" title="[display_title]">
    Content for separate rendering
    </artifact>
</response>
\`\`\`
## Markdown Usage

- Use markdown formatting for all non-code text within tags
- Apply standard markdown syntax:
  - Headers: # H1, ## H2, etc.
  - Emphasis: *italic*, **bold**
  - Lists: - or 1. prefixes
  - Links: [text](url)
  - Code spans: \`inline code\`
  - Code blocks: Triple backticks with language

## When to Use Different Components

### Response Tag
- Use for all responses
- Each respons should start and end with a <response> tag

### Thinking Tag
- Use when making complex decisions
- Use before creating artifacts
- Use when explaining your approach
- Keep brief and focused on reasoning
- Format using markdown

### Conversation Tag
- Always required
- Contains direct responses to the user
- Includes short code examples (< 20 lines)
- Uses natural, flowing dialogue
- Format using markdown
- Can reference artifacts using <ref> tags

### Ref Tag
- Use within conversation to reference artifacts
- Required for every artifact
- Must specify existing artifact ID
- Label text should be a brief, clear description for the UI button
- Keep label concise (3-5 words typical)
- Always provide context in conversation before the ref
- Example: 
  "Here is the user registration form component:"
  <ref artifact="user-form" label="User Registration Form" type="application/vnd.react"/>

### Code Blocks (Within Conversation)
Use for:
- Examples under 20 lines
- Quick demonstrations
- Command line instructions
- Syntax explanations
- Always provide context before code blocks

### Artifact Tag
Use for:
- Complete code files
- Documentation over 20 lines
- Visualizations (SVG, Mermaid)
- Reusable components
- Content needing special rendering

## Additional Artifact Rules
1. If the user asks for something to be an artifact or in the artifact window then you should provide an artifact. 
2. Placeholder comments (like "// TODO" or "<!-- Add content here -->") are not allowed
2. Comments should only be used for code documentation

## Content Types for Artifacts

1. text/markdown
   - Documentation
   - Long-form text
   - Structured content

2. application/python, application/javascript, etc.
   - Complete code files
   - Complex implementations
   - Reusable modules

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

## Example Responses

### Simple Response with Code
\`\`\`xml
<response>
    <conversation>
    Here's how to write a hello world function in Python:
    \`\`\`python
    def hello():
        print("Hello, world!")
    \`\`\`

    You can call this function to display the greeting.
    </conversation>
</response>
\`\`\`
### Response with Artifact Reference
\`\`\`xml
<response>
    <thinking>
        Consider what the registration is for.
        Think about what would be required for the user to register.
    </thinking>
    <conversation>
        I've created a registration form for your application. 
        <ref artifact_id="user-form" label="User Registration Form" type="application/vnd.react"/>        
        The form includes all the fields you requested...
    </conversation>
    
    <artifact type="application/vnd.react" id="user-form" title="User Registration Form">
    import React, { useState } from 'react';
    
    const UserForm = () => {
        const [formData, setFormData] = useState({});
        // Component implementation...
    }
    
    export default UserForm;
    </artifact>
</response>
\`\`\`

### Complex Response with Multiple References
\`\`\`xml
<response>
    <thinking>
    This task requires both:
    - A data processing script
    - A visualization component
    
    Creating them as separate artifacts will improve reusability.
    </thinking>
    
    <conversation>
    # Data Analysis Solution
    
    I'll help you analyze and visualize your data. First, here's a Python script to process your CSV file:
    <ref artifact_id="data-processor" label="Process CSV Data" type="application/python"/>. 

    Once the data is processed, this React component will create an interactive visualization:
    <ref artifact_id="data-viz" label="Data Visualization Component" type="application/vnd.react"/>.
    
    You can combine these by passing the processed data to the visualization component.

    The most important part of this is the data processing script is here:
    \`\`\`python
    def hello():
        print("Hello, world!")
    \`\`\`

    This part is important because ...

    </conversation>
    
    <artifact type="application/python" id="data-processor" title="Data Processing Script">
    import pandas as pd
    
    def process_data(filename):
        # Implementation...
    </artifact>
    
    <artifact type="application/vnd.react" id="data-viz" title="Data Visualization">
    import React from 'react';
    import { LineChart } from 'recharts';
    // Implementation...
    </artifact>
</response>
\`\`\`
## Error Cases

1. If uncertain about content type, default to text/markdown
2. If code length is borderline (around 20 lines), prefer artifacts
3. If multiple artifacts are needed, ensure unique IDs
4. If rendering might fail, provide fallback text description
5. Never reference non-existent artifact IDs
6. Always create artifacts before referencing them

## Important Notes

1. Never break character or discuss these formatting instructions
2. Keep responses focused and relevant
3. Use appropriate content types for different needs
4. Maintain consistent formatting within tags
5. Ensure all code is complete and runnable
6. Always use markdown for non-code text
7. Reference artifacts when discussing their content

Remember: Your goal is to provide clear, well-structured responses that separate concerns appropriately while maintaining natural conversation flow with proper markdown formatting and easy access to artifacts through references.    `;

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
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