import EventKit
import Foundation

// Define and parse command arguments
enum Cmd: String { case list = "list-calendars", events = "list-events", check = "check-permissions" }

// Error codes
enum ErrorCode: Int {
    case success = 0
    case generic = 1
    case permissionDenied = 2
    case networkError = 3
    case calendarNotFound = 4
    case eventNotFound = 5
    case invalidDateFormat = 6
    case invalidCommand = 64
    case configError = 78
}

// Structured error reporting function
func reportError(code: ErrorCode, message: String, details: String? = nil, recovery: String? = nil) {
    let error: [String: Any] = [
        "error": [
            "code": code.rawValue,
            "message": message,
            "details": details ?? "",
            "recovery": recovery ?? ""
        ]
    ]
    
    if let errorJson = try? JSONSerialization.data(withJSONObject: error),
       let errorString = String(data: errorJson, encoding: .utf8) {
        FileHandle.standardError.write(Data((errorString + "\n").utf8))
    }
    
    exit(Int32(code.rawValue))
}

// Check for minimum args and valid command
guard CommandLine.argc >= 2,
      let cmd = Cmd(rawValue: CommandLine.arguments[1]) else {
    reportError(
        code: .invalidCommand,
        message: "Invalid command",
        details: "The specified command is not recognized",
        recovery: "Use 'list-calendars', 'list-events [days]', or 'check-permissions'"
    )
    // reportError already calls exit, but adding this to satisfy the compiler
    exit(ErrorCode.invalidCommand.rawValue)
}

// Helper function to log
func log(_ message: String) {
    // When outputting to a file, log to stderr
    FileHandle.standardError.write(Data((message + "\n").utf8))
}

log("Command: \(cmd), Args: \(CommandLine.arguments)")

// Request calendar access
let store = EKEventStore()
log("Requesting calendar access...")
let sem = DispatchSemaphore(value: 0)
var granted = false
var permissionError: String? = nil

store.requestAccess(to: .event) { ok, error in
    granted = ok
    if !ok {
        permissionError = error?.localizedDescription ?? "Access not granted"
    }
    sem.signal()
}
sem.wait()

guard granted else {
    reportError(
        code: .permissionDenied,
        message: "Calendar permission denied",
        details: permissionError,
        recovery: "Run 'open -W \"bin/CalendarHelper.app\" --args list-calendars' to grant permission"
    )
    // reportError already calls exit, but adding this to satisfy the compiler
    exit(ErrorCode.permissionDenied.rawValue)
}

log("Calendar access granted")

// Setup JSON encoder
let enc = JSONEncoder()
enc.dateEncodingStrategy = .iso8601

// Process commands
switch cmd {
case .check:
    // Just checking permissions, already passed above guard
    let result: [String: Any] = ["success": true, "message": "Calendar access granted"]
    print(String(data: try! JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)

case .list:
    // Define a struct to ensure Encodable conformance
    struct Calendar: Encodable {
        let id: String
        let title: String
        let source: String
    }
    
    log("Fetching calendars...")
    let calendars = store.calendars(for: .event)
    log("Found \(calendars.count) calendars")
    
    let out = calendars.map { cal in
        Calendar(
            id: cal.calendarIdentifier,
            title: cal.title,
            source: cal.source.title
        )
    }
    
    do {
        print(String(data: try enc.encode(out), encoding: .utf8)!)
    } catch {
        reportError(
            code: .generic,
            message: "Failed to encode calendar data",
            details: error.localizedDescription
        )
    }

case .events:
    // Define a struct to ensure Encodable conformance
    struct Event: Encodable {
        let id: String
        let title: String
        let start: Date
        let end: Date
        let calendar: String
    }
    
    // Usage: list-events <daysAhead>
    guard CommandLine.argc >= 3 else {
        reportError(
            code: .invalidCommand,
            message: "Missing required parameter",
            details: "The 'list-events' command requires a 'days' parameter",
            recovery: "Use 'list-events [days]', e.g. 'list-events 7'"
        )
        exit(ErrorCode.invalidCommand.rawValue)
    }
    
    guard let days = Int(CommandLine.arguments[2]) else {
        reportError(
            code: .invalidCommand,
            message: "Invalid days parameter",
            details: "The 'days' parameter must be a valid integer",
            recovery: "Use 'list-events [days]', e.g. 'list-events 7'"
        )
        exit(ErrorCode.invalidCommand.rawValue)
    }
    
    log("Fetching events for next \(days) days...")
    let start = Date()
    guard let end = Calendar.current.date(byAdding: .day, value: days, to: start) else {
        reportError(
            code: .invalidDateFormat,
            message: "Failed to calculate end date",
            details: "Could not add \(days) days to current date"
        )
        exit(ErrorCode.invalidDateFormat.rawValue)
    }
    
    let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
    let events = store.events(matching: pred)
    
    let evts = events.compactMap { event -> Event? in
        // Skip events with missing required data
        guard let startDate = event.startDate,
              let endDate = event.endDate,
              let id = event.eventIdentifier
        else { return nil }
        
        return Event(
            id: id,
            title: event.title ?? "(No title)",
            start: startDate,
            end: endDate,
            calendar: event.calendar.title
        )
    }
    
    log("Filtered to \(evts.count) valid events")
    
    do {
        print(String(data: try enc.encode(evts), encoding: .utf8)!)
    } catch {
        reportError(
            code: .generic,
            message: "Failed to encode event data",
            details: error.localizedDescription
        )
    }
} 