```markdown
# Logging

**Protocol Revision**: 2024-11-05

The Model Context Protocol (MCP) provides a standardized way for servers to send structured log messages to clients. Clients can manage logging verbosity by configuring minimum log levels. Log messages include severity levels, optional logger names, and JSON-serializable data.

---

## User Interaction Model

Logging can be exposed through any user interface pattern. The protocol does not mandate a specific interaction model.

---

## Capabilities

Servers that support logging MUST declare the `logging` capability during initialization:

```json
{
  "capabilities": {
    "logging": {}
  }
}
```

---

## Log Levels

The protocol adheres to the syslog severity levels defined in **RFC 5424**:

| **Level**     | **Description**                   | **Example Use Case**                  |
|---------------|-----------------------------------|---------------------------------------|
| `debug`       | Detailed debugging information    | Function entry/exit points            |
| `info`        | General informational messages    | Operation progress updates            |
| `notice`      | Normal but significant events     | Configuration changes                 |
| `warning`     | Warning conditions                | Deprecated feature usage              |
| `error`       | Error conditions                  | Operation failures                    |
| `critical`    | Critical conditions               | System component failures             |
| `alert`       | Immediate action required         | Data corruption detected              |
| `emergency`   | System is unusable                | Complete system failure               |

---

## Protocol Messages

### 1. **Setting Log Level**

Clients can configure the minimum log level by sending a `logging/setLevel` request:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "logging/setLevel",
  "params": {
    "level": "info"
  }
}
```

**Response:**
An empty result confirms the change.

---

### 2. **Log Message Notifications**

Servers send log messages using the `notifications/message` method:

**Notification Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "error",
    "logger": "database",
    "data": {
      "error": "Connection failed",
      "details": {
        "host": "localhost",
        "port": 5432
      }
    }
  }
}
```

---

## Message Flow

The flow for logging configuration and message notifications is as follows:

1. **Client Configures Log Level**:
   - Client sends a `logging/setLevel` request.
   - Server adjusts the logging level and responds with an empty result.

2. **Server Sends Log Messages**:
   - Based on the configured level, the server sends log messages as notifications (`notifications/message`).

**Message Flow Example**:

- **Client to Server**: `logging/setLevel (info)`
- **Server to Client**: Sends only messages at `info` level or higher.

**Flow Diagram**:
- `logging/setLevel (info)` → Configures log level.
- `notifications/message (info)` → Sends informational log messages.
- `notifications/message (warning)` → Sends warning log messages.
- `logging/setLevel (error)` → Changes log level to `error`.

---

## Error Handling

- **Invalid log level**: `-32602 (Invalid params)`
- **Configuration errors**: `-32603 (Internal error)`

---

## Implementation Considerations

### **Servers SHOULD:**
- Rate limit log messages to avoid flooding.
- Include relevant context in the `data` field.
- Use consistent logger names for easier filtering.
- Remove sensitive or unnecessary information.

### **Clients MAY:**
- Present log messages in the user interface (UI).
- Implement log filtering and search capabilities.
- Display severity visually for better clarity.
- Persist logs for auditing purposes.

---

## Security

**Log messages MUST NOT contain:**
- Credentials or secrets.
- Personal identifying information (PII).
- Internal system details that could aid malicious actors.

**Implementations SHOULD:**
- Rate limit messages to prevent abuse.
- Validate all fields in log messages.
- Control access to logs.
- Monitor and filter sensitive content before logging.

---
