Below is a **from-scratch EventKit-only MCP**.  
Everything is self-contained except the signed Swift helper that actually talks to macOS Calendar.  
After the code you’ll find a quick primer on signing and whether you *really* need an Apple-issued developer certificate.

---

## 1 Project layout

```
eventkit-mcp/
├─ bin/
│  └─ CalendarHelper        ⟵ signed Swift CLI (built once; see §2)
├─ src/
│  ├─ index.ts              ⟵ MCP entry point
│  └─ services/
│     └─ eventkit-service.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 2 CalendarHelper – minimal Swift CLI

> **Build & sign once**, then drop the binary in `bin/`.

### 2.1 Swift sources

<details>
<summary><code>Package.swift</code></summary>

```swift
// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "CalendarHelper",
  platforms: [.macOS(.v13)],
  targets: [
    .executableTarget(
      name: "CalendarHelper",
      linkerSettings: [.linkedFramework("EventKit")]
    )
  ]
)
```
</details>

<details>
<summary><code>Sources/CalendarHelper/main.swift</code></summary>

```swift
import EventKit
import Foundation

enum Cmd: String { case list = "list-calendars", events = "list-events" }
guard CommandLine.argc >= 2,
      let cmd = Cmd(rawValue: CommandLine.arguments[1]) else { exit(64) }

let store = EKEventStore()
let sem = DispatchSemaphore(value: 0)
var granted = false
store.requestAccess(to: .event) { ok, _ in granted = ok; sem.signal() }
sem.wait(); guard granted else { exit(2) }

let enc = JSONEncoder(); enc.dateEncodingStrategy = .iso8601

switch cmd {
case .list:
  let out = store.calendars(for: .event).map {
      ["id": $0.calendarIdentifier,
       "title": $0.title,
       "source": $0.source.title]
  }
  print(String(data: try enc.encode(out), encoding: .utf8)!)

case .events:
  // Usage: list-events <daysAhead>
  let days = Int(CommandLine.arguments[2]) ?? 7
  let start = Date()
  let end = Calendar.current.date(byAdding: .day, value: days, to: start)!
  let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
  let evts = store.events(matching: pred).map {
      ["id": $0.eventIdentifier ?? "",
       "title": $0.title ?? "",
       "start": $0.startDate,
       "end": $0.endDate,
       "calendar": $0.calendar.title]
  }
  print(String(data: try enc.encode(evts), encoding: .utf8)!)
}
```
</details>

### 2.2 Entitlements (`calendar.entitlements`)

```xml
<?xml version="1.0"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" \
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.personal-information.calendars</key><true/>
</dict></plist>
```

### 2.3 Build & sign

```bash
# build in release mode
swift build -c release

# sign the helper – three common options ▼
codesign --force --options runtime \
  --entitlements calendar.entitlements \
  -s "Developer ID Application: Your Name (TEAMID)" \
  .build/release/CalendarHelper                       # ← preferred

# OR (no Apple account) – ad-hoc signature:
# codesign --force --options runtime \
#          --entitlements calendar.entitlements \
#          -s - .build/release/CalendarHelper

mkdir -p ../eventkit-mcp/bin
mv .build/release/CalendarHelper ../eventkit-mcp/bin/
```

> Run once (`bin/CalendarHelper list-calendars`) so macOS shows  
> **“CalendarHelper wants to access your calendars.”**  
> Click **OK** → TCC stores the grant and never reprompts.

---

## 3 Node service layer

### 3.1 `src/services/eventkit-service.ts`

```ts
import { spawn } from "node:child_process";

interface ListArgs {
  days?: number;               // default 7
}

export class EventKitService {
  private helper = new URL("../../bin/CalendarHelper", import.meta.url).pathname;

  private run(args: string[]): Promise<any[]> {
    return new Promise((res, rej) => {
      const p = spawn(this.helper, args);
      let out = "", err = "";
      p.stdout.on("data", d => out += d);
      p.stderr.on("data", d => err += d);
      p.on("close", c => c === 0 ? res(JSON.parse(out || "[]"))
                                 : rej(new Error(`CalendarHelper ${c}: ${err}`)));
    });
  }

