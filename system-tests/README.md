# System Tests

This directory contains Cypress end-to-end tests for the Charm-MCP application.

## Prerequisites

1. **Docker**: Must be running for all services:
   - Ollama (with deepseek-coder:latest and llama3.2 models)


2. **Node.js**: For running the backend and frontend services

## Setup from project root

1. Install dependencies:
   ```bash
   npm run install:mcp-servers
   npm run build:mcp-servers
   npm install
   ```

## Running Tests

1. Start services in system-tests directory:
   ```bash
   npm run start:services
   ```

2. Run tests:
   ```bash
   npm run test:e2e
   ```

### Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:auto

# Open Cypress UI
npm run test:e2e:open
```

## Services

The tests require the following services to be running:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Ollama**: http://localhost:11434 (via Docker)

Managed by the mcp service
- **Python MCP**: http://localhost:3002
- **R MCP**: http://localhost:3003

## Docker Containers

The following Docker containers are automatically managed:

- **ollama-test**: Runs Ollama with required models
- **python-mcp-test**: Python MCP server
- **r-mcp-test**: R MCP server
