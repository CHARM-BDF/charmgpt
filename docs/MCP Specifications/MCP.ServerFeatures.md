Here is the content reformatted in Markdown:

```markdown
# Server Features in Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

Servers provide the essential primitives for adding context to language models via MCP. These primitives enable rich and dynamic interactions between clients, servers, and language models. The main primitives are:

1. **Prompts**: Pre-defined templates or instructions that guide language model interactions.
2. **Resources**: Structured data or content that provides additional context to the model.
3. **Tools**: Executable functions that allow models to perform actions or retrieve information.

---

## Control Hierarchy of Primitives

Each primitive operates under a specific control hierarchy:

| **Primitive** | **Control**          | **Description**                                    | **Example**                      |
|---------------|----------------------|----------------------------------------------------|----------------------------------|
| **Prompts**   | User-controlled      | Interactive templates invoked by user choice       | Slash commands, menu options    |
| **Resources** | Application-controlled | Contextual data attached and managed by the client | File contents, git history      |
| **Tools**     | Model-controlled     | Functions exposed to the LLM to take actions       | API POST requests, file writing |

---

## Key Primitives

### Prompts
- **Definition**: Templates or instructions that guide how the language model interacts with the user or data.
- **Control**: User-controlled, enabling interactive and customizable workflows.
- **Examples**:
  - Slash commands like `/summarize` or `/translate`.
  - Menu options in graphical interfaces.

### Resources
- **Definition**: Structured data or contextual content that enriches the model's understanding.
- **Control**: Managed by the application, providing curated and relevant information.
- **Examples**:
  - File contents for context.
  - Git commit history for code reviews.

### Tools
- **Definition**: Executable functions exposed to the language model for performing tasks or retrieving information.
- **Control**: Model-controlled, allowing the model to decide when and how to use them.
- **Examples**:
  - API POST requests for querying external services.
  - File writing operations to save generated outputs.

---

Explore these primitives to leverage the full potential of MCP and enhance the functionality and interactivity of your client-server implementations.





# Prompts in Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

The Model Context Protocol (MCP) provides a standardized way for servers to expose prompt templates to clients. Prompts allow servers to deliver structured messages and instructions for interacting with language models. Clients can discover available prompts, retrieve their contents, and customize them with arguments.

---

## User Interaction Model

Prompts are **user-controlled** and are exposed by servers for explicit selection and use by users. Typically, prompts are triggered through user-initiated commands in the interface, such as slash commands:

```text
Example of prompt exposed as slash command
```

While the protocol does not mandate specific user interaction patterns, implementers are free to design interfaces that best suit their needs.

---

## Capabilities

Servers that support prompts **MUST** declare the `prompts` capability during initialization:

```json
{
  "capabilities": {
    "prompts": {
      "listChanged": true
    }
  }
}
```

- `listChanged`: Indicates whether the server will notify clients when the list of available prompts changes.

---

## Protocol Messages

### Listing Prompts

Clients can retrieve available prompts using the `prompts/list` request. Pagination is supported.

#### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/list",
  "params": {
    "cursor": "optional-cursor-value"
  }
}
```

#### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "prompts": [
      {
        "name": "code_review",
        "description": "Asks the LLM to analyze code quality and suggest improvements",
        "arguments": [
          {
            "name": "code",
            "description": "The code to review",
            "required": true
          }
        ]
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

---

### Getting a Prompt

To retrieve a specific prompt, clients use the `prompts/get` request. Argument auto-completion is supported through the completion API.

#### Request

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "prompts/get",
  "params": {
    "name": "code_review",
    "arguments": {
      "code": "def hello():\n    print('world')"
    }
  }
}
```

#### Response

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "description": "Code review prompt",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Please review this Python code:\ndef hello():\n    print('world')"
        }
      }
    ]
  }
}
```

---

### List Changed Notification

