import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION SECTION
// =============================================================================

const TOOL_NAME = "kappa-writer-mcp";
const SERVICE_NAME = "kappa-writer-mcp";

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================

const GetSyntaxGuideArgumentsSchema = z.object({
  section: z.string().optional().describe("Specific section of the guide to retrieve (e.g., 'agent-declarations', 'rules', 'observables')"),
});

const ValidateKappaCodeArgumentsSchema = z.object({
  code: z.string().min(1, "Kappa code cannot be empty").describe("Kappa code to validate"),
  check_syntax: z.boolean().optional().default(true).describe("Whether to perform syntax validation"),
});

// =============================================================================
// SERVER SETUP
// =============================================================================

// Create server instance
const server = new Server(
  {
    name: SERVICE_NAME,
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {
        level: "info"
      }
    },
  }
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Load the Kappa syntax validation prompt
async function loadSyntaxPrompt(): Promise<string> {
  try {
    const promptPath = path.join(__dirname, '..', 'Kappa_Syntax_Validation_Prompt.md');
    const promptContent = await fs.readFile(promptPath, 'utf-8');
    return promptContent;
  } catch (error) {
    console.error(`Error loading syntax prompt:`, error);
    return "Error loading Kappa syntax validation prompt.";
  }
}

// Extract specific section from the prompt
function extractSection(prompt: string, section: string): string {
  const sections: Record<string, string> = {
    'agent-declarations': 'Agent Declarations',
    'initial-conditions': 'Initial Conditions', 
    'observables': 'Observables',
    'rules': 'Rules',
    'checklist': 'Pre-Submission Checklist',
    'common-errors': 'Common Error Patterns to Avoid',
    'template': 'Validation Template'
  };

  const targetSection = sections[section] || section;
  
  // Split by headers and find the target section
  const lines = prompt.split('\n');
  let inTargetSection = false;
  let sectionContent: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('###') && line.includes(targetSection)) {
      inTargetSection = true;
      sectionContent.push(line);
    } else if (inTargetSection && line.startsWith('###') && !line.includes(targetSection)) {
      break;
    } else if (inTargetSection) {
      sectionContent.push(line);
    }
  }
  
  return sectionContent.length > 0 ? sectionContent.join('\n') : prompt;
}

