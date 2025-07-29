# Base Protocol

ℹ️ **Protocol Revision**: 2024-11-05

All messages between MCP clients and servers **MUST** follow the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) specification. The protocol defines three fundamental types of messages:

| Type          | Description                         | Requirements                            |
|---------------|-------------------------------------|-----------------------------------------|
| `Requests`    | Messages sent to initiate an operation | Must include unique ID and method name |
| `Responses`   | Messages sent in reply to requests  | Must include same ID as request         |
| `Notifications` | One-way messages with no reply     | Must not include an ID                  |

**Responses** are further sub-categorized as either **successful results** or **errors**. Results can follow any JSON object structure, while errors must include an error code and message at minimum.

## Protocol Layers

The Model Context Protocol consists of several key components that work together:

- **Base Protocol**: Core JSON-RPC message types
- **Lifecycle Management**: Connection initialization, capability negotiation, and session control
- **Server Features**: Resources, prompts, and tools exposed by servers
- **Client Features**: Sampling and root directory lists provided by clients
- **Utilities**: Cross-cutting concerns like logging and argument completion

All implementations **MUST** support the base protocol and lifecycle management components. Other components **MAY** be implemented based on the specific needs of the application.

These protocol layers establish clear separation of concerns while enabling rich interactions between clients and servers. The modular design allows implementations to support exactly the features they need.

See the following pages for more details on the different components:

