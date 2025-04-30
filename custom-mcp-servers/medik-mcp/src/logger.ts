import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

/**
 * Logger class for MediK MCP
 * Creates timestamped log files and captures all console output
 */
export class Logger {
  private logDir: string;
  private logFile: string;
  private startTime: Date;
  private logStream: fs.WriteStream | null = null;
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleInfo: typeof console.info;
  
  /**
   * Initialize the logger
   * @param logDir Directory where logs will be stored (default: './logs')
   */
  constructor(logDir?: string) {
    this.startTime = new Date();
    
    // Get absolute path to logs directory
    if (logDir) {
      this.logDir = logDir;
    } else {
      // Get current file's directory
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // Go up one level to the project root, then to logs
        this.logDir = path.join(__dirname, '..', 'logs');
      } catch (error) {
        // Fallback if ESM imports fail
        console.error(`[LOGGER-INIT] Error getting directory path, falling back to relative path: ${error instanceof Error ? error.message : String(error)}`);
        this.logDir = './logs';
      }
    }
    
    console.error(`[LOGGER-INIT] Creating logs in: ${this.logDir}`);
    
    // Create the log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      console.error(`[LOGGER-INIT] Log directory doesn't exist, creating it`);
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.error(`[LOGGER-INIT] Created log directory at ${this.logDir}`);
      } catch (error) {
        console.error(`[LOGGER-INIT] Error creating log directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Generate a timestamped log filename
    const timestamp = this.formatDate(this.startTime);
    const sessionId = randomUUID().substring(0, 8);
    this.logFile = path.join(this.logDir, `medik-mcp_${timestamp}_${sessionId}.log`);
    
    console.error(`[LOGGER-INIT] Creating log file at: ${this.logFile}`);
    
    // Create the log file stream
    try {
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      console.error(`[LOGGER-INIT] Log file stream created successfully`);
    } catch (error) {
      console.error(`[LOGGER-INIT] Error creating log stream: ${error instanceof Error ? error.message : String(error)}`);
      this.logStream = null;
    }
    
    // Save the original console methods
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleInfo = console.info;
    
    // Log the initialization
    this.log(`Logger initialized at ${this.formatCentralTime(this.startTime)}`);
    this.log(`Log file: ${this.logFile}`);
  }
  
  /**
   * Format date for filename
   * @param date Date to format
   * @returns Formatted date string (YYYY-MM-DD_HH-MM-SS)
   */
  private formatDate(date: Date): string {
    return this.formatCentralTime(date)
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace('T', '_');
  }

  /**
   * Format date to Central Time Zone
   * @param date Date to format
   * @returns ISO string in Central Time
   */
  private formatCentralTime(date: Date): string {
    // Convert UTC to US Central Time (CT)
    // Options for formatting to CT
    const options: Intl.DateTimeFormatOptions = {
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
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);
    
    // Convert parts array to object for easier access
    const dateObj: Record<string, string> = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        dateObj[part.type] = part.value;
      }
    });

    // Get milliseconds separately - we'll format CT time and append ms
    // Convert the date to CT first
    const ctTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const milliseconds = ctTime.getMilliseconds().toString().padStart(3, '0');

    // Create ISO-like format in Central Time
    return `${dateObj.year}-${dateObj.month}-${dateObj.day}T${dateObj.hour}:${dateObj.minute}:${dateObj.second}.${milliseconds}[CT]`;
  }
  
  /**
   * Write a message to the log file
   * @param message Message to log
   */
  private log(message: string): void {
    if (!this.logStream) {
      console.error(`[LOGGER] Cannot write to log file - stream not initialized`);
      return;
    }
    
    const timestamp = this.formatCentralTime(new Date());
    const logMessage = `[${timestamp}] ${message}\n`;
    
    try {
      this.logStream.write(logMessage);
    } catch (error) {
      console.error(`[LOGGER] Error writing to log file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Intercept console output and redirect to log file
   */
  public interceptConsole(): void {
    // Intercept console.log
    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      this.log(`[LOG] ${message}`);
      this.originalConsoleLog.apply(console, args);
    };
    
    // Intercept console.error
    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      this.log(`[ERROR] ${message}`);
      this.originalConsoleError.apply(console, args);
    };
    
    // Intercept console.warn
    console.warn = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      this.log(`[WARN] ${message}`);
      this.originalConsoleWarn.apply(console, args);
    };
    
    // Intercept console.info
    console.info = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      this.log(`[INFO] ${message}`);
      this.originalConsoleInfo.apply(console, args);
    };
    
    this.log('[LOGGER] Console output interception enabled');
  }
  
  /**
   * Restore original console methods
   */
  public restoreConsole(): void {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.info = this.originalConsoleInfo;
    this.log('[LOGGER] Console output interception disabled');
  }
  
  /**
   * Close the logger and clean up
   */
  public close(): void {
    this.log(`Logger closed at ${this.formatCentralTime(new Date())}`);
    this.log(`Session duration: ${(new Date().getTime() - this.startTime.getTime()) / 1000} seconds`);
    
    if (this.logStream) {
      try {
        this.logStream.end();
        console.error(`[LOGGER] Log stream closed successfully`);
      } catch (error) {
        console.error(`[LOGGER] Error closing log stream: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Get the path to the current log file
   * @returns Path to the log file
   */
  public getLogFile(): string {
    return this.logFile;
  }
}

// Export a singleton instance
export default new Logger(); 