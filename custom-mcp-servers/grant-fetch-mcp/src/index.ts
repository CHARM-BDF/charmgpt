#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fetchWebPage } from "./tools/fetch.js";
import { convertToMarkdown } from "./tools/markdown.js";

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

// Define the tools
const FETCH_WEBPAGE_TOOL = {
  name: "fetch_webpage",
  description: "Fetches content from a webpage, with focus on grant pages. Returns the raw HTML content along with metadata.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL of the webpage to fetch"
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

const HTML_TO_MARKDOWN_TOOL = {
  name: "html_to_markdown",
  description: "Converts HTML content to Markdown format, preserving structure and formatting important for grant information.",
  inputSchema: {
    type: "object",
    properties: {
      html: {
        type: "string",
        description: "HTML content to convert"
      },
      preserveTables: {
        type: "boolean",
        description: "Whether to preserve table formatting",
        default: true
      }
    },
    required: ["html"]
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
    tools: [FETCH_WEBPAGE_TOOL, HTML_TO_MARKDOWN_TOOL],
  };
});

interface FetchWebPageArgs {
  url: string;
  timeout?: number;
}

interface HtmlToMarkdownArgs {
  html: string;
  preserveTables?: boolean;
}

function isFetchWebPageArgs(args: unknown): args is FetchWebPageArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    'url' in args &&
    typeof (args as any).url === 'string' &&
    (typeof (args as any).timeout === 'undefined' || typeof (args as any).timeout === 'number')
  );
}

function isHtmlToMarkdownArgs(args: unknown): args is HtmlToMarkdownArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    'html' in args &&
    typeof (args as any).html === 'string' &&
    (typeof (args as any).preserveTables === 'undefined' || typeof (args as any).preserveTables === 'boolean')
  );
}

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info(`Received tool execution request for tool: ${request.params.name}`);
  logger.debug("Tool request parameters:", request.params);

  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "fetch_webpage": {
        if (!isFetchWebPageArgs(args)) {
          throw new Error('Invalid or missing arguments for fetch_webpage');
        }
        const result = await fetchWebPage(args);
        return {
          content: [{
            type: "text",
            text: result.content,
            metadata: {
              url: args.url,
              contentType: result.contentType,
              statusCode: result.statusCode
            }
          }],
          isError: false,
        };
      }

      case "html_to_markdown": {
        if (!isHtmlToMarkdownArgs(args)) {
          throw new Error('Invalid or missing arguments for html_to_markdown');
        }
        const result = await convertToMarkdown(args);
        return {
          content: [{
            type: "text",
            text: result.markdown,
            metadata: {
              originalLength: args.html.length,
              markdownLength: result.markdown.length
            }
          }],
          isError: false,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
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