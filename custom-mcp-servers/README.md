# Getting Started with Custom MCP Servers

This guide walks you through setting up and running the custom MCP (Model Context Protocol) servers in this repository.

## Contents
- [Prerequisites](#prerequisites)
- [Automated Setup](#automated-setup)
- [Manual Setup](#manual-setup)
  - [Build MCP Servers](#build-mcp-servers)
  - [Build Docker Images](#build-docker-images)
- [Using the LLM Service](#using-the-llm-service)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your machine
  - For Mac: Install [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
  - For Windows: Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
  - For Linux: Install [Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/)
  - After installation, make sure to start Docker Desktop or the Docker daemon
- Git repository cloned locally
- Node.js and npm installed

## Automated Setup

The simplest way to set up all custom MCP servers is to use the provided bash script:

```bash
# From the repository root
chmod +x custom-mcp-servers/build-all-mcps.sh
./custom-mcp-servers/build-all-mcps.sh
```

This script handles the entire setup process:
- Checks if Docker is running and starts it if needed
- Installs dependencies for all MCP servers
- Builds all MCP servers (TypeScript compilation)
- Builds the Docker images for both Python and R MCPs

## Manual Setup

If you prefer to set up the servers step by step, follow these instructions:

### Build MCP Servers

1. **Ensure Docker is Running**
   
   Before building any Docker images, make sure Docker Desktop is running:
   ```bash
   open -a Docker
   ```
   Wait for Docker Desktop to start completely.

2. **Install and Build MCP Server Code**
   
   From the repository root, run:
   ```bash
   # Install dependencies for all MCP servers
   npm run install:mcp-servers
   
   # Build all MCP servers
   npm run build:mcp-servers
   ```
   
   Alternatively, to build everything (MCP servers and main application):
   ```bash
   npm run build:all
   ```

### Build Docker Images

#### Python MCP

1. **Build the Python MCP Docker Image**
   
   ```bash
   cd custom-mcp-servers/python-mcp
   docker build -t my-python-mcp .
   ```
   This process may take several minutes as it installs all required dependencies.

2. **Verify the Build**
   
   ```bash
   docker images
   ```
   You should see `my-python-mcp` in the list of available images.

#### R MCP

1. **Build the R MCP Docker Image**
   
   ```bash
   cd custom-mcp-servers/r-mcp
   docker build --platform linux/amd64 -t my-r-mcp .
   ```
   This process may take a long time (potentially 30+ minutes) as it installs R and all required packages. The `--platform linux/amd64` flag ensures compatibility.

2. **Verify the Build**
   
   ```bash
   docker images
   ```
   You should see `my-r-mcp` in the list of available images.

## Using the LLM Service

Charm MCP includes a centralized LLM Service that your custom MCP servers can use. This provides managed access to language models like Claude without needing to implement API integrations in each MCP.

### Configuration

1. **Environment Variables**

   Set the `MCP_AUTH_TOKEN` environment variable in your `.env` file (in the project root):
   ```
   MCP_AUTH_TOKEN=your-auth-token-here
   ```
   This token is used to authenticate requests to the LLM Service.

2. **TypeScript Configuration (for TypeScript MCPs)**

   If you're developing a TypeScript MCP server, you'll need to configure your `tsconfig.json` to import the shared helper library:

   ```json
   {
     "compilerOptions": {
       // ... other options
       "rootDirs": ["./src", "../mcp-helpers"],
       // ... other options
     },
     "include": ["src/**/*", "../mcp-helpers/**/*"],
     "exclude": ["node_modules"]
   }
   ```

   This allows your MCP to import the LLM client from the shared helpers directory.

3. **Client Usage**

   Import and use the LLM client in your MCP server:

   ```typescript
   import { LLMClient } from "../../mcp-helpers/llm-client.js";

   // Initialize the client
   const llmClient = new LLMClient({
     mcpName: 'your-mcp-name', // Identifies your MCP in logs
     retries: 3 // Number of retry attempts for failed requests
   });

   // Use the client for LLM queries
   const response = await llmClient.query({
     prompt: "Your prompt here",
     responseFormat: 'text'
   });
   ```

   The client handles authentication, retries, and error handling automatically.

## Next Steps

Now that you have the MCP servers and Docker images built, you can:

- Run the containers
- Develop and test your MCP implementations
- Make modifications to the codebase as needed

## Troubleshooting

### General Issues

- If you see an error about Docker daemon not running, make sure Docker Desktop is started
- If build fails due to network issues, check your internet connection and try again

### Python MCP Issues

- For Mac with Apple Silicon (M1/M2/M3), ensure Rosetta is installed if required by Docker

### R MCP Issues

- If the build process is interrupted, you can simply run the build command again - Docker will use cached layers when possible
- If you encounter memory issues during the build, try increasing the resources allocated to Docker in Docker Desktop settings
- For Mac with Apple Silicon (M1/M2/M3), the `--platform linux/amd64` flag is essential for compatibility

### LLM Service Issues

- If you get "Unauthorized" errors when using the LLM client, verify your `MCP_AUTH_TOKEN` is set correctly
- If imports from `mcp-helpers` fail with TypeScript errors, check your `tsconfig.json` configuration
- For testing, you can directly access the LLM service with curl:
  ```bash
  source .env && curl -X POST http://localhost:3001/api/internal/llm/query \
    -H "Content-Type: application/json" \
    -H "X-MCP-Auth: $MCP_AUTH_TOKEN" \
    -H "X-MCP-Name: test-client" \
    -d '{"prompt": "Your prompt here", "responseFormat": "text"}'
  ``` 