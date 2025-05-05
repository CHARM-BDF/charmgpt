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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatKnowledgeGraphArtifact = formatKnowledgeGraphArtifact;
exports.formatNetworkNeighborhood = formatNetworkNeighborhood;
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
// Add workspace root path resolution
var workspaceRoot = process.cwd();
var logsDir = path.join(workspaceRoot, 'logs', 'data');
// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log("MEDIK FORMATTER: Created logs directory at ".concat(logsDir));
}
// Helper function to check if a node ID should be filtered out
function shouldFilterNode(id) {
    return id.startsWith('CAID:');
}
// Helper function to determine entity type and group from ID
function getEntityTypeAndGroup(id) {
    if (id.startsWith('DRUGBANK:')) {
        return { type: 'Drug', group: 1 };
    }
    else if (id.startsWith('NCBIGene:')) {
        return { type: 'Gene', group: 2 };
    }
    else if (id.startsWith('MONDO:') || id.startsWith('HP:') || id.startsWith('DOID:')) {
        return { type: 'Disease', group: 3 };
    }
    else if (id.startsWith('UMLS:')) {
        return { type: 'UMLS Concept', group: 4 };
    }
    else if (id.startsWith('REACT:')) {
        return { type: 'Reaction', group: 5 };
    }
    else if (id.startsWith('NCIT:')) {
        return { type: 'Cancer Concept', group: 6 };
    }
    else {
        return { type: 'Other', group: 7 };
    }
}
/**
 * Determine entity type from biolink types
 * @param types Array of biolink types
 * @returns A human-readable entity type
 */
function getEntityTypeFromBiolink(types) {
    if (!types || types.length === 0) {
        return 'Other';
    }
    // Check for cellular component
    if (types.includes('biolink:CellularComponent')) {
        return 'Cellular Component';
    }
    // Check for chemical entities
    if (types.includes('biolink:SmallMolecule') ||
        types.includes('biolink:ChemicalEntity') ||
        types.includes('biolink:ChemicalOrDrugOrTreatment')) {
        return 'Chemical';
    }
    // Check for anatomical structures
    if (types.includes('biolink:GrossAnatomicalStructure') ||
        types.includes('biolink:AnatomicalEntity')) {
        return 'Anatomical Structure';
    }
    // Check for genes and proteins
    if (types.includes('biolink:Gene') ||
        types.includes('biolink:GeneOrGeneProduct') ||
        types.includes('biolink:Protein') ||
        types.includes('biolink:GeneProductMixin') ||
        types.includes('biolink:Polypeptide')) {
        return 'Gene';
    }
    // Check for gene families and groups
    if (types.includes('biolink:GeneFamily') ||
        types.includes('biolink:GeneGroupingMixin')) {
        return 'Gene Group';
    }
    // Check for diseases and phenotypes
    if (types.includes('biolink:Disease') ||
        types.includes('biolink:DiseaseOrPhenotypicFeature') ||
        types.includes('biolink:PhenotypicFeature') ||
        types.includes('biolink:Disease')) {
        return 'Disease or Phenotype';
    }
    // Default case
    return 'Other';
}
// Helper function to make predicate human-readable
function formatPredicate(predicate) {
    // Remove the biolink: prefix
    var formatted = predicate.replace('biolink:', '');
    // Replace underscores with spaces
    formatted = formatted.replace(/_/g, ' ');
    return formatted;
}
/**
 * Call the Node Normalizer API to get canonical IDs for a list of CURIEs
 * Uses batching to avoid overwhelming the API
 *
 * @param curies - Array of CURIEs to normalize
 * @returns A map of original CURIEs to their normalized data
 */
