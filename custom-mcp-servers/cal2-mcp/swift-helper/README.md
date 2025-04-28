# CalendarHelper

A Swift command-line utility for accessing macOS Calendar data through EventKit.

## Overview

This utility provides a simple CLI for accessing calendar data from macOS, designed to be called from Node.js applications through a wrapper script.

## Features

- List all available calendars with their IDs, titles, and sources
- List events for the next N days (configurable)
- EventKit permissions handling
- JSON output for easy integration
- Structured JSON error reporting
- Permission verification command

## Requirements

- macOS 13.0 or later
- Swift 5.9 or later (for building)
- Xcode Command Line Tools

## Build Instructions

The project includes a build script that:
1. Compiles the Swift code in release mode
2. Creates a macOS app bundle with proper entitlements
3. Signs the app bundle
4. Also creates a standalone binary for direct command-line use

To build the utility:

```bash
# Navigate to the swift-helper directory
cd /path/to/charm-mcp/custom-mcp-servers/cal2-mcp/swift-helper

# Make the build script executable (if needed)
chmod +x build.sh

# Run the build script
./build.sh
```

This will produce:
- An app bundle at `../bin/CalendarHelper.app`
- A standalone binary at `../bin/CalendarHelper`

## First-Time Setup

Before using the helper, you need to trigger the macOS calendar permissions dialog:

```bash
open -W "../bin/CalendarHelper.app" --args list-calendars
```

## Usage

### Check Permissions

Verify if calendar permissions are granted:

```bash
../bin/CalendarHelper check-permissions
```

Output (success):
```json
{"success":true,"message":"Calendar access granted"}
```

### List Calendars

```bash
../bin/CalendarHelper list-calendars
```

Output:
```json
[
  {
    "id": "calendar-id-1",
    "title": "Calendar Name",
    "source": "Source Name"
  },
  ...
]
```

### List Events

```bash
../bin/CalendarHelper list-events 14  # List events for next 14 days
```

Output:
```json
[
  {
    "id": "event-id-1",
    "title": "Event Title",
    "start": "2023-06-01T10:00:00Z",
    "end": "2023-06-01T11:00:00Z",
    "calendar": "Calendar Name"
  },
  ...
]
```

## Error Handling

The utility now provides structured JSON error output to stderr. Error responses have the following format:

```json
{
  "error": {
    "code": 2,
    "message": "Calendar permission denied",
    "details": "Access not granted by user",
    "recovery": "Run 'open -W \"bin/CalendarHelper.app\" --args list-calendars' to grant permission"
  }
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| 0    | Success |
| 1    | Generic Error |
| 2    | Permission Denied |
| 3    | Network/Connection Error |
| 4    | Calendar Not Found |
| 5    | Event Not Found |
| 6    | Invalid Date Format |
| 64   | Invalid Command/Usage |
| 78   | Configuration Error |

## Integration

This utility is intended to be used with the `run-helper.sh` script, which is called by the EventKit service in the main application.

## Troubleshooting

If you encounter permission issues:
1. Try running the app bundle directly with `open`
2. Check console logs for permission errors
3. Verify that the app is properly signed with calendar entitlements
4. Use the `check-permissions` command to verify access

## Developer Notes

- The Swift code is in `Sources/CalendarHelper/main.swift`
- The utility uses EventKit framework for calendar access
- Logging is sent to stderr, data output to stdout
- Errors are reported as structured JSON to stderr 