When the list of available prompts changes, servers **SHOULD** notify clients using the `notifications/prompts/list_changed` method:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/prompts/list_changed"
}
```

# Message Flow: Prompt Management in MCP

# Message Flow for Tools in MCP

This diagram illustrates the interaction between the **LLM**, **Client**, and **Server** during tool discovery, selection, invocation, and updates.

---

## Entities

- **LLM**: The language model interacting with the tools.
- **Client**: The intermediary entity facilitating communication between the LLM and the Server.
- **Server**: The entity exposing tools to the Client and providing results.

---

## Stages of Message Flow

### 1. **Discovery**
   - The **Client** sends a `tools/list` request to the **Server** to retrieve the list of available tools.
   - The **Server** responds with the list of tools.

   **Messages:**
   - `tools/list` (Request from Client to Server)
   - `List of tools` (Response from Server to Client)

---

### 2. **Tool Selection**
   - The **LLM** selects a tool to use based on the list provided by the **Client**.

   **Action:**
   - **LLM**: Decides which tool to invoke.

---

### 3. **Invocation**
   - The **Client** sends a `tools/call` request to the **Server`, specifying the tool and its input arguments.
   - The **Server** processes the request and returns the result.

   **Messages:**
   - `tools/call` (Request from Client to Server)
   - `Tool result` (Response from Server to Client)

   **Example:**
   - If the selected tool is `get_weather`, the Client sends arguments like location ("New York"), and the Server returns the weather data.

---

### 4. **Updates**
   - The **Server** notifies the **Client** when the list of available tools changes by sending a `tools/list_changed` notification.
   - The **Client** can then request an updated list of tools using `tools/list`.

   **Messages:**
   - `tools/list_changed` (Notification from Server to Client)
   - `tools/list` (Request from Client to Server for updated list)
   - `Updated tools` (Response from Server to Client)

---

## Sequential Example in Plain Text

1. **Client to Server**: `tools/list` → Request a list of tools.
2. **Server to Client**: Responds with a list of tools.
3. **LLM**: Selects a tool from the list.
4. **Client to Server**: `tools/call` → Invoke the selected tool with arguments.
5. **Server to Client**: Returns the result of the tool invocation.
6. **Server to Client** (Optional): `tools/list_changed` → Notify that the tool list has changed.
7. **Client to Server**: `tools/list` → Request updated tool list.
8. **Server to Client**: Responds with the updated list of tools.

---

## Key Notes for LLMs

- **Discovery Stage**: Ensure you request the list of tools before attempting to invoke any.
- **Invocation Stage**: Provide the correct tool name and required input arguments.
- **Updates Stage**: Be prepared to handle changes in the tool list by re-requesting updated information.

---

## Security Considerations

- **Human-in-the-loop**: Always confirm tool invocations with a human before execution.
- **Input Validation**: Validate arguments before invoking a tool.
- **Error Handling**: Handle cases where tools are unavailable or fail to execute properly.

---


## Data Types

### Prompt

A prompt definition includes:

- `name`: Unique identifier for the prompt
- `description`: Optional human-readable description
- `arguments`: Optional list of arguments for customization

### PromptMessage

Messages in a prompt can contain:

- `role`: Either `user` or `assistant`, indicating the speaker
- `content`: Can be one of the following types:
  - **Text Content**:
    ```json
    {
      "type": "text",
      "text": "The text content of the message"
    }
    ```
  - **Image Content**:
    ```json
    {
      "type": "image",
      "data": "base64-encoded-image-data",
      "mimeType": "image/png"
    }
    ```
    - The `data` field contains base64-encoded image data.
    - The `mimeType` field specifies the image's format (e.g., `image/png`).
  - **Embedded Resources**:
    ```json
    {
      "type": "resource",
      "resource": {
        "uri": "resource://example",
        "mimeType": "text/plain",
        "text": "Resource content"
      }
    }
    ```
    - Includes a valid `uri`, `mimeType`, and resource content.

---

## Error Handling

Servers **SHOULD** return standard JSON-RPC errors for failure cases:

- **Invalid prompt name**: `-32602` (Invalid params)
- **Missing required arguments**: `-32602` (Invalid params)
- **Internal errors**: `-32603` (Internal error)

---

## Implementation Considerations

- **Servers**:
  - Validate prompt arguments before processing.
  - Notify clients when the prompt list changes if the `listChanged` capability is enabled.
- **Clients**:
  - Handle pagination for large prompt lists.
  - Use argument auto-completion for better user experience.

---

## Security

- Implementations **MUST** validate all inputs and outputs to prevent:
  - Injection attacks
  - Unauthorized access to resources
- Resources referenced in prompts should follow strict validation rules.


