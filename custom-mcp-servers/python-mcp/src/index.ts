#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execute } from "./tools/execute.js";
import { validatePythonCode } from "./tools/env.js";
import os from "os";

// Logger utility
const logger = {
  info: (message: string, ...args: any[]) => {
    console.error(`\x1b[36m[PYTHON-MCP INFO]\x1b[0m ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`\x1b[31m[PYTHON-MCP ERROR]\x1b[0m ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.error(`\x1b[35m[PYTHON-MCP DEBUG]\x1b[0m ${message}`, ...args);
    }
  }
};

// Define the Python execution tool
const PYTHON_EXECUTION_TOOL = {
  name: "execute_python",
  description: "Execute Python code with data science capabilities. Supports numpy, pandas, matplotlib, and other common data science packages. " +
    "⚠️ CRITICAL FILE OUTPUT INSTRUCTIONS ⚠️\n" +
    "This runs in a non-interactive environment with strict file output requirements:\n" +
    "1. ALWAYS use os.environ['OUTPUT_DIR'] for ANY file operations\n" +
    "2. NEVER use relative paths (like 'plot.png') - they will fail\n" +
    "3. ALWAYS include 'import os' when saving files\n\n" +
    "Required Pattern for File Outputs:\n" +
    "```python\n" +
    "import os\n" +
    "# Save files using os.path.join with OUTPUT_DIR:\n" +
    "plt.savefig(os.path.join(os.environ['OUTPUT_DIR'], 'plot.png'))\n" +
    "df.to_csv(os.path.join(os.environ['OUTPUT_DIR'], 'data.csv'))\n" +
    "```\n" +
    "Other Requirements:\n" +
    "- Use print() for text output\n" +
    "- Return values for data structures\n" +
    "- Maximum execution time: 30 seconds\n" +
    "- Memory limit: 256MB",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to execute. ⚠️ MUST use os.environ['OUTPUT_DIR'] for ALL file outputs. Example: plt.savefig(os.path.join(os.environ['OUTPUT_DIR'], 'plot.png'))"
      },
      dataFiles: {
        type: "object",
        description: "Map of variable names to file paths"
      },
      timeout: {
        type: "number",
        description: "Execution timeout in seconds (max 60)",
        default: 60
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
      logging: {}

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
    logger.debug("Raw execution result:", result);

    // Handle binary output if present
    if (result.binaryOutput) {
      console.error("PYTHON SERVER LOGS: Binary output detected!");
      console.error(`PYTHON SERVER LOGS: Binary type: ${result.binaryOutput.type}`);
      console.error(`PYTHON SERVER LOGS: Binary size: ${result.binaryOutput.metadata.size} bytes`);
      console.error(`PYTHON SERVER LOGS: Binary dimensions: ${result.binaryOutput.metadata.dimensions.width}x${result.binaryOutput.metadata.dimensions.height}`);
      console.error(`PYTHON SERVER LOGS: Binary content starts with: ${result.binaryOutput.data.substring(0, 50)}...`);
      
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
            title: `Python Generated ${result.binaryOutput.type.split('/')[1].toUpperCase()}`,
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
      
      console.error("PYTHON SERVER LOGS: Returning artifact with following structure:");
      console.error(`PYTHON SERVER LOGS: - Content items: ${artifactResponse.content.length}`);
      console.error(`PYTHON SERVER LOGS: - Artifacts items: ${artifactResponse.artifacts.length}`);
      console.error(`PYTHON SERVER LOGS: - First artifact type: ${artifactResponse.artifacts[0].type}`);
      console.error(`PYTHON SERVER LOGS: - First artifact title: ${artifactResponse.artifacts[0].title}`);
      console.error(`PYTHON SERVER LOGS: - Content data length: ${artifactResponse.artifacts[0].content.length} characters`);
      
      return artifactResponse;
    } else {
      console.error("PYTHON SERVER LOGS: No binary output detected in execution result");
    }

    // Log standard output result
    console.error(`PYTHON SERVER LOGS: Standard output result (${result.output.length} chars):`);
    console.error(`PYTHON SERVER LOGS: Output type: ${result.type || 'text'}`);
    console.error(`PYTHON SERVER LOGS: Output preview: ${result.output.substring(0, 100)}...`);
    
    logger.info("Standard output result:");
    logger.info(`- Type: ${result.type || 'text'}`);
    logger.info(`- Output length: ${result.output.length} characters`);
    if (result.metadata) {
      logger.info(`- Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
    }

    // For text output, create an artifact if it's rich enough to deserve one
    let artifacts = undefined;
    if (result.output.length > 200 || result.output.includes('\n')) {
      console.error("PYTHON SERVER LOGS: Creating text/markdown artifact for long output");
      artifacts = [
        {
          type: "text/markdown",
          title: "Python Output",
          content: "```\n" + result.output + "\n```"
        }
      ];
      console.error(`PYTHON SERVER LOGS: Created markdown artifact with length ${artifacts[0].content.length}`);
    } else {
      console.error("PYTHON SERVER LOGS: Output too short, not creating artifact");
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