import { spawn } from "node:child_process";
import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

interface ListArgs {
  days?: number;               // default 7
}

export class EventKitService {
  private helperScript = new URL("../../bin/run-helper.sh", import.meta.url).pathname;
  private logFilePath: string;

  constructor() {
    this.logFilePath = path.join(path.dirname(this.helperScript), "eventkit-service.log");
    this.writeToLogFile(`\n--- EventKitService initialized at ${new Date().toISOString()} ---\n`);
  }

  private run(args: string[]): Promise<any[]> {
    console.error(`[EventKitService] Running helper with args: ${JSON.stringify(args)}`);
    this.writeToLogFile(`\n--- Calendar request: ${new Date().toISOString()} ---\n`);
    this.writeToLogFile(`Running helper with args: ${JSON.stringify(args)}\n`);
    
    return new Promise((res, rej) => {
      console.error(`[EventKitService] Using wrapper script: ${this.helperScript}`);
      const p = spawn(this.helperScript, args);
      let out = "", err = "";
      
      p.stdout.on("data", d => {
        const data = d.toString();
        out += data;
        console.error(`[EventKitService] Helper stdout: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
        this.writeToLogFile(`STDOUT: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}\n`);
      });
      
      p.stderr.on("data", d => {
        const data = d.toString();
        err += data;
        console.error(`[EventKitService] Helper stderr: ${data}`);
        this.writeToLogFile(`STDERR: ${data}\n`);
      });
      
      p.on("close", c => {
        console.error(`[EventKitService] Helper exited with code: ${c}`);
        this.writeToLogFile(`EXIT CODE: ${c}\n`);
        
        if (c === 0) {
          try {
            console.error(`[EventKitService] Raw stdout: ${out.substring(0, 100)}${out.length > 100 ? '...' : ''}`);
            this.writeToLogFile(`RAW STDOUT: ${out.substring(0, 100)}${out.length > 100 ? '...' : ''}\n`);
            
            const parsed = JSON.parse(out || "[]");
            console.error(`[EventKitService] Successfully parsed response: ${parsed.length} items`);
            this.writeToLogFile(`PARSED ${parsed.length} ITEMS\n`);
            
            res(parsed);
          } catch (e) {
            console.error(`[EventKitService] Failed to parse helper output: ${e}`);
            this.writeToLogFile(`PARSE ERROR: ${e}\n`);
            rej(new Error(`Failed to parse helper output: ${e}`));
          }
        } else {
          console.error(`[EventKitService] Helper failed with code ${c}: ${err}`);
          this.writeToLogFile(`HELPER FAILED: code ${c}, error: ${err}\n`);
          
          if (c === 2) {
            rej(new Error(`Calendar permission denied. Please run 'bin/CalendarHelper list-calendars' in Terminal and grant access.`));
          } else {
            rej(new Error(`Helper error (${c}): ${err}`));
          }
        }
      });
      
      p.on("error", e => {
        console.error(`[EventKitService] Helper process error: ${e}`);
        this.writeToLogFile(`PROCESS ERROR: ${e}\n`);
        rej(new Error(`Helper process error: ${e}`));
      });
    });
  }
  
  /**
   * Write to log file
   */
  private writeToLogFile(content: string) {
    try {
      fs.appendFileSync(this.logFilePath, content);
    } catch (e) {
      console.error(`[EventKitService] Failed to write to log file: ${e}`);
    }
  }

  listCalendars() {
    console.error(`[EventKitService] Listing calendars`);
    return this.run(["list-calendars"]);
  }
  
  listEvents({ days = 7 }: ListArgs = {}) {
    console.error(`[EventKitService] Listing events for next ${days} days`);
    return this.run(["list-events", String(days)]);
  }

  async initialize() {
    console.error(`[EventKitService] Initializing`);
    try {
      // Verify helper script exists
      if (!fs.existsSync(this.helperScript)) {
        console.error(`[EventKitService] Helper script not found at: ${this.helperScript}`);
        throw new Error(`Helper script not found at: ${this.helperScript}`);
      }
      
      console.error(`[EventKitService] Helper script found at: ${this.helperScript}`);
      
      // Make it executable if needed
      try {
        fs.accessSync(this.helperScript, fs.constants.X_OK);
        console.error(`[EventKitService] Helper script is executable`);
      } catch (e) {
        console.error(`[EventKitService] Helper script is not executable, attempting to fix`);
        try {
          fs.chmodSync(this.helperScript, 0o755);
          console.error(`[EventKitService] Made helper script executable`);
        } catch (e) {
          console.error(`[EventKitService] Failed to make script executable: ${e}`);
        }
      }
    } catch (e) {
      console.error(`[EventKitService] Error during initialization: ${e}`);
    }
  }
} 