function normalizeNodes(curies) {
    return __awaiter(this, void 0, void 0, function () {
        var BATCH_SIZE, DELAY_MS, NODE_NORM_API, normalizedMap, _loop_1, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    BATCH_SIZE = 50;
                    DELAY_MS = 500;
                    NODE_NORM_API = 'https://nodenorm.ci.transltr.io/1.5/get_normalized_nodes';
                    console.log("MEDIK FORMATTER: Normalizing ".concat(curies.length, " nodes"));
                    normalizedMap = new Map();
                    _loop_1 = function (i) {
                        var batchCuries, url_1, response, data, _i, _b, _c, curie, normData, error_1;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    batchCuries = curies.slice(i, i + BATCH_SIZE);
                                    _d.label = 1;
                                case 1:
                                    _d.trys.push([1, 6, , 7]);
                                    url_1 = new URL(NODE_NORM_API);
                                    batchCuries.forEach(function (curie) {
                                        url_1.searchParams.append('curie', curie);
                                    });
                                    url_1.searchParams.append('conflate', 'true');
                                    url_1.searchParams.append('drug_chemical_conflate', 'false');
                                    url_1.searchParams.append('description', 'true');
                                    url_1.searchParams.append('individual_types', 'true');
                                    console.log("MEDIK FORMATTER: Making request to: ".concat(url_1.toString()));
                                    return [4 /*yield*/, fetch(url_1.toString(), {
                                            method: 'GET',
                                            headers: {
                                                'accept': 'application/json'
                                            }
                                        })];
                                case 2:
                                    response = _d.sent();
                                    if (!response.ok) {
                                        console.log("MEDIK FORMATTER: Error from Node Normalizer API: ".concat(response.status, " ").concat(response.statusText));
                                        return [2 /*return*/, "continue"];
                                    }
                                    return [4 /*yield*/, response.json()];
                                case 3:
                                    data = _d.sent();
                                    console.log("MEDIK FORMATTER: Received ".concat(Object.keys(data).length, " normalized nodes"));
                                    // Add the normalized data to the map, filtering out null values
                                    for (_i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                                        _c = _b[_i], curie = _c[0], normData = _c[1];
                                        if (normData !== null) {
                                            normalizedMap.set(curie, normData);
                                        }
                                    }
                                    if (!(i + BATCH_SIZE < curies.length)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, DELAY_MS); })];
                                case 4:
                                    _d.sent();
                                    _d.label = 5;
                                case 5: return [3 /*break*/, 7];
                                case 6:
                                    error_1 = _d.sent();
                                    console.log("MEDIK FORMATTER: Error normalizing nodes: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < curies.length)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("MEDIK FORMATTER: Successfully normalized ".concat(normalizedMap.size, " out of ").concat(curies.length, " nodes"));
                    return [2 /*return*/, normalizedMap];
            }
        });
    });
}
/**
 * Formats mediKanren query results into human-readable text and a knowledge graph artifact
 *
 * @param queryResults - The raw results from a mediKanren query
 * @param queryParams - The parameters used for the query (for context)
 * @returns A Promise that resolves to an object with content (text) and artifacts (knowledge graph)
 */
