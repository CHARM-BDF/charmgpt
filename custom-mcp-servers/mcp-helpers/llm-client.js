"use strict";
/**
 * LLM Client for MCP Servers
 *
 * This file provides a client library for MCP servers to interact with
 * the centralized LLM Service.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
var node_fetch_1 = __importDefault(require("node-fetch"));
// Remove the timers/promises import and define our own delay function
/**
 * Create a delay using Promise
 * @param ms Time to delay in milliseconds
 * @returns Promise that resolves after ms milliseconds
 */
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
/**
 * Client for the LLM Service
 */
var LLMClient = /** @class */ (function () {
    /**
     * Create a new LLM client
     * @param options Client configuration options
     */
    function LLMClient(options) {
        if (options === void 0) { options = {}; }
        this.baseUrl = options.baseUrl || 'http://localhost:3001/api/internal/llm';
        this.timeout = options.timeout || 30000;
        this.authToken = options.authToken || process.env.MCP_AUTH_TOKEN || '';
        this.retries = options.retries || 3;
        this.mcpName = options.mcpName || 'unknown-mcp';
        console.log("LLMClient: Initialized with baseUrl ".concat(this.baseUrl));
    }
    /**
     * Send a request to the LLM Service
     * @param endpoint The endpoint to call
     * @param body The request body
     * @param retryCount Current retry count (internal use)
     * @returns The response from the LLM Service
     */
    LLMClient.prototype.sendRequest = function (endpoint_1, body_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, body, retryCount) {
            var url, controller, timeoutId, response, errorText, error_1, backoffTime;
            if (retryCount === void 0) { retryCount = 0; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.baseUrl).concat(endpoint);
                        controller = new AbortController();
                        timeoutId = setTimeout(function () { return controller.abort(); }, this.timeout);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 9]);
                        console.log("LLMClient: Sending request to ".concat(endpoint));
                        return [4 /*yield*/, (0, node_fetch_1.default)(url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-MCP-Auth': this.authToken,
                                    'X-MCP-Name': this.mcpName
                                },
                                body: JSON.stringify(body),
                                signal: controller.signal // Type assertion to fix compatibility issue
                            })];
                    case 2:
                        response = _a.sent();
                        clearTimeout(timeoutId);
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.text()];
                    case 3:
                        errorText = _a.sent();
                        throw new Error("LLM Service request failed: ".concat(response.status, " ").concat(errorText));
                    case 4: return [4 /*yield*/, response.json()];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6:
                        error_1 = _a.sent();
                        // Handle abort errors
                        if (error_1.name === 'AbortError') {
                            throw new Error("LLM Service request timed out after ".concat(this.timeout, "ms"));
                        }
                        if (!(retryCount < this.retries)) return [3 /*break*/, 8];
                        console.warn("LLMClient: Request failed, retrying (".concat(retryCount + 1, "/").concat(this.retries, ")..."));
                        backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
                        return [4 /*yield*/, delay(backoffTime)];
                    case 7:
                        _a.sent(); // Use our custom delay function
                        return [2 /*return*/, this.sendRequest(endpoint, body, retryCount + 1)];
                    case 8: 
                    // Max retries exceeded
                    throw error_1;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send a query to the LLM
     * @param params The query parameters
     * @returns The response from the LLM
     */
    LLMClient.prototype.query = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.sendRequest('/query', params)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_2 = _a.sent();
                        console.error('LLMClient: Query failed:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                content: '',
                                error: error_2.message || 'Unknown error'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Analyze data using the LLM
     * @param data The data to analyze
     * @param task The analysis task description
     * @param options Additional request options
     * @returns The LLM's analysis
     */
    LLMClient.prototype.analyze = function (data_1, task_1) {
        return __awaiter(this, arguments, void 0, function (data, task, options) {
            var error_3;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.sendRequest('/analyze', { data: data, task: task, options: options })];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_3 = _a.sent();
                        console.error('LLMClient: Analysis failed:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                content: '',
                                error: error_3.message || 'Unknown error'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Rank items based on criteria
     * @param items The items to rank
     * @param criteria The ranking criteria
     * @param options Additional request options
     * @returns The ranked items or original items if ranking failed
     */
    LLMClient.prototype.rank = function (items_1, criteria_1) {
        return __awaiter(this, arguments, void 0, function (items, criteria, options) {
            var result, error_4;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.sendRequest('/rank', { items: items, criteria: criteria, options: options })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.success ? result.items : items];
                    case 2:
                        error_4 = _a.sent();
                        console.error('LLMClient: Ranking failed:', error_4);
                        // Return original items unranked if the request fails
                        return [2 /*return*/, items];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return LLMClient;
}());
exports.LLMClient = LLMClient;
exports.default = LLMClient;
