"use strict";
/**
 * Test script for find-pathway functionality
 *
 * This script directly calls the find-pathway functionality to test the new filtering
 * without having to go through the MCP interface.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var formatters_1 = require("./formatters");
// Sample test CURIEs (you can replace these with any valid CURIEs)
var SOURCE_CURIE = 'UniProtKB:P04637'; // TP53 tumor protein
var TARGET_CURIE = 'MONDO:0005070'; // Breast cancer
/**
 * Function to filter low connectivity nodes
 * Copy of the function from index.ts to avoid circular imports
 */
function filterLowConnectivityNodes(graph, startingNodeIds) {
    if (!graph || !graph.nodes || !graph.links || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
        console.error("Invalid graph structure for filtering: ".concat(JSON.stringify(graph)));
        return graph;
    }
    console.log("Filtering knowledge graph: ".concat(graph.nodes.length, " nodes, ").concat(graph.links.length, " links"));
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
            console.log("Keeping starting node: ".concat(nodeId));
        }
        // Keep nodes with more than 1 connection
        else if (count > 1) {
            nodesToKeep.add(nodeId);
        }
    });
    console.log("Nodes to keep: ".concat(nodesToKeep.size, " out of ").concat(graph.nodes.length));
    // Filter nodes
    var filteredNodes = graph.nodes.filter(function (node) { return nodesToKeep.has(node.id); });
    // Filter links (only keep links where both source and target are kept)
    var filteredLinks = graph.links.filter(function (link) {
        return nodesToKeep.has(link.source) && nodesToKeep.has(link.target);
    });
    console.log("Filtered graph: ".concat(filteredNodes.length, " nodes, ").concat(filteredLinks.length, " links"));
    // Return new graph object
    return {
        nodes: filteredNodes,
        links: filteredLinks
    };
}
/**
 * Test the pathway filtering logic
 */
