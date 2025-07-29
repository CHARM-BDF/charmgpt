import EventKit
import Foundation

let store = EKEventStore()
let sem = DispatchSemaphore(value: 0)
var granted = false

print("Requesting calendar access...")
store.requestAccess(to: .event) { ok, _ in granted = ok; sem.signal() }
sem.wait()
guard granted else { 
    print("Calendar access denied")
    exit(2) 
}

// Check if command line arguments are provided
guard CommandLine.arguments.count > 1 else {
    print("Usage: CalendarHelper [list-calendars|list-events <days>]")
    exit(64)
}

enum Cmd: String { case list = "list-calendars", events = "list-events" }
guard let cmd = Cmd(rawValue: CommandLine.arguments[1]) else { 
    print("Unknown command: \(CommandLine.arguments[1])")
    print("Usage: CalendarHelper [list-calendars|list-events <days>]")
    exit(64) 
}

let enc = JSONEncoder()
enc.dateEncodingStrategy = .iso8601
enc.outputFormatting = .prettyPrinted

switch cmd {
case .list:
    print("Fetching calendars...")
    let cals = store.calendars(for: .event).map { 
        [
            "id": $0.calendarIdentifier, 
            "title": $0.title, 
            "source": $0.source.title
        ] 
    }
    print(String(data: try enc.encode(cals), encoding: .utf8)!)

case .events:
    let days = CommandLine.arguments.count > 2 ? Int(CommandLine.arguments[2]) ?? 7 : 7
    print("Fetching events for the next \(days) days...")
    
    let start = Date()
    let end = Calendar.current.date(byAdding: .day, value: days, to: start)!
    let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
    let events = store.events(matching: predicate).map {
        [
            "id": $0.eventIdentifier ?? "",
            "title": $0.title,
            "start": $0.startDate,
            "end": $0.endDate,
            "calendar": $0.calendar.title
        ]
    }
    print(String(data: try enc.encode(events), encoding: .utf8)!)
} 