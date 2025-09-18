/**
 * Transport Factory for MCP Clients
 * Handles creation of both local and remote transports
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ServerConfig, LocalServerConfig, RemoteServerConfig, TransportInfo } from '../types/mcp.js';

export class TransportFactory {
  /**
   * Creates the appropriate transport based on server configuration
   */
  static createTransport(serverName: string, config: ServerConfig): TransportInfo {
    if (config.type === 'remote') {
      return this.createRemoteTransport(serverName, config as RemoteServerConfig);
    } else {
      return this.createLocalTransport(serverName, config as LocalServerConfig);
    }
  }

  /**
   * Creates a local stdio transport for spawned processes
   */
  private static createLocalTransport(serverName: string, config: LocalServerConfig): TransportInfo {
    console.log(`[TransportFactory] Creating local transport for ${serverName}`);
    
    // Handle relative paths in args
    const modifiedArgs = config.args.map(arg => {
      if (arg.startsWith('./node_modules/')) {
        return arg.replace('./', '');
      }
      return arg;
    });

    const transport = new StdioClientTransport({
      command: config.command,
      args: modifiedArgs,
      env: {
        ...config.env,
        ...Object.fromEntries(
          Object.entries(process.env).filter(([, v]) => v !== undefined)
        ) as Record<string, string>
      }
    });

    return {
      transport,
      isRemote: false,
      serverConfig: config
    };
  }

  /**
   * Creates a remote transport (SSE or WebSocket)
   */
  private static createRemoteTransport(serverName: string, config: RemoteServerConfig): TransportInfo {
    console.log(`[TransportFactory] Creating remote ${config.transport} transport for ${serverName} at ${config.url}`);
    
    const url = new URL(config.url);
    
    // Add authentication headers if provided
    if (config.auth) {
      this.addAuthToUrl(url, config.auth);
    }

    let transport;
    
    if (config.transport === 'sse') {
      transport = new SSEClientTransport(url);
    } else if (config.transport === 'websocket') {
      transport = new WebSocketClientTransport(url);
    } else if (config.transport === 'http') {
      transport = new StreamableHTTPClientTransport(url);
    } else {
      throw new Error(`Unsupported remote transport type: ${config.transport}`);
    }

    // Add authentication handling for remote transports
    if (config.auth && transport) {
      this.configureTransportAuth(transport, config.auth);
    }

    return {
      transport,
      isRemote: true,
      serverConfig: config
    };
  }

  /**
   * Adds authentication parameters to URL (for query-based auth)
   */
  private static addAuthToUrl(url: URL, auth: RemoteServerConfig['auth']): void {
    if (!auth) return;

    switch (auth.type) {
      case 'api-key':
        if (auth.apiKey) {
          url.searchParams.set('api_key', auth.apiKey);
        }
        break;
      // Bearer and header auth are handled in transport configuration
    }
  }

  /**
   * Configures transport-level authentication
   */
  private static configureTransportAuth(transport: unknown, auth: RemoteServerConfig['auth']): void {
    if (!auth) return;

    // For SSE and WebSocket transports, we might need to override send methods
    // to add authentication headers. This is a simplified approach.
    const originalSend = (transport as { send?: (message: unknown) => Promise<void> }).send?.bind(transport);
    
    if (originalSend && (auth.type === 'bearer' || auth.type === 'header')) {
      (transport as { send: (message: unknown) => Promise<void> }).send = async function(message: unknown) {
        // For now, we'll rely on the server to handle auth via URL params or initial handshake
        // More sophisticated auth handling can be added later
        return originalSend(message);
      };
    }
  }

  /**
   * Validates server configuration
   */
  static validateConfig(serverName: string, config: ServerConfig): void {
    if (config.type === 'remote') {
      const remoteConfig = config as RemoteServerConfig;
      
      if (!remoteConfig.url) {
        throw new Error(`Remote server ${serverName} missing required 'url' field`);
      }
      
      if (!remoteConfig.transport || !['sse', 'websocket', 'http'].includes(remoteConfig.transport)) {
        throw new Error(`Remote server ${serverName} must specify transport as 'sse', 'websocket', or 'http'`);
      }

      try {
        new URL(remoteConfig.url);
      } catch {
        throw new Error(`Remote server ${serverName} has invalid URL: ${remoteConfig.url}`);
      }
    } else {
      const localConfig = config as LocalServerConfig;
      
      if (!localConfig.command) {
        throw new Error(`Local server ${serverName} missing required 'command' field`);
      }
      
      if (!localConfig.args || !Array.isArray(localConfig.args)) {
        throw new Error(`Local server ${serverName} missing required 'args' array`);
      }
    }
  }
}
