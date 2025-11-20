#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execute } from "./tools/execute.js";
import { getResponse, makeLogger } from "./shared/mcpCodeUtils.js";
import os from "os";
import crypto from 'crypto';

// Logger utility
const logger = makeLogger({
  log_type: (type: string, message: string, ...args: any[]) => {
    console.error(`\x1b[36m[PYTHON-MCP ${type}]\x1b[0m ${message}`, ...args);
  }
});

// Define the Python execution tool
const PYTHON_EXECUTION_TOOL = {
  name: "execute_python",
  description: "Execute Python code with data science capabilities. Supports numpy, pandas, matplotlib, and other common data science packages. " +
    "📁 FILE ACCESS INSTRUCTIONS 📁\n" +
    "This environment has access to uploaded files through helper functions:\n" +
    "1. Use list_available_files() to see all available files\n" +
    "2. Use pd.read_csv('filename.csv') directly - it will auto-resolve filenames\n" +
    "3. Files are accessible by their original names (e.g., 'allergies.csv', 'patients.csv')\n" +
    "4. Common libraries (pandas, numpy, matplotlib, seaborn) are pre-loaded\n\n" +
    "Recommended Workflow:\n" +
    "```python\n" +
    "# Step 1: Check available files\n" +
    "files = list_available_files()\n" +
    "print(f'Available files: {len(files)}')\n" +
    "\n" +
    "# Step 2: Load your data\n" +
    "patients = pd.read_csv('patients.csv')\n" +
    "conditions = pd.read_csv('conditions.csv')\n" +
    "observations = pd.read_csv('observations.csv')\n" +
    "\n" +
    "# Step 3: Perform analysis\n" +
    "print(f'Loaded {len(patients)} patients')\n" +
    "```\n\n" +
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
        description: "Python code to execute. 📁 Start with list_available_files() to see uploaded files, then use pd.read_csv('filename.csv') to load them. Common libraries (pandas, numpy, matplotlib, seaborn) are pre-loaded. ⚠️ For file outputs, MUST use os.environ['OUTPUT_DIR']. Example: files = list_available_files(); df = pd.read_csv('patients.csv'); plt.savefig(os.path.join(os.environ['OUTPUT_DIR'], 'plot.png'))"
      },
      dataFiles: {
        type: "object",
        description: "Map of variable names to file IDs or file paths. File IDs are UUIDs from uploaded files. Files will be automatically loaded as Python variables with the specified names. Supports CSV (pandas DataFrame), JSON (dict), Excel (pandas DataFrame), text files (string), and Parquet (pandas DataFrame)."
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

    logger.info("Executing Python code...");
    const result = await execute({
      code,
      dataFiles,
      timeout: timeout && timeout > 0 && timeout <= 30 ? timeout : 30,
    });
    logger.info("Code execution completed successfully");
    logger.debug("Raw execution result:", result);

    return getResponse("Python", result, logger);
  
  } catch (error) {
    logger.error("Error during tool execution:", error);
    
    // Extract Python-specific error details if available
    const errorObj = error as any;
    let errorText = '';
    
    if (errorObj.pythonError) {
      // Python execution error with full traceback
      errorText = errorObj.message || `Python execution failed`;
      
      // Add the Python error/traceback (this is the most important part)
      if (errorObj.pythonError.trim()) {
        errorText += '\n\n' + '--- Python Error/Traceback ---\n' + errorObj.pythonError;
      }
      
      // Add stdout if it exists and is different from stderr
      if (errorObj.stdout && errorObj.stdout.trim() && 
          errorObj.stdout.trim() !== errorObj.pythonError.trim()) {
        errorText += '\n\n' + '--- Standard Output ---\n' + errorObj.stdout;
      }
      
      // Add exit code if available
      if (errorObj.exitCode !== undefined) {
        errorText += `\n\nExit code: ${errorObj.exitCode}`;
      }
      
      // Add timeout indicator if applicable
      if (errorObj.isTimeout) {
        errorText += '\n\n⚠️ Execution timed out after 30 seconds';
      }
    } else {
      // Generic error (e.g., argument validation, Docker setup)
      errorText = error instanceof Error ? error.message : String(error);
      
      // Include stack trace for non-Python errors to help with debugging
      if (error instanceof Error && error.stack && process.env.DEBUG) {
        errorText += '\n\n--- Stack Trace ---\n' + error.stack;
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: errorText,
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