// Kappa syntax validation using LLM with comprehensive prompt
async function validateKappaSyntaxWithLLM(code: string): Promise<string> {
  try {
    const prompt = await loadSyntaxPrompt();
    
    const validationPrompt = `${prompt}

# Code to Validate and Fix

\`\`\`kappa
${code}
\`\`\`

**🚨 PRIMARY GOAL: RETURN WORKING KAPPA CODE 🚨**

Your main objective is to provide a complete, corrected version of the Kappa code that will actually run. Do NOT just identify errors - you MUST fix them and return working code.

**Required Steps (in order of priority):**

1. **🔧 FIX ALL ERRORS** - This is your PRIMARY task. Correct every syntax error found
2. **📝 EXPLAIN FIXES** - Briefly describe what you changed and why
3. **⚠️ IDENTIFY ISSUES** - List any syntax errors with line numbers
4. **💡 ADD WARNINGS** - Point out potential improvements or issues

**CRITICAL REQUIREMENTS:**
- **ALWAYS return the complete corrected code** - This is MANDATORY, not optional
- **Fix errors automatically** - Don't just point them out, actually fix them
- **Use proper Kappa syntax** - Follow all the rules defined above
- **Make the code runnable** - The output must be valid Kappa that can be executed
- **If code is over 200 lines** - Still provide the fix, just mention the length

**❌ UNACCEPTABLE RESPONSES:**
- "Here are the errors found: [list] - fix them yourself"
- "The code has issues at lines X, Y, Z"
- "You need to change this and that"
- Any response that doesn't include the complete corrected code

**✅ REQUIRED RESPONSE:**
- Complete working Kappa code with all errors fixed
- Clear explanation of what was changed
- Proper markdown formatting with \`\`\`kappa code blocks

**Response Format:**
# Kappa Code Validation & Correction

## 🔧 CORRECTED CODE (PRIMARY OUTPUT)
\`\`\`kappa
[The complete corrected code - THIS IS THE MOST IMPORTANT PART]
\`\`\`

## Fixes Applied
[Describe what was corrected and why]

## Errors Found
[List any syntax errors with line numbers]

## Warnings
[Any potential issues or suggestions]

**IMPORTANT:** Always return Kappa code in markdown code blocks with the language type specified as \`kappa\` (e.g., \`\`\`kappa) to ensure proper syntax highlighting and formatting.

**NO PYTHON:** Do not return Python wrapper versions of the Kappa code. Only return the raw Kappa syntax.`;

    // For now, return a message indicating LLM validation should be used
    return `# Kappa Code Validation & Auto-Correction

**Note:** This validation should be performed by the LLM using the comprehensive Kappa syntax validation prompt. The LLM will not only identify errors but automatically fix them and return the corrected code.

**Code to validate and fix:**
\`\`\`kappa
${code}
\`\`\`

**Instructions for the LLM:**
1. Use the comprehensive Kappa syntax validation prompt to check this code
2. Identify any syntax errors (like incorrect state separators, wrong comment syntax, etc.)
3. **Automatically fix all errors** and return the corrected code
4. Don't just point out problems - provide the working solution
5. If the code is over 200 lines, mention it's too long for inline display
6. **Always return Kappa code in markdown code blocks with language type \`kappa\`** (e.g., \`\`\`kappa) for proper syntax highlighting
7. **Do NOT return Python wrapper versions** - only return the raw Kappa syntax

Please use the kappa-writer-validate-kappa-code tool with the comprehensive prompt to get detailed validation and automatic error correction.`;
    
  } catch (error) {
    console.error('Error in LLM validation:', error);
    return `Error loading validation prompt: ${error}`;
  }
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get-kappa-syntax-guide",
        description: "Get the complete Kappa syntax validation guide. " +
          "Use this when you need help writing correct Kappa code, " +
          "understanding syntax rules, or avoiding common errors. " +
          "Returns comprehensive guidance for writing Kappa models. " +
          "All returned Kappa code will be formatted in markdown with 'kappa' language type. " +
          "No Python wrapper versions will be provided.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Specific section to retrieve (optional). " +
                "Options: 'agent-declarations', 'initial-conditions', 'observables', " +
                "'rules', 'checklist', 'common-errors', 'template'",
            },
          },
          required: [],
        },
      },
      {
        name: "validate-kappa-code",
        description: "Validate Kappa code for syntax errors and provide suggestions. " +
          "Use this to check if Kappa code follows proper syntax rules " +
          "and get specific feedback on errors and warnings. " +
          "All returned Kappa code will be formatted in markdown with 'kappa' language type. " +
          "No Python wrapper versions will be provided.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The Kappa code to validate",
            },
            check_syntax: {
              type: "boolean",
              description: "Whether to perform syntax validation (default: true)",
            },
          },
          required: ["code"],
        },
      },
      {
        name: "load-kappa-syntax-guide-simplified",
        description: "Load the complete Kappa syntax validation guide into context. " +
          "Use this when a user asks for help writing Kappa code. " +
          "Returns the comprehensive Kappa syntax validation prompt with all rules and examples. " +
          "All returned Kappa code will be formatted in markdown with 'kappa' language type. " +
          "No Python wrapper versions will be provided.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// =============================================================================
// TOOL EXECUTION
// =============================================================================

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get-kappa-syntax-guide") {
      const { section } = GetSyntaxGuideArgumentsSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Loading Kappa syntax guide${section ? ` for section: ${section}` : ''}`);
      
      const fullPrompt = await loadSyntaxPrompt();
      
      if (section) {
        const sectionContent = extractSection(fullPrompt, section);
        return {
          content: [
            {
              type: "text",
              text: `# Kappa Syntax Guide - ${section}\n\n${sectionContent}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: fullPrompt,
            },
          ],
        };
      }

    } else if (name === "validate-kappa-code") {
      const { code, check_syntax } = ValidateKappaCodeArgumentsSchema.parse(args);
      
      console.log(`[${SERVICE_NAME}] Validating Kappa code (${code.length} characters)`);
      
      if (!check_syntax) {
        return {
          content: [
            {
              type: "text",
              text: "Syntax validation was disabled. No validation performed.",
            },
          ],
        };
      }
      
      // Use LLM-based validation instead of regex patterns
      const validationResult = await validateKappaSyntaxWithLLM(code);
      
      // 🔍 LOGGING: What the MCP server is returning
      console.error(`\n🔍 ===== KAPPA-WRITER-MCP RETURNING =====`);
      console.error(`Tool: validate-kappa-code`);
      console.error(`Input code length: ${code.length} characters`);
      console.error(`Validation result length: ${validationResult.length} characters`);
      console.error(`Validation result preview (first 500 chars):`);
      console.error(validationResult.substring(0, 500));
      if (validationResult.length > 500) {
        console.error('... (truncated)');
      }
      console.error('===== END KAPPA-WRITER-MCP RETURN =====\n');
      
      return {
        content: [
          {
            type: "text",
            text: validationResult,
          },
        ],
      };

    } else if (name === "load-kappa-syntax-guide-simplified") {
      console.log(`[${SERVICE_NAME}] Loading complete Kappa syntax guide`);
      
      const fullPrompt = await loadSyntaxPrompt();
      
      // 🔍 LOGGING: What the MCP server is returning
      console.error(`\n🔍 ===== KAPPA-WRITER-MCP RETURNING =====`);
      console.error(`Tool: load-kappa-syntax-guide-simplified`);
      console.error(`Guide length: ${fullPrompt.length} characters`);
      console.error(`Guide preview (first 500 chars):`);
      console.error(fullPrompt.substring(0, 500));
      if (fullPrompt.length > 500) {
        console.error('... (truncated)');
      }
      console.error('===== END KAPPA-WRITER-MCP RETURN =====\n');
      
      return {
        content: [
          {
            type: "text",
            text: fullPrompt,
          },
        ],
      };
      
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

// Start the server
async function main() {
  console.log(`[${SERVICE_NAME}] Starting Kappa Writer MCP Server`);
  console.log(`[${SERVICE_NAME}] Available tools: get-kappa-syntax-guide, validate-kappa-code`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVICE_NAME}] MCP Server running on stdio`);
}

main().catch((error) => {
  console.error(`[${SERVICE_NAME}] Fatal error in main():`, error);
  process.exit(1);
});
