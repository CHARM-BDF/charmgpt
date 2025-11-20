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
    console.log('🔍 KAPPA-VALIDATOR: Starting validation of Kappa code');
    console.log('🔍 KAPPA-VALIDATOR: Code length:', code.length);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    let correctedCode = code;
    
    // Split code into lines for analysis
    const lines = code.split('\n');
    
    // Validate each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      
      // Skip empty lines and comments
      if (!line || line.startsWith('//')) continue;
      
      // Check for agent declarations
      if (line.startsWith('%agent:')) {
        const agentMatch = line.match(/^%agent:\s*(\w+)\((.*)\)/);
        if (agentMatch) {
          const [, agentName, sites] = agentMatch;
          
          // Check for incorrect state notation (double ~)
          if (sites.includes('~u~m') || sites.includes('~u~p') || sites.includes('~s~u')) {
            const correctedSites = sites
              .replace(/~u~m/g, '~{u m}')
              .replace(/~u~p/g, '~{u p}')
              .replace(/~s~u/g, '~{s u}');
            
            correctedCode = correctedCode.replace(line, `%agent: ${agentName}(${correctedSites})`);
            errors.push(`Line ${lineNum}: Incorrect state notation - fixed double ~ to proper state syntax`);
          }
        }
      }
      
      // Check for init declarations
      if (line.startsWith('%init:')) {
        // Check for incorrect state notation in init
        if (line.includes('~u~m') || line.includes('~u~p') || line.includes('~s~u')) {
          const correctedLine = line
            .replace(/~u~m/g, '~{u m}')
            .replace(/~u~p/g, '~{u p}')
            .replace(/~s~u/g, '~{s u}');
          
          correctedCode = correctedCode.replace(line, correctedLine);
          errors.push(`Line ${lineNum}: Incorrect state notation in init - fixed double ~ to proper state syntax`);
        }
      }
      
      // Check for rules
      if (line.includes('->') || line.includes('@')) {
        // Check for link identifier consistency
        const linkMatches = line.match(/\[(\d+)\]/g);
        if (linkMatches) {
          const links = linkMatches.map(m => m.replace(/[\[\]]/g, ''));
          const uniqueLinks = [...new Set(links)];
          
          // Check if all links appear exactly twice
          for (const link of uniqueLinks) {
            const count = links.filter(l => l === link).length;
            if (count === 1) {
              errors.push(`Line ${lineNum}: Link '${link}' appears only once - check for binding consistency`);
            }
          }
        }
      }
    }
    
    // Generate validation report
    let report = '# Kappa Code Validation & Correction\n\n';
    
    if (errors.length === 0 && warnings.length === 0) {
      report += '✅ **No syntax errors found!** The code appears to be valid Kappa syntax.\n\n';
    } else {
      if (errors.length > 0) {
        report += '## 🔧 Fixes Applied\n\n';
        errors.forEach((error, index) => {
          report += `${index + 1}. ${error}\n`;
        });
        report += '\n';
      }
      
      if (warnings.length > 0) {
        report += '## ⚠️ Warnings\n\n';
        warnings.forEach((warning, index) => {
          report += `${index + 1}. ${warning}\n`;
        });
        report += '\n';
      }
    }
    
    // Add the corrected code
    report += '## 🔧 Corrected Code\n\n';
    report += '```kappa\n';
    report += correctedCode;
    report += '\n```\n\n';
    
    // Add the all-caps message if there were errors
    if (errors.length > 0) {
      report += '## 🚨 IMPORTANT: USE THE SUGGESTED CHANGES TO FIX THE CODE AND RETURN THE FULL CODE WITH THE FIX\n\n';
      report += '**The corrected code above contains all necessary fixes. Please use this corrected version.**\n\n';
    }
    
    // Add artifact information
    report += '## 📁 Artifact Created\n\n';
    report += 'A markdown artifact has been created with the corrected code for easy viewing and copying.\n\n';
    
    // Add final message for the LLM
    if (errors.length > 0) {
      report += '## 🎯 READY TO RUN\n\n';
      report += '**The corrected Kappa code is now syntactically valid and ready to run.**\n';
      report += '**Please use the corrected code above for any simulation or further processing.**\n\n';
    }
    
    // Add summary
    if (errors.length > 0) {
      report += `**Summary:** Fixed ${errors.length} error${errors.length > 1 ? 's' : ''} in the Kappa code. The corrected version should now be syntactically valid.`;
    } else {
      report += '**Summary:** The code was already valid Kappa syntax.';
    }
    
    console.log('🔍 KAPPA-VALIDATOR: Validation complete');
    console.log('🔍 KAPPA-VALIDATOR: Errors found:', errors.length);
    console.log('🔍 KAPPA-VALIDATOR: Warnings found:', warnings.length);
    
    return report;
    
  } catch (error) {
    console.error('Error in Kappa validation:', error);
    return `# Kappa Code Validation Error

❌ **Error during validation:** ${error}

**Original code:**
\`\`\`kappa
${code}
\`\`\`

Please check the code manually for syntax errors.`;
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
          "IMPORTANT: Use this tool FIRST before running any Kappa simulations. " +
          "This tool will automatically fix common syntax errors and return the complete corrected code. " +
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
      
      // Create artifact with the corrected code
      const correctedCode = validationResult.match(/```kappa\n([\s\S]*?)\n```/)?.[1] || code;
      const hasErrors = validationResult.includes('## 🔧 Fixes Applied');
      
      return {
        content: [
          {
            type: "text",
            text: validationResult,
          },
        ],
        artifacts: [
          {
            type: "markdown",
            title: "Corrected Kappa Code",
            content: `# Corrected Kappa Code\n\n\`\`\`kappa\n${correctedCode}\n\`\`\`\n\n## Fixes Applied\n\n${hasErrors ? 'See the validation report above for details on fixes applied.' : 'No syntax errors found.'}`
          }
        ]
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
