#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execute } from "./tools/execute.js";
import { getResponse, makeLogger } from "./shared/mcpCodeUtils.js";

// Logger utility
const logger = makeLogger({
  log_type: (type: string,message: string, ...args: any[]) => {
    console.error(`\x1b[36m[R-MCP ${type}]\x1b[0m ${message}`, ...args);
  }
});

// Define the R execution tool
const R_EXECUTION_TOOL = {
  name: "execute_r",
  description: "Execute R code with data science capabilities. Supports tidyverse, ggplot2, and other common R data science packages. " +
    "⚠️ CRITICAL FILE OUTPUT INSTRUCTIONS ⚠️\n" +
    "This runs in a non-interactive environment with strict file output requirements:\n" +
    "1. ALWAYS use file.path() with OUTPUT_DIR for ANY file operations\n" +
    "2. NEVER use relative paths (like 'plot.png') - they will fail\n" +
    "3. ALWAYS get OUTPUT_DIR from Sys.getenv('OUTPUT_DIR')\n\n" +
    "Required Pattern for File Outputs:\n" +
    "```r\n" +
    "# Set up output directory\n" +
    "OUTPUT_DIR <- Sys.getenv('OUTPUT_DIR')\n\n" +
    "# Save files using file.path with OUTPUT_DIR:\n" +
    "ggsave(file.path(OUTPUT_DIR, 'plot.png'), plot)\n" +
    "write.csv(data, file.path(OUTPUT_DIR, 'data.csv'))\n" +
    "saveRDS(model, file.path(OUTPUT_DIR, 'model.rds'))\n" +
    "```\n" +
    "Other Requirements:\n" +
    "- Use print() or cat() for text output\n" +
    "- Return values will be captured automatically\n" +
    "- Maximum execution time: 30 seconds\n" +
    "- Memory limit: 256MB",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "R code to execute. ⚠️ MUST use file.path(OUTPUT_DIR, ...) for ALL file outputs. Example: ggsave(file.path(OUTPUT_DIR, 'plot.png'), plot)"
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
logger.info("Initializing R MCP Server...");
const server = new Server(
  {
    name: "r-mcp",
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
  logger.debug("Available tools:", [R_EXECUTION_TOOL.name]);
  return {
    tools: [R_EXECUTION_TOOL],
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info(`Received tool execution request for tool: ${request.params.name}`);
  logger.debug("Tool request parameters:", request.params);

  try {
    const { name, arguments: args } = request.params;

    if (name !== "execute_r") {
      logger.error(`Unknown tool requested: ${name}`);
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    if (!args || typeof args !== "object") {
      logger.error("Invalid arguments provided for execute_r");
      throw new Error("Invalid arguments for execute_r");
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

    logger.info("Executing R code...");
    const result = await execute({
      code,
      dataFiles,
      timeout: timeout && timeout > 0 && timeout <= 30 ? timeout : 30,
    });
    logger.info("Code execution completed successfully");
    logger.debug("Raw execution result:", result);

    return getResponse("R", result, logger);

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
  logger.info("Starting R MCP Server...");
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("R MCP Server running on stdio");
  } catch (error) {
    logger.error("Failed to start server:", error);
    throw error;
  }
}

runServer().catch((error) => {
  logger.error("Fatal error running server:", error);
  process.exit(1);
}); 