function testPathwayFiltering() {
    return __awaiter(this, void 0, void 0, function () {
        var sourceNeighborhood, targetNeighborhood, combinedResults, startingNodeIds, graphResult, knowledgeGraphArtifact, graph, standardFilteredGraph, filteredGraph, connectedToSource_1, connectedToTarget_1, pathwayNodes_1, expandedPathwayNodes_1, pathwayFilteredNodes, pathwayFilteredLinks, fs, enhancedFilteredGraph, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Testing pathway between ".concat(SOURCE_CURIE, " and ").concat(TARGET_CURIE));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    // Get neighborhood data
                    console.log("Fetching source neighborhood data...");
                    return [4 /*yield*/, (0, index_1.runBidirectionalQuery)({ curie: SOURCE_CURIE })];
                case 2:
                    sourceNeighborhood = _a.sent();
                    console.log("Fetching target neighborhood data...");
                    return [4 /*yield*/, (0, index_1.runBidirectionalQuery)({ curie: TARGET_CURIE })];
                case 3:
                    targetNeighborhood = _a.sent();
                    if (!sourceNeighborhood || !targetNeighborhood) {
                        console.error("Failed to retrieve neighborhoods");
                        return [2 /*return*/];
                    }
                    if (!Array.isArray(sourceNeighborhood) || !Array.isArray(targetNeighborhood)) {
                        console.error("Invalid neighborhood data");
                        return [2 /*return*/];
                    }
                    console.log("Source neighborhood: ".concat(sourceNeighborhood.length, " relationships"));
                    console.log("Target neighborhood: ".concat(targetNeighborhood.length, " relationships"));
                    combinedResults = __spreadArray(__spreadArray([], sourceNeighborhood, true), targetNeighborhood, true);
                    startingNodeIds = new Set([SOURCE_CURIE, TARGET_CURIE]);
                    // Format as a knowledge graph
                    console.log("Formatting as knowledge graph...");
                    return [4 /*yield*/, (0, formatters_1.formatKnowledgeGraphArtifact)(combinedResults, {
                            e1: "PathwayAnalysis",
                            e2: "pathway-between",
                            e3: "".concat(SOURCE_CURIE, "_to_").concat(TARGET_CURIE)
                        }, startingNodeIds)];
                case 4:
                    graphResult = _a.sent();
                    if (!graphResult.artifacts || graphResult.artifacts.length === 0) {
                        console.error("No graph artifact created");
                        return [2 /*return*/];
                    }
                    knowledgeGraphArtifact = graphResult.artifacts.find(function (a) { return a.type === 'application/vnd.knowledge-graph'; });
                    if (!knowledgeGraphArtifact || !knowledgeGraphArtifact.content) {
                        console.error("No graph content found");
                        return [2 /*return*/];
                    }
                    graph = typeof knowledgeGraphArtifact.content === 'string'
                        ? JSON.parse(knowledgeGraphArtifact.content)
                        : knowledgeGraphArtifact.content;
                    console.log("Original graph: ".concat(graph.nodes.length, " nodes, ").concat(graph.links.length, " links"));
                    standardFilteredGraph = filterLowConnectivityNodes(graph, startingNodeIds);
                    console.log("Standard filtered graph: ".concat(standardFilteredGraph.nodes.length, " nodes, ").concat(standardFilteredGraph.links.length, " links"));
                    filteredGraph = standardFilteredGraph;
                    connectedToSource_1 = new Set([SOURCE_CURIE]);
                    connectedToTarget_1 = new Set([TARGET_CURIE]);
                    // First pass: identify nodes connected to source or target (direct neighbors)
                    filteredGraph.links.forEach(function (link) {
                        if (link.source === SOURCE_CURIE) {
                            connectedToSource_1.add(link.target);
                        }
                        else if (link.target === SOURCE_CURIE) {
                            connectedToSource_1.add(link.source);
                        }
                        if (link.source === TARGET_CURIE) {
                            connectedToTarget_1.add(link.target);
                        }
                        else if (link.target === TARGET_CURIE) {
                            connectedToTarget_1.add(link.source);
                        }
                    });
                    console.log("Nodes connected to source: ".concat(connectedToSource_1.size));
                    console.log("Nodes connected to target: ".concat(connectedToTarget_1.size));
                    pathwayNodes_1 = new Set([SOURCE_CURIE, TARGET_CURIE]);
                    connectedToSource_1.forEach(function (nodeId) {
                        if (connectedToTarget_1.has(nodeId)) {
                            pathwayNodes_1.add(nodeId);
                        }
                    });
                    console.log("Nodes connected to both source and target: ".concat(pathwayNodes_1.size - 2));
                    expandedPathwayNodes_1 = new Set(pathwayNodes_1);
                    filteredGraph.links.forEach(function (link) {
                        if (pathwayNodes_1.has(link.source) && pathwayNodes_1.has(link.target)) {
                            expandedPathwayNodes_1.add(link.source);
                            expandedPathwayNodes_1.add(link.target);
                        }
                    });
                    console.log("Expanded pathway nodes: ".concat(expandedPathwayNodes_1.size));
                    pathwayFilteredNodes = filteredGraph.nodes.filter(function (node) {
                        return expandedPathwayNodes_1.has(node.id);
                    });
                    pathwayFilteredLinks = filteredGraph.links.filter(function (link) {
                        return expandedPathwayNodes_1.has(link.source) && expandedPathwayNodes_1.has(link.target);
                    });
                    console.log("Enhanced pathway filtered graph: ".concat(pathwayFilteredNodes.length, " nodes, ").concat(pathwayFilteredLinks.length, " links"));
                    // Output summary of node and link reduction
                    console.log("\nFilter Effectiveness:");
                    console.log("- Original graph: ".concat(graph.nodes.length, " nodes, ").concat(graph.links.length, " links"));
                    console.log("- After standard filtering: ".concat(standardFilteredGraph.nodes.length, " nodes (").concat((standardFilteredGraph.nodes.length / graph.nodes.length * 100).toFixed(1), "% of original)"));
                    console.log("- After enhanced pathway filtering: ".concat(pathwayFilteredNodes.length, " nodes (").concat((pathwayFilteredNodes.length / graph.nodes.length * 100).toFixed(1), "% of original)"));
                    fs = require('fs');
                    enhancedFilteredGraph = {
                        nodes: pathwayFilteredNodes,
                        links: pathwayFilteredLinks
                    };
                    fs.writeFileSync('./pathwayTest-result.json', JSON.stringify(enhancedFilteredGraph, null, 2));
                    console.log("Filtered graph saved to pathwayTest-result.json");
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    console.error("Error testing pathway filtering:", error_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Run the test
testPathwayFiltering().then(function () { return console.log("Test completed"); }).catch(console.error);
