declare module 'tsdav' {
  export interface DAVCredentials {
    username: string;
    password: string;
  }

  export interface DAVClient {
    fetchCalendars(): Promise<Calendar[]>;
    fetchCalendarObjects(params: {
      calendar: Calendar;
      timeRange?: {
        start: Date;
        end: Date;
      };
    }): Promise<CalendarObject[]>;
  }

  export interface Calendar {
    url: string;
    displayName?: string;
    description?: string;
    calendarColor?: string;
  }

  export interface CalendarObject {
    url: string;
    etag: string;
    data: string;
  }

  export interface DAVOptions {
    serverUrl: string;
    credentials: DAVCredentials;
    authMethod?: string;
    defaultAccountType?: string;
  }

  export function createDAVClient(options: DAVOptions): Promise<DAVClient>;
} 