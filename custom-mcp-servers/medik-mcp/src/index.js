"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQuery = runQuery;
exports.runBidirectionalQuery = runBidirectionalQuery;
exports.runNetworkNeighborhoodQuery = runNetworkNeighborhoodQuery;
var index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var zod_1 = require("zod");
var formatters_js_1 = require("./formatters.js");
var crypto_1 = require("crypto");
var llm_client_js_1 = require("../../mcp-helpers/llm-client.js");
var logger_js_1 = __importDefault(require("./logger.js"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
// Enable console interception to capture logs to file
logger_js_1.default.interceptConsole();
// Helper function for structured logging
function sendStructuredLog(server, level, message, metadata) {
    if (DEBUG)
        console.error("[medik-mcp] [MEDIK-STEP 0] PREPARING TO SEND LOG: ".concat(message));
    var timestamp = new Date().toISOString();
    var traceId = (0, crypto_1.randomUUID)().split('-')[0];
    var formattedMessage = "[medik-mcp] [".concat(level.toUpperCase(), "] [").concat(traceId, "] ").concat(message);
    try {
        if (DEBUG) {
            console.error("[medik-mcp] [MEDIK-STEP 0] Server object type: ".concat(typeof server));
            console.error("[medik-mcp] [MEDIK-STEP 0] Has sendLoggingMessage: ".concat(typeof server.sendLoggingMessage === 'function'));
        }
        var logPayload = {
            level: level,
            logger: 'medik-mcp',
            data: __assign({ message: formattedMessage, timestamp: timestamp, traceId: traceId, level: level, method: "logging/message" }, metadata),
        };
        if (DEBUG)
            console.error("[medik-mcp] [MEDIK-STEP 0] About to call server.sendLoggingMessage with payload: ".concat(JSON.stringify(logPayload)));
        server.sendLoggingMessage(logPayload);
        if (DEBUG)
            console.error("[medik-mcp] [MEDIK-STEP 0] \u2705 server.sendLoggingMessage completed without errors");
    }
    catch (error) {
        console.error("[medik-mcp] [MEDIK-STEP 0] \u274C ERROR SENDING LOG:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            level: level,
            message: message,
            metadata: metadata
        });
        console.error(formattedMessage);
        if (metadata && Object.keys(metadata).length > 0) {
            console.error("[medik-mcp] [".concat(traceId, "] Metadata:"), metadata);
        }
    }
}
// mediKanren API configuration
// const MEDIKANREN_API_BASE = "https://medikanren.loca.lt/";
var MEDIKANREN_API_BASE = "https://medikanren.metareflective.app";
// https://medikanren.loca.lt/
var DEBUG = false; // Set to false to reduce logging
// Initialize the LLM client
var llmClient = new llm_client_js_1.LLMClient({
    mcpName: 'medik-mcp', // Identifies this MCP in logs
    retries: 3 // Number of retry attempts for failed requests
});
// Log LLM client initialization 
if (DEBUG)
    console.error('[medik-mcp] LLM Client initialized');
// Define validation schemas based on the OpenAPI spec
var QueryRequestSchema = zod_1.z.object({
    e1: zod_1.z.string().describe("X->Known or Known->X, for subject unknown or object unknown respectively."),
    e2: zod_1.z.string().describe("A biolink predicate such as biolink:treats, from the biolink list."),
    e3: zod_1.z.string().describe("A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.")
});
// Define validation schema for network-neighborhood tool
var NetworkNeighborhoodRequestSchema = zod_1.z.object({
    curies: zod_1.z.array(zod_1.z.string()).min(2).describe("Array of CURIEs (at least 2) representing genes or proteins.")
});
// Define validation schema for get-everything tool
var GetEverythingRequestSchema = zod_1.z.object({
    curie: zod_1.z.string().describe("A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.")
});
// Define validation schema for find-pathway tool
var FindPathwayRequestSchema = zod_1.z.object({
    sourceCurie: zod_1.z.string().describe("CURIE of the first entity (e.g., gene HGNC:1097)"),
    targetCurie: zod_1.z.string().describe("CURIE of the second entity (e.g., disease MONDO:0011719)"),
    maxIterations: zod_1.z.number().default(3).describe("Maximum number of exploration iterations"),
    maxNodesPerIteration: zod_1.z.number().default(5).describe("Number of candidate nodes to explore in each iteration")
});
// Create server instance
var server = new index_js_1.Server({
    name: "medik-mcp",
    version: "1.0.1",
}, {
    capabilities: {
        tools: {},
        logging: {} // Add logging capability
    },
});
// Direct file logging for debugging
try {
    // Use the imported fs and path modules
    var debugDir = './debug';
    // Create debug directory if it doesn't exist
    if (!fs_1.default.existsSync(debugDir)) {
        fs_1.default.mkdirSync(debugDir, { recursive: true });
    }
    // Create a debug log file
    var timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');
    var debugFile_1 = path_1.default.join(debugDir, "medik-debug_".concat(timestamp, ".log"));
    // Write initial log
    fs_1.default.writeFileSync(debugFile_1, "MediK MCP Server Debug Log\nStarted at: ".concat(new Date().toISOString(), "\nVersion: 1.0.1\n\n"));
    // Log function for appending to the debug file
    global.writeDebugLog = function (message) {
        try {
            var logEntry = "[".concat(new Date().toISOString(), "] ").concat(message, "\n");
            fs_1.default.appendFileSync(debugFile_1, logEntry);
            console.error("[DEBUG] ".concat(message));
        }
        catch (err) {
            console.error("[ERROR] Failed to write debug log: ".concat(err));
        }
    };
    global.writeDebugLog('Debug logging initialized');
    global.writeDebugLog('Server version: 1.0.1');
    global.writeDebugLog('find-pathway tool is enabled');
}
catch (error) {
    console.error('Failed to initialize debug logging:', error);
}
// Log server initialization
console.log("[medik-mcp] Starting server v1.0.1 with find-pathway tool enabled");
console.log("[medik-mcp] Registering tools: run-query, get-everything, network-neighborhood, find-pathway");
// Debug helper for direct console output
function debugLog(message, data) {
    if (DEBUG) {
        console.error("[medik-mcp] [MEDIK-DEBUG] ".concat(message), data ? data : '');
    }
}
// Helper function for API requests
function makeMediKanrenRequest(params_1) {
    return __awaiter(this, arguments, void 0, function (params, retryCount) {
        var MAX_RETRIES, RETRY_DELAY_MS, url, queryParams, _i, _a, _b, key, value, fullUrl, headers, username, password, credentials, response, data, error_1;
        if (retryCount === void 0) { retryCount = 0; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    MAX_RETRIES = 5;
                    RETRY_DELAY_MS = 1000;
                    url = "".concat(MEDIKANREN_API_BASE, "/query");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    queryParams = new URLSearchParams();
                    for (_i = 0, _a = Object.entries(params); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], value = _b[1];
                        queryParams.append(key, value);
                    }
                    fullUrl = "".concat(url, "?").concat(queryParams.toString());
                    if (DEBUG)
                        console.error("[medik-mcp] Making request to: ".concat(fullUrl));
                    headers = {};
                    if (MEDIKANREN_API_BASE.includes('medikanren.loca.lt')) {
                        username = '';
                        password = '138.26.202.195';
                        credentials = Buffer.from("".concat(username, ":").concat(password)).toString('base64');
                        headers['Authorization'] = "Basic ".concat(credentials);
                    }
                    return [4 /*yield*/, fetch(fullUrl, {
                            method: 'GET',
                            headers: headers
                        })];
                case 2:
                    response = _c.sent();
                    if (!response.ok) {
                        console.error("[medik-mcp] HTTP error! status: ".concat(response.status, " for query: ").concat(JSON.stringify(params)));
                        throw new Error("HTTP error! status: ".concat(response.status, " for query: ").concat(JSON.stringify(params)));
                    }
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _c.sent();
                    return [2 /*return*/, data];
                case 4:
                    error_1 = _c.sent();
                    console.error("[medik-mcp] Error in request: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                    if (retryCount < MAX_RETRIES) {
                        if (DEBUG)
                            console.error("[medik-mcp] Retrying request (attempt ".concat(retryCount + 2, "/").concat(MAX_RETRIES + 1, ")"));
                        return [2 /*return*/, makeMediKanrenRequest(params, retryCount + 1)];
                    }
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Function to run a query
function runQuery(params) {
    return __awaiter(this, void 0, void 0, function () {
        var e1, e2, e3, queryResult, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e1 = params.e1, e2 = params.e2, e3 = params.e3;
                    if (DEBUG)
                        console.error("[medik-mcp] Query: ".concat(e1, " ").concat(e2, " ").concat(e3));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, makeMediKanrenRequest({
                            e1: e1,
                            e2: e2,
                            e3: e3
                        })];
                case 2:
                    queryResult = _a.sent();
                    if (!queryResult) {
                        console.error("[medik-mcp] Query failed");
                        return [2 /*return*/, null];
                    }
                    if (Array.isArray(queryResult) && DEBUG) {
                        console.error("[medik-mcp] Query returned ".concat(queryResult.length, " results"));
                    }
                    return [2 /*return*/, queryResult];
                case 3:
                    error_2 = _a.sent();
                    console.error("[medik-mcp] Query error:", error_2);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Function to run both X->Known and Known->X queries
function runBidirectionalQuery(params) {
    return __awaiter(this, void 0, void 0, function () {
        var curie, xToKnownResult, knownToXResult, combinedResults, deduplicatedResults, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    curie = params.curie;
                    if (DEBUG)
                        console.error("[medik-mcp] Starting bidirectional query for ".concat(curie));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    console.error("[medik-mcp] Running X->Known query for ".concat(curie));
                    return [4 /*yield*/, makeMediKanrenRequest({
                            e1: 'X->Known',
                            e2: 'biolink:related_to',
                            e3: curie
                        })];
                case 2:
                    xToKnownResult = _a.sent();
                    console.error("[medik-mcp] Running Known->X query for ".concat(curie));
                    return [4 /*yield*/, makeMediKanrenRequest({
                            e1: 'Known->X',
                            e2: 'biolink:related_to',
                            e3: curie
                        })];
                case 3:
                    knownToXResult = _a.sent();
                    combinedResults = [];
                    if (Array.isArray(xToKnownResult)) {
                        console.error("[medik-mcp] X->Known query for ".concat(curie, " returned ").concat(xToKnownResult.length, " results"));
                        combinedResults = __spreadArray(__spreadArray([], combinedResults, true), xToKnownResult, true);
                    }
                    else {
                        console.error("[medik-mcp] X->Known query for ".concat(curie, " failed or returned no results"));
                    }
                    if (Array.isArray(knownToXResult)) {
                        console.error("[medik-mcp] Known->X query for ".concat(curie, " returned ").concat(knownToXResult.length, " results"));
                        combinedResults = __spreadArray(__spreadArray([], combinedResults, true), knownToXResult, true);
                    }
                    else {
                        console.error("[medik-mcp] Known->X query for ".concat(curie, " failed or returned no results"));
                    }
                    deduplicatedResults = combinedResults.filter(function (result, index, self) {
                        return index === self.findIndex(function (r) { return (r[0] === result[0] &&
                            r[2] === result[2] &&
                            r[3] === result[3]); });
                    });
                    if (deduplicatedResults.length === 0) {
                        console.error("[medik-mcp] No results found for ".concat(curie, " after deduplication"));
                        return [2 /*return*/, null];
                    }
                    if (DEBUG)
                        console.error("[medik-mcp] Found ".concat(deduplicatedResults.length, " unique relationships"));
                    return [2 /*return*/, deduplicatedResults];
                case 4:
                    error_3 = _a.sent();
                    console.error("[medik-mcp] Error in bidirectional query: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)));
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Function to run network neighborhood query
function runNetworkNeighborhoodQuery(params) {
    return __awaiter(this, void 0, void 0, function () {
        var curies, allResults, successfulGenes, failedGenes, _i, curies_1, curie, queryResult, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    curies = params.curies;
                    if (DEBUG) {
                        console.error("[medik-mcp] MEDIK: NEW NETWORK NEIGHBORHOOD QUERY STARTED AT ".concat(new Date().toISOString()));
                        console.error("[medik-mcp] MEDIK: Query for genes: ".concat(curies.join(', ')));
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    allResults = [];
                    successfulGenes = [];
                    failedGenes = [];
                    _i = 0, curies_1 = curies;
                    _a.label = 2;
                case 2:
                    if (!(_i < curies_1.length)) return [3 /*break*/, 5];
                    curie = curies_1[_i];
                    console.error("[medik-mcp] Processing gene: ".concat(curie));
                    return [4 /*yield*/, runBidirectionalQuery({ curie: curie })];
                case 3:
                    queryResult = _a.sent();
                    if (Array.isArray(queryResult) && queryResult.length > 0) {
                        console.error("[medik-mcp] Successfully retrieved ".concat(queryResult.length, " relationships for ").concat(curie));
                        allResults.push.apply(allResults, queryResult);
                        successfulGenes.push(curie);
                    }
                    else {
                        console.error("[medik-mcp] Failed to retrieve relationships for ".concat(curie));
                        failedGenes.push(curie);
                    }
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.error("[medik-mcp] Network neighborhood query summary:");
                    console.error("[medik-mcp] - Total genes processed: ".concat(curies.length));
                    console.error("[medik-mcp] - Successful genes: ".concat(successfulGenes.length, " (").concat(successfulGenes.join(', '), ")"));
                    console.error("[medik-mcp] - Failed genes: ".concat(failedGenes.length, " (").concat(failedGenes.join(', '), ")"));
                    console.error("[medik-mcp] - Total relationships retrieved: ".concat(allResults.length));
                    return [2 /*return*/, allResults];
                case 6:
                    error_4 = _a.sent();
                    console.error("[medik-mcp] MEDIK: Network neighborhood query error:", error_4);
                    return [2 /*return*/, null];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// List available tools
server.setRequestHandler(types_js_1.ListToolsRequestSchema, function () { return __awaiter(void 0, void 0, void 0, function () {
    var allTools, findPathwayTool;
    return __generator(this, function (_a) {
        console.error('[TOOLS-DEBUG] Starting ListToolsRequestSchema handler');
        // Create the tools array with all tools
        console.error('[TOOLS-DEBUG] Creating tools array...');
        allTools = [
            {
                name: "run-query",
                description: "Run a 1-hop query in mediKanren. Note: If you need comprehensive bidirectional relationships, use get-everything instead as it provides complete coverage.",
                inputSchema: {
                    type: "object",
                    properties: {
                        e1: {
                            type: "string",
                            description: "X->Known or Known->X, for subject unknown or object unknown respectively.",
                        },
                        e2: {
                            type: "string",
                            description: "A biolink predicate such as biolink:treats, from the biolink list.",
                        },
                        e3: {
                            type: "string",
                            description: "A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.",
                        }
                    },
                    required: ["e1", "e2", "e3"],
                },
            },
            {
                name: "get-everything",
                description: "Run both X->Known and Known->X queries with biolink:related_to to get all relationships for a CURIE. This is the recommended comprehensive query that provides complete bidirectional coverage. Do not use run-query if you are using this tool as it would be redundant.",
                inputSchema: {
                    type: "object",
                    properties: {
                        curie: {
                            type: "string",
                            description: "A CURIE such as MONDO:0011719; you can ask a Monarch action to get a CURIE from a name.",
                        }
                    },
                    required: ["curie"],
                },
            },
            {
                name: "find-pathway",
                description: "Find potential connection pathways between two biomedical entities by exploring the knowledge graph",
                inputSchema: {
                    type: "object",
                    properties: {
                        sourceCurie: {
                            type: "string",
                            description: "CURIE of the first entity (e.g., gene HGNC:1097)",
                        },
                        targetCurie: {
                            type: "string",
                            description: "CURIE of the second entity (e.g., disease MONDO:0011719)",
                        },
                        maxIterations: {
                            type: "number",
                            description: "Maximum number of exploration iterations (default: 3)",
                        },
                        maxNodesPerIteration: {
                            type: "number",
                            description: "Number of candidate nodes to explore in each iteration (default: 5)",
                        }
                    },
                    required: ["sourceCurie", "targetCurie"],
                },
                // These fields were causing issues, removing them
                // version: "0.1",
                // enabled: true  // Explicitly mark the tool as enabled
            },
            {
                name: "network-neighborhood",
                description: "Find genes or proteins that are neighbors in the network.",
                inputSchema: {
                    type: "object",
                    properties: {
                        curies: {
                            type: "array",
                            items: {
                                type: "string",
                                description: "Array of CURIEs (at least 2) representing genes or proteins.",
                            },
                            minItems: 2,
                            description: "Array of CURIEs (at least 2) representing genes or proteins.",
                        },
                    },
                    required: ["curies"],
                },
            }
        ];
        console.error('[TOOLS-DEBUG] Tools list created with', allTools.length, 'tools');
        console.error('[TOOLS-DEBUG] Tools names:', allTools.map(function (t) { return t.name; }).join(', '));
        findPathwayTool = allTools.find(function (t) { return t.name === 'find-pathway'; });
        console.error('[TOOLS-DEBUG] Find-pathway tool found?', !!findPathwayTool);
        // Log to debug file
        if (global.writeDebugLog) {
            global.writeDebugLog('--------- TOOLS LIST ---------');
            global.writeDebugLog("Returning ".concat(allTools.length, " tools:"));
            allTools.forEach(function (tool) {
                global.writeDebugLog("- ".concat(tool.name, ": ").concat(tool.description.substring(0, 50), "..."));
            });
        }
        console.error('[TOOLS-DEBUG] Final tools count before return:', allTools.length);
        return [2 /*return*/, {
                tools: allTools
            }];
    });
}); });
// Handle tool execution
server.setRequestHandler(types_js_1.CallToolRequestSchema, function (request, extra) { return __awaiter(void 0, void 0, void 0, function () {
    var toolName, toolArgs, _a, e1, e2, e3, queryResult, formattingPromise, formattedResult, error_5, formattedResult, curie_1, queryResult, combinedParams, formattingPromise, formattedResult, knowledgeGraphArtifact, graph, filteredGraph, connectedToSource_1, connectedToTarget_1, pathwayNodes_1, expandedPathwayNodes_1, metadata, error_6, curies, queryResult, formattingPromise, formattedResult, error_7, _b, sourceCurie_1, targetCurie_1, _c, maxIterations, _d, maxNodesPerIteration, requestId, sourceNeighborhood, targetNeighborhood, combinedResults, startingNodeIds, pathwayGraphPromise, formatRelationshipForLLM, sourceRelationships, targetRelationships, systemPrompt, userPrompt, response, graphResult_1, analysisText, graphResult, knowledgeGraphArtifact, graph, filteredGraph, connectedToSource_2, connectedToTarget_2, pathwayNodes_2, expandedPathwayNodes_2, combinedContent, llmError_1, errorDetails, graphResult, error_8, minimalGraph, minimalArtifact, error_9;
    var _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                _k.trys.push([0, 40, , 41]);
                toolName = request.params.name;
                toolArgs = request.params.arguments || {};
                debugLog('Tool execution started', {
                    tool: toolName,
                    args: toolArgs,
                    hasExtra: !!extra
                });
                if (DEBUG) {
                    console.error('MEDIK: Tool request:', { toolName: toolName, toolArgs: toolArgs });
                }
                if (!(toolName === "run-query")) return [3 /*break*/, 8];
                _a = QueryRequestSchema.parse(toolArgs), e1 = _a.e1, e2 = _a.e2, e3 = _a.e3;
                if (DEBUG) {
                    console.error("\n\n========================================");
                    console.error("MEDIK: NEW QUERY STARTED AT ".concat(new Date().toISOString()));
                    console.error("MEDIK: Query: ".concat(e1, " ").concat(e2, " ").concat(e3));
                    console.error("========================================\n");
                    console.error('MEDIK: Parsed arguments:', { e1: e1, e2: e2, e3: e3 });
                }
                return [4 /*yield*/, runQuery({ e1: e1, e2: e2, e3: e3 })];
            case 1:
                queryResult = _k.sent();
                if (!queryResult) {
                    if (DEBUG) {
                        console.error("========================================");
                        console.error("MEDIK: QUERY FAILED AT ".concat(new Date().toISOString()));
                        console.error("========================================\n");
                    }
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Failed to retrieve query results. Please check the server logs for details.",
                                },
                            ],
                        }];
                }
                if (!Array.isArray(queryResult)) return [3 /*break*/, 6];
                server.sendLoggingMessage({
                    level: "info",
                    data: {
                        message: "MEDIK: Filtering out nodes with CAID: prefix from query results",
                        originalResultCount: queryResult.length
                    },
                });
                if (DEBUG)
                    console.error("MEDIK: Starting CAID node filtering process on ".concat(queryResult.length, " results"));
                _k.label = 2;
            case 2:
                _k.trys.push([2, 4, , 5]);
                if (DEBUG)
                    console.error("MEDIK: Calling formatKnowledgeGraphArtifact with ".concat(queryResult.length, " results"));
                formattingPromise = (0, formatters_js_1.formatKnowledgeGraphArtifact)(queryResult, { e1: e1, e2: e2, e3: e3 });
                if (DEBUG)
                    console.error("MEDIK: Got Promise from formatKnowledgeGraphArtifact, waiting for resolution...");
                return [4 /*yield*/, formattingPromise];
            case 3:
                formattedResult = _k.sent();
                if (DEBUG)
                    console.error("MEDIK: Promise resolved successfully, got formatted result");
                if (formattedResult.filteredCount && formattedResult.filteredCount > 0) {
                    if (DEBUG)
                        console.error("MEDIK: Filtered out ".concat(formattedResult.filteredCount, " relationships involving ").concat(formattedResult.filteredNodeCount, " unique CAID nodes"));
                    server.sendLoggingMessage({
                        level: "info",
                        data: {
                            message: "MEDIK: Filtered out ".concat(formattedResult.filteredCount, " relationships involving ").concat(formattedResult.filteredNodeCount, " unique nodes with CAID: prefix"),
                            filteredCount: formattedResult.filteredCount,
                            filteredNodeCount: formattedResult.filteredNodeCount,
                            remainingCount: queryResult.length - formattedResult.filteredCount
                        },
                    });
                }
                else if (DEBUG) {
                    console.error("MEDIK: No CAID nodes found in the results");
                }
                if (DEBUG) {
                    console.error("MEDIK: Formatted result has ".concat(formattedResult.content.length, " content items and ").concat(((_e = formattedResult.artifacts) === null || _e === void 0 ? void 0 : _e.length) || 0, " artifacts"));
                    console.error("\n========================================");
                    console.error("MEDIK: QUERY COMPLETED SUCCESSFULLY AT ".concat(new Date().toISOString()));
                    console.error("========================================\n");
                }
                return [2 /*return*/, {
                        content: formattedResult.content,
                        artifacts: formattedResult.artifacts
                    }];
            case 4:
                error_5 = _k.sent();
                console.error("MEDIK: Error formatting results: ".concat(error_5 instanceof Error ? error_5.message : String(error_5)));
                if (DEBUG) {
                    console.error("MEDIK: Error stack trace: ".concat(error_5 instanceof Error ? error_5.stack : 'No stack trace available'));
                    console.error("========================================");
                    console.error("MEDIK: QUERY ERROR AT ".concat(new Date().toISOString(), ": Error formatting results"));
                    console.error("========================================\n");
                }
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Error formatting results: ".concat(error_5 instanceof Error ? error_5.message : 'Unknown error'),
                            },
                        ],
                    }];
            case 5: return [3 /*break*/, 7];
            case 6:
                if ('error' in queryResult) {
                    console.error("========================================");
                    console.error("MEDIK: QUERY ERROR AT ".concat(new Date().toISOString(), ": ").concat(queryResult.error));
                    console.error("========================================\n");
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Error: ".concat(queryResult.error),
                                },
                            ],
                        }];
                }
                else {
                    console.error("========================================");
                    console.error("MEDIK: QUERY COMPLETED WITH UNKNOWN RESULT TYPE AT ".concat(new Date().toISOString()));
                    console.error("========================================\n");
                    formattedResult = JSON.stringify(queryResult, null, 2);
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Query results:\n\n".concat(formattedResult),
                                },
                            ],
                        }];
                }
                _k.label = 7;
            case 7: return [3 /*break*/, 39];
            case 8:
                if (!(toolName === "get-everything")) return [3 /*break*/, 16];
                curie_1 = GetEverythingRequestSchema.parse(toolArgs).curie;
                // Add explicit logging for testing
                sendStructuredLog(server, 'info', "Processing get-everything request for ".concat(curie_1), {
                    curie: curie_1,
                    toolName: toolName,
                    timestamp: new Date().toISOString()
                });
                console.error("MEDIK: Query: get-everything for ".concat(curie_1));
                // Add a clear boundary marker for the start of a new query
                console.error("\n\n========================================");
                console.error("MEDIK: NEW BIDIRECTIONAL QUERY STARTED AT ".concat(new Date().toISOString()));
                console.error("MEDIK: Query: get-everything for ".concat(curie_1));
                console.error("========================================\n");
                if (DEBUG) {
                    console.error('MEDIK: Parsed arguments:', { curie: curie_1 });
                }
                return [4 /*yield*/, runBidirectionalQuery({ curie: curie_1 })];
            case 9:
                queryResult = _k.sent();
                if (!queryResult) {
                    console.error("========================================");
                    console.error("MEDIK: BIDIRECTIONAL QUERY FAILED AT ".concat(new Date().toISOString()));
                    console.error("========================================\n");
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Failed to retrieve bidirectional query results. Please check the server logs for details.",
                                },
                            ],
                            metadata: {
                                querySuccess: false,
                                bothDirectionsSuccessful: false,
                                nodeCount: 0
                            }
                        }];
                }
                if (!Array.isArray(queryResult)) return [3 /*break*/, 14];
                // Log that we're filtering CAID nodes
                server.sendLoggingMessage({
                    level: "info",
                    data: {
                        message: "MEDIK: Filtering out nodes with CAID: prefix from bidirectional query results",
                        originalResultCount: queryResult.length
                    },
                });
                _k.label = 10;
            case 10:
                _k.trys.push([10, 12, , 13]);
                console.error("MEDIK: Calling formatKnowledgeGraphArtifact with ".concat(queryResult.length, " results"));
                combinedParams = {
                    e1: "Bidirectional",
                    e2: "biolink:related_to",
                    e3: curie_1
                };
                formattingPromise = (0, formatters_js_1.formatKnowledgeGraphArtifact)(queryResult, combinedParams);
                console.error("MEDIK: Got Promise from formatKnowledgeGraphArtifact, waiting for resolution...");
                return [4 /*yield*/, formattingPromise];
            case 11:
                formattedResult = _k.sent();
                console.error("MEDIK: Promise resolved successfully, got formatted result");
                // Filter the knowledge graph to remove nodes with only one connection
                if (formattedResult.artifacts && formattedResult.artifacts.length > 0) {
                    knowledgeGraphArtifact = formattedResult.artifacts.find(function (a) { return a.type === 'application/vnd.knowledge-graph'; });
                    if (knowledgeGraphArtifact && knowledgeGraphArtifact.content) {
                        // Parse the knowledge graph content
                        try {
                            graph = typeof knowledgeGraphArtifact.content === 'string'
                                ? JSON.parse(knowledgeGraphArtifact.content)
                                : knowledgeGraphArtifact.content;
                            filteredGraph = filterLowConnectivityNodes(graph, new Set([curie_1]));
                            connectedToSource_1 = new Set([curie_1]);
                            connectedToTarget_1 = new Set([curie_1]);
                            // First pass: identify nodes connected to source or target (direct neighbors)
                            filteredGraph.links.forEach(function (link) {
                                if (link.source === curie_1) {
                                    connectedToSource_1.add(link.target);
                                }
                                else if (link.target === curie_1) {
                                    connectedToSource_1.add(link.source);
                                }
                                if (link.source === curie_1) {
                                    connectedToTarget_1.add(link.target);
                                }
                                else if (link.target === curie_1) {
                                    connectedToTarget_1.add(link.source);
                                }
                            });
                            pathwayNodes_1 = new Set([curie_1]);
                            connectedToSource_1.forEach(function (nodeId) {
                                if (connectedToTarget_1.has(nodeId)) {
                                    pathwayNodes_1.add(nodeId);
                                }
                            });
                            expandedPathwayNodes_1 = new Set(pathwayNodes_1);
                            filteredGraph.links.forEach(function (link) {
                                if (pathwayNodes_1.has(link.source) && pathwayNodes_1.has(link.target)) {
                                    expandedPathwayNodes_1.add(link.source);
                                    expandedPathwayNodes_1.add(link.target);
                                }
                            });
                            // Keep only nodes that are on potential pathways
                            filteredGraph.nodes = filteredGraph.nodes.filter(function (node) {
                                return expandedPathwayNodes_1.has(node.id);
                            });
                            // Keep only links between pathway nodes
                            filteredGraph.links = filteredGraph.links.filter(function (link) {
                                return expandedPathwayNodes_1.has(link.source) && expandedPathwayNodes_1.has(link.target);
                            });
                            // Update the artifact content with the filtered graph
                            knowledgeGraphArtifact.content = typeof knowledgeGraphArtifact.content === 'string'
                                ? JSON.stringify(filteredGraph)
                                : filteredGraph;
                            console.error("[medik-mcp] Enhanced pathway filtering: ".concat(filteredGraph.nodes.length, " nodes, ").concat(filteredGraph.links.length, " links"));
                        }
                        catch (filterError) {
                            console.error("[medik-mcp] Error filtering knowledge graph:", filterError);
                            // If filtering fails, just use the original graph
                        }
                    }
                }
                metadata = {
                    querySuccess: true,
                    bothDirectionsSuccessful: true, // Since this is a bidirectional query and we got results
                    nodeCount: JSON.parse(((_g = (_f = formattedResult.artifacts) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.content) || '{"nodes":[]}').nodes.length,
                    message: "Both forward and reverse queries were successful. No need to run this query again."
                };
                // Return the formatted result with metadata
                return [2 /*return*/, {
                        content: formattedResult.content,
                        artifacts: formattedResult.artifacts,
                        metadata: metadata
                    }];
            case 12:
                error_6 = _k.sent();
                console.error("MEDIK: Error formatting knowledge graph:", error_6);
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Error formatting knowledge graph: ".concat(error_6),
                            },
                        ],
                        metadata: {
                            querySuccess: false,
                            bothDirectionsSuccessful: false,
                            nodeCount: 0
                        }
                    }];
            case 13: return [3 /*break*/, 15];
            case 14:
                // Handle error response
                console.error("MEDIK: Query returned an error:", queryResult);
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Query error: ".concat(queryResult.error),
                            },
                        ],
                        metadata: {
                            querySuccess: false,
                            bothDirectionsSuccessful: false,
                            nodeCount: 0
                        }
                    }];
            case 15: return [3 /*break*/, 39];
            case 16:
                if (!(toolName === "network-neighborhood")) return [3 /*break*/, 24];
                curies = NetworkNeighborhoodRequestSchema.parse(toolArgs).curies;
                // Add explicit logging for testing
                sendStructuredLog(server, 'info', "Processing network-neighborhood request for ".concat(curies.join(', ')), {
                    curies: curies,
                    toolName: toolName,
                    timestamp: new Date().toISOString()
                });
                console.error("MEDIK: Query: network-neighborhood for ".concat(curies.join(', ')));
                // Add a clear boundary marker for the start of a new query
                console.error("\n\n========================================");
                console.error("MEDIK: NEW NETWORK NEIGHBORHOOD QUERY STARTED AT ".concat(new Date().toISOString()));
                console.error("MEDIK: Query: network-neighborhood for ".concat(curies.join(', ')));
                console.error("========================================\n");
                if (DEBUG) {
                    console.error('MEDIK: Parsed arguments:', { curies: curies });
                }
                return [4 /*yield*/, runNetworkNeighborhoodQuery({ curies: curies })];
            case 17:
                queryResult = _k.sent();
                if (!queryResult) {
                    console.error("========================================");
                    console.error("MEDIK: NETWORK NEIGHBORHOOD QUERY FAILED AT ".concat(new Date().toISOString()));
                    console.error("========================================\n");
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Failed to retrieve network-neighborhood query results. Please check the server logs for details.",
                                },
                            ],
                        }];
                }
                if (!Array.isArray(queryResult)) return [3 /*break*/, 22];
                // Log that we're filtering CAID nodes
                server.sendLoggingMessage({
                    level: "info",
                    data: {
                        message: "MEDIK: Filtering out nodes with CAID: prefix from network-neighborhood query results",
                        originalResultCount: queryResult.length
                    },
                });
                _k.label = 18;
            case 18:
                _k.trys.push([18, 20, , 21]);
                console.error("MEDIK: Calling formatNetworkNeighborhood with ".concat(queryResult.length, " results"));
                formattingPromise = (0, formatters_js_1.formatNetworkNeighborhood)(queryResult, curies);
                console.error("MEDIK: Got Promise from formatNetworkNeighborhood, waiting for resolution...");
                return [4 /*yield*/, formattingPromise];
            case 19:
                formattedResult = _k.sent();
                console.error("MEDIK: Promise resolved successfully, got formatted result");
                // Log the filtering results
                if (formattedResult.filteredCount && formattedResult.filteredCount > 0) {
                    console.error("MEDIK: Filtered out ".concat(formattedResult.filteredCount, " relationships involving ").concat(formattedResult.filteredNodeCount, " unique CAID nodes"));
                    server.sendLoggingMessage({
                        level: "info",
                        data: {
                            message: "MEDIK: Filtered out ".concat(formattedResult.filteredCount, " relationships involving ").concat(formattedResult.filteredNodeCount, " unique nodes with CAID: prefix"),
                            filteredCount: formattedResult.filteredCount,
                            filteredNodeCount: formattedResult.filteredNodeCount,
                            remainingCount: queryResult.length - formattedResult.filteredCount
                        },
                    });
                }
                else {
                    console.error("MEDIK: No CAID nodes found in the results");
                }
                // Log the content and artifacts
                console.error("MEDIK: Formatted result has ".concat(formattedResult.content.length, " content items and ").concat(((_h = formattedResult.artifacts) === null || _h === void 0 ? void 0 : _h.length) || 0, " artifacts"));
                // Add a clear boundary marker for the end of a successful query
                console.error("\n========================================");
                console.error("MEDIK: QUERY COMPLETED SUCCESSFULLY AT ".concat(new Date().toISOString()));
                console.error("========================================\n");
                // Return the formatted result as a ServerResult
                return [2 /*return*/, {
                        content: formattedResult.content,
                        artifacts: formattedResult.artifacts
                    }];
            case 20:
                error_7 = _k.sent();
                console.error("MEDIK: Error formatting results:", error_7);
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Error formatting results: ".concat(error_7 instanceof Error ? error_7.message : 'Unknown error'),
                            },
                        ],
                    }];
            case 21: return [3 /*break*/, 23];
            case 22:
                // Handle error response
                console.error("MEDIK: Query returned an error:", queryResult);
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Query error: ".concat(queryResult.error),
                            },
                        ],
                    }];
            case 23: return [3 /*break*/, 39];
            case 24:
                if (!(toolName === "find-pathway")) return [3 /*break*/, 38];
                _b = FindPathwayRequestSchema.parse(toolArgs), sourceCurie_1 = _b.sourceCurie, targetCurie_1 = _b.targetCurie, _c = _b.maxIterations, maxIterations = _c === void 0 ? 3 : _c, _d = _b.maxNodesPerIteration, maxNodesPerIteration = _d === void 0 ? 5 : _d;
                requestId = (0, crypto_1.randomUUID)().substring(0, 8);
                // Log the request
                sendStructuredLog(server, 'info', "Starting pathway discovery between ".concat(sourceCurie_1, " and ").concat(targetCurie_1), {
                    requestId: requestId,
                    sourceCurie: sourceCurie_1,
                    targetCurie: targetCurie_1,
                    maxIterations: maxIterations,
                    maxNodesPerIteration: maxNodesPerIteration
                });
                _k.label = 25;
            case 25:
                _k.trys.push([25, 36, , 37]);
                // Step 1: Get initial neighborhoods for source and target
                sendStructuredLog(server, 'info', "Querying initial neighborhoods for source and target", {
                    requestId: requestId,
                    stage: "initial_neighborhoods"
                });
                return [4 /*yield*/, runBidirectionalQuery({ curie: sourceCurie_1 })];
            case 26:
                sourceNeighborhood = _k.sent();
                return [4 /*yield*/, runBidirectionalQuery({ curie: targetCurie_1 })];
            case 27:
                targetNeighborhood = _k.sent();
                if (!sourceNeighborhood || !targetNeighborhood) {
                    sendStructuredLog(server, 'error', "Failed to retrieve neighborhoods for source or target", {
                        sourceCurie: sourceCurie_1,
                        targetCurie: targetCurie_1,
                        sourceSuccess: !!sourceNeighborhood,
                        targetSuccess: !!targetNeighborhood
                    });
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Could not find neighborhood information for ".concat(!sourceNeighborhood ? sourceCurie_1 : '', " ").concat(!sourceNeighborhood && !targetNeighborhood ? 'and' : '', " ").concat(!targetNeighborhood ? targetCurie_1 : '', ". Please verify these CURIEs exist in the knowledge graph.")
                                }
                            ]
                        }];
                }
                combinedResults = [];
                startingNodeIds = new Set([sourceCurie_1, targetCurie_1]);
                // Add source neighborhood relationships to the combined results
                if (Array.isArray(sourceNeighborhood)) {
                    combinedResults.push.apply(combinedResults, sourceNeighborhood);
                }
                // Add target neighborhood relationships to the combined results
                if (Array.isArray(targetNeighborhood)) {
                    combinedResults.push.apply(combinedResults, targetNeighborhood);
                }
                pathwayGraphPromise = (0, formatters_js_1.formatKnowledgeGraphArtifact)(combinedResults, {
                    e1: "PathwayAnalysis",
                    e2: "pathway-between",
                    e3: "".concat(sourceCurie_1, "_to_").concat(targetCurie_1)
                }, startingNodeIds);
                // Step 2: Format the neighborhoods for the LLM
                sendStructuredLog(server, 'info', "Formatting neighborhoods for LLM analysis", {
                    requestId: requestId,
                    stage: "data_preparation"
                });
                formatRelationshipForLLM = function (rel) {
                    // Expected format: [subject, predicate, object, ...]
                    return {
                        subject: rel[0] || 'Unknown',
                        predicate: rel[2] || 'Unknown',
                        object: rel[3] || 'Unknown'
                    };
                };
                sourceRelationships = Array.isArray(sourceNeighborhood)
                    ? sourceNeighborhood
                        .filter(function (rel) { return rel && rel.length >= 4; })
                        .map(formatRelationshipForLLM)
                        .slice(0, 20) // Limit to 20 relationships to avoid token limits
                    : [];
                targetRelationships = Array.isArray(targetNeighborhood)
                    ? targetNeighborhood
                        .filter(function (rel) { return rel && rel.length >= 4; })
                        .map(formatRelationshipForLLM)
                        .slice(0, 20) // Limit to 20 relationships
                    : [];
                sendStructuredLog(server, 'info', "Using LLM to identify potential connecting paths", {
                    requestId: requestId,
                    stage: "llm_analysis",
                    sourceRelationshipsCount: sourceRelationships.length,
                    targetRelationshipsCount: targetRelationships.length
                });
                _k.label = 28;
            case 28:
                _k.trys.push([28, 33, , 35]);
                // Log that we're about to call the LLM
                console.error("[medik-mcp] [Pathfinder:".concat(requestId, "] Calling LLM client for pathway analysis between ").concat(sourceCurie_1, " and ").concat(targetCurie_1));
                // Add detailed logging before LLM call
                sendStructuredLog(server, 'info', "[Pathfinder:".concat(requestId, "] Preparing LLM request with prompt data"), {
                    stage: "llm_request_preparation",
                    requestId: requestId,
                    model: "claude-3-opus-20240229",
                    promptLength: {
                        system: generateSystemPrompt().length,
                        user: generateUserPrompt(sourceCurie_1, targetCurie_1).length
                    },
                    timestamp: new Date().toISOString()
                });
                systemPrompt = generateSystemPrompt();
                userPrompt = generateUserPrompt(sourceCurie_1, targetCurie_1);
                console.error("[medik-mcp] [Pathfinder:".concat(requestId, "] Using llmClient to query LLM"));
                return [4 /*yield*/, llmClient.query({
                        prompt: userPrompt,
                        systemPrompt: systemPrompt,
                        responseFormat: 'text',
                        options: {
                            model: "claude-3-opus-20240229"
                        }
                    })];
            case 29:
                response = _k.sent();
                // Log the raw response for debugging
                console.error("[medik-mcp] [Pathfinder:".concat(requestId, "] Raw LLM response:"), response ? "success=".concat(response.success, ", content_length=").concat(((_j = response.content) === null || _j === void 0 ? void 0 : _j.length) || 0) : 'null');
                // Add more detailed logging for the response
                sendStructuredLog(server, 'info', "[Pathfinder:".concat(requestId, "] Received LLM response"), {
                    stage: "llm_response_received",
                    requestId: requestId,
                    status: (response === null || response === void 0 ? void 0 : response.success) ? "success" : "error",
                    hasContent: !!(response === null || response === void 0 ? void 0 : response.content),
                    contentSize: (response === null || response === void 0 ? void 0 : response.content) ? response.content.length : 0,
                    errorMessage: (response === null || response === void 0 ? void 0 : response.error) || null,
                    responseTime: new Date().toISOString()
                });
                console.error("[medik-mcp] [Pathfinder:".concat(requestId, "] LLM response received: ").concat((response === null || response === void 0 ? void 0 : response.success) ? "success" : "error"));
                if (!(!response || !response.success || !response.content)) return [3 /*break*/, 31];
                // Add detailed error logging
                sendStructuredLog(server, 'error', "[Pathfinder:".concat(requestId, "] Failed to extract pathways from LLM response"), {
                    stage: "llm_extraction_failure",
                    requestId: requestId,
                    error: (response === null || response === void 0 ? void 0 : response.error) || "Invalid or empty LLM response",
                    rawResponse: response ? JSON.stringify(response).substring(0, 500) : "null",
                    timestamp: new Date().toISOString()
                });
                return [4 /*yield*/, pathwayGraphPromise];
            case 30:
                graphResult_1 = _k.sent();
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "## Pathway Analysis Results\n\n### Source Entity: ".concat(sourceCurie_1, "\nFound ").concat(sourceRelationships.length, " relationships in its neighborhood.\n\n### Target Entity: ").concat(targetCurie_1, "\nFound ").concat(targetRelationships.length, " relationships in its neighborhood.\n\n### LLM Analysis Failed\nCould not generate pathway analysis due to an error with the LLM service.\nThe basic neighborhood data has been retrieved successfully.\n\n---\n**IMPORTANT: Analysis complete with graph visualization despite LLM error. No need to run this query again.**\n\n*Error details: ").concat((response === null || response === void 0 ? void 0 : response.error) || 'Unknown error', "*")
                            }
                        ],
                        artifacts: graphResult_1.artifacts,
                        metadata: {
                            pathfinder: true,
                            sourceCurie: sourceCurie_1,
                            targetCurie: targetCurie_1,
                            llmSuccess: false,
                            version: "0.2-with-graph"
                        }
                    }];
            case 31:
                analysisText = "## Pathway Analysis Results\n\n### Source Entity: ".concat(sourceCurie_1, "\nFound ").concat(sourceRelationships.length, " relationships in its neighborhood.\n\n### Target Entity: ").concat(targetCurie_1, "\nFound ").concat(targetRelationships.length, " relationships in its neighborhood.\n\n### Potential Pathways\n").concat(response.content, "\n\n---\n**IMPORTANT: Analysis complete with both text and graph visualization. No need to run this query again.**\n\n*This task is complete. The knowledge graph visualization shows the network connections between the entities.*");
                return [4 /*yield*/, pathwayGraphPromise];
            case 32:
                graphResult = _k.sent();
                // Filter the knowledge graph to remove nodes with only one connection
                if (graphResult.artifacts && graphResult.artifacts.length > 0) {
                    knowledgeGraphArtifact = graphResult.artifacts.find(function (a) { return a.type === 'application/vnd.knowledge-graph'; });
                    if (knowledgeGraphArtifact && knowledgeGraphArtifact.content) {
                        // Parse the knowledge graph content
                        try {
                            graph = typeof knowledgeGraphArtifact.content === 'string'
                                ? JSON.parse(knowledgeGraphArtifact.content)
                                : knowledgeGraphArtifact.content;
                            filteredGraph = filterLowConnectivityNodes(graph, startingNodeIds);
                            connectedToSource_2 = new Set([sourceCurie_1]);
                            connectedToTarget_2 = new Set([targetCurie_1]);
                            // First pass: identify nodes connected to source or target (direct neighbors)
                            filteredGraph.links.forEach(function (link) {
                                if (link.source === sourceCurie_1) {
                                    connectedToSource_2.add(link.target);
                                }
                                else if (link.target === sourceCurie_1) {
                                    connectedToSource_2.add(link.source);
                                }
                                if (link.source === targetCurie_1) {
                                    connectedToTarget_2.add(link.target);
                                }
                                else if (link.target === targetCurie_1) {
                                    connectedToTarget_2.add(link.source);
                                }
                            });
                            pathwayNodes_2 = new Set([sourceCurie_1, targetCurie_1]);
                            connectedToSource_2.forEach(function (nodeId) {
                                if (connectedToTarget_2.has(nodeId)) {
                                    pathwayNodes_2.add(nodeId);
                                }
                            });
                            expandedPathwayNodes_2 = new Set(pathwayNodes_2);
                            filteredGraph.links.forEach(function (link) {
                                if (pathwayNodes_2.has(link.source) && pathwayNodes_2.has(link.target)) {
                                    expandedPathwayNodes_2.add(link.source);
                                    expandedPathwayNodes_2.add(link.target);
                                }
                            });
                            // Keep only nodes that are on potential pathways
                            filteredGraph.nodes = filteredGraph.nodes.filter(function (node) {
                                return expandedPathwayNodes_2.has(node.id);
                            });
                            // Keep only links between pathway nodes
                            filteredGraph.links = filteredGraph.links.filter(function (link) {
                                return expandedPathwayNodes_2.has(link.source) && expandedPathwayNodes_2.has(link.target);
                            });
                            // Update the artifact content with the filtered graph
                            knowledgeGraphArtifact.content = typeof knowledgeGraphArtifact.content === 'string'
                                ? JSON.stringify(filteredGraph)
                                : filteredGraph;
                            console.error("[medik-mcp] Enhanced pathway filtering: ".concat(filteredGraph.nodes.length, " nodes, ").concat(filteredGraph.links.length, " links"));
                        }
                        catch (filterError) {
                            console.error("[medik-mcp] Error filtering knowledge graph:", filterError);
                            // If filtering fails, just use the original graph
                        }
                    }
                }
                combinedContent = [
                    {
                        type: "text",
                        text: analysisText
                    }
                ];
                // Return the formatted response with both text and graph
                return [2 /*return*/, {
                        content: combinedContent,
                        artifacts: graphResult.artifacts,
                        metadata: {
                            pathfinder: true,
                            sourceCurie: sourceCurie_1,
                            targetCurie: targetCurie_1,
                            maxIterations: maxIterations,
                            maxNodesPerIteration: maxNodesPerIteration,
                            sourceNeighborhoodSize: Array.isArray(sourceNeighborhood) ? sourceNeighborhood.length : 0,
                            targetNeighborhoodSize: Array.isArray(targetNeighborhood) ? targetNeighborhood.length : 0,
                            llmSuccess: response.success,
                            version: "0.2-with-graph"
                        }
                    }];
            case 33:
                llmError_1 = _k.sent();
                // Handle LLM error gracefully with detailed logs
                console.error("[medik-mcp] [Pathfinder:".concat(requestId, "] LLM query error:"), llmError_1);
                errorDetails = {
                    message: llmError_1 instanceof Error ? llmError_1.message : String(llmError_1),
                    stack: llmError_1 instanceof Error ? llmError_1.stack : undefined,
                    name: llmError_1 instanceof Error ? llmError_1.name : undefined,
                    toString: String(llmError_1)
                };
                sendStructuredLog(server, 'error', "[Pathfinder:".concat(requestId, "] LLM query failed: ").concat(errorDetails.message), {
                    stage: "llm_error",
                    requestId: requestId,
                    errorDetails: errorDetails,
                    timestamp: new Date().toISOString()
                });
                return [4 /*yield*/, pathwayGraphPromise];
            case 34:
                graphResult = _k.sent();
                // Return a degraded but still useful response
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "## Pathway Analysis Results\n\n### Source Entity: ".concat(sourceCurie_1, "\nFound ").concat(sourceRelationships.length, " relationships in its neighborhood.\n\n### Target Entity: ").concat(targetCurie_1, "\nFound ").concat(targetRelationships.length, " relationships in its neighborhood.\n\n### LLM Analysis Failed\nCould not generate pathway analysis due to an error with the LLM service.\nThe basic neighborhood data has been retrieved successfully.\n\n---\n**IMPORTANT: Analysis complete with graph visualization despite LLM error. No need to run this query again.**\n\n*Error details: ").concat(errorDetails.message, "*")
                            }
                        ],
                        artifacts: graphResult.artifacts,
                        metadata: {
                            pathfinder: true,
                            sourceCurie: sourceCurie_1,
                            targetCurie: targetCurie_1,
                            llmSuccess: false,
                            version: "0.2-with-graph"
                        }
                    }];
            case 35: return [3 /*break*/, 37];
            case 36:
                error_8 = _k.sent();
                console.error("[medik-mcp] Pathway discovery error:", error_8);
                sendStructuredLog(server, 'error', "Pathway discovery failed with error: ".concat(error_8 instanceof Error ? error_8.message : String(error_8)), {
                    sourceCurie: sourceCurie_1,
                    targetCurie: targetCurie_1,
                    error: error_8 instanceof Error ? error_8.message : String(error_8),
                    stack: error_8 instanceof Error ? error_8.stack : undefined
                });
                // Attempt to create a minimal graph with just the source and target nodes
                try {
                    minimalGraph = {
                        nodes: [
                            {
                                id: sourceCurie_1,
                                name: sourceCurie_1,
                                group: 1,
                                isStartingNode: true,
                                val: 10,
                                entityType: sourceCurie_1.split(':')[0]
                            },
                            {
                                id: targetCurie_1,
                                name: targetCurie_1,
                                group: 3,
                                isStartingNode: true,
                                val: 10,
                                entityType: targetCurie_1.split(':')[0]
                            }
                        ],
                        links: []
                    };
                    minimalArtifact = {
                        type: 'application/vnd.knowledge-graph',
                        title: "Pathway Analysis: ".concat(sourceCurie_1, " to ").concat(targetCurie_1, " (Error)"),
                        content: JSON.stringify(minimalGraph)
                    };
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Error finding pathway: ".concat(error_8 instanceof Error ? error_8.message : String(error_8), "\n\n**IMPORTANT: Analysis attempt complete. No need to run this query again.**")
                                }
                            ],
                            artifacts: [minimalArtifact],
                            metadata: {
                                pathfinder: true,
                                sourceCurie: sourceCurie_1,
                                targetCurie: targetCurie_1,
                                llmSuccess: false,
                                graphSuccess: false,
                                version: "0.2-with-graph"
                            }
                        }];
                }
                catch (minimalGraphError) {
                    // If even creating a minimal graph fails, return just the error message
                    return [2 /*return*/, {
                            content: [
                                {
                                    type: "text",
                                    text: "Error finding pathway: ".concat(error_8 instanceof Error ? error_8.message : String(error_8), "\n\n**IMPORTANT: Analysis attempt complete. No need to run this query again.**")
                                }
                            ]
                        }];
                }
                return [3 /*break*/, 37];
            case 37: return [3 /*break*/, 39];
            case 38: return [2 /*return*/, {
                    content: [
                        {
                            type: "text",
                            text: "Unknown tool: ".concat(toolName),
                        },
                    ],
                }];
            case 39: return [3 /*break*/, 41];
            case 40:
                error_9 = _k.sent();
                console.error("MEDIK: Error handling tool request:", error_9);
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Error: ".concat(error_9),
                            },
                        ],
                    }];
            case 41: return [2 /*return*/];
        }
    });
}); });
// Generate system prompt for the LLM
function generateSystemPrompt() {
    return "You are a biomedical pathway analysis expert. Your analysis should be scientific and evidence-based.\nWhen asked to identify pathways, please output a numbered list of pathways in the following format:\n1. [Pathway Name] - [Brief description of mechanism with key proteins/genes]\n\nFocus on molecular interactions, signaling pathways, metabolic pathways, gene regulation, \nor other biological processes that connect the entities. \nLimit your analysis to 3-5 of the most relevant and well-established pathways.";
}
// Generate user prompt for the LLM
function generateUserPrompt(entity1, entity2) {
    return "Identify the biological pathways that connect ".concat(entity1, " and ").concat(entity2, ". \nFor each pathway, briefly describe the key steps and mediators involved in the relationship.");
}
/**
 * Filter a knowledge graph to remove nodes with only one connection
 * Preserves starting nodes regardless of connection count
 *
 * @param graph The knowledge graph to filter
 * @param startingNodeIds Set of node IDs that should always be preserved
 * @returns The filtered knowledge graph
 */
