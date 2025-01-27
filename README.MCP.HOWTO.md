Excerpt from https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-client-development-guide.md

## 4. Step-by-Step: Building an MCP Client in TypeScript

This section provides a practical guide to building and running an MCP client in TypeScript that can:

1. Connect to an MCP server via stdio.
2. Discover prompts, resources, and tools.
3. Send queries to an LLM (e.g., Claude) and orchestrate tool usage based on the LLM's response.
4. Handle user input and display responses.
5. Re-inject context after tool calls to maintain conversation flow.

### 4.1. Installing the MCP SDK

**TypeScript:**

```bash
npm install @modelcontextprotocol/sdk
```

### 4.2. Connecting to a Server

**TypeScript (Stdio Example):**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function connectToServer(command: string, args: string[]): Promise<Client | null> {
  const client = new Client({ name: "my-ts-client", version: "1.0.0" }, {});
  const transport = new StdioClientTransport({ command, args });
  
  try {
    await client.connect(transport);
    
    // Initialize the client and declare roots
    const initializeResponse = await client.initialize({
      roots: [
        { uri: "file:///path/to/project", name: "My Project" },
        { uri: "https://api.example.com/v1", name: "Example API" },
      ],
    });
    
    // Example initialize response format:
    // {
    //   capabilities: {
    //     tools: {},           // Server supports tools
    //     resources: {},       // Server supports resources
    //     prompts: {},        // Server supports prompts
    //     roots: {},          // Server supports roots feature
    //     sampling: {}        // Server supports sampling
    //   },
    //   serverInfo: {
    //     name: "example-server",
    //     version: "1.0.0"
    //   }
    // }
    
    console.log("Server capabilities:", initializeResponse.capabilities);
    console.log("Successfully connected to the server.");
    return client;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Failed to connect to the server:", error.message);
      if (error.cause) {
        console.error("Caused by:", error.cause);
      }
    } else {
      console.error("Failed to connect to the server:", error);
    }
    
    try {
      await transport.close();
    } catch (closeError) {
      console.error("Error closing transport:", closeError);
    }
    
    return null;
  }
}
```

### 4.3. Discovering Tools, Prompts, and Resources

The discovery endpoints (`tools/list`, `prompts/list`, and `resources/list`) are fundamental to MCP's functionality. They serve as the primary mechanism for clients to discover server capabilities and are essential for enabling dynamic interactions between LLMs and MCP servers.

#### 4.3.1. Listing Tools (tools/list)

The `tools/list` endpoint is crucial for discovering available tools that an LLM can use to perform actions. This endpoint returns detailed information about each tool, including its name, description, and input schema.

**Request Format:**

```json
{
  "method": "tools/list"
}
```

**Response Format:**

```json
{
  "tools": [
    {
      "name": "calculate_sum",
      "description": "Add two numbers together",
      "inputSchema": {
        "type": "object",
        "properties": {
          "a": { "type": "number" },
          "b": { "type": "number" }
        },
        "required": ["a", "b"]
      }
    }
  ]
}
```

**TypeScript Implementation:**

```typescript
import { Client, type Tool } from "@modelcontextprotocol/sdk/client/index.js";

async function discoverTools(client: Client) {
  try {
    const tools = await client.listTools();
    console.log("Available tools:");
    tools.tools.forEach((tool: Tool) => {
      console.log(`- ${tool.name}: ${tool.description}`);
      console.log(`  Input schema:`, tool.inputSchema);
    });
  } catch (error) {
    console.error("Error discovering tools:", error);
  }
}
```

#### 4.3.2. Listing Prompts (prompts/list)

The `prompts/list` endpoint discovers available prompt templates that can guide LLM interactions. Each prompt includes a name, description, and optional arguments.

**Request Format:**

```json
{
  "method": "prompts/list"
}
```

**Response Format:**

```json
{
  "prompts": [
    {
      "name": "analyze-code",
      "description": "Analyze code for potential improvements",
      "arguments": [
        {
          "name": "language",
          "description": "Programming language",
          "required": true
        }
      ]
    }
  ]
}
```

**TypeScript Implementation:**

```typescript
import { Client, type Prompt } from "@modelcontextprotocol/sdk/client/index.js";