```markdown
# Resources
**Protocol Revision:** 2024-11-05

The Model Context Protocol (MCP) provides a standardized way for servers to expose resources to clients. Resources enable sharing data that provides context to language models, such as files, database schemas, or application-specific information. Each resource is uniquely identified by a URI.

---

## User Interaction Model

Resources in MCP are application-driven, meaning the host application determines how to incorporate context based on its needs. For example:
- **Explicit selection**: Expose resources through UI elements like trees or lists.
- **Search and filter**: Allow users to search and filter available resources.
- **Automatic inclusion**: Dynamically include resources based on heuristics or AI model selection.

---

## Capabilities

Servers that support resources must declare the `resources` capability during initialization:

```json
{
  "capabilities": {
    "resources": {
      "subscribe": true,
      "listChanged": true
    }
  }
}
```

### Optional Features
- **`subscribe`**: Allows clients to subscribe to changes in individual resources.
- **`listChanged`**: Notifies clients when the list of resources changes.

---

## Protocol Messages

### Listing Resources
To discover available resources, clients send a `resources/list` request:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "cursor": "optional-cursor-value"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resources": [
      {
        "uri": "file:///project/src/main.rs",
        "name": "main.rs",
        "description": "Primary application entry point",
        "mimeType": "text/x-rust"
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

### Reading Resources
To retrieve resource contents, clients send a `resources/read` request:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "file:///project/src/main.rs"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "contents": [
      {
        "uri": "file:///project/src/main.rs",
        "mimeType": "text/x-rust",
        "text": "fn main() {\n    println!(\"Hello world!\");\n}"
      }
    ]
  }
}
```

### Resource Templates
Servers can expose parameterized resources using URI templates:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/templates/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "resourceTemplates": [
      {
        "uriTemplate": "file:///{path}",
        "name": "Project Files",
        "description": "Access files in the project directory",
        "mimeType": "application/octet-stream"
      }
    ]
  }
}
```

---

## Notifications

### List Changed Notification
If the list of available resources changes, servers supporting `listChanged` SHOULD send a notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/list_changed"
}
```

### Subscriptions
Clients can subscribe to specific resource changes:

**Subscribe Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/subscribe",
  "params": {
    "uri": "file:///project/src/main.rs"
  }
}
```

**Update Notification:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "uri": "file:///project/src/main.rs"
  }
}
```

---

## Message Flow

### Sequence of Operations
1. **Resource Discovery**:
    - Client: `resources/list`
    - Server: Responds with a list of resources.
2. **Resource Access**:
    - Client: `resources/read`
    - Server: Returns resource content.
3. **Subscriptions (Optional)**:
    - Client: `resources/subscribe`
    - Server: Sends updates using `notifications/resources/updated`.

### Example Flow

```plaintext
Client              Server
  |                   |
  | resources/list     |  --> Discovery
  |------------------->|
  | List of resources  |
  |<-------------------|
  |                   |
  | resources/read     |  --> Access
  |------------------->|
  | Resource contents  |
  |<-------------------|
  |                   |
  | resources/subscribe|  --> Subscriptions
  |------------------->|
  | notifications/     |
  | resources/updated  |  --> Updates
  |<-------------------|
```

---

## Data Types

### Resource Definition
Each resource includes:
- **`uri`**: Unique identifier
- **`name`**: Human-readable name
- **`description`**: Optional description
- **`mimeType`**: Optional MIME type

### Resource Contents
Resources can have text or binary content:
- **Text Example**:
  ```json
  {
    "uri": "file:///example.txt",
    "mimeType": "text/plain",
    "text": "Resource content"
  }
  ```
- **Binary Example**:
  ```json
  {
    "uri": "file:///example.png",
    "mimeType": "image/png",
    "blob": "base64-encoded-data"
  }
  ```

---

## Common URI Schemes

| **Scheme**  | **Description**                                      |
|-------------|------------------------------------------------------|
| `https://`  | For web-accessible resources.                        |
| `file://`   | For file-like resources (e.g., project files).       |
| `git://`    | For Git version control integration.                 |

---

## Error Handling

Servers should handle errors gracefully and return standard JSON-RPC error codes:

