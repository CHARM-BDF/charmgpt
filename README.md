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