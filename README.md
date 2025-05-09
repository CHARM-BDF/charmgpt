# Getting Started with Custom MCP Servers

This guide walks you through setting up and running the custom MCP (Model Context Protocol) servers in this repository.

## Contents
- [Prerequisites](#prerequisites)
- [Automated Setup](#automated-setup)
- [Manual Setup](#manual-setup)
  - [Build MCP Servers](#build-mcp-servers)
  - [Build Docker Images](#build-docker-images)
- [Running the Application](#running-the-application)
  - [Start the Application](#start-the-application)
  - [Access the Application](#access-the-application)
- [Environment Variables](#environment-variables)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your machine
  - For Mac: Install [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
  - For Windows: Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
  - For Linux: Install [Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/)
  - After installation, make sure to start Docker Desktop or the Docker daemon
- Git repository cloned locally
- Node.js (v16 or later) and npm installed

## Automated Setup

The simplest way to set up all custom MCP servers is to use the provided bash script:

```bash
# From the repository root
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

## Running the Application

After setting up the MCP servers and Docker images, you'll need to install the main application dependencies and start the application.

### Install Main Application Dependencies

From the repository root, run:

```bash
# Install all dependencies for the main application
npm install
```

### Start the Application

The application consists of a frontend and a backend server. You can start both simultaneously using:

```bash
# Start both the frontend and backend server
npm start
```

This command runs:
- The Vite development server for the frontend
- The backend server that manages MCP servers and handles API requests

Alternatively, you can run them separately:

```bash
# Start just the frontend
npm run dev

# Start just the backend server
npm run server:dev
```

### Access the Application

Once started, the application will be available at:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env` file in the root directory with the following variables (as needed):

```
# Server Configuration
PORT=3000
NODE_ENV=development

# Brave Search API (for brave-search MCP server)
BRAVE_API_KEY=your_brave_api_key_here

# PubMed/NCBI (for pubmed MCP server)
NCBI_API_KEY=your_ncbi_api_key_here
NCBI_TOOL_EMAIL=your_email@example.com

# Other API keys may be required depending on which MCP servers you use
```

## Next Steps

Now that you have the application running, you can:

- Create new conversations in the UI
- Utilize the various MCP servers through the interface
- Develop and test your MCP implementations
- Make modifications to the codebase as needed

## Troubleshooting

### General Issues

- If you see an error about Docker daemon not running, make sure Docker Desktop is started
- If build fails due to network issues, check your internet connection and try again
- If the application doesn't start, check that all dependencies are installed with `npm install`

### Debug Logging Utility

Located in `src/utils/debug.ts`, this utility helps collect and organize debug logs for easier troubleshooting.

#### Usage:

1. In Browser DevTools Console:
```javascript
// Start collecting logs
const stop = collectDebugLogs();

// Perform actions you want to debug
// ... do your actions ...

// Stop and display collected logs
const logs = stop();
```

2. Logs are automatically categorized by type:
- State Updates: `[STATE UPDATE]`
- Stream Debug: `[STREAM DEBUG]`
- Final Debug: `[FINAL DEBUG]`
- ID Debug: `[ID DEBUG]`
- ChatStore: `ChatStore:`
- Errors: `Error:`

#### Server Logs

Server-side logs are automatically saved to the `./logs` directory:
- Application logs: `./logs/app.log`
- Error logs: `./logs/error.log`
- Debug logs: `./logs/debug.log`

These log files are useful for debugging server-side issues or when the browser console isn't sufficient.

#### Adding Custom Logging:

To make your logs work with this utility, use these prefixes in your `console.log` calls:
```javascript
console.log('[STATE UPDATE: yourCategory]', { your: 'data' });
console.log('[STREAM DEBUG]', 'your message');
```

The utility will automatically collect and group these logs for easier debugging.

#### Benefits:
- Organized, categorized log output
- Easier tracking of state changes
- Simplified debugging of async operations
- Clean console output for specific debugging tasks

### MCP Server Issues

- If an MCP server fails to start, check its logs in the console output
- Ensure that all required environment variables are set (check `.env` files if they exist)
- For TypeScript errors, try rebuilding with `npm run build:mcp-servers`

### Python MCP Issues

- For Mac with Apple Silicon (M1/M2/M3), ensure Rosetta is installed if required by Docker

### R MCP Issues

- If the build process is interrupted, you can simply run the build command again - Docker will use cached layers when possible
- If you encounter memory issues during the build, try increasing the resources allocated to Docker in Docker Desktop settings
- For Mac with Apple Silicon (M1/M2/M3), the `--platform linux/amd64` flag is essential for compatibility

### Building and Running

```bash
# Build the project
npm run build

# Run with CalDAV backend (default)
npm start

# Run with EventKit backend 
CAL_BACKEND=eventkit npm start
```

## Tools

The server provides the following MCP tools:

### 1. `list_calendars`

Lists all available calendars from the configured calendar source.

Example usage:
```javascript
const response = await mcpClient.callTool('list_calendars', {});
```

### 2. `get_calendar_events`

Gets events from a specified calendar within a date range.

Parameters:
- `calendarId` (optional): ID of the calendar to get events from
- `start` (optional): Start date in ISO format (defaults to today)
- `end` (optional): End date in ISO format (defaults to 7 days from start)
- `query` (optional): Search query to filter events by title, description, or location

Example usage:
```javascript
const response = await mcpClient.callTool('get_calendar_events', {
  calendarId: 'https://caldav.example.com/calendars/user/calendar/',
  start: '2023-10-01T00:00:00Z',
  end: '2023-10-31T23:59:59Z',
  query: 'meeting'
});
```

## Troubleshooting

- **Connection Issues**: Ensure your credentials are correct and the server URL is accessible
- **Authentication Failures**: Some providers may require app-specific passwords or other authentication methods
- **Empty Calendar List**: Verify that you have permissions to access the calendars on the server
- **EventKit Permissions**: If using EventKit, make sure you've run the helper once manually to grant permissions 