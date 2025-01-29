import { spawn, ChildProcess } from 'child_process';
import { readFileSync } from 'fs';

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

class MCPServerManager {
  private servers: Map<string, ChildProcess> = new Map();
  private serverTools: Map<string, any[]> = new Map();
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  private loadConfig(): MCPServersConfig {
    try {
      const configContent = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configContent) as MCPServersConfig;
      
      // Modify paths to be relative to project root
      Object.values(config.mcpServers).forEach((server: MCPServerConfig) => {
        if (server.args) {
          server.args = server.args.map((arg: string) => {
            if (arg.startsWith('./node_modules/')) {
              return arg.replace('./', '');
            }
            return arg;
          });
        }
      });
      
      return config;
    } catch (error) {
      console.error('Failed to load MCP server config');
      throw error;
    }
  }

  async startAllServers(): Promise<void> {
    const config = this.loadConfig();

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        await this.startServer(serverName, serverConfig);
      } catch (error) {
        console.error(`Failed to start MCP server ${serverName}`);
      }
    }

    // Set up cleanup handler for graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down MCP servers...');
      await this.stopAllServers();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down MCP servers...');
      await this.stopAllServers();
      process.exit(0);
    });
  }

  private async startServer(serverName: string, config: MCPServerConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Starting MCP server: ${serverName}`);
        
        const serverProcess = spawn(config.command, config.args, {
          env: {
            ...process.env,
            ...config.env
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Handle server output - only log errors and critical status changes
        serverProcess.stdout?.on('data', (data) => {
          // Only log startup and critical operational messages
          const message = data.toString().trim();
          if (message.includes('Server started') || message.includes('Initialization complete')) {
            console.log(`[${serverName}] ${message}`);
          }
        });

        serverProcess.stderr?.on('data', (data) => {
          const message = data.toString().trim();
          // Only log actual errors, not status messages
          if (!message.includes('running on stdio') && !message.includes('Allowed directories')) {
            console.error(`[${serverName}] Error: ${message}`);
          }
        });

        // Handle server exit
        serverProcess.on('error', (error) => {
          console.error(`[${serverName}] Failed to start:`, error);
          reject(error);
        });

        serverProcess.on('exit', (code, signal) => {
          if (code !== null && code !== 0) {
            console.log(`[${serverName}] exited with code ${code}`);
          } else if (signal !== null) {
            console.log(`[${serverName}] was terminated with signal ${signal}`);
          }
          this.servers.delete(serverName);
        });

        // Store the server process
        this.servers.set(serverName, serverProcess);
        
        // Wait a bit to ensure the server starts properly
        setTimeout(() => {
          if (serverProcess.exitCode === null) {
            console.log(`MCP server ${serverName} started successfully`);
            resolve();
          } else {
            reject(new Error(`Server ${serverName} failed to start`));
          }
        }, 1000);

      } catch (error) {
        reject(error);
      }
    });
  }

  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.entries()).map(([serverName, process]) => 
      this.stopServer(serverName, process)
    );

    await Promise.all(stopPromises);
    console.log('All MCP servers stopped');
  }

  private async stopServer(serverName: string, process: ChildProcess): Promise<void> {
    return new Promise((resolve) => {
      console.log(`Stopping MCP server: ${serverName}`);

      // First try SIGTERM for graceful shutdown
      process.kill('SIGTERM');

      // Give it some time to shut down gracefully
      const forceKillTimeout = setTimeout(() => {
        if (!process.killed) {
          console.log(`Force killing MCP server: ${serverName}`);
          process.kill('SIGKILL');
        }
      }, 5000);

      process.on('exit', () => {
        clearTimeout(forceKillTimeout);
        this.servers.delete(serverName);
        resolve();
      });
    });
  }

  isServerRunning(serverName: string): boolean {
    const process = this.servers.get(serverName);
    return process !== undefined && process.exitCode === null;
  }

  getServerNames(): string[] {
    const config = this.loadConfig();
    return Object.keys(config.mcpServers);
  }

  async fetchServerTools(serverName: string): Promise<any[] | undefined> {
    const serverProcess = this.servers.get(serverName);
    if (!serverProcess || serverProcess.exitCode !== null) {
      return undefined;
    }

    return new Promise((resolve) => {
      const responseHandler = (data: Buffer) => {
        const message = data.toString().trim();
        try {
          const parsed = JSON.parse(message);
          if (parsed.result?.tools) {
            this.serverTools.set(serverName, parsed.result.tools);
            serverProcess.stdout?.removeListener('data', responseHandler);
            resolve(parsed.result.tools);
          }
        } catch (e) {
          // Not JSON or not the response we're looking for
        }
      };

      serverProcess.stdout?.on('data', responseHandler);

      // Initialize the server and request tools
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          },
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          }
        }
      }) + "\n");

      setTimeout(() => {
        serverProcess.stdin?.write(JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {}
        }) + "\n");
      }, 500);

      // Set a timeout to resolve with undefined if we don't get a response
      setTimeout(() => {
        serverProcess.stdout?.removeListener('data', responseHandler);
        resolve(undefined);
      }, 5000);
    });
  }

  getServerTools(serverName: string): any[] | undefined {
    return this.serverTools.get(serverName);
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<any> {
    const serverProcess = this.servers.get(serverName);
    if (!serverProcess || serverProcess.exitCode !== null) {
      throw new Error(`Server ${serverName} is not running`);
    }

    return new Promise((resolve, reject) => {
      const responseHandler = (data: Buffer) => {
        const message = data.toString().trim();
        try {
          const parsed = JSON.parse(message);
          // Check if this is the response to our tool call
          if (parsed.id === 3) { // We use id 3 for tool calls
            serverProcess.stdout?.removeListener('data', responseHandler);
            if (parsed.error) {
              reject(new Error(parsed.error.message));
            } else {
              resolve(parsed.result);
            }
          }
        } catch (e) {
          // Not JSON or not the response we're looking for
        }
      };

      serverProcess.stdout?.on('data', responseHandler);

      // Send the tool call request
      serverProcess.stdin?.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        }
      }) + "\n");

      // Set a timeout to prevent hanging
      setTimeout(() => {
        serverProcess.stdout?.removeListener('data', responseHandler);
        reject(new Error(`Tool call timed out: ${serverName}/${toolName}`));
      }, 30000); // 30 second timeout
    });
  }
}

export default MCPServerManager; 