async function discoverPrompts(client: Client) {
  try {
    const prompts = await client.listPrompts();
    console.log("Available prompts:");
    prompts.prompts.forEach((prompt: Prompt) => {
      console.log(`- ${prompt.name}: ${prompt.description}`);
      if (prompt.arguments) {
        console.log("  Arguments:");
        prompt.arguments.forEach((arg) => {
          console.log(`    - ${arg.name}: ${arg.description}`);
        });
      }
    });
  } catch (error) {
    console.error("Error discovering prompts:", error);
  }
}
```

#### 4.3.3. Listing Resources (resources/list)

The `resources/list` endpoint discovers available data sources that can provide context to the LLM. Resources can be either direct (concrete URIs) or templates (URI patterns).

**Request Format:**

```json
{
  "method": "resources/list"
}
```

**Response Format:**

```json
{
  "resources": [
    {
      "uri": "file:///logs/app.log",
      "name": "Application Logs",
      "description": "Real-time application log data",
      "mimeType": "text/plain"
    }
  ],
  "resourceTemplates": [
    {
      "uriTemplate": "file:///data/{year}/{month}/report.csv",
      "name": "Monthly Reports",
      "description": "Historical monthly report data",
      "mimeType": "text/csv"
    }
  ]
}
```

Resource templates enable dynamic access to resources through parameterized URIs. Clients can expand these templates by replacing variables with actual values. For example:

```typescript
import { Client, type Resource, type ResourceTemplate } from "@modelcontextprotocol/sdk/client/index.js";

async function accessMonthlyReport(client: Client, year: string, month: string): Promise<string | null> {
  try {
    const resources = await client.listResources();
    const template = resources.resourceTemplates.find(
      (t: ResourceTemplate) => t.name === "Monthly Reports"
    );

    if (template) {
      const uri = template.uriTemplate
        .replace("{year}", year)
        .replace("{month}", month);

      const contents = await client.readResource(uri);
      return contents.contents[0].text || null;
    }
  } catch (error) {
    console.error("Error accessing monthly report:", error);
    return null;
  }
  return null;
}
```

This allows servers to expose parameterized access to collections of resources while maintaining a clean interface. The LLM can understand these templates and request specific resources by providing the appropriate parameters.

**TypeScript Implementation:**

```typescript
import { Client, type Resource } from "@modelcontextprotocol/sdk/client/index.js";

async function discoverResources(client: Client) {
  try {
    const resources = await client.listResources();
    console.log("Available resources:");
    resources.resources.forEach((resource: Resource) => {
      console.log(`- ${resource.name} (${resource.uri})`);
      console.log(`  Description: ${resource.description}`);
      if (resource.mimeType) {
        console.log(`  MIME Type: ${resource.mimeType}`);
      }
    });
  } catch (error) {
    console.error("Error discovering resources:", error);
  }
}
```

#### 4.3.4. Integrating Discovery with LLM Interactions

When working with LLMs, the discovery endpoints provide crucial information that helps the LLM understand and use available capabilities. Here's how to manage and format this context effectively:

```typescript
import { Client, Tool, Prompt, Resource, ResourceTemplate } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";