- [Lifecycle](https://github.com/modelcontextprotocol/specification/2024-11-05/basic/lifecycle)
- [Resources](https://github.com/modelcontextprotocol/specification/2024-11-05/server/resources)
- [Prompts](https://github.com/modelcontextprotocol/specification/2024-11-05/server/prompts)
- [Tools](https://github.com/modelcontextprotocol/specification/2024-11-05/server/tools)
- [Logging](https://github.com/modelcontextprotocol/specification/2024-11-05/server/utilities/logging)
- [Sampling](https://github.com/modelcontextprotocol/specification/2024-11-05/client/sampling)

## Auth

Authentication and authorization are not currently part of the core MCP specification, but we are considering ways to introduce them in the future. Join us in [GitHub Discussions](https://github.com/modelcontextprotocol/specification/discussions) to help shape the future of the protocol!

Clients and servers **MAY** negotiate their own custom authentication and authorization strategies.

## Schema

The full specification of the protocol is defined as a [TypeScript schema](http://github.com/modelcontextprotocol/specification/tree/main/schema/2024-11-05/schema.ts). This is the source of truth for all protocol messages and structures.

There is also a [JSON Schema](http://github.com/modelcontextprotocol/specification/tree/main/schema/2024-11-05/schema.json), which is automatically generated from the TypeScript source of truth, for use with various automated tooling.

```markdown


# Messages

ℹ️ **Protocol Revision**: 2024-11-05

All messages in MCP **MUST** follow the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) specification. The protocol defines three types of messages:

## Requests

Requests are sent from the client to the server or vice versa.

```typescript
{
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: {
    [key: string]: unknown;
  };
}
```

- Requests **MUST** include a string or integer ID.
- Unlike base JSON-RPC, the ID **MUST NOT** be `null`.
- The request ID **MUST NOT** have been previously used by the requestor within the same session.

## Responses

Responses are sent in reply to requests.

```typescript
{
  jsonrpc: "2.0";
  id: string | number;
  result?: {
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
```

- Responses **MUST** include the same ID as the request they correspond to.
- Either a `result` or an `error` **MUST** be set. A response **MUST NOT** set both.
- Error codes **MUST** be integers.

## Notifications

Notifications are sent from the client to the server or vice versa. They do not expect a response.

```typescript
{
  jsonrpc: "2.0";
  method: string;
  params?: {
    [key: string]: unknown;
  };
}
```

- Notifications **MUST NOT** include an ID.
```


```markdown
# Lifecycle

ℹ️ **Protocol Revision**: 2024-11-05

The Model Context Protocol (MCP) defines a rigorous lifecycle for client-server connections that ensures proper capability negotiation and state management.

1. **Initialization**: Capability negotiation and protocol version agreement.
2. **Operation**: Normal protocol communication.
3. **Shutdown**: Graceful termination of the connection.

## Lifecycle Phases

### Initialization

The initialization phase **MUST** be the first interaction between client and server. During this phase, the client and server:

- Establish protocol version compatibility.
- Exchange and negotiate capabilities.
- Share implementation details.

The client **MUST** initiate this phase by sending an `initialize` request containing:

- Protocol version supported.
- Client capabilities.
- Client implementation information.

Example `initialize` request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "ExampleClient",
      "version": "1.0.0"
    }
  }
}
```

The server **MUST** respond with its own capabilities and information:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "ExampleServer",
      "version": "1.0.0"
    }
  }
}
```

After successful initialization, the client **MUST** send an `initialized` notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

#### Version Negotiation

- The client **MUST** send a protocol version it supports (preferably the latest).
- The server **MUST** respond with a supported version (preferably the latest).
- If the client does not support the version in the server’s response, it **SHOULD** disconnect.

#### Capability Negotiation

Key capabilities include:

| Category | Capability      | Description                                              |
|----------|------------------|----------------------------------------------------------|
| Client   | `roots`          | Provides filesystem roots.                              |
| Client   | `sampling`       | Supports LLM sampling requests.                         |
| Client   | `experimental`   | Non-standard experimental features.                     |
| Server   | `prompts`        | Provides prompt templates.                              |
| Server   | `resources`      | Exposes readable resources.                             |
| Server   | `tools`          | Offers callable tools.                                  |
| Server   | `logging`        | Provides structured log messages.                       |
| Server   | `experimental`   | Non-standard experimental features.                     |

### Operation

During the operation phase, the client and server exchange messages based on the negotiated capabilities. Both parties **SHOULD**:

- Respect the negotiated protocol version.
- Only use successfully negotiated capabilities.

### Shutdown

The shutdown phase involves one side cleanly terminating the protocol connection. No specific shutdown messages are defined; the underlying transport mechanism is used.

#### Stdio Transport

1. The client **SHOULD** close the input stream to the server process.
2. Wait for the server to exit, or send `SIGTERM` if it does not exit in time.
3. Send `SIGKILL` if the server does not exit after `SIGTERM`.

#### HTTP Transport

- Shutdown is indicated by closing the associated HTTP connection(s).

## Error Handling

Implementations **SHOULD** handle the following errors:

- Protocol version mismatch.
- Failure to negotiate required capabilities.
- Timeout during initialization or shutdown.

Example error response for unsupported protocol version:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Unsupported protocol version",
    "data": {
      "supported": ["2024-11-05"],
      "requested": "1.0.0"
    }
  }
}
```
```


Here is the information converted into Markdown format for easier readability:

```markdown
# Messages in the Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

All messages in MCP **MUST** follow the JSON-RPC 2.0 specification. The protocol defines three types of messages:

---

## **1. Requests**

Requests are sent from the client to the server or vice versa.

### Example Request
```json
{
  "jsonrpc": "2.0",
  "id": "string or number",
  "method": "string",
  "params": {
    "key": "value" // Optional parameters
  }
}
```

### **Key Rules for Requests**
- Requests **MUST** include a string or integer `id`.
- The `id` **MUST NOT** be `null`.
- The request `id` **MUST NOT** have been previously used by the requestor within the same session.

---

## **2. Responses**

Responses are sent in reply to requests.

### Example Response
```json
{
  "jsonrpc": "2.0",
  "id": "string or number",
  "result": {
    "key": "value" // Optional result data
  },
  "error": {
    "code": "integer",
    "message": "string",
    "data": "optional data"
  }
}
```

### **Key Rules for Responses**
- Responses **MUST** include the same `id` as the corresponding request.
- Either a `result` or an `error` **MUST** be set. A response **MUST NOT** set both.
- Error codes **MUST** be integers.

---

## **3. Notifications**

Notifications are sent from the client to the server or vice versa and do not expect a response.

### Example Notification
```json
{
  "jsonrpc": "2.0",
  "method": "string",
  "params": {
    "key": "value" // Optional parameters
  }
}
```

### **Key Rules for Notifications**
- Notifications **MUST NOT** include an `id`.

---

This structure ensures consistent communication between clients and servers in MCP.



# Lifecycle in Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

The Model Context Protocol (MCP) defines a rigorous lifecycle for client-server connections, ensuring proper capability negotiation and state management. The lifecycle includes three main phases:

1. **Initialization**: Capability negotiation and protocol version agreement  
2. **Operation**: Normal protocol communication  
3. **Shutdown**: Graceful termination of the connection  

---

## Lifecycle Phases

### **1. Initialization Phase**

The **initialization phase** MUST be the first interaction between the client and server. During this phase, the client and server:

- Establish protocol version compatibility  
- Exchange and negotiate capabilities  
- Share implementation details  

#### **Client Initialization Request**
The client initiates this phase by sending an `initialize` request containing:
- Supported protocol version  
- Client capabilities  
- Client implementation information  

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "ExampleClient",
      "version": "1.0.0"
    }
  }
}
```

#### **Server Response**
The server responds with its own capabilities and information:

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "ExampleServer",
      "version": "1.0.0"
    }
  }
}
```

#### **Client Initialized Notification**
After successful initialization, the client sends an `initialized` notification:

**Example Notification:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

#### **Rules for Initialization**
- The client **SHOULD NOT** send requests (except pings) before receiving the server's response to the `initialize` request.  
- The server **SHOULD NOT** send requests (except pings or logging) before receiving the `initialized` notification.

---

### **2. Version Negotiation**
- The client **MUST** send a supported protocol version in the `initialize` request. This SHOULD be the latest version supported by the client.  
- If the server supports the requested version, it **MUST** respond with the same version. Otherwise, it responds with another supported version.  
- If the client does not support the server's response version, it **SHOULD** disconnect.

---

### **3. Capability Negotiation**
Client and server capabilities establish which optional protocol features will be available during the session.

#### **Key Capabilities**
| **Category** | **Capability**   | **Description**                          |
|--------------|------------------|------------------------------------------|
| Client       | `roots`          | Ability to provide filesystem roots      |
| Client       | `sampling`       | Support for LLM sampling requests        |
| Client       | `experimental`   | Describes support for experimental features |
| Server       | `prompts`        | Offers prompt templates                  |
| Server       | `resources`      | Provides readable resources              |
| Server       | `tools`          | Exposes callable tools                   |
| Server       | `logging`        | Emits structured log messages            |
| Server       | `experimental`   | Describes support for experimental features |

#### **Sub-Capabilities**
- `listChanged`: Support for list change notifications (prompts, resources, tools)  
- `subscribe`: Support for subscribing to changes in individual items (resources only)  

---

## **Operation Phase**
During the **operation phase**, the client and server exchange messages based on the negotiated capabilities. Both parties **SHOULD**:
- Respect the negotiated protocol version  
- Use only successfully negotiated capabilities  

---

## **Shutdown Phase**
During the **shutdown phase**, one side (usually the client) terminates the protocol connection cleanly. No specific shutdown messages are defined—shutdown is signaled via the transport mechanism.

### **Transport-Specific Shutdown Procedures**

#### **Stdio Transport**
- The client initiates shutdown by:
  1. Closing the input stream to the server process.
  2. Waiting for the server to exit.
  3. Sending `SIGTERM` if the server does not exit within a reasonable time.
  4. Sending `SIGKILL` if the server does not exit after `SIGTERM`.  

- The server MAY initiate shutdown by closing its output stream to the client and exiting.

#### **HTTP Transport**
- Shutdown is indicated by closing the associated HTTP connections.

---

## **Error Handling**
Implementations **SHOULD** handle these error cases:
- Protocol version mismatch  
- Failure to negotiate required capabilities  
- `Initialize` request timeout  
- Shutdown timeout  

### **Example Initialization Error**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Unsupported protocol version",
    "data": {
      "supported": ["2024-11-05"],
      "requested": "1.0.0"
    }
  }
}
```

Implementations **SHOULD** include timeouts to prevent hung connections and resource exhaustion.


Here is the content reformatted in Markdown:

```markdown
# Transports in Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

MCP defines two standard transport mechanisms for client-server communication:

1. **stdio**: Communication over standard input (stdin) and standard output (stdout).  
2. **HTTP with Server-Sent Events (SSE)**: Communication using HTTP and SSE for real-time updates.  

Clients **SHOULD** support `stdio` whenever possible.  
Custom transports can also be implemented in a pluggable fashion.

---

## Standard Transports

### **1. stdio**
In the **stdio** transport:
- The client launches the MCP server as a subprocess.
- The server receives JSON-RPC messages via its **stdin** and writes responses to **stdout**.
- Messages are delimited by newlines and **MUST NOT** contain embedded newlines.
- The server **MAY** write UTF-8 logs to its **stderr**, which the client can capture, forward, or ignore.
- The server **MUST NOT** write anything to **stdout** that is not a valid MCP message.
- The client **MUST NOT** write anything to the server’s **stdin** that is not a valid MCP message.

#### **Stdio Communication Flow**
1. The client launches the server as a subprocess.  
2. Messages are exchanged between the client (via **stdin**) and the server (via **stdout**).  
3. The client can optionally capture logs from the server’s **stderr**.  
4. The client closes **stdin** and terminates the subprocess to end communication.  

---

### **2. HTTP with Server-Sent Events (SSE)**
In the **SSE** transport:
- The server operates as an independent process, capable of handling multiple client connections.

#### **Server Requirements**
The server **MUST** provide two HTTP endpoints:
1. **SSE Endpoint**: Allows clients to establish a connection and receive messages from the server.  
2. **HTTP POST Endpoint**: Enables clients to send messages to the server.  

#### **SSE Communication Flow**
1. The client opens an SSE connection to the server.
2. Upon connection, the server sends an **endpoint event** containing a URI for the client to use for sending messages.  
3. The client sends subsequent messages as HTTP POST requests to the provided endpoint.  
4. The server sends messages to the client as SSE **message events**, with message content encoded as JSON in the event data.  
5. The client or server closes the SSE connection to terminate communication.  

---

## Custom Transports
Clients and servers **MAY** implement additional custom transport mechanisms to suit specific needs. MCP is transport-agnostic and can be implemented over any communication channel supporting bidirectional message exchange.

#### **Requirements for Custom Transports**
- **Preserve JSON-RPC Message Format**: Custom transports **MUST** adhere to the JSON-RPC message format and lifecycle requirements defined by MCP.  
- **Document Custom Patterns**: Implementers **SHOULD** document their connection establishment and message exchange patterns to ensure interoperability.  


Here is the content reformatted in Markdown:

```markdown
# Versioning in Model Context Protocol (MCP)

The Model Context Protocol (MCP) uses string-based version identifiers in the format **YYYY-MM-DD**, representing the last date that backward-incompatible changes were made.

### **Current Protocol Version**
The current protocol version is **2024-11-05**. See all revisions.

---

## Versioning Principles

- **Backward Compatibility**: The protocol version will **NOT** be incremented for updates that maintain backward compatibility. This allows for incremental improvements while ensuring interoperability.
- **Version Negotiation**:
  - Version negotiation occurs during the initialization phase.
  - Clients and servers **MAY** support multiple protocol versions simultaneously.
  - Clients and servers **MUST** agree on a single protocol version to use for a session.

---

## Error Handling for Version Negotiation

If version negotiation fails:
- The protocol provides appropriate error handling mechanisms.
- Clients can gracefully terminate connections if a compatible protocol version cannot be found.


Here is the content reformatted in Markdown:

```markdown
# Ping in Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

The Model Context Protocol includes an optional ping mechanism to verify that the connection between the client and server is alive and responsive.

---

## Overview

The ping mechanism is implemented using a simple request/response pattern. Both the client and server can initiate a ping by sending a **ping request**.

---

## Message Format

### **Ping Request**
A ping request is a JSON-RPC request with no parameters:
```json
{
  "jsonrpc": "2.0",
  "id": "123",
  "method": "ping"
}
```

### **Ping Response**
The receiver **MUST** respond with an empty response:
```json
{
  "jsonrpc": "2.0",
  "id": "123",
  "result": {}
}
```

---

## Behavior Requirements

- If no response is received within a reasonable timeout period, the sender **MAY**:
  - Consider the connection stale
  - Terminate the connection
  - Attempt reconnection procedures

---

## Usage Patterns

1. **Sender** sends a ping request.
2. **Receiver** promptly replies with an empty response.

---

## Implementation Considerations

- **Periodic Pings**: Implementations **SHOULD** issue periodic pings to monitor connection health.
- **Configurable Frequency**: The frequency of pings **SHOULD** be configurable.
- **Timeout Settings**: Timeouts **SHOULD** be set appropriately for the network environment.
- **Avoid Excessive Pinging**: To reduce network overhead, excessive pinging **SHOULD** be avoided.

---

## Error Handling

- **Timeouts**: Timeouts **SHOULD** be treated as connection failures.
- **Connection Reset**: Multiple failed pings **MAY** trigger a connection reset.
- **Logging**: Implementations **SHOULD** log ping failures for diagnostic purposes.

Here is the content reformatted in Markdown:

```markdown
# Cancellation in Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

The Model Context Protocol supports optional cancellation of in-progress requests via notification messages. Either the client or server can send a cancellation notification to terminate a previously issued request.

---

## Cancellation Flow

To cancel an in-progress request, a party sends a `notifications/cancelled` notification containing:

- **`requestId`**: The ID of the request to cancel.
- **`reason`** (optional): A string for logging or display purposes.

### Example Cancellation Notification:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": "123",
    "reason": "User requested cancellation"
  }
}
```

---

## Behavior Requirements

### Cancellation Notifications
- **MUST** reference requests that:
  - Were issued in the same direction.
  - Are believed to still be in-progress.
- **MUST NOT** cancel the `initialize` request.

### Receivers of Cancellation Notifications
- **SHOULD**:
  - Stop processing the cancelled request.
  - Free any resources associated with the cancelled request.
  - Avoid sending a response for the cancelled request.
- **MAY** ignore cancellation notifications if:
  - The referenced request is unknown.
  - Processing is already complete.
  - The request cannot be cancelled.

### Senders of Cancellation Notifications
- **SHOULD** ignore any response to the cancelled request if it arrives afterward.

---

## Timing Considerations

Due to network latency, cancellation notifications may:
- Arrive after request processing is complete.
- Arrive after a response has already been sent.

Both the client and server **MUST** handle these race conditions gracefully.

---

## Example Workflow

1. **Request Initiated**:
   - A client or server sends a request (`ID: 123`).
2. **Cancellation Notification**:
   - A `notifications/cancelled` message is sent (`ID: 123`).
3. **Handling Cancellation**:
   - If processing is incomplete, stop the operation and free resources.
   - If processing is already complete, ignore the notification.

---

## Implementation Notes

- **Logging**: Both parties **SHOULD** log cancellation reasons for debugging purposes.
- **UI Feedback**: Applications **SHOULD** provide visual feedback when cancellation is requested.

---

## Error Handling

Cancellation notifications **SHOULD** be ignored if they:
- Reference unknown request IDs.
- Reference requests that have already completed.
- Are malformed.

This ensures the "fire and forget" nature of notifications while accounting for race conditions in asynchronous communication.


Here is the content reformatted in Markdown:

```markdown
# Progress Tracking in Model Context Protocol (MCP)

**Protocol Revision**: 2024-11-05

The Model Context Protocol supports optional progress tracking for long-running operations using notification messages. Both clients and servers can send progress notifications to provide updates on the status of ongoing operations.

---

## Progress Flow

### Including a Progress Token
To track progress for a request, the sender includes a `progressToken` in the request metadata.

- **Progress tokens** MUST be a string or integer.
- **Progress tokens** MUST be unique across all active requests.

#### Example Request with Progress Token:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "some_method",
  "params": {
    "_meta": {
      "progressToken": "abc123"
    }
  }
}
```

### Sending Progress Notifications
The receiver of the request MAY send progress notifications that include:
- The **progressToken** from the original request.
- The **current progress** value so far.
- An optional **total** value, if known.

#### Example Progress Notification:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "abc123",
    "progress": 50,
    "total": 100
  }
}
```

### Key Rules for Progress Notifications:
- The **progress** value MUST increase with each notification.
- The **total** value is optional and MAY be omitted if unknown.
- Both **progress** and **total** values MAY be floating-point numbers.

---

## Behavior Requirements

### Progress Notifications
- MUST reference tokens provided in active requests.
- MUST relate to in-progress operations.

### Receivers of Progress Requests
- **MAY** choose not to send progress notifications.
- **MAY** send notifications at any frequency deemed appropriate.
- **MAY** omit the **total** value if it is unknown.

---

## Example Workflow

1. **Request Initiated**:
   - A method request is sent with a `progressToken`.
2. **Progress Updates**:
   - The receiver sends periodic progress notifications, e.g.:
     - Progress: 0.2/1.0
     - Progress: 0.6/1.0
     - Progress: 1.0/1.0
3. **Completion**:
   - A response is sent when the operation is complete.

---

## Implementation Notes

- **Tracking**: Both senders and receivers **SHOULD** maintain a record of active progress tokens.
- **Rate Limiting**: Both parties **SHOULD** implement rate limiting to prevent flooding the connection with notifications.
- **Completion**: Progress notifications **MUST** stop after the operation completes.

---

## Example Timeline

```plaintext
Sender          Receiver
------          --------
Request with progressToken ("abc123")
                Progress notification (0.2/1.0)
                Progress notification (0.6/1.0)
                Progress notification (1.0/1.0)
Response (operation complete)
```



