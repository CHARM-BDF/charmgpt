#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import crypto from "crypto";

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remote Kappa server configuration
const KAPPA_SERVER_URL = "https://kappa-async.livecode.ch";
const DEBUG = true;

// Temporary directory for CSV generation
const TEMP_DIR = path.join(__dirname, '../../temp');
const UPLOADS_DIR = path.join(__dirname, '../../../backend-mcp-client/uploads');

// Logger utility
const logger = {
  info: (message: string, ...args: any[]) => {
    console.error(`\x1b[36m[KAPPA-MCP INFO]\x1b[0m ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`\x1b[31m[KAPPA-MCP ERROR]\x1b[0m ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (DEBUG) {
      console.error(`\x1b[33m[KAPPA-MCP DEBUG]\x1b[0m ${message}`, ...args);
    }
  }
};

// Define Zod schemas for input validation
const RunSimulationSchema = z.object({
  ka: z.string().describe("Kappa model code to simulate"),
  l: z.number().optional().default(100).describe("Simulation limit (time units)"),
  p: z.number().optional().default(1.0).describe("Plot period for data collection")
});

// Helper function to ensure directory exists
async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist, that's fine
  }
}

// Extract CSV from KaSim output
function extractCSVFromOutput(output: string): string {
  logger.debug("Extracting CSV from KaSim output");
  
  // The output field from the API should contain the CSV data
  // KaSim typically outputs CSV format with headers
  if (!output || output.trim().length === 0) {
    throw new Error("Empty simulation output");
  }
  
  // Filter out comment lines starting with '#'
  // KaSim includes metadata comments that should be stripped
  const lines = output.trim().split('\n');
  const csvLines = lines.filter(line => !line.trim().startsWith('#'));
  
  if (csvLines.length < 2) {
    throw new Error("Invalid CSV output - need at least header and one data line");
  }
  
  const cleanedCSV = csvLines.join('\n');
  logger.debug(`Extracted CSV with ${csvLines.length} lines (filtered out ${lines.length - csvLines.length} comment lines)`);
  
  return cleanedCSV;
}

// Store file in server storage (mimicking Python MCP pattern)
async function storeFileInServerStorage(
  tempFilePath: string,
  originalFilename: string,
  sourceCode: string
): Promise<{ fileId: string; size: number }> {
  try {
    const fileId = crypto.randomUUID();
    
    // Ensure uploads directory exists
    await ensureDir(UPLOADS_DIR);
    
    // Move file to uploads directory
    const permanentFilePath = path.join(UPLOADS_DIR, fileId);
    await fs.rename(tempFilePath, permanentFilePath);
    
    // Get file stats
    const stats = await fs.stat(permanentFilePath);
    
    // Create metadata
    const metadata = {
      description: originalFilename,
      schema: {
        type: 'tabular' as const,
        format: 'text/csv',
        encoding: 'utf-8',
        sampleData: ''
      },
      tags: ['kappa-output', 'simulation', 'auto-generated'],
      originalFilename,
      generatedBy: 'kappa-mcp',
      generatedAt: new Date().toISOString(),
      sourceCode,
      size: stats.size
    };
    
    // Store metadata
    const metadataDir = path.join(UPLOADS_DIR, 'metadata');
    await ensureDir(metadataDir);
    
    const metadataPath = path.join(metadataDir, `${fileId}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    logger.info(`Stored file in server storage: ${originalFilename} -> ${fileId}`);
    return { fileId, size: stats.size };
    
  } catch (error) {
    logger.error(`Error storing file in server storage: ${error}`);
    throw error;
  }
}

// Call remote Kappa server
async function callRemoteKappaServer(params: { ka: string; l?: number; p?: number }): Promise<{
  output: string;
  stdout: string;
  stderr: string;
}> {
  logger.info("Calling remote Kappa server");
  logger.debug("Request parameters:", JSON.stringify(params, null, 2));
  
  try {
    const response = await fetch(`${KAPPA_SERVER_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Kappa server error: ${response.status} - ${errorText}`);
      throw new Error(`Kappa server returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    logger.debug("Received response from Kappa server");
    logger.debug("Output length:", data.output?.length || 0);
    logger.debug("Stdout length:", data.stdout?.length || 0);
    logger.debug("Stderr length:", data.stderr?.length || 0);
    
    return data;
    
  } catch (error) {
    logger.error("Error calling remote Kappa server:", error);
    throw error;
  }
}

// Main simulation execution function
async function runKappaSimulation(args: z.infer<typeof RunSimulationSchema>): Promise<any> {
  logger.info("Starting Kappa simulation");
  
  try {
    // Ensure temp directory exists
    await ensureDir(TEMP_DIR);
    
    // Call remote Kappa server
    const simulationResult = await callRemoteKappaServer(args);
    
    // Check for errors in stderr
    if (simulationResult.stderr && simulationResult.stderr.trim().length > 0) {
      logger.error("KaSim stderr:", simulationResult.stderr);
      // Only throw if there's no output (some warnings might appear in stderr)
      if (!simulationResult.output || simulationResult.output.trim().length === 0) {
        throw new Error(`KaSim error: ${simulationResult.stderr}`);
      }
    }
    
    // Extract CSV from output
    const csvContent = extractCSVFromOutput(simulationResult.output);
    
    // Generate filename
    const timestamp = Date.now();
    const filename = `kappa_simulation_${timestamp}.csv`;
    const tempFilePath = path.join(TEMP_DIR, filename);
    
    // Write CSV to temp file
    await fs.writeFile(tempFilePath, csvContent);
    logger.info(`Created CSV file: ${filename}`);
    
    // Store in server storage
    const sourceCode = args.ka;
    const { fileId, size } = await storeFileInServerStorage(
      tempFilePath,
      filename,
      sourceCode
    );
    
    // Build response summary
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/^['"]|['"]$/g, '').trim());
    const dataLines = lines.length - 1;
    
    const summary = `Kappa simulation completed successfully.

**Simulation Parameters:**
- Simulation limit: ${args.l} time units
- Plot period: ${args.p}

**Results:**
- Generated ${dataLines} time points
- Columns: ${headers.join(', ')}
- Stored as: ${filename}

The CSV file contains the complete time-series data and can be used with Python MCP for plotting and analysis.`;
    
    return {
      output: summary,
      code: sourceCode,
      createdFiles: [{
        fileId,
        originalFilename: filename,
        size
      }],
      metadata: {
        simulationParams: args,
        dataPoints: dataLines,
        headers: headers
      }
    };
    
  } catch (error) {
    logger.error("Error in runKappaSimulation:", error);
    throw error;
  }
}

// Initialize MCP server
logger.info("Initializing Kappa MCP Server...");
const server = new Server(
  {
    name: "kappa-mcp",
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

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "run_kappa_simulation",
        description: "Run a Kappa simulation using KaSim and generate CSV output for analysis. " +
          "The CSV file will be automatically stored and can be used with Python MCP for plotting. " +
          "Kappa is a rule-based modeling language for systems biology. " +
          "Example model: '%agent: A(x)\\n%agent: B(x)\\n%init: 1000 A(x[.])\\n%init: 1000 B(x[.])\\nA(x[.]),B(x[.]) -> A(x[1]),B(x[1]) @ 0.001'",
        inputSchema: {
          type: "object",
          properties: {
            ka: {
              type: "string",
              description: "Kappa model code to simulate. Must include %agent declarations, %init for initial conditions, and rules."
            },
            l: {
              type: "number",
              description: "Simulation limit in time units (default: 100)",
              default: 100
            },
            p: {
              type: "number",
              description: "Plot period - how often to record data points (default: 1.0)",
              default: 1.0
            }
          },
          required: ["ka"]
        }
      }
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info(`Received tool execution request for tool: ${request.params.name}`);
  
  try {
    const { name, arguments: args } = request.params;

    if (name !== "run_kappa_simulation") {
      logger.error(`Unknown tool requested: ${name}`);
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    if (!args || typeof args !== "object") {
      logger.error("Invalid arguments provided");
      throw new Error("Invalid arguments for run_kappa_simulation");
    }

    // Validate arguments
    const validatedArgs = RunSimulationSchema.parse(args);
    
    // Run simulation and get results
    const result = await runKappaSimulation(validatedArgs);
    
    // Build response following the Python MCP pattern
    const artifacts = [];
    const content = [];
    
    // Add code artifact (simulation parameters)
    artifacts.push({
      type: "code",
      title: "Kappa Simulation Parameters",
      content: result.code,
      language: "json",
      metadata: {
        editorView: true,
        sourceCode: result.code
      }
    });
    
    // Add output artifact
    artifacts.push({
      type: "text/markdown",
      title: "Simulation Output",
      content: result.output
    });
    
    // Add file reference artifact for the CSV
    if (result.createdFiles && result.createdFiles.length > 0) {
      const csvFile = result.createdFiles[0];
      
      artifacts.push({
        id: crypto.randomUUID(),
        artifactId: crypto.randomUUID(),
        type: "text/markdown",  // Will render as table in UI
        title: `Generated: ${csvFile.originalFilename}`,
        content: '',  // Empty - loaded dynamically
        timestamp: new Date(),
        position: artifacts.length,
        metadata: {
          fileReference: {
            fileId: csvFile.fileId,
            fileName: csvFile.originalFilename,
            fileType: 'text/csv',
            fileSize: csvFile.size
          }
        }
      });
      
      content.push({
        type: "text",
        text: result.output
      });
    }
    
    logger.info("Simulation completed successfully");
    
    return {
      content,
      artifacts,
      metadata: result.metadata,
      isError: false,
    };
  
  } catch (error) {
    logger.error("Error during tool execution:", error);
    
    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: "text",
          text: `Invalid arguments: ${error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        }],
        isError: true,
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  logger.info("Starting Kappa MCP Server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Kappa MCP Server running on stdio");
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});

