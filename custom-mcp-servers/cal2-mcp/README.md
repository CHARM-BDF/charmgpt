# Cal2 MCP - macOS Calendar Access

An MCP server for accessing macOS Calendar (EventKit) data.

## Features

- List all calendars visible to macOS Calendar.app
- List upcoming calendar events from all calendars

## Setup

### 1. Build the Swift helper

The Swift helper is required to access macOS Calendar data with appropriate permissions:

```bash
cd swift-helper
./build.sh
```

This will:
- Build the Swift helper in release mode
- Sign it with necessary entitlements
- Move it to the `bin` directory

### 2. Grant calendar permission

Run the helper once to trigger the macOS permission prompt:

```bash
bin/CalendarHelper list-calendars
```

You should see a prompt: "CalendarHelper wants to access your calendars." Click "OK".

### 3. Build and run the MCP server

```bash
# Install dependencies
npm install

# Build TypeScript code
npm run build

# Start the server
npm start
```

## Available MCP Tools

The MCP server provides two tools:

1. `list_calendars` - Lists all calendars visible via macOS EventKit
   ```json
   { "name": "list_calendars", "arguments": {} }
   ```

2. `list_calendar_events` - Returns upcoming events for the next N days
   ```json
   { "name": "list_calendar_events", "arguments": { "days": 3 } }
   ```
   The `days` parameter is optional and defaults to 7.

## Notes on Signing

The Swift helper is signed with an ad-hoc signature by default, which is sufficient for personal use.

If you plan to distribute this to others, you may want to sign it with a proper Apple Developer ID certificate:

```bash
codesign --force --options runtime \
  --entitlements calendar.entitlements \
  -s "Developer ID Application: Your Name (TEAMID)" \
  .build/release/CalendarHelper
``` 