import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

export class LoggingService {
  private logDir: string;
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private currentLogFile: string;

  constructor() {
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.logDir = '';
    this.currentLogFile = '';
  }

  /**
   * Initialize logging system
   */
  initializeLogging(logDir: string): void {
    this.logDir = logDir;

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
      this.originalConsoleLog(`Created log directory at: ${this.logDir}`);
    }

    // Override console methods
    console.log = (...args: any[]) => this.log('info', ...args);
    console.error = (...args: any[]) => this.log('error', ...args);
    console.debug = (...args: any[]) => this.log('debug', ...args);

    // Start initial log session
    this.startNewLogSession('server');
  }

  /**
   * Start new log session
   */
  startNewLogSession(type: 'server' | 'chat' = 'server'): void {
    const now = new Date();
    const fileName = `${type}-${now.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[\/:]/g, '-')}.log`;

    this.currentLogFile = path.join(this.logDir, fileName);
    
    // Ensure the directory exists
    const dirPath = path.dirname(this.currentLogFile);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(this.currentLogFile, `=== ${type.toUpperCase()} Session Started: ${now.toISOString()} ===\n\n`);
    this.log('info', `Started new ${type} log session at: ${this.currentLogFile}`);
  }

  /**
   * Log message with type and timestamp
   */
  private log(type: 'info' | 'error' | 'debug', ...args: any[]): void {
    const now = new Date();
    const centralTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');

    try {
      const logEntry = `[${centralTime}] [${type.toUpperCase()}] ${message}\n`;
      
      if (this.currentLogFile) {
        // Ensure the directory exists before writing
        const dirPath = path.dirname(this.currentLogFile);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.appendFileSync(this.currentLogFile, logEntry);
      } else {
        // If no log file exists, start a new session
        this.startNewLogSession('server');
        fs.appendFileSync(this.currentLogFile, logEntry);
      }
      
      // Also output to original console
      if (type === 'error') {
        this.originalConsoleError(logEntry);
      } else {
        this.originalConsoleLog(logEntry);
      }
    } catch (error) {
      this.originalConsoleError('Error writing to log file:', error);
    }
  }

  /**
   * Log request details
   */
  logRequest(req: Request): void {
    // Start new chat log session for chat requests
    if (req.url.includes('/api/chat')) {
      this.startNewLogSession('chat');
    }

    const requestLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query
    };

    this.log('info', '=== Incoming Request ===\n', requestLog);
  }

  /**
   * Log response details
   */
  logResponse(res: Response): void {
    const responseLog = {
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode,
      headers: res.getHeaders()
    };

    this.log('info', '=== Outgoing Response ===\n', responseLog);
  }

  /**
   * Log error with stack trace
   */
  logError(error: Error): void {
    this.log('error', '=== Error ===\n', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }

  /**
   * Get current log file path
   */
  getCurrentLogFile(): string {
    return this.currentLogFile;
  }
} 