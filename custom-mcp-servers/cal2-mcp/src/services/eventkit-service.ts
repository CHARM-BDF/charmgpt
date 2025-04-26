import { spawn } from "node:child_process";
import { exec } from "node:child_process";

interface ListArgs {
  days?: number;               // default 7
}

export class EventKitService {
  private helper = new URL("../../bin/CalendarHelper", import.meta.url).pathname;
  private permissionRequested = false;

  private run(args: string[]): Promise<any[]> {
    console.error(`[EventKitService] Running helper with args: ${JSON.stringify(args)}`);
    console.error(`[EventKitService] Helper path: ${this.helper}`);
    
    return new Promise((res, rej) => {
      const p = spawn(this.helper, args);
      let out = "", err = "";
      
      p.stdout.on("data", d => {
        out += d;
        console.error(`[EventKitService] Helper stdout: ${d}`);
      });
      
      p.stderr.on("data", d => {
        err += d;
        console.error(`[EventKitService] Helper stderr: ${d}`);
      });
      
      p.on("close", c => {
        console.error(`[EventKitService] Helper exited with code: ${c}`);
        if (c === 0) {
          try {
            const parsed = JSON.parse(out || "[]");
            console.error(`[EventKitService] Successfully parsed response: ${parsed.length} items`);
            res(parsed);
          } catch (e) {
            console.error(`[EventKitService] Failed to parse helper output: ${e}`);
            rej(new Error(`Failed to parse helper output: ${e}`));
          }
        } else if (c === 2 && !this.permissionRequested) {
          // Permission denied and we haven't tried requesting permission yet
          console.error(`[EventKitService] Permission denied. Attempting to trigger permission prompt...`);
          this.requestPermission()
            .then(() => {
              console.error(`[EventKitService] Permission request complete. Retrying operation...`);
              // Retry the operation
              return this.run(args);
            })
            .then(result => res(result))
            .catch(error => {
              console.error(`[EventKitService] Failed to request permission: ${error}`);
              rej(new Error(`CalendarHelper ${c}: Permission denied. Calendar access not granted.`));
            });
        } else {
          console.error(`[EventKitService] Helper failed with code ${c}: ${err}`);
          if (c === 2) {
            rej(new Error(`CalendarHelper ${c}: Permission denied. Calendar access not granted.`));
          } else {
            rej(new Error(`CalendarHelper ${c}: ${err}`));
          }
        }
      });
      
      p.on("error", e => {
        console.error(`[EventKitService] Helper process error: ${e}`);
        rej(new Error(`Helper process error: ${e}`));
      });
    });
  }

  /**
   * Attempt to trigger a permission request by opening a new Terminal
   * and running the helper with the list-calendars command
   */
  private requestPermission(): Promise<void> {
    this.permissionRequested = true;
    console.error(`[EventKitService] Attempting to request calendar permission via new Terminal window`);
    
    return new Promise((resolve, reject) => {
      // Create a command to open a new Terminal window and run the helper
      const helperPath = this.helper;
      const command = `osascript -e 'tell application "Terminal" to do script "echo 'Calendar access is needed to use the calendar MCP server. Please click \\'OK\\' if prompted.'; '${helperPath}' list-calendars; echo 'Permission request complete. You can close this window.'; exit"'`;
      
      console.error(`[EventKitService] Executing permission request command: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`[EventKitService] Failed to execute permission request: ${error}`);
          reject(error);
          return;
        }
        
        console.error(`[EventKitService] Permission request initiated. Terminal window opened.`);
        console.error(`[EventKitService] stdout: ${stdout}`);
        console.error(`[EventKitService] stderr: ${stderr}`);
        
        // Wait a bit to give the user time to respond to the prompt
        setTimeout(() => {
          console.error(`[EventKitService] Continuing after permission request attempt`);
          resolve();
        }, 5000); // Wait 5 seconds for user to interact with prompt
      });
    });
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
      // Verify the helper exists
      const { access } = await import('node:fs/promises');
      await access(this.helper);
      console.error(`[EventKitService] Helper found at: ${this.helper}`);
    } catch (e) {
      console.error(`[EventKitService] Helper not found or not accessible: ${e}`);
    }
  }
} 