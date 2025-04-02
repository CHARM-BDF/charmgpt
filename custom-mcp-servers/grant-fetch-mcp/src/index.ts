#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fetchWebPage } from "./tools/fetch.js";
import { convertToMarkdown } from "./tools/markdown.js";
import { randomUUID } from "crypto";

// Logger utility
const logger = {
  info: (message: string, ...args: any[]) => {
    console.error(`\x1b[36m[GRANT-FETCH-MCP INFO]\x1b[0m ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`\x1b[31m[GRANT-FETCH-MCP ERROR]\x1b[0m ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.error(`\x1b[35m[GRANT-FETCH-MCP DEBUG]\x1b[0m ${message}`, ...args);
    }
  }
};

// Define the tool
const FETCH_GRANT_TOOL = {
  name: "fetch_grant",
  description: "Fetches an NIH grant page and converts it to markdown format. Example URL: https://grants.nih.gov/grants/guide/rfa-files/RFA-TR-25-002.html. Returns both a markdown artifact for display and an analysis-ready version with instructions for the LLM.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL of the NIH grant page to fetch"
      },
      timeout: {
        type: "number",
        description: "Timeout in seconds",
        default: 30
      }
    },
    required: ["url"]
  }
};

// Initialize MCP server
logger.info("Initializing Grant Fetch MCP Server...");
const server = new Server(
  {
    name: "grant-fetch-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info("Received tool listing request");
  return {
    tools: [FETCH_GRANT_TOOL],
  };
});

interface FetchGrantArgs {
  url: string;
  timeout?: number;
}

function isFetchGrantArgs(args: unknown): args is FetchGrantArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    'url' in args &&
    typeof (args as any).url === 'string' &&
    (typeof (args as any).timeout === 'undefined' || typeof (args as any).timeout === 'number')
  );
}

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info(`Received tool execution request for tool: ${request.params.name}`);
  logger.debug("Tool request parameters:", request.params);

  try {
    const { name, arguments: args } = request.params;

    if (name !== "fetch_grant") {
      throw new Error(`Unknown tool: ${name}`);
    }

    if (!isFetchGrantArgs(args)) {
      throw new Error('Invalid or missing arguments for fetch_grant');
    }

    // Step 1: Fetch the webpage
    logger.info("Fetching grant page...");
    const fetchResult = await fetchWebPage(args);

    // Step 2: Convert to markdown
    logger.info("Converting to markdown...");
    const markdownResult = await convertToMarkdown({
      html: fetchResult.content,
      preserveTables: true
    });

    // Create the LLM analysis version with instructions
    const llmVersion = `# Grant Analysis Instructions
Please analyze this NIH grant opportunity and provide:
1. Key objectives and specific aims
2. Funding amount and duration
3. Eligibility requirements
4. Critical deadlines
5. Any unique or notable requirements
6. Participating organizations and components

Here is the grant content:

${markdownResult.markdown}`;

    // Return both the artifact and LLM version
    return {
      content: [{
        type: "text",
        text: llmVersion,
        forModel: true,
        metadata: {
          url: args.url,
          contentType: fetchResult.contentType,
          statusCode: fetchResult.statusCode
        }
      }],
      grantMarkdown: {
        type: "text/markdown",
        title: "NIH Grant Details",
        content: markdownResult.markdown,
        metadata: {
          source: args.url,
          contentType: fetchResult.contentType,
          convertedAt: new Date().toISOString()
        }
      },
      isError: false
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
  logger.info("Starting Grant Fetch MCP Server...");
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Grant Fetch MCP Server running on stdio");
  } catch (error) {
    logger.error("Failed to start server:", error);
    throw error;
  }
}

runServer().catch((error) => {
  logger.error("Fatal error running server:", error);
  process.exit(1);
}); 