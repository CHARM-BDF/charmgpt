#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execute } from "./tools/execute.js";
import { validateRacketCode } from "./tools/env.js";
import os from "os";

// Logger utility
const logger = {
  info: (message: string, ...args: any[]) => {
    console.error(`\x1b[36m[RACKET-MCP INFO]\x1b[0m ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`\x1b[31m[RACKET-MCP ERROR]\x1b[0m ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.error(`\x1b[35m[RACKET-MCP DEBUG]\x1b[0m ${message}`, ...args);
    }
  }
};

// Define the Racket execution tool
const RACKET_EXECUTION_TOOL = {
  name: "execute_racket",
  description: "Execute Racket code with various capabilities. Supports plotting, math operations, and other Racket packages. " +
    "⚠️ CRITICAL FILE OUTPUT INSTRUCTIONS ⚠️\n" +
    "This runs in a non-interactive environment with strict file output requirements:\n" +
    "1. ALWAYS use (getenv \"OUTPUT_DIR\") for ANY file operations\n" +
    "2. NEVER use relative paths (like 'plot.png') - they will fail\n" +
    "3. ALWAYS use proper file path construction with OUTPUT_DIR\n\n" +
    "Required Pattern for File Outputs:\n" +
    "```racket\n" +
    "#lang racket\n" +
    "(require racket/file)\n" +
    "(define output-dir (getenv \"OUTPUT_DIR\"))\n" +
    "(write-to-file data (build-path output-dir \"data.txt\"))\n" +
    "```\n" +
    "Other Requirements:\n" +
    "- Use (display) or (displayln) for text output\n" +
    "- Return values for data structures\n" +
    "- Maximum execution time: 30 seconds\n" +
    "- Memory limit: 256MB",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Racket code to execute. ⚠️ MUST use (getenv \"OUTPUT_DIR\") for ALL file outputs. Example: (write-to-file data (build-path (getenv \"OUTPUT_DIR\") \"data.txt\"))"
      },
      dataFiles: {
        type: "object",
        description: "Map of variable names to file paths"
      },
      timeout: {
        type: "number",
        description: "Execution timeout in seconds (max 30)",
        default: 30
      }
    },
    required: ["code"]
  }
};

// Initialize MCP server
logger.info("Initializing Racket MCP Server...");
const server = new Server(
  {
    name: "racket-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {}

    },
  }
);
logger.info("Server initialized successfully");