class LLMContextManager {
  private client: Client;
  private context: Record<string, any> | null = null;
  private lastUpdate: number | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  async prepareLlmContext(): Promise<Record<string, any>> {
    try {
      console.info("Refreshing LLM context from MCP capabilities");

      const tools = await this.safeListTools();
      const prompts = await this.safeListPrompts();
      const resources = await this.safeListResources();

      this.context = {
        available_tools: tools.tools
          .filter(this.isValidTool)
          .map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: this.validateSchema(tool.name, tool.inputSchema),
            example: this.generateToolExample(tool),
          })),
        available_prompts: prompts.prompts
          .filter(this.isValidPrompt)
          .map((prompt) => ({
            name: prompt.name,
            description: prompt.description,
            arguments: prompt.arguments,
          })),
        available_resources: resources.resources
          .filter(this.isValidResource)
          .map((resource) => ({
            name: resource.name,
            uri: resource.uri,
            description: resource.description,
          })),
      };

      this.lastUpdate = Date.now();
      console.info("Successfully updated LLM context");
      return this.context;
    } catch (error) {
      console.error("Unexpected error preparing LLM context:", error);
      return {
        available_tools: [],
        available_prompts: [],
        available_resources: [],
      };
    }
  }

  private async safeListTools(): Promise<{ tools: Tool[] }> {
    try {
      const tools = await this.client.listTools();
      console.debug(`Retrieved ${tools.tools.length} tools`);
      return tools;
    } catch (error) {
      console.error("Failed to list tools:", error);
      return { tools: [] };
    }
  }

  private async safeListPrompts(): Promise<{ prompts: Prompt[] }> {
    try {
      const prompts = await this.client.listPrompts();
      console.debug(`Retrieved ${prompts.prompts.length} prompts`);
      return prompts;
    } catch (error) {
      console.error("Failed to list prompts:", error);
      return { prompts: [] };
    }
  }

  private async safeListResources(): Promise<{ resources: Resource[]; resourceTemplates: ResourceTemplate[] }> {
    try {
      const resources = await this.client.listResources();
      console.debug(`Retrieved ${resources.resources.length} resources`);
      return resources;
    } catch (error) {
      console.error("Failed to list resources:", error);
      return { resources: [], resourceTemplates: [] };
    }
  }

  private validateSchema(toolName: string, schema: any): any {
    try {
      const zodSchema = this.createZodSchema(schema);
      return zodSchema.shape;
    } catch (error) {
      console.warn(`Invalid schema for tool ${toolName}:`, error);
      return {};
    }
  }

  private createZodSchema(schema: any): z.ZodTypeAny {
    const type = schema.type;

    if (type === "string") {
      return z.string();
    } else if (type === "number") {
      return z.number();
    } else if (type === "integer") {
      return z.number().int();
    } else if (type === "boolean") {
      return z.boolean();
    } else if (type === "array") {
      const items = schema.items || {};
      return z.array(this.createZodSchema(items));
    } else if (type === "object") {
      const properties = schema.properties || {};
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, value] of Object.entries(properties)) {
        shape[key] = this.createZodSchema(value);
      }
      return z.object(shape);
    } else {
      return z.any();
    }
  }

  private generateToolExample(tool: Tool): Record<string, any> | null {
    if (!tool.inputSchema || !tool.inputSchema.properties) {
      return null;
    }

    const exampleArgs: Record<string, any> = {};
    for (const [propName, prop] of Object.entries(tool.inputSchema.properties)) {
      if (prop.type === "string") {
        exampleArgs[propName] = "example_string";
      } else if (prop.type === "number" || prop.type === "integer") {
        exampleArgs[propName] = 42;
      } else if (prop.type === "boolean") {
        exampleArgs[propName] = true;
      }
    }

    return {
      name: tool.name,
      arguments: exampleArgs,
    };
  }

  private isValidTool(tool: Tool): boolean {
    return !!tool.name && !!tool.description && !!tool.inputSchema;
  }

  private isValidPrompt(prompt: Prompt): boolean {
    return !!prompt.name && !!prompt.description;
  }

  private isValidResource(resource: Resource): boolean {
    return !!resource.name && !!resource.uri && !!resource.description;
  }

  asSystemPrompt(): string {
    if (!this.context) {
      return "";
    }

    const parts = ["You have access to the following capabilities:"];

    if (this.context.available_tools.length > 0) {
      parts.push("\nTOOLS:");
      for (const tool of this.context.available_tools) {
        parts.push(`- ${tool.name}: ${tool.description}`);
      }
    }

    if (this.context.available_prompts.length > 0) {
      parts.push("\nPROMPTS:");
      for (const prompt of this.context.available_prompts) {
        parts.push(`- ${prompt.name}: ${prompt.description}`);
      }
    }

    if (this.context.available_resources.length > 0) {
      parts.push("\nRESOURCES:");
      for (const resource of this.context.available_resources) {
        parts.push(`- ${resource.name}: ${resource.description}`);
      }
    }

    return "\n".join(parts);
  }

  formatForClaude(): Record<string, any> {
    if (!this.context) {
      return {};
    }

    return {
      tools: this.context.available_tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    };
  }
}

