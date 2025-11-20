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

// Enhanced logger utility with better formatting and context
const logger = {
  info: (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`\x1b[36m[KAPPA-MCP INFO ${timestamp}]\x1b[0m ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`\x1b[31m[KAPPA-MCP ERROR ${timestamp}]\x1b[0m ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (DEBUG) {
      const timestamp = new Date().toISOString();
      console.error(`\x1b[33m[KAPPA-MCP DEBUG ${timestamp}]\x1b[0m ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`\x1b[35m[KAPPA-MCP WARN ${timestamp}]\x1b[0m ${message}`, ...args);
  },
  success: (message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`\x1b[32m[KAPPA-MCP SUCCESS ${timestamp}]\x1b[0m ${message}`, ...args);
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

// Parse and format Kappa syntax errors for better LLM understanding
function formatKappaError(errorMessage: string, sourceCode?: string): string {
  logger.debug("Formatting Kappa error for LLM");
  
  // Parse the error format: File "path", line X, characters Y-Z: Error message
  const fileMatch = errorMessage.match(/File "([^"]+)", line (\d+), characters (\d+)-(\d+):\s*(.+)/);
  
  if (!fileMatch) {
    // If we can't parse the format, return the original error with some context
    return `🚨 Kappa Syntax Error\n\n**Error:** ${errorMessage}\n\n**Tip:** Use the kappa-writer-mcp tool to get detailed syntax guidance.`;
  }
  
  const [, filePath, lineNum, charStart, charEnd, errorText] = fileMatch;
  const lineNumber = parseInt(lineNum);
  const charStartNum = parseInt(charStart);
  const charEndNum = parseInt(charEnd);
  
  // Extract the problematic line from source code if available
  let problematicLine = '';
  let lineContext = '';
  if (sourceCode) {
    const lines = sourceCode.split('\n');
    if (lineNumber <= lines.length) {
      problematicLine = lines[lineNumber - 1];
      // Add context lines
      const contextStart = Math.max(0, lineNumber - 3);
      const contextEnd = Math.min(lines.length, lineNumber + 2);
      lineContext = lines.slice(contextStart, contextEnd)
        .map((line, idx) => {
          const actualLineNum = contextStart + idx + 1;
          const marker = actualLineNum === lineNumber ? '>>> ' : '    ';
          return `${marker}${actualLineNum}: ${line}`;
        })
        .join('\n');
    }
  }
  
  // Generate helpful suggestions based on error type
  let suggestions = '';
  const errorLower = errorText.toLowerCase();
  
  if (errorLower.includes('illegal definition of variable')) {
    suggestions = `**Fix:** Variable names must be quoted strings. Change to: \`%var: 'variable_name' value\``;
  } else if (errorLower.includes('unbound variable')) {
    suggestions = `**Fix:** Define the variable first with \`%var: 'variable_name' value\` or check spelling.`;
  } else if (errorLower.includes('illegal agent')) {
    suggestions = `**Fix:** Agent names must be quoted strings. Change to: \`%agent: 'AgentName'(sites)\``;
  } else if (errorLower.includes('illegal initial condition')) {
    suggestions = `**Fix:** Initial conditions must reference defined agents. Check agent names and site syntax.`;
  } else if (errorLower.includes('illegal rule')) {
    suggestions = `**Fix:** Rules must follow the pattern: \`Agent1(sites), Agent2(sites) -> Agent1(sites), Agent2(sites) @ rate\``;
  } else if (errorLower.includes('syntax error') || errorLower.includes('parse error')) {
    suggestions = `**Fix:** Check for missing quotes, brackets, or commas. Use \`//\` for comments, not \`#\`.`;
  } else {
    suggestions = `**Tip:** Use the kappa-writer-mcp tool for detailed syntax guidance.`;
  }
  
  // Build the formatted error message
  let formattedError = `🚨 Kappa Syntax Error\n\n`;
  formattedError += `**Location:** Line ${lineNumber}, characters ${charStartNum}-${charEndNum}\n`;
  formattedError += `**Error:** ${errorText}\n\n`;
  
  if (problematicLine) {
    formattedError += `**Problematic Line:**\n\`\`\`kappa\n${problematicLine}\n\`\`\`\n\n`;
  }
  
  if (lineContext) {
    formattedError += `**Code Context:**\n\`\`\`\n${lineContext}\n\`\`\`\n\n`;
  }
  
  formattedError += `${suggestions}\n\n`;
  
  // Add the all-caps important message
  formattedError += `## 🚨 VERY IMPORTANT: RETURN THE FULL CORRECTED CODE\n\n`;
  formattedError += `**DO NOT JUST SHOW SUGGESTIONS - THE USER WANTS THE COMPLETE FIXED CODE RETURNED.**\n`;
  formattedError += `**USE THE ERROR INFORMATION ABOVE TO REWRITE THE ENTIRE KAPPA CODE AND RETURN IT FIXED.**\n\n`;
  
  formattedError += `**Need Help?** Use the \`get-kappa-syntax-guide\` tool for comprehensive Kappa syntax rules.`;
  
  return formattedError;
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

// Call remote Kappa server with enhanced logging
async function callRemoteKappaServer(params: { ka: string; l?: number; p?: number }): Promise<{
  output: string;
  stdout: string;
  stderr: string;
}> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  logger.info(`[${requestId}] Starting remote Kappa server call to ${KAPPA_SERVER_URL}/run`);
  logger.debug(`[${requestId}] Request parameters:`, {
    ka_length: params.ka?.length || 0,
    l: params.l,
    p: params.p,
    ka_preview: params.ka?.substring(0, 100) + (params.ka?.length > 100 ? '...' : '')
  });
  
  try {
    logger.debug(`[${requestId}] Preparing fetch request...`);
    const requestBody = JSON.stringify(params);
    logger.debug(`[${requestId}] Request body size: ${requestBody.length} bytes`);
    
    const response = await fetch(`${KAPPA_SERVER_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kappa-MCP-Server/1.0',
        'X-Request-ID': requestId
      },
      body: requestBody
    });
    
    const responseTime = Date.now() - startTime;
    logger.info(`[${requestId}] Received response in ${responseTime}ms`);
    logger.debug(`[${requestId}] Response status: ${response.status} ${response.statusText}`);
    logger.debug(`[${requestId}] Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[${requestId}] Kappa server error: ${response.status} ${response.statusText}`);
      logger.error(`[${requestId}] Error response body:`, errorText);
      logger.error(`[${requestId}] Request details:`, {
        url: `${KAPPA_SERVER_URL}/run`,
        method: 'POST',
        bodySize: requestBody.length,
        responseTime: `${responseTime}ms`
      });
      // Try to format the error if it looks like a Kappa syntax error
      const formattedError = formatKappaError(errorText, params.ka);
      throw new Error(formattedError);
    }
    
    logger.debug(`[${requestId}] Parsing JSON response...`);
    const data = await response.json();
    
    logger.success(`[${requestId}] Successfully received response from Kappa server`);
    logger.debug(`[${requestId}] Response data summary:`, {
      output_length: data.output?.length || 0,
      stdout_length: data.stdout?.length || 0,
      stderr_length: data.stderr?.length || 0,
      has_output: !!data.output,
      has_stdout: !!data.stdout,
      has_stderr: !!data.stderr
    });
    
    // Log stderr content if present (might contain warnings)
    if (data.stderr && data.stderr.trim().length > 0) {
      logger.warn(`[${requestId}] Kappa stderr content:`, data.stderr);
    }
    
    // Log a preview of the output
    if (data.output && data.output.length > 0) {
      const outputPreview = data.output.substring(0, 200);
      logger.debug(`[${requestId}] Output preview:`, outputPreview + (data.output.length > 200 ? '...' : ''));
    }
    
    return data;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error(`[${requestId}] Error calling remote Kappa server after ${responseTime}ms:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestDetails: {
        url: `${KAPPA_SERVER_URL}/run`,
        method: 'POST',
        params: {
          ka_length: params.ka?.length || 0,
          l: params.l,
          p: params.p
        }
      }
    });
    throw error;
  }
}

// Main simulation execution function with enhanced logging
async function runKappaSimulation(args: z.infer<typeof RunSimulationSchema>): Promise<any> {
  const simulationId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  logger.info(`[${simulationId}] Starting Kappa simulation`);
  logger.debug(`[${simulationId}] Simulation parameters:`, {
    ka_length: args.ka?.length || 0,
    l: args.l,
    p: args.p,
    ka_preview: args.ka?.substring(0, 150) + (args.ka?.length > 150 ? '...' : '')
  });
  
  try {
    // Ensure temp directory exists
    logger.debug(`[${simulationId}] Ensuring temp directory exists: ${TEMP_DIR}`);
    await ensureDir(TEMP_DIR);
    logger.debug(`[${simulationId}] Temp directory ready`);
    
    // Call remote Kappa server
    logger.info(`[${simulationId}] Calling remote Kappa server...`);
    const simulationResult = await callRemoteKappaServer(args);
    logger.success(`[${simulationId}] Remote server call completed`);
    
    // Check for errors in stderr
    if (simulationResult.stderr && simulationResult.stderr.trim().length > 0) {
      logger.warn(`[${simulationId}] KaSim stderr detected:`, simulationResult.stderr);
      // Only throw if there's no output (some warnings might appear in stderr)
      if (!simulationResult.output || simulationResult.output.trim().length === 0) {
        logger.error(`[${simulationId}] No output received, treating stderr as fatal error`);
        // Format the error for better LLM understanding
        const formattedError = formatKappaError(simulationResult.stderr, args.ka);
        throw new Error(formattedError);
      } else {
        logger.info(`[${simulationId}] Stderr present but output exists, continuing...`);
      }
    }
    
    // Extract CSV from output
    logger.debug(`[${simulationId}] Extracting CSV from output...`);
    const csvContent = extractCSVFromOutput(simulationResult.output);
    logger.debug(`[${simulationId}] CSV extraction completed, length: ${csvContent.length} characters`);
    
    // Generate filename
    const timestamp = Date.now();
    const filename = `kappa_simulation_${timestamp}.csv`;
    const tempFilePath = path.join(TEMP_DIR, filename);
    
    // Write CSV to temp file
    logger.debug(`[${simulationId}] Writing CSV to temp file: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, csvContent);
    logger.info(`[${simulationId}] Created CSV file: ${filename} (${csvContent.length} bytes)`);
    
    // Store in server storage
    logger.debug(`[${simulationId}] Storing file in server storage...`);
    const sourceCode = args.ka;
    const { fileId, size } = await storeFileInServerStorage(
      tempFilePath,
      filename,
      sourceCode
    );
    logger.success(`[${simulationId}] File stored successfully - ID: ${fileId}, Size: ${size} bytes`);
    
    // Build response summary
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/^['"]|['"]$/g, '').trim());
    const dataLines = lines.length - 1;
    
    const totalTime = Date.now() - startTime;
    logger.success(`[${simulationId}] Kappa simulation completed successfully in ${totalTime}ms`);
    logger.debug(`[${simulationId}] Simulation results:`, {
      dataPoints: dataLines,
      columns: headers.length,
      headers: headers,
      fileSize: size,
      fileId: fileId
    });
    
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
    const totalTime = Date.now() - startTime;
    logger.error(`[${simulationId}] Error in Kappa simulation after ${totalTime}ms:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      simulationParams: {
        ka_length: args.ka?.length || 0,
        l: args.l,
        p: args.p
      }
    });
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
          "IMPORTANT: Always validate Kappa code with kappa_writer-validate-kappa-code BEFORE running simulation. " +
          "This tool will fail if the Kappa code has syntax errors. Use kappa_writer-validate-kappa-code first to fix any syntax issues. " +
          "The CSV file will be automatically stored and can be used with Python MCP for plotting. " +
          "Kappa is a rule-based modeling language for systems biology. " +
          "All returned Kappa code will be formatted in markdown with 'kappa' language type. " +
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

// Handle tool execution with enhanced logging
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  logger.info(`[${requestId}] Received tool execution request for tool: ${request.params.name}`);
  logger.debug(`[${requestId}] Request details:`, {
    toolName: request.params.name,
    hasArguments: !!request.params.arguments,
    argumentsType: typeof request.params.arguments
  });
  
  try {
    const { name, arguments: args } = request.params;

    if (name !== "run_kappa_simulation") {
      logger.error(`[${requestId}] Unknown tool requested: ${name}`);
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    if (!args || typeof args !== "object") {
      logger.error(`[${requestId}] Invalid arguments provided:`, args);
      throw new Error("Invalid arguments for run_kappa_simulation");
    }

    logger.debug(`[${requestId}] Validating arguments...`);
    // Validate arguments
    const validatedArgs = RunSimulationSchema.parse(args);
    logger.success(`[${requestId}] Arguments validated successfully`);
    
    // Run simulation and get results
    logger.info(`[${requestId}] Starting simulation execution...`);
    const result = await runKappaSimulation(validatedArgs);
    logger.success(`[${requestId}] Simulation execution completed`);
    
    // Build response following the Python MCP pattern
    const artifacts = [];
    const content = [];
    
    // Add code artifact (simulation parameters)
    artifacts.push({
      type: "code",
      title: "Kappa Simulation Parameters",
      content: result.code,
      language: "kappa",
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
    
    const totalTime = Date.now() - startTime;
    logger.success(`[${requestId}] Simulation completed successfully in ${totalTime}ms`);
    logger.debug(`[${requestId}] Response details:`, {
      artifactsCount: artifacts.length,
      contentLength: content.length,
      hasMetadata: !!result.metadata
    });
    
    return {
      content,
      artifacts,
      metadata: result.metadata,
      isError: false,
    };
  
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error(`[${requestId}] Error during tool execution after ${totalTime}ms:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestDetails: {
        toolName: request.params.name,
        hasArguments: !!request.params.arguments
      }
    });
    
    if (error instanceof z.ZodError) {
      logger.error(`[${requestId}] Validation error details:`, error.errors);
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