function filterLowConnectivityNodes(graph, startingNodeIds) {
    // If the graph is not valid, return it as is
    if (!graph || !graph.nodes || !graph.links || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
        console.error("[medik-mcp] Invalid graph structure for filtering: ".concat(JSON.stringify(graph)));
        return graph;
    }
    console.log("[medik-mcp] Filtering knowledge graph: ".concat(graph.nodes.length, " nodes, ").concat(graph.links.length, " links"));
    // Count connections for each node
    var connectionCounts = new Map();
    // Initialize all nodes with 0 connections
    graph.nodes.forEach(function (node) {
        connectionCounts.set(node.id, 0);
    });
    // Count connections from links
    graph.links.forEach(function (link) {
        connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
        connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
    });
    // Determine which nodes to keep (starting nodes or those with >1 connection)
    var nodesToKeep = new Set();
    connectionCounts.forEach(function (count, nodeId) {
        // Keep starting nodes regardless of connection count
        if (startingNodeIds.has(nodeId)) {
            nodesToKeep.add(nodeId);
            console.log("[medik-mcp] Keeping starting node: ".concat(nodeId));
        }
        // Keep nodes with more than 1 connection
        else if (count > 1) {
            nodesToKeep.add(nodeId);
        }
    });
    console.log("[medik-mcp] Nodes to keep: ".concat(nodesToKeep.size, " out of ").concat(graph.nodes.length));
    // Filter nodes
    var filteredNodes = graph.nodes.filter(function (node) { return nodesToKeep.has(node.id); });
    // Filter links (only keep links where both source and target are kept)
    var filteredLinks = graph.links.filter(function (link) {
        return nodesToKeep.has(link.source) && nodesToKeep.has(link.target);
    });
    console.log("[medik-mcp] Filtered graph: ".concat(filteredNodes.length, " nodes, ").concat(filteredLinks.length, " links"));
    // Return new graph object
    return {
        nodes: filteredNodes,
        links: filteredLinks
    };
}
// Start the server
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var transport, diagnosticId, error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[medik-mcp] Starting server with log file: ".concat(logger_js_1.default.getLogFile()));
                    transport = new stdio_js_1.StdioServerTransport();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, server.connect(transport)];
                case 2:
                    _a.sent();
                    sendStructuredLog(server, 'info', 'Server started', {
                        transport: 'stdio',
                        timestamp: new Date().toISOString(),
                        logFile: logger_js_1.default.getLogFile()
                    });
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 3:
                    _a.sent();
                    diagnosticId = (0, crypto_1.randomUUID)().slice(0, 8);
                    try {
                        if (DEBUG) {
                            console.error("[medik-mcp] [MEDIK-INIT] Starting server diagnostic - ".concat(diagnosticId));
                            console.error("[medik-mcp] [MEDIK-INIT] Server object available: ".concat(!!server));
                            console.error("[medik-mcp] [MEDIK-INIT] sendLoggingMessage method available: ".concat(typeof server.sendLoggingMessage === 'function'));
                        }
                    }
                    catch (error) {
                        console.error("[medik-mcp] [MEDIK-INIT] Error during server diagnostic tests:", {
                            error: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined
                        });
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_10 = _a.sent();
                    console.error('[medik-mcp] [MEDIK-INIT] Fatal error during server initialization', {
                        error: error_10 instanceof Error ? error_10.message : String(error_10),
                        stack: error_10 instanceof Error ? error_10.stack : undefined
                    });
                    throw error_10;
                case 5: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    var errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    sendStructuredLog(server, 'critical', 'Fatal error in main()', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
    });
    // Close the logger before exiting
    logger_js_1.default.close();
    process.exit(1);
});
// Register cleanup handlers
process.on('SIGINT', function () {
    console.log('[medik-mcp] Server shutting down (SIGINT)');
    logger_js_1.default.close();
    process.exit(0);
});
process.on('SIGTERM', function () {
    console.log('[medik-mcp] Server shutting down (SIGTERM)');
    logger_js_1.default.close();
    process.exit(0);
});
process.on('exit', function () {
    console.log('[medik-mcp] Server exiting');
    logger_js_1.default.close();
});