function formatKnowledgeGraphArtifact(queryResults, queryParams, startingNodeIds) {
    // Create timestamp and filename base
    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    var searchTerm = queryParams.e3.replace(/[^a-zA-Z0-9]/g, '_');
    var fileBase = "".concat(timestamp, "_").concat(searchTerm);
    // Save raw data with absolute path
    try {
        var rawDataPath = path.join(logsDir, "".concat(fileBase, "_raw.json"));
        fs.writeFileSync(rawDataPath, JSON.stringify({
            queryParams: queryParams,
            results: queryResults
        }, null, 2));
        console.log("MEDIK FORMATTER: Saved raw data to ".concat(rawDataPath));
    }
    catch (error) {
        console.log("MEDIK FORMATTER: Error saving raw data: ".concat(error));
        console.log("MEDIK FORMATTER: Current working directory: ".concat(process.cwd()));
        console.log("MEDIK FORMATTER: Attempted to save to: ".concat(logsDir));
    }
    // Log the raw data before processing
    console.log("MEDIK FORMATTER: Processing ".concat(queryResults.length, " raw results"));
    console.log("MEDIK FORMATTER: Query params:", JSON.stringify(queryParams, null, 2));
    // Sample the first few results to avoid excessive logging
    if (queryResults.length > 0) {
        console.log("MEDIK FORMATTER: Sample of first result:", JSON.stringify(queryResults[0], null, 2));
    }
    // Track unique CAID nodes that will be filtered out
    var caidNodes = new Set();
    // Initialize the knowledge graph structure
    var graph = {
        nodes: [],
        links: []
    };
    // Track unique nodes to avoid duplicates
    var nodeMap = new Map();
    // Track node connections for sizing
    var connectionCounts = new Map();
    // First pass: identify all CAID nodes
    queryResults.forEach(function (result) {
        var sourceId = result[0], sourceName = result[1], predicate = result[2], targetId = result[3], targetName = result[4], _ = result[5], evidence = result[6];
        // Helper function to process IDs
        var processId = function (id) {
            // Check if it's a UniProtKB ID with version
            if (id.startsWith('UniProtKB:') && id.includes('-')) {
                var baseId = id.split('-')[0];
                return baseId; // Return unversioned ID for normalization
            }
            return id;
        };
        if (sourceId) {
            var normalizedId = processId(sourceId);
            if (normalizedId !== sourceId) {
                // If this is a versioned ID, update the node in nodeMap
                var node = nodeMap.get(sourceId);
                if (node) {
                    nodeMap.set(normalizedId, __assign(__assign({}, node), { id: normalizedId, startingId: [sourceId] // Keep the versioned ID in startingId
                     }));
                    nodeMap.delete(sourceId); // Remove the old entry
                }
            }
            if (shouldFilterNode(sourceId)) {
                caidNodes.add(sourceId);
            }
        }
        if (targetId) {
            var normalizedId = processId(targetId);
            if (normalizedId !== targetId) {
                // If this is a versioned ID, update the node in nodeMap
                var node = nodeMap.get(targetId);
                if (node) {
                    nodeMap.set(normalizedId, __assign(__assign({}, node), { id: normalizedId, startingId: [targetId] // Keep the versioned ID in startingId
                     }));
                    nodeMap.delete(targetId); // Remove the old entry
                }
            }
            if (shouldFilterNode(targetId)) {
                caidNodes.add(targetId);
            }
        }
    });
    // Filter out results containing CAID: prefixed nodes and transcribed_from edges
    var originalCount = queryResults.length;
    var filteredResults = queryResults.filter(function (result) {
        var sourceId = result[0], predicate = result[2], targetId = result[3];
        // Filter out CAID nodes
        if (shouldFilterNode(sourceId) || shouldFilterNode(targetId)) {
            return false;
        }
        // Filter out transcribed_from edges
        if (predicate === 'transcribed_from') {
            console.log("MEDIK FORMATTER: Filtering out transcribed_from edge: ".concat(sourceId, " -> ").concat(targetId));
            return false;
        }
        return true;
    });
    var filteredCount = originalCount - filteredResults.length;
    var filteredNodeCount = caidNodes.size;
    console.log("MEDIK FORMATTER: After filtering: ".concat(filteredResults.length, " results remain (removed ").concat(filteredCount, " results)"));
    // Process each result triple
    var relationships = [];
    filteredResults.forEach(function (result) {
        var sourceId = result[0], sourceName = result[1], predicate = result[2], targetId = result[3], targetName = result[4], _ = result[5], evidence = result[6];
        // Skip if missing essential data
        if (!sourceId || !sourceName || !predicate || !targetId || !targetName) {
            return;
        }
        // Helper function to process IDs
        var processId = function (id) {
            // Check if it's a UniProtKB ID with version
            if (id.startsWith('UniProtKB:') && id.includes('-')) {
                var baseId = id.split('-')[0];
                return baseId; // Return unversioned ID for normalization
            }
            return id;
        };
        // Add human-readable relationship
        var readablePredicate = formatPredicate(predicate);
        relationships.push("".concat(sourceName, " ").concat(readablePredicate, " ").concat(targetName));
        // Process source node
        var sourceNormalizedId = processId(sourceId);
        if (!nodeMap.has(sourceNormalizedId)) {
            var _a = getEntityTypeAndGroup(sourceId), type = _a.type, group = _a.group;
            nodeMap.set(sourceNormalizedId, {
                id: sourceNormalizedId,
                startingId: [sourceId], // Store the original versioned ID
                name: sourceName,
                group: group,
                entityType: type,
                isStartingNode: startingNodeIds === null || startingNodeIds === void 0 ? void 0 : startingNodeIds.has(sourceId) // Set starting node flag
            });
        }
        else if (sourceId !== sourceNormalizedId) {
            // If this is a different version of the same node, add to startingId
            var existingNode = nodeMap.get(sourceNormalizedId);
            if (!existingNode.startingId) {
                existingNode.startingId = [sourceId];
            }
            else if (!existingNode.startingId.includes(sourceId)) {
                existingNode.startingId.push(sourceId);
            }
            // Preserve starting node status if this version is a starting node
            if (startingNodeIds === null || startingNodeIds === void 0 ? void 0 : startingNodeIds.has(sourceId)) {
                existingNode.isStartingNode = true;
            }
        }
        // Process target node
        var targetNormalizedId = processId(targetId);
        if (!nodeMap.has(targetNormalizedId)) {
            var _b = getEntityTypeAndGroup(targetId), type = _b.type, group = _b.group;
            nodeMap.set(targetNormalizedId, {
                id: targetNormalizedId,
                startingId: [targetId], // Store the original versioned ID
                name: targetName,
                group: group,
                entityType: type,
                isStartingNode: startingNodeIds === null || startingNodeIds === void 0 ? void 0 : startingNodeIds.has(targetId) // Set starting node flag
            });
        }
        else if (targetId !== targetNormalizedId) {
            // If this is a different version of the same node, add to startingId
            var existingNode = nodeMap.get(targetNormalizedId);
            if (!existingNode.startingId) {
                existingNode.startingId = [targetId];
            }
            else if (!existingNode.startingId.includes(targetId)) {
                existingNode.startingId.push(targetId);
            }
            // Preserve starting node status if this version is a starting node
            if (startingNodeIds === null || startingNodeIds === void 0 ? void 0 : startingNodeIds.has(targetId)) {
                existingNode.isStartingNode = true;
            }
        }
        // Update connection counts
        connectionCounts.set(sourceNormalizedId, (connectionCounts.get(sourceNormalizedId) || 0) + 1);
        connectionCounts.set(targetNormalizedId, (connectionCounts.get(targetNormalizedId) || 0) + 1);
        // Add link using normalized IDs
        graph.links.push({
            source: sourceNormalizedId,
            target: targetNormalizedId,
            label: readablePredicate,
            value: 1,
            evidence: Array.isArray(evidence) ? evidence : []
        });
    });
    // Update node sizes based on connection counts
    nodeMap.forEach(function (node, id) {
        var connections = connectionCounts.get(id) || 1;
        node.val = Math.max(5, Math.min(20, connections * 3)); // Scale node size between 5 and 20
    });
    // Convert node map to array for normalization
    var nodes = Array.from(nodeMap.values());
    // Get all unique node IDs for normalization
    var nodeIds = nodes.map(function (node) { return node.id; });
    // Normalize the nodes asynchronously and then continue processing
    return normalizeNodes(nodeIds).then(function (normalizedMap) {
        // console.log(`MEDIK FORMATTER: Applying normalized IDs to ${nodes.length} nodes`);
        // console.log(`MEDIK FORMATTER: Normalized map contains ${normalizedMap.size} entries`);
        // Track ID changes for updating links
        var idMap = new Map();
        var normalizedCount = 0;
        // Track nodes that have been merged
        var mergedNodes = new Map();
        // First pass: Apply normalized IDs to nodes and identify duplicates
        nodes.forEach(function (node) {
            var _a, _b;
            console.log("MEDIK FORMATTER: Processing node ".concat(node.id));
            var normData = normalizedMap.get(node.id);
            if (!normData) {
                console.log("MEDIK FORMATTER: No normalized data found for ".concat(node.id));
                return;
            }
            if (!normData.id) {
                console.log("MEDIK FORMATTER: Normalized data for ".concat(node.id, " does not contain id field:"), JSON.stringify(normData, null, 2));
                return;
            }
            // Store the original ID for reference
            var originalId = node.id;
            var normalizedId = normData.id.identifier;
            // Track the ID change for updating links
            idMap.set(originalId, normalizedId);
            // Check if we've already seen this normalized ID
            if (mergedNodes.has(normalizedId)) {
                // This is a duplicate, merge with existing node
                var existingNode_1 = mergedNodes.get(normalizedId);
                // Add the original ID to the startingId array of the existing node
                if (node.startingId && node.startingId.length > 0) {
                    // Ensure we don't add duplicate startingIds
                    var newStartingIds = node.startingId.filter(function (id) { var _a; return !((_a = existingNode_1.startingId) === null || _a === void 0 ? void 0 : _a.includes(id)); });
                    existingNode_1.startingId = __spreadArray(__spreadArray([], (existingNode_1.startingId || []), true), newStartingIds, true);
                }
                else {
                    // If no startingId array, use the original ID
                    var originalId_1 = node.id;
                    if (!((_a = existingNode_1.startingId) === null || _a === void 0 ? void 0 : _a.includes(originalId_1))) {
                        existingNode_1.startingId = __spreadArray(__spreadArray([], (existingNode_1.startingId || []), true), [originalId_1], false);
                    }
                }
                // Preserve isStartingNode property - if either node is a starting node, the merged node should be too
                existingNode_1.isStartingNode = existingNode_1.isStartingNode || node.isStartingNode;
                // Update connection count (will be used for node size)
                existingNode_1.val = (existingNode_1.val || 0) + (node.val || 0);
                console.log("MEDIK FORMATTER: Merged node ".concat(node.id, " into existing node ").concat(normalizedId, " with startingIds: ").concat((_b = existingNode_1.startingId) === null || _b === void 0 ? void 0 : _b.join(', ')));
            }
            else {
                // This is a new normalized ID
                // Update the node with normalized data
                node.id = normalizedId;
                node.name = normData.id.label || node.name;
                // Ensure startingId is an array
                if (!Array.isArray(node.startingId)) {
                    node.startingId = node.startingId ? [node.startingId] : [originalId];
                }
                // Determine entity type from biolink types if available
                var biolinkEntityType = getEntityTypeFromBiolink(normData.type);
                // Update node metadata and entity type
                node.metadata = {
                    label: normData.id.label,
                    description: normData.id.description,
                    type: normData.type
                };
                // Update entity type with biolink-derived type
                node.entityType = biolinkEntityType;
                // Preserve isStartingNode property
                node.isStartingNode = node.isStartingNode || false;
                // Add to merged nodes map
                mergedNodes.set(normalizedId, node);
                normalizedCount++;
                console.log("MEDIK FORMATTER: Normalized ".concat(originalId, " to ").concat(normalizedId));
            }
        });
        console.log("MEDIK FORMATTER: Successfully normalized to ".concat(mergedNodes.size, " unique nodes from ").concat(nodes.length, " original nodes"));
        console.log("MEDIK FORMATTER: ID map contains ".concat(idMap.size, " entries"));
        // Update links with new node IDs
        var updatedLinkCount = 0;
        graph.links.forEach(function (link) {
            if (idMap.has(link.source)) {
                var oldSource = link.source;
                link.source = idMap.get(link.source);
                console.log("MEDIK FORMATTER: Updated link source from ".concat(oldSource, " to ").concat(link.source));
                updatedLinkCount++;
            }
            if (idMap.has(link.target)) {
                var oldTarget = link.target;
                link.target = idMap.get(link.target);
                console.log("MEDIK FORMATTER: Updated link target from ".concat(oldTarget, " to ").concat(link.target));
                updatedLinkCount++;
            }
        });
        console.log("MEDIK FORMATTER: Updated ".concat(updatedLinkCount, " link endpoints"));
        // Update the graph with merged nodes
        graph.nodes = Array.from(mergedNodes.values());
        // Ensure all nodes have colors and startingId arrays
        graph.nodes.forEach(function (node) {
            // Make sure startingId is an array
            if (!node.startingId) {
                node.startingId = [node.id];
                console.log("MEDIK FORMATTER: Fixed missing startingId for node ".concat(node.id));
            }
            else if (!Array.isArray(node.startingId)) {
                node.startingId = [node.startingId];
                console.log("MEDIK FORMATTER: Converted startingId to array for node ".concat(node.id));
            }
        });
        // Log the final nodes after ensuring colors and startingId arrays
        console.log("MEDIK FORMATTER: Final nodes after ensuring colors and startingId arrays:");
        graph.nodes.slice(0, 3).forEach(function (node, index) {
            console.log("MEDIK FORMATTER: Node ".concat(index + 1, ":"), JSON.stringify({
                id: node.id,
                name: node.name,
                entityType: node.entityType,
                startingId: node.startingId
            }, null, 2));
        });
        // Log a sample of the final nodes
        if (graph.nodes.length > 0) {
            console.log("MEDIK FORMATTER: Sample of final node:", JSON.stringify(graph.nodes[0], null, 2));
        }
        // Final verification that all nodes have colors
        var nodesWithoutColor = graph.nodes.filter(function (node) { return !node.color; });
        if (nodesWithoutColor.length > 0) {
            console.log("MEDIK FORMATTER: WARNING - Found ".concat(nodesWithoutColor.length, " nodes without color property. Fixing..."));
            nodesWithoutColor.forEach(function (node) {
                // Just log that we're skipping color assignment as it's now handled by templates
                console.log("MEDIK FORMATTER: Node ".concat(node.id, " has no color - will be handled by templates"));
            });
        }
        else {
            console.log("MEDIK FORMATTER: All nodes have required properties. Good!");
        }
        // Final check before returning the graph
        console.log("MEDIK FORMATTER: Performing final verification of node properties before returning graph...");
        var finalNodeCheck = graph.nodes.map(function (node) {
            // Create a deep copy to avoid modifying the original
            var nodeCopy = __assign({}, node);
            // Ensure startingId is an array
            if (!nodeCopy.startingId) {
                nodeCopy.startingId = [nodeCopy.id];
                console.log("MEDIK FORMATTER: Final check - Fixed missing startingId for node ".concat(nodeCopy.id));
            }
            else if (!Array.isArray(nodeCopy.startingId)) {
                nodeCopy.startingId = [nodeCopy.startingId];
                console.log("MEDIK FORMATTER: Final check - Converted startingId to array for node ".concat(nodeCopy.id));
            }
            return nodeCopy;
        });
        // Replace the nodes with the verified ones
        graph.nodes = finalNodeCheck;
        // Log the final graph structure
        console.log("MEDIK FORMATTER: Final graph structure - ".concat(graph.nodes.length, " nodes and ").concat(graph.links.length, " links"));
        if (graph.nodes.length > 0) {
            console.log("MEDIK FORMATTER: First node in final graph:", JSON.stringify({
                id: graph.nodes[0].id,
                name: graph.nodes[0].name,
                entityType: graph.nodes[0].entityType,
                startingId: graph.nodes[0].startingId
            }, null, 2));
        }
        // Create human-readable text
        var queryType = queryParams.e1 === 'X->Known' ? 'entities related to' :
            queryParams.e1 === 'Bidirectional' ? 'all entities related to' :
                'entities that relate to';
        var entityName = queryParams.e1 === 'X->Known' || queryParams.e1 === 'Bidirectional' ?
            queryParams.e3 :
            queryParams.e1;
        var relationshipType = formatPredicate(queryParams.e2);
        // Group relationships by predicate for better readability
        var groupedRelationships = relationships.reduce(function (acc, rel) {
            var parts = rel.split(' ');
            var predicate = parts.slice(1, -1).join(' ');
            if (!acc[predicate]) {
                acc[predicate] = [];
            }
            acc[predicate].push(rel);
            return acc;
        }, {});
        // Format the grouped relationships
        var formattedRelationships = Object.entries(groupedRelationships)
            .map(function (_a) {
            var predicate = _a[0], rels = _a[1];
            return "\n### ".concat(predicate.toUpperCase(), "\n").concat(rels.map(function (r) { return "- ".concat(r); }).join('\n'));
        })
            .join('\n');
        var humanReadableText = "\n# Knowledge Graph: ".concat(queryType, " ").concat(entityName, " via ").concat(relationshipType, "\n\n").concat(queryParams.e1 === 'Bidirectional' ? 'This is a comprehensive bidirectional query that includes both incoming and outgoing relationships.\nBoth forward and reverse queries were successful - no need to run this query again.\n\n' : '', "The graph includes the following relationships:\n").concat(formattedRelationships, "\n\nIdentify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.\n");
        // Add information about filtered nodes if any were filtered
        if (filteredCount > 0) {
            humanReadableText = "\n# Knowledge Graph: ".concat(queryType, " ").concat(entityName, " via ").concat(relationshipType, "\n\n").concat(queryParams.e1 === 'Bidirectional' ? 'This is a comprehensive bidirectional query that includes both incoming and outgoing relationships.\nBoth forward and reverse queries were successful - no need to run this query again.\n\n' : '', "Note: ").concat(filteredCount, " relationships were filtered out from the results:\n- Relationships involving ").concat(filteredNodeCount, " unique nodes with CAID: prefix (these variants are typically less reliable or less established in the literature)\n- Edges with the 'transcribed_from' predicate (these represent basic transcription relationships)\n\nThe graph includes the following relationships:\n").concat(formattedRelationships, "\n\nIdentify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.\n");
        }
        // Create the knowledge graph artifact
        var artifact = {
            type: 'application/vnd.knowledge-graph',
            title: queryParams.e1 === 'Bidirectional'
                ? "Knowledge Graph: All relationships for ".concat(entityName)
                : "Knowledge Graph: ".concat(queryType, " ").concat(entityName),
            content: JSON.stringify(graph)
        };
        console.log("MEDIK FORMATTER: Completed formatting with ".concat(relationships.length, " relationships"));
        // Before returning, save the formatted data with absolute path
        try {
            var formattedDataPath = path.join(logsDir, "".concat(fileBase, "_formatted.json"));
            fs.writeFileSync(formattedDataPath, JSON.stringify({
                graph: graph,
                relationships: relationships,
                content: humanReadableText,
                stats: {
                    originalCount: originalCount,
                    filteredCount: filteredCount,
                    filteredNodeCount: filteredNodeCount,
                    finalNodeCount: graph.nodes.length,
                    finalLinkCount: graph.links.length
                }
            }, null, 2));
            console.log("MEDIK FORMATTER: Saved formatted data to ".concat(formattedDataPath));
        }
        catch (error) {
            console.log("MEDIK FORMATTER: Error saving formatted data: ".concat(error));
            console.log("MEDIK FORMATTER: Current working directory: ".concat(process.cwd()));
            console.log("MEDIK FORMATTER: Attempted to save to: ".concat(logsDir));
        }
        return {
            content: [
                {
                    type: 'text',
                    text: humanReadableText
                }
            ],
            artifacts: [artifact],
            filteredCount: filteredCount,
            filteredNodeCount: filteredNodeCount
        };
    });
}
/**
 * Formats the network neighborhood for a group of genes/proteins
 *
 * @param queryResults - Combined results from bidirectional queries
 * @param startCuries - Array of starting CURIEs (genes/proteins)
 * @returns A Promise that resolves to an object with content (text) and artifacts (knowledge graph)
 */
