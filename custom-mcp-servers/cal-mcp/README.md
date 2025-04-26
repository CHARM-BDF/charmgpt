# CalDAV MCP Server

This is a Model Context Protocol (MCP) server that provides access to calendars via the CalDAV protocol, enabling integration with Apple Calendar, Google Calendar, and other calendar systems through a standardized protocol.

## Features

- Access calendars from multiple providers via CalDAV
- List available calendars
- Retrieve calendar events with filtering options

## Setup

### Installation

```bash
# Clone the repository
cd /path/to/charm-mcp/custom-mcp-servers/cal-mcp

# Install dependencies
npm install
```

### Configuration

The server is configured through environment variables that are set in the main charm-mcp .env file and passed through the mcp_server_config.json.

Add these variables to your root .env file:

```
CALDAV_SERVER_URL=https://caldav.your-provider.com/
CALDAV_USERNAME=your-username
CALDAV_PASSWORD=your-password
CALDAV_DEFAULT_CALENDAR=Your Calendar Name
```

**For Apple Calendar**, these values would be:
```
CALDAV_SERVER_URL=https://caldav.icloud.com/
CALDAV_USERNAME=your.email@icloud.com
CALDAV_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App-specific password
CALDAV_DEFAULT_CALENDAR=Personal      # Optional
```

> Note: For Apple Calendar, you must use an app-specific password generated at https://appleid.apple.com/ rather than your regular Apple ID password.

Alternatively, for local development or testing, you can create a local config.json file:

```json
{
  "serverUrl": "https://caldav.your-provider.com/",
  "username": "your-username",
  "password": "your-password",
  "defaultCalendar": "Your Calendar Name"
}
```

### Building and Running

```bash
# Build the project
npm run build

# For standalone testing
npm start

# The server is normally started through the MCP system
```

## Tools

The server provides the following MCP tools:

### 1. `list_calendars`

Lists all available calendars from the configured CalDAV server.

Example usage:
```javascript
const response = await mcpClient.callTool('list_calendars', {});
```

### 2. `get_calendar_events`

Gets events from a specified calendar within a date range.

Parameters:
- `calendarId` (optional): ID of the calendar to get events from
- `start` (optional): Start date in ISO format (defaults to today)
- `end` (optional): End date in ISO format (defaults to 7 days from start)
- `query` (optional): Search query to filter events by title, description, or location

Example usage:
```javascript
const response = await mcpClient.callTool('get_calendar_events', {
  calendarId: 'https://caldav.example.com/calendars/user/calendar/',
  start: '2023-10-01T00:00:00Z',
  end: '2023-10-31T23:59:59Z',
  query: 'meeting'
});
```

## Common CalDAV Server URLs

- Apple iCloud: `https://caldav.icloud.com/`
- Google Calendar: `https://calendar.google.com/calendar/dav/`
- FastMail: `https://caldav.fastmail.com/`
- Zimbra: `https://mail.example.com/dav/`

## Troubleshooting

- **Connection Issues**: Ensure your credentials are correct and the CalDAV server URL is accessible
- **Authentication Failures**: Some providers may require app-specific passwords or other authentication methods
- **Empty Calendar List**: Verify that you have permissions to access the calendars on the server 