// Example usage with Claude:
async function useWithClaude(client: Client, user_input: string) {
  // Initialize context manager and prepare MCP context
  const contextManager = new LLMContextManager(client);
  await contextManager.prepareLlmContext();

  // Pass the formatted context as the system prompt and tools to Claude
  const anthropicClient = new Anthropic();
  const response = await anthropicClient.messages.create({
    model: "claude-3-5-sonnet-20241022",
    system: contextManager.asSystemPrompt(), // MCP context as system prompt
    messages: [{ role: "user", content: user_input }],
    tools: contextManager.formatForClaude().tools, // MCP tools formatted for Claude's tools parameter
  });
  return response;
}
```

This enhanced context manager:

1. Provides rich context about available capabilities
2. Includes usage examples and access patterns
3. Formats context appropriately for different LLMs
4. Maintains context freshness with timestamps
5. Supports multiple context injection methods:
    *   As system prompts
    *   As function/tool definitions
    *   As conversation context

### 4.4. Handling Tool Calls and Schema Validation

**Calling a Tool:**

**TypeScript:**

```typescript
import { Client, type CallToolResult } from "@modelcontextprotocol/sdk/client/index.js";

async function callToolExample(client: Client) {
  try {
    const toolResult: CallToolResult = await client.callTool("calculate_sum", {
      a: 2,
      b: 3,
    });
    if (toolResult.isError) {
      console.error("Tool call error:", toolResult.content[0].text);
    } else {
      console.log("Tool result:", toolResult.content[0].text);
    }
  } catch (error) {
    console.error("Error calling tool:", error);
  }
}
```

**Schema Validation:**

Validate tool arguments against the `inputSchema` provided by the server using libraries like `zod`.

**TypeScript (using `zod`):**

```typescript
import { Client, type Tool } from "@modelcontextprotocol/sdk/client/index.js";
import { z, ZodError } from "zod";

async function validateAndCallTool(
  client: Client,
  toolName: string,
  toolArgs: any
) {
  const tools = await client.listTools();
  const tool = tools.tools.find((t: Tool) => t.name === toolName);

  if (tool) {
    try {
      // Create a Zod schema from the input schema
      const toolSchema = createZodSchema(tool.inputSchema);

      // Validate arguments
      const validatedArgs = toolSchema.parse(toolArgs);

      // Call the tool with validated arguments
      const toolResult = await client.callTool(tool.name, validatedArgs);
      if (toolResult.isError) {
        console.error("Tool call error:", toolResult.content[0].text);
      } else {
        console.log(`Tool result: ${toolResult.content[0].text}`);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Invalid arguments:", error.errors);
      } else {
        console.error(`Error calling tool ${toolName}:`, error);
      }
    }
  } else {
    console.error(`Tool not found: ${toolName}`);
  }
}

function createZodSchema(schema: any): z.ZodTypeAny {
  // Helper function to map JSON schema types to Zod types
  const type = schema.type;

  if (type === "string") {
    return z.string();
  } else if (type === "number") {
    return z.number();
  } else if (type === "integer") {
    return z.number().int();
  } else if (type === "boolean") {
    return z.boolean();
  } else if (type === "array") {
    const items = schema.items || {};
    return z.array(createZodSchema(items));
  } else if (type === "object") {
    const properties = schema.properties || {};
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(properties)) {
      shape[key] = createZodSchema(value);
    }
    return z.object(shape);
  } else {
    return z.any();
  }
}
```

### 4.5. Reading Resources

**TypeScript:**

```typescript
import { Client, type Resource, type ReadResourceResult } from "@modelcontextprotocol/sdk/client/index.js";

