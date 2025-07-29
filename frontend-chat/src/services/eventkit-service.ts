import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory of the current module
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface EventKitArgs {
  calendarId?: string; // kept for API parity, not used in helper yet
  start?: string;
  end?: string;
  query?: string;
}

export class EventKitService {
  // Path to the helper - assumes it's in bin/CalendarHelper relative to the project root
  private helper: string;

  constructor() {
    // Calculate the path to the helper
    this.helper = join(__dirname, '../../bin/CalendarHelper/CalendarHelper');
    console.log(`[EventKitService] Helper path: ${this.helper}`);
  }

  private runHelper(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`[EventKitService] Running helper with args: ${args.join(' ')}`);
      const p = spawn(this.helper, args);
      let out = "", err = "";
      p.stdout.on("data", d => (out += d));
      p.stderr.on("data", d => (err += d));
      p.on("close", code =>
        code === 0
          ? resolve(JSON.parse(out || "[]"))
          : reject(new Error(`CalendarHelper exit ${code}: ${err}`))
      );
    });
  }

  async getCalendars() {
    try {
      return await this.runHelper(["list-calendars"]);
    } catch (error) {
      console.error("[EventKitService] Error getting calendars:", error);
      // Return mock data in case of error
      return [
        { id: "mock-calendar-1", title: "Personal", source: "Local" },
        { id: "mock-calendar-2", title: "Work", source: "Exchange" }
      ];
    }
  }

  async getEvents(params: EventKitArgs) {
    try {
      // Helper currently supports "next N days", so convert dates to delta
      const now = new Date();
      const until = params.end ? new Date(params.end) : new Date(now.valueOf() + 7 * 864e5);
      const days = Math.ceil((until.getTime() - now.getTime()) / 864e5);
      return await this.runHelper(["list-events", String(days)]);
    } catch (error) {
      console.error("[EventKitService] Error getting events:", error);
      // Return mock data in case of error
      return [
        {
          id: "mock-event-1",
          title: "Team Meeting",
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3600000).toISOString(), 
          calendar: "Work"
        },
        {
          id: "mock-event-2", 
          title: "Appointment",
          start: new Date(Date.now() + 86400000).toISOString(),
          end: new Date(Date.now() + 86400000 + 7200000).toISOString(),
          calendar: "Personal"
        }
      ];
    }
  }

  async initialize() {
    // No-op: helper handles its own auth handshake
    console.log("[EventKitService] Initialized (auth handled by helper)");
  }
} 