// Handle tool listing requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info("Received tool listing request");
  logger.debug("Available tools:", [RACKET_EXECUTION_TOOL.name]);
  return {
    tools: [RACKET_EXECUTION_TOOL],
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info(`Received tool execution request for tool: ${request.params.name}`);
  logger.debug("Tool request parameters:", request.params);

  try {
    const { name, arguments: args } = request.params;

    if (name !== "execute_racket") {
      logger.error(`Unknown tool requested: ${name}`);
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    if (!args || typeof args !== "object") {
      logger.error("Invalid arguments provided for execute_racket");
      throw new Error("Invalid arguments for execute_racket");
    }

    const { code, dataFiles, timeout } = args as {
      code: string;
      dataFiles?: Record<string, string>;
      timeout?: number;
    };

    if (!code || typeof code !== "string") {
      logger.error("Missing or invalid code parameter");
      throw new Error("Code parameter is required and must be a string");
    }

    logger.info("Validating Racket code...");
    validateRacketCode(code);
    logger.info("Code validation successful");

    logger.info("Executing Racket code...");
    const result = await execute({
      code,
      dataFiles,
      timeout: timeout && timeout > 0 && timeout <= 30 ? timeout : 30,
    });
    logger.info("Code execution completed successfully");
    logger.debug("Raw execution result:", result);

    // Handle binary output if present
    if (result.binaryOutput) {
      console.error("RACKET SERVER LOGS: Binary output detected!");
      console.error(`RACKET SERVER LOGS: Binary type: ${result.binaryOutput.type}`);
      console.error(`RACKET SERVER LOGS: Binary size: ${result.binaryOutput.metadata.size} bytes`);
      console.error(`RACKET SERVER LOGS: Binary dimensions: ${result.binaryOutput.metadata.dimensions.width}x${result.binaryOutput.metadata.dimensions.height}`);
      console.error(`RACKET SERVER LOGS: Binary content starts with: ${result.binaryOutput.data.substring(0, 50)}...`);
      
      logger.info("Binary output detected:");
      logger.info(`- Type: ${result.binaryOutput.type}`);
      logger.info(`- Size: ${result.binaryOutput.metadata.size} bytes`);
      logger.info(`- Metadata: ${JSON.stringify(result.binaryOutput.metadata, null, 2)}`);

      // Use standard artifacts array format instead of binaryOutput
      const artifactResponse = {
        content: [
          {
            type: "text",
            text: `Generated ${result.binaryOutput.type} output (${result.binaryOutput.metadata.size} bytes)`,
          }
        ],
        artifacts: [
          {
            type: result.binaryOutput.type,
            title: `Racket Generated ${result.binaryOutput.type.split('/')[1].toUpperCase()}`,
            content: result.binaryOutput.data,
            metadata: {
              ...result.binaryOutput.metadata,
              sourceCode: result.code
            }
          }
        ],
        metadata: {
          hasBinaryOutput: true,
          binaryType: result.binaryOutput.type,
        },
        isError: false,
      };
      
      console.error("RACKET SERVER LOGS: Returning artifact with following structure:");
      console.error(`RACKET SERVER LOGS: - Content items: ${artifactResponse.content.length}`);
      console.error(`RACKET SERVER LOGS: - Artifacts items: ${artifactResponse.artifacts.length}`);
      console.error(`RACKET SERVER LOGS: - First artifact type: ${artifactResponse.artifacts[0].type}`);
      console.error(`RACKET SERVER LOGS: - First artifact title: ${artifactResponse.artifacts[0].title}`);
      console.error(`RACKET SERVER LOGS: - Content data length: ${artifactResponse.artifacts[0].content.length} characters`);
      
      return artifactResponse;
    } else {
      console.error("RACKET SERVER LOGS: No binary output detected in execution result");
    }

    // Log standard output result
    console.error(`RACKET SERVER LOGS: Standard output result (${result.output.length} chars):`);
    console.error(`RACKET SERVER LOGS: Output type: ${result.type || 'text'}`);
    console.error(`RACKET SERVER LOGS: Output preview: ${result.output.substring(0, 100)}...`);
    
    logger.info("Standard output result:");
    logger.info(`- Type: ${result.type || 'text'}`);
    logger.info(`- Output length: ${result.output.length} characters`);
    if (result.metadata) {
      logger.info(`- Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
    }

    // For text output, create an artifact if it's rich enough to deserve one
    let artifacts = undefined;
    if (result.output.length > 200 || result.output.includes('\n')) {
      console.error("RACKET SERVER LOGS: Creating text/markdown artifact for long output");
      artifacts = [
        {
          type: "text/markdown",
          title: "Racket Output",
          content: "```\n" + result.output + "\n```"
        }
      ];
      console.error(`RACKET SERVER LOGS: Created markdown artifact with length ${artifacts[0].content.length}`);
    } else {
      console.error("RACKET SERVER LOGS: Output too short, not creating artifact");
    }

    // Default response for non-binary output
    return {
      content: [{
        type: "text",
        text: result.output || "Code executed successfully with no text output.",
      }],
      artifacts,
      metadata: result.metadata,
      isError: false,
    };
  } catch (error) {
    logger.error("Error during tool execution:", error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function runServer() {
  logger.info("Starting Racket MCP Server...");
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Racket MCP Server running on stdio");
  } catch (error) {
    logger.error("Failed to start server:", error);
    throw error;
  }
}

runServer().catch((error) => {
  logger.error("Fatal error running server:", error);
  process.exit(1);
}); 