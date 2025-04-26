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
  // Define a struct to ensure Encodable conformance
  struct Calendar: Encodable {
    let id: String
    let title: String
    let source: String
  }
  
  let out = store.calendars(for: .event).map { cal in
    Calendar(
      id: cal.calendarIdentifier,
      title: cal.title,
      source: cal.source.title
    )
  }
  print(String(data: try enc.encode(out), encoding: .utf8)!)

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
  let days = Int(CommandLine.arguments[2]) ?? 7
  let start = Date()
  let end = Calendar.current.date(byAdding: .day, value: days, to: start)!
  let pred = store.predicateForEvents(withStart: start, end: end, calendars: nil)
  
  let evts = store.events(matching: pred).compactMap { event -> Event? in
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
  
  print(String(data: try enc.encode(evts), encoding: .utf8)!)
} 