function formatNetworkNeighborhood(queryResults, startCuries) {
    var startingNodeIds = new Set(startCuries);
    // Track which nodes are connected to which starting nodes
    var nodeConnections = new Map();
    // Process each result to build connections map
    queryResults.forEach(function (result) {
        var sourceId = result[0], sourceName = result[1], predicate = result[2], targetId = result[3], targetName = result[4];
        // Skip if missing essential data
        if (!sourceId || !targetId) {
            return;
        }
        // If source is a starting node, record that target is connected to it
        if (startingNodeIds.has(sourceId)) {
            if (!nodeConnections.has(targetId)) {
                nodeConnections.set(targetId, new Set());
            }
            nodeConnections.get(targetId).add(sourceId);
        }
        // If target is a starting node, record that source is connected to it
        if (startingNodeIds.has(targetId)) {
            if (!nodeConnections.has(sourceId)) {
                nodeConnections.set(sourceId, new Set());
            }
            nodeConnections.get(sourceId).add(targetId);
        }
    });
    // Filter results to keep only:
    // 1. Relationships between starting nodes
    // 2. Relationships to nodes connected to 2+ starting nodes
    var filteredResults = queryResults.filter(function (result) {
        var sourceId = result[0], sourceName = result[1], predicate = result[2], targetId = result[3], targetName = result[4];
        // Always keep relationships between starting nodes
        if (startingNodeIds.has(sourceId) && startingNodeIds.has(targetId)) {
            return true;
        }
        // Keep if source is a starting node and target is connected to 2+ starting nodes
        if (startingNodeIds.has(sourceId) &&
            nodeConnections.has(targetId) &&
            nodeConnections.get(targetId).size >= 2) {
            return true;
        }
        // Keep if target is a starting node and source is connected to 2+ starting nodes
        if (startingNodeIds.has(targetId) &&
            nodeConnections.has(sourceId) &&
            nodeConnections.get(sourceId).size >= 2) {
            return true;
        }
        // Otherwise, filter it out
        return false;
    });
    // Use the existing formatKnowledgeGraphArtifact function with modified parameters
    return formatKnowledgeGraphArtifact(filteredResults, {
        e1: "NetworkNeighborhood",
        e2: "network-connections",
        e3: startCuries.join(',')
    }, startingNodeIds); // Pass the starting node IDs to formatKnowledgeGraphArtifact
}
