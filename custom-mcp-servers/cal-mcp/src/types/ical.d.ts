declare module 'ical.js' {
  export class Component {
    constructor(jCal: any);
    getFirstSubcomponent(componentName: string): Component | null;
  }

  export class Event {
    constructor(component: Component);
    uid: string;
    summary: string;
    description: string;
    location: string;
    startDate: Time;
    endDate: Time;
    recurrenceId: any;
    organizer: any;
    attendees: any[];
  }

  export class Time {
    constructor(data: any);
    toJSDate(): Date;
    isDate: boolean;
    toString(): string;
  }

  export function parse(icsData: string): any;
} 