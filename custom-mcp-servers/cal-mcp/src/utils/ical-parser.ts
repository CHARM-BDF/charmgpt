import ICAL from 'ical.js';

export function parseICS(icsData: string) {
  const jcalData = ICAL.parse(icsData);
  const comp = new ICAL.Component(jcalData);
  const vevent = comp.getFirstSubcomponent('vevent');
  
  if (!vevent) {
    return null;
  }
  
  const event = new ICAL.Event(vevent);
  
  return {
    id: event.uid,
    title: event.summary,
    description: event.description,
    location: event.location,
    start: event.startDate.toJSDate().toISOString(),
    end: event.endDate.toJSDate().toISOString(),
    allDay: event.startDate.isDate,
    recurrence: event.recurrenceId ? event.recurrenceId.toString() : null,
    organizer: event.organizer ? event.organizer.toString() : null,
    attendees: event.attendees ? event.attendees.map((attendee: any) => attendee.toString()) : []
  };
} 