async function readResourceExample(client: Client) {
  try {
    const resources = await client.listResources();
    const res = resources.resources.find(
      (r: Resource) => r.uri === "file:///path/to/app.log"
    );

    if (res) {
      const contents: ReadResourceResult = await client.readResource(res.uri);
      console.log(contents.contents[0].text); // The file's text
    } else {
      console.error("Resource not found.");
    }
  } catch (error) {
    console.error("Error reading resource:", error);
  }
}
```

### 4.6. Using Prompts

**TypeScript:**

```typescript
import { Client, type Prompt, type GetPromptResult } from "@modelcontextprotocol/sdk/client/index.js";

async function getPromptExample(client: Client) {
  try {
    const prompts = await client.listPrompts();
    const prompt = prompts.prompts.find((p: Prompt) => p.name === "prompt-name");

    if (prompt) {
      const promptResult: GetPromptResult = await client.getPrompt(prompt.name);
      console.log("Prompt messages:", promptResult.messages);
    } else {
      console.error("Prompt not found.");
    }
  } catch (error) {
    console.error("Error getting prompt:", error);
  }
}
```

### 4.7. Running Queries with LLM Integration and Context Re-injection

MCP standardizes server communication but doesn't mandate a specific LLM. Integrate with Claude (Anthropic), OpenAI, or other LLMs using their respective client libraries.

**Key Concepts:**

1. **Message History Management**
    * The conversation history is maintained in a `messages` array that includes:
      ```typescript
      type Message = {
        role: "user" | "assistant";
        content: string | ToolUse[];
      };

      type ToolUse = {
        type: "tool_use";
        name: string;
        input: Record<string, any>;
      };
      ```
    * Each interaction adds multiple entries to track:
      - User queries
      - LLM responses
      - Tool calls and their results
      - Follow-up responses

2. **Context Re-injection**
    * After each tool call, the history is updated with:
      ```typescript
      // Record the tool call
      messages.push({
        role: "assistant",
        content: [{
          type: "tool_use",
          name: "list_files",
          input: { path: "/project" }
        }]
      });

      // Record the tool result
      messages.push({
        role: "user",
        content: toolResult.content
      });
      ```
    * This history is included in subsequent LLM requests:
      ```typescript
      const response = await llm.createMessage({
        messages: messages,  // Complete history
        tools: availableTools,
        // ... other parameters
      });
      ```

3. **Example Conversation Flow**
    ```typescript
    // Initial state
    messages = [
      {
        role: "user",
        content: "List Python files and show their sizes"
      }
    ];

    // After LLM decides to use list_files tool
    messages = [
      {
        role: "user",
        content: "List Python files and show their sizes"
      },
      {
        role: "assistant",
        content: [{
          type: "tool_use",
          name: "list_files",
          input: { path: ".", pattern: "*.py" }
        }]
      },
      {
        role: "user",
        content: "Found: main.py (1.2KB), utils.py (800B)"
      },
      {
        role: "assistant",
        content: "I found 2 Python files:\n- main.py (1.2 KB)\n- utils.py (800 bytes)\nWould you like me to analyze their contents?"
      }
    ];

    // After user responds
    messages.push({
      role: "user",
      content: "Yes, show me what's in main.py"
    });
    ```

4. **Dynamic Adaptation**
    * Tool availability is refreshed before each LLM request
    * Context is maintained across multiple tool calls
    * The LLM can reference previous results and actions
    * Each request includes:
      - Complete conversation history
      - Current tool capabilities
      - Previous tool results

**Simplified TypeScript Example (using Anthropic's client):**

```typescript
import { Client, type Tool } from "@modelcontextprotocol/sdk/client/index.js";
import { Anthropic, type Message, type MessageCreateParams } from "@anthropic-ai/sdk";
import * as readline from "readline";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function processUserQuery(client: Client, user_input: string): Promise<string> {
  let messages: Message[] = [{ role: "user", content: user_input }];
  let pendingToolCalls: { name: string; input: any }[] = [];
  let toolResults: { name: string; result: any }[] = [];
  let iteration = 0;
  const MAX_ITERATIONS = 5; // Prevent infinite loops

  try {
    // 1) Discover and validate tools
    const tools_info = await client.listTools();
    if (!tools_info.tools || tools_info.tools.length === 0) {
      return "No tools available to process your request.";
    }

    // 2) Send query + tool list to LLM
    let llm_response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: messages,
      tools: tools_info.tools.map((t: Tool) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
    });

    // 3) Handle LLM response and potential tool calls
    let final_response = "";

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      pendingToolCalls = [];

      // Process all content from LLM response
      for (const content of llm_response.content) {
        if (content.type === "text") {
          final_response += content.text;
        } else if (content.type === "tool_use") {
          pendingToolCalls.push({
            name: content.name,
            input: content.input,
          });
        }
      }

      // If no tool calls, we're done
      if (pendingToolCalls.length === 0) {
        break;
      }

      // Execute all pending tool calls (after approval)
      for (const toolCall of pendingToolCalls) {
        try {
          if (await shouldCallTool(client, toolCall.name, toolCall.input)) {
            const tool_result = await client.callTool(
              toolCall.name,
              toolCall.input
            );

            // Handle tool errors
            if (tool_result.isError) {
              toolResults.push({
                name: toolCall.name,
                result: {
                  error: true,
                  message: tool_result.content[0].text,
                },
              });
              final_response += `\nError executing ${toolCall.name}: ${tool_result.content[0].text}\n`;
              continue;
            }

            toolResults.push({
              name: toolCall.name,
              result: tool_result.content,
            });

            // Update conversation context
            messages.push({
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  name: toolCall.name,
                  input: toolCall.input,
                },
              ],
            });
            messages.push({
              role: "user",
              content: tool_result.content,
            });
          } else {
            final_response += `\nTool call to ${toolCall.name} was not approved.\n`;
          }
        } catch (error) {
          console.error(`Error executing tool ${toolCall.name}:`, error);
          final_response += `\nError executing ${toolCall.name}: ${error}\n`;
        }
      }

      // Send updated context back to LLM
      llm_response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: messages,
        tools: tools_info.tools.map((t: Tool) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        })),
      });
    }

    if (iteration >= MAX_ITERATIONS) {
      final_response += "\nReached maximum number of tool call iterations.";
    }

    // 4) Return the final result to the user
    return final_response;
  } catch (error) {
    console.error("Error processing user query:", error);
    if (error instanceof Error) {
      return `An error occurred while processing your request: ${error.message}`;
    }
    return "An error occurred while processing your request.";
  }
}
```

**Explanation of Message History Management:**

1. The `messages` array maintains the complete conversation history, including:
   - User inputs
   - LLM responses
   - Tool calls and their results

2. After each tool call, two entries are appended to `messages`:
   ```typescript
   // First: Record the tool call itself
   messages.push({
     role: "assistant",
     content: [
       {
         type: "tool_use",
         name: toolCall.name,
         input: toolCall.input,
       },
     ],
   });

   // Second: Record the tool's result
   messages.push({
     role: "user",
     content: tool_result.content,
   });
   ```

3. This history is used in subsequent LLM requests to maintain context:
   ```typescript
   // Example of how the messages array evolves:
   const messageHistory = [
     // Initial user query
     {
       role: "user",
       content: "What Python files are in the project?",
     },
     // LLM decides to use list_files tool
     {
       role: "assistant",
       content: [
         {
           type: "tool_use",
           name: "list_files",
           input: { path: ".", pattern: "*.py" },
         },
       ],
     },
     // Tool result
     {
       role: "user",
       content: [
         {
           type: "text",
           text: "Found: main.py, utils.py, test_app.py",
         },
       ],
     },
     // LLM processes result and responds
     {
       role: "assistant",
       content: "I found 3 Python files in the project: main.py, utils.py, and test_app.py. Would you like me to analyze their contents?",
     },
     // User follows up
     {
       role: "user",
       content: "Yes, show me what's in main.py",
     },
     // And so on...
   ];

   // Each new LLM request includes the full history
   const llm_response = await anthropic.messages.create({
     model: "claude-3-5-sonnet-20241022",
     max_tokens: 1000,
     messages: messageHistory,  // Pass complete history
     tools: tools_info.tools,  // Tools remain available
   });
   ```

This context management ensures that:
- The LLM understands the full conversation flow
- Tool calls and their results are properly tracked
- The LLM can reference previous actions and results
- The conversation maintains coherence across multiple interactions

### 4.8. Human-in-the-Loop (Tool Call Approval)

MCP emphasizes human oversight. Before executing a tool, you can prompt the user for confirmation:

**TypeScript (Example):**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import * as readline from "readline";

async function shouldCallTool(
  client: Client,
  toolName: string,
  toolArgs: any
): Promise<boolean> {
  /**
   * Prompts the user to approve a tool call and returns True if approved, False otherwise.
   */
  console.log(`LLM requested to call tool: ${toolName}`);
  console.log(`Arguments: ${JSON.stringify(toolArgs)}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question("Approve tool execution? (y/n): ", resolve);
  });

  rl.close();

  return answer.toLowerCase() === "y";
}
```

### 4.9. Example: Full TypeScript Code

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Anthropic } from "@anthropic-ai/sdk";
import * as readline from "readline";
import { z } from "zod";

async function main() {
  if (process.argv.length < 3) {
    console.error("Usage: node client.ts <server-script>");
    process.exit(1);
  }
  const serverScript = process.argv[2];

  // Setup client & transport
  const client = new Client({ name: "my-ts-client", version: "1.0.0" }, {});
  const transport = new StdioClientTransport({
    command: serverScript.endsWith(".ts") ? "npx" : "node",
    args: serverScript.endsWith(".ts")
      ? ["ts-node", serverScript]
      : [serverScript],
  });
  await client.connect(transport);
  await client.initialize();

  // List available tools
  const tools = await client.listTools();
  console.log("Tools available:", tools.tools.map((t) => t.name));

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
  });

  // Simple REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log("Type your queries or 'quit' to exit.\n");

  for await (const line of rl) {
    const query = line.trim();
    if (!query || query.toLowerCase() === "quit") {
      break;
    }

    let messages = [{ role: "user", content: query }];

    // Send query to LLM (Anthropic example)
    let claudeResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: messages,
      tools: tools.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
    });

    console.log("LLM response:", claudeResponse);

    // Check if LLM wants to call a tool
    for (const content of claudeResponse.content) {
      if (content.type === "tool_use") {
        // Human-in-the-loop approval
        if (
          await shouldCallTool(client, content.name, content.input)
        ) {
          // Execute a tool call
          const result = await client.callTool(content.name, content.input);
          console.log("Tool Result:", result);

          messages.push({
            role: "assistant",
            content: [content],
          });

          messages.push({
            role: "user",
            content: result.content,
          });

          claudeResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: messages,
          });
          console.log("LLM response:", claudeResponse);
        } else {
          console.log(
            `Tool call to ${content.name} was not approved.`
          );
        }
      }
    }
  }

  rl.close();
  console.log("Shutting down MCP client...");
  await client.close();
}

async function shouldCallTool(
  client: Client,
  toolName: string,
  toolArgs: any
): Promise<boolean> {
  /**
   * Prompts the user to approve a tool call and returns True if approved, False otherwise.
   */
  console.log(`LLM requested to call tool: ${toolName}`);
  console.log(`Arguments: ${JSON.stringify(toolArgs)}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question("Approve tool execution? (y/n): ", resolve);
  });

  rl.close();

  return answer.toLowerCase() === "y";
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```