| **Error**                 | **Code** | **Example**                          |
|---------------------------|----------|--------------------------------------|
| Resource not found        | -32002   | `"message": "Resource not found"`    |
| Internal server error     | -32603   | `"message": "Internal error"`        |

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "error": {
    "code": -32002,
    "message": "Resource not found",
    "data": {
      "uri": "file:///nonexistent.txt"
    }
  }
}
```

---

## Security Considerations

- Servers MUST validate all resource URIs.
- Binary data MUST be properly encoded.
- Access controls SHOULD be enforced for sensitive resources.
- Resource permissions SHOULD be checked before operations.

```markdown
# Tools
**Protocol Revision:** 2024-11-05

The Model Context Protocol (MCP) allows servers to expose tools that can be invoked by language models. Tools enable models to interact with external systems, such as querying databases, calling APIs, or performing computations. Each tool is uniquely identified by a name and includes metadata describing its schema.

---

## User Interaction Model

Tools in MCP are designed to be **model-controlled**, meaning the language model can discover and invoke tools automatically based on its contextual understanding and the user’s prompts.

### Best Practices
- Applications SHOULD:
  - Provide UI that clearly indicates which tools are exposed to the AI model.
  - Include visual indicators when tools are invoked.
  - Require user confirmation for operations to ensure a **human-in-the-loop** approach.

---

## Capabilities

Servers that support tools must declare the `tools` capability during initialization:

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true
    }
  }
}
```

- **`listChanged`**: Indicates whether the server will notify clients when the list of tools changes.

---

## Protocol Messages

### Listing Tools

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "cursor": "optional-cursor-value"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "get_weather",
        "description": "Get current weather information for a location",
        "inputSchema": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City name or zip code"
            }
          },
          "required": ["location"]
        }
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

---

### Calling Tools

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "location": "New York"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Current weather in New York:\nTemperature: 72°F\nConditions: Partly cloudy"
      }
    ],
    "isError": false
  }
}
```

---

### List Changed Notification

When the list of available tools changes, servers that declared the `listChanged` capability SHOULD send a notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}
```

---

## Message Flow

### Sequence of Operations
1. **Discovery**:
    - Client: `tools/list`
    - Server: Returns the list of tools.
2. **Tool Selection**:
    - Model selects the tool to use.
3. **Invocation**:
    - Client: `tools/call`
    - Server: Processes and returns results.
4. **Updates (if applicable)**:
    - Server: Sends `tools/list_changed` notification.
    - Client: Updates the list of tools.

```plaintext
Client              Server              LLM
  |                   |                 |
  | tools/list         |  --> Discovery |
  |------------------->|                 |
  | List of tools      |                 |
  |<-------------------|                 |
  |                   | Select Tool     |
  | tools/call         |  --> Invocation|
  |------------------->|                 |
  | Tool Result        |                 |
  |<-------------------| Process Result |
  | tools/list_changed |  --> Updates   |
```

---

## Data Types

### Tool
A tool definition includes:
- **`name`**: Unique identifier.
- **`description`**: Human-readable description of functionality.
- **`inputSchema`**: JSON Schema defining expected parameters.

### Tool Result
Tool results can contain multiple content items of different types:
- **Text Example**:
  ```json
  {
    "type": "text",
    "text": "Tool result text"
  }
  ```
- **Image Example**:
  ```json
  {
    "type": "image",
    "data": "base64-encoded-data",
    "mimeType": "image/png"
  }
  ```
- **Embedded Resource Example**:
  ```json
  {
    "type": "resource",
    "resource": {
      "uri": "resource://example",
      "mimeType": "text/plain",
      "text": "Resource content"
    }
  }
  ```

---

## Error Handling

### Protocol Errors
These errors follow JSON-RPC standards:
- **Unknown tools**
- **Invalid arguments**
- **Server errors**

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Unknown tool: invalid_tool_name"
  }
}
```

### Tool Execution Errors
Errors specific to the tool invocation are reported with `isError: true`:
- **API failures**
- **Invalid input data**
- **Business logic errors**

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Failed to fetch weather data: API rate limit exceeded"
      }
    ],
    "isError": true
  }
}
```

---

## Security Considerations

### Server Responsibilities
- Validate all tool inputs.
- Implement proper access controls.
- Rate limit tool invocations.
- Sanitize tool outputs.

### Client Responsibilities
- Prompt for user confirmation on sensitive operations.
- Show tool inputs to the user before calling the server.
- Validate tool results before passing them to the LLM.
- Implement timeouts for tool calls.
- Log tool usage for auditing.

---