  listCalendars()            { return this.run(["list-calendars"]); }
  listEvents({ days = 7 }: ListArgs = {}) {
    return this.run(["list-events", String(days)]);
  }

  async initialize() { /* nothing to do */ }
}
```

### 3.2 `src/index.ts` (MCP entry)

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport }
  from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema }
  from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { EventKitService } from "./services/eventkit-service.js";

const calendar = new EventKitService();
const server = new Server(
  { name: "eventkit-mcp", version: "1.0.0" },
  { capabilities: { tools: {}, logging: {} } }
);

// ───── tool metadata ─────
const listCalendarsTool = { name: "list_calendars", description:
  "List all calendars visible via macOS EventKit", inputSchema: { type:"object"} };

const listEventsTool = { name: "list_calendar_events", description:
  "Return upcoming events (next N days) across all calendars",
  inputSchema: { type:"object",
    properties: { days:{type:"integer",description:"Days ahead",default:7}},
    required:[] } };

// ───── list-tools handler ─────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools:[listCalendarsTool, listEventsTool]
}));

// ───── call-tool handler ─────
server.setRequestHandler(CallToolRequestSchema, async req => {
  const { name, arguments: args } = req.params;
  if (name === "list_calendars") {
    const cals = await calendar.listCalendars();
    return {
      content:[{ type:"text", text:`${cals.length} calendars`, forModel:true }],
      artifacts:[{ type:"json", id:randomUUID(), title:"Calendars",
                   content:JSON.stringify(cals,null,2)}] };
  }
  if (name === "list_calendar_events") {
    const evts = await calendar.listEvents(args as any);
    return {
      content:[{ type:"text", text:`${evts.length} events`, forModel:true }],
      artifacts:[{ type:"json", id:randomUUID(), title:"Events",
                   content:JSON.stringify(evts,null,2)}] };
  }
  return { content:[{type:"text", text:`Unknown tool ${name}`}], isError:true };
});

// ───── bootstrap ─────
(async () => {
  await calendar.initialize();
  await server.connect(new StdioServerTransport());
  console.error("[eventkit-mcp] ready");
})();
```

---

## 4 Running it

```bash
# One-time: trigger the TCC prompt
bin/CalendarHelper list-calendars

# Then start the MCP
npm install
npm run build   # transpile TS → JS
node dist/index.js
```

Your LLM can now call:

```jsonc
{ "name": "list_calendars", "arguments": {} }
{ "name": "list_calendar_events", "arguments": { "days": 3 } }
```

…and it will see **iCloud, Exchange/Outlook, Google, On-My-Mac**—anything that Calendar.app itself syncs.

---

## 5 Do I need an Apple Developer certificate?

| Use-case | Signing identity you can use | Will TCC show the calendar prompt? | Gatekeeper UX |
|----------|-----------------------------|------------------------------------|---------------|
| **Local, just you** | **ad-hoc** (`-s -`) or self-signed | **Yes** – ad-hoc is still a *signed* binary so entitlements work. | First launch shows *“unidentified developer”*—right-click › *Open*. |
| **Share inside your org** | Company-wide **Developer ID Application** cert (needs a paid Dev account) | Yes | Users see the normal *“from Developer ID”* dialog—no quarantine woes. |
| **App Store** | Mac App Store distribution cert | Yes | Must be sandboxed; CLI helper would need to live inside a `.app`. |

So: **for personal use you don’t *need* a paid developer account**—ad-hoc codesigning plus the calendars entitlement is enough to satisfy TCC.  
If you plan to hand the binary to colleagues who aren’t comfortable bypassing Gatekeeper, a proper Developer ID cert is strongly recommended. (Costs \$99 / year.)

Apple’s entitlement doc: com.apple.security.personal-information.calendars  ([Calendars entitlement | Apple Developer Documentation](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.personal-information.calendars?utm_source=chatgpt.com))  
Community report confirming CLI + entitlement works when signed  ([xcode - EventKit permission problems for Swift Command Line Tool ...](https://stackoverflow.com/questions/69232295/eventkit-permission-problems-for-swift-command-line-tool-on-macos-big-sur?utm_source=chatgpt.com))

---

That’s a clean EventKit-only MCP.  
Ping me if you’d like a pre-built helper or additional tool verbs (create, update, delete events)!