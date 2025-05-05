"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var crypto_1 = require("crypto");
var url_1 = require("url");
/**
 * Logger class for MediK MCP
 * Creates timestamped log files and captures all console output
 */
var Logger = /** @class */ (function () {
    /**
     * Initialize the logger
     * @param logDir Directory where logs will be stored (default: './logs')
     */
    function Logger(logDir) {
        this.logStream = null;
        this.startTime = new Date();
        // Get absolute path to logs directory
        if (logDir) {
            this.logDir = logDir;
        }
        else {
            // Get current file's directory
            try {
                var __filename_1 = (0, url_1.fileURLToPath)(import.meta.url);
                var __dirname_1 = path_1.default.dirname(__filename_1);
                // Go up one level to the project root, then to logs
                this.logDir = path_1.default.join(__dirname_1, '..', 'logs');
            }
            catch (error) {
                // Fallback if ESM imports fail
                console.error("[LOGGER-INIT] Error getting directory path, falling back to relative path: ".concat(error instanceof Error ? error.message : String(error)));
                this.logDir = './logs';
            }
        }
        console.error("[LOGGER-INIT] Creating logs in: ".concat(this.logDir));
        // Create the log directory if it doesn't exist
        if (!fs_1.default.existsSync(this.logDir)) {
            console.error("[LOGGER-INIT] Log directory doesn't exist, creating it");
            try {
                fs_1.default.mkdirSync(this.logDir, { recursive: true });
                console.error("[LOGGER-INIT] Created log directory at ".concat(this.logDir));
            }
            catch (error) {
                console.error("[LOGGER-INIT] Error creating log directory: ".concat(error instanceof Error ? error.message : String(error)));
            }
        }
        // Generate a timestamped log filename
        var timestamp = this.formatDate(this.startTime);
        var sessionId = (0, crypto_1.randomUUID)().substring(0, 8);
        this.logFile = path_1.default.join(this.logDir, "medik-mcp_".concat(timestamp, "_").concat(sessionId, ".log"));
        console.error("[LOGGER-INIT] Creating log file at: ".concat(this.logFile));
        // Create the log file stream
        try {
            this.logStream = fs_1.default.createWriteStream(this.logFile, { flags: 'a' });
            console.error("[LOGGER-INIT] Log file stream created successfully");
        }
        catch (error) {
            console.error("[LOGGER-INIT] Error creating log stream: ".concat(error instanceof Error ? error.message : String(error)));
            this.logStream = null;
        }
        // Save the original console methods
        this.originalConsoleLog = console.log;
        this.originalConsoleError = console.error;
        this.originalConsoleWarn = console.warn;
        this.originalConsoleInfo = console.info;
        // Log the initialization
        this.log("Logger initialized at ".concat(this.formatCentralTime(this.startTime)));
        this.log("Log file: ".concat(this.logFile));
    }
    /**
     * Format date for filename
     * @param date Date to format
     * @returns Formatted date string (YYYY-MM-DD_HH-MM-SS)
     */
    Logger.prototype.formatDate = function (date) {
        return this.formatCentralTime(date)
            .replace(/:/g, '-')
            .replace(/\..+/, '')
            .replace('T', '_');
    };
    /**
     * Format date to Central Time Zone
     * @param date Date to format
     * @returns ISO string in Central Time
     */
    Logger.prototype.formatCentralTime = function (date) {
        // Convert UTC to US Central Time (CT)
        // Options for formatting to CT
        var options = {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        // Get formatted date parts without milliseconds
        var formatter = new Intl.DateTimeFormat('en-US', options);
        var parts = formatter.formatToParts(date);
        // Convert parts array to object for easier access
        var dateObj = {};
        parts.forEach(function (part) {
            if (part.type !== 'literal') {
                dateObj[part.type] = part.value;
            }
        });
        // Get milliseconds separately - we'll format CT time and append ms
        // Convert the date to CT first
        var ctTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        var milliseconds = ctTime.getMilliseconds().toString().padStart(3, '0');
        // Create ISO-like format in Central Time
        return "".concat(dateObj.year, "-").concat(dateObj.month, "-").concat(dateObj.day, "T").concat(dateObj.hour, ":").concat(dateObj.minute, ":").concat(dateObj.second, ".").concat(milliseconds, "[CT]");
    };
    /**
     * Write a message to the log file
     * @param message Message to log
     */
    Logger.prototype.log = function (message) {
        if (!this.logStream) {
            console.error("[LOGGER] Cannot write to log file - stream not initialized");
            return;
        }
        var timestamp = this.formatCentralTime(new Date());
        var logMessage = "[".concat(timestamp, "] ").concat(message, "\n");
        try {
            this.logStream.write(logMessage);
        }
        catch (error) {
            console.error("[LOGGER] Error writing to log file: ".concat(error instanceof Error ? error.message : String(error)));
        }
    };
    /**
     * Intercept console output and redirect to log file
     */
    Logger.prototype.interceptConsole = function () {
        var _this = this;
        // Intercept console.log
        console.log = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var message = args.map(function (arg) {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            }).join(' ');
            _this.log("[LOG] ".concat(message));
            _this.originalConsoleLog.apply(console, args);
        };
        // Intercept console.error
        console.error = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var message = args.map(function (arg) {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            }).join(' ');
            _this.log("[ERROR] ".concat(message));
            _this.originalConsoleError.apply(console, args);
        };
        // Intercept console.warn
        console.warn = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var message = args.map(function (arg) {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            }).join(' ');
            _this.log("[WARN] ".concat(message));
            _this.originalConsoleWarn.apply(console, args);
        };
        // Intercept console.info
        console.info = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var message = args.map(function (arg) {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            }).join(' ');
            _this.log("[INFO] ".concat(message));
            _this.originalConsoleInfo.apply(console, args);
        };
        this.log('[LOGGER] Console output interception enabled');
    };
    /**
     * Restore original console methods
     */
    Logger.prototype.restoreConsole = function () {
        console.log = this.originalConsoleLog;
        console.error = this.originalConsoleError;
        console.warn = this.originalConsoleWarn;
        console.info = this.originalConsoleInfo;
        this.log('[LOGGER] Console output interception disabled');
    };
    /**
     * Close the logger and clean up
     */
    Logger.prototype.close = function () {
        this.log("Logger closed at ".concat(this.formatCentralTime(new Date())));
        this.log("Session duration: ".concat((new Date().getTime() - this.startTime.getTime()) / 1000, " seconds"));
        if (this.logStream) {
            try {
                this.logStream.end();
                console.error("[LOGGER] Log stream closed successfully");
            }
            catch (error) {
                console.error("[LOGGER] Error closing log stream: ".concat(error instanceof Error ? error.message : String(error)));
            }
        }
    };
    /**
     * Get the path to the current log file
     * @returns Path to the log file
     */
    Logger.prototype.getLogFile = function () {
        return this.logFile;
    };
    return Logger;
}());
exports.Logger = Logger;
// Export a singleton instance
exports.default = new Logger();
