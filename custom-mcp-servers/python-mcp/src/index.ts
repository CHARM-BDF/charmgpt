#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execute } from "./tools/execute.js";
import { validatePythonCode } from "./tools/env.js";

// Logger utility
const logger = {
  info: (message: string, ...args: any[]) => {
    console.error(`[INFO] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }
};

// Define the Python execution tool
const PYTHON_EXECUTION_TOOL = {
  name: "execute_python",
  description: "Execute Python code with data science capabilities. Supports numpy, pandas, matplotlib, and other common data science packages. " +
    "Code execution is sandboxed with security restrictions and resource limits. " +
    "Maximum execution time is 30 seconds, and memory usage is limited to 256MB.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to execute"
      },
      dataFiles: {
        type: "object",
        description: "Map of variable names to file paths",
        additionalProperties: { type: "string" }
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
logger.info("Initializing Python MCP Server...");
const server = new Server(
  {
    name: "python-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);
logger.info("Server initialized successfully");

// Handle tool listing requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info("Received tool listing request");
  logger.debug("Available tools:", [PYTHON_EXECUTION_TOOL.name]);
  return {
    tools: [PYTHON_EXECUTION_TOOL],
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info(`Received tool execution request for tool: ${request.params.name}`);
  logger.debug("Tool request parameters:", request.params);

  try {
    const { name, arguments: args } = request.params;

    if (name !== "execute_python") {
      logger.error(`Unknown tool requested: ${name}`);
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    if (!args || typeof args !== "object") {
      logger.error("Invalid arguments provided for execute_python");
      throw new Error("Invalid arguments for execute_python");
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

    logger.info("Validating Python code...");
    validatePythonCode(code);
    logger.info("Code validation successful");

    logger.info("Executing Python code...");
    const result = await execute({
      code,
      dataFiles,
      timeout: timeout && timeout > 0 && timeout <= 30 ? timeout : 30,
    });
    logger.info("Code execution completed successfully");
    logger.debug("Execution result:", result);

    return {
      content: [{
        type: result.type || "text",
        text: result.output,
        metadata: result.metadata
      }],
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
  logger.info("Starting Python MCP Server...");
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Python MCP Server running on stdio");
  } catch (error) {
    logger.error("Failed to start server:", error);
    throw error;
  }
}

runServer().catch((error) => {
  logger.error("Fatal error running server:", error);
  process.exit(1);
}); 