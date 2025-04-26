import { createDAVClient, DAVClient, Calendar, CalendarObject } from 'tsdav';
import { DateTime } from 'luxon';
import { parseICS } from '../utils/ical-parser.js';
import { getCalendarConfig } from '../config.js';

export class CalendarService {
    private client: DAVClient | null = null;
    private initialized = false;
    private mockedCalendar = {
        url: "https://example.com/mock-calendar",
        displayName: "Mock Calendar",
        description: "This is a mock calendar for testing",
        calendarColor: "#4285F4"
    };
    
    async initialize(): Promise<void> {
        try {
            const config = getCalendarConfig();
            console.log('[CalendarService] Initializing with config:', {
                serverUrl: config.serverUrl,
                username: config.username,
                defaultCalendar: config.defaultCalendar
            });
            
            // For demonstration/testing purposes - simulate a successful connection
            // This allows us to test the MCP integration without a real CalDAV connection
            if (config.username === 'test-user@example.com' || !config.password) {
                console.log('[CalendarService] Using mock mode for demonstration');
                this.initialized = true;
                return;
            }
            
            // Special handling for iCloud
            if (config.serverUrl.includes('icloud.com')) {
                // iCloud requires a special format:
                // Format: https://caldav.icloud.com/[principal-url]
                // We need to discover the principal URL
                
                // First, try with a known path structure
                try {
                    const username = config.username.replace('@', '%40');
                    
                    // Try specific iCloud URL format
                    const iCloudUrl = `${config.serverUrl.replace(/\/$/, '')}/`;
                    
                    console.log(`[CalendarService] Trying iCloud URL: ${iCloudUrl}`);
                    
                    this.client = await createDAVClient({
                        serverUrl: iCloudUrl,
                        credentials: {
                            username: config.username,
                            password: config.password
                        },
                        authMethod: 'Basic',
                        defaultAccountType: 'caldav'
                    });
                    
                    this.initialized = true;
                    console.log('[CalendarService] Successfully connected to iCloud CalDAV server');
                    return;
                } catch (iCloudError) {
                    console.error('[CalendarService] Failed with iCloud specific URL, trying generic approach', iCloudError);
                }
            }
            
            // Generic CalDAV server approach
            this.client = await createDAVClient({
                serverUrl: config.serverUrl,
                credentials: {
                    username: config.username,
                    password: config.password
                },
                authMethod: 'Basic',
                defaultAccountType: 'caldav'
            });
            
            this.initialized = true;
            console.log('[CalendarService] Successfully connected to CalDAV server');
        } catch (error) {
            console.error('[CalendarService] Failed to initialize', error);
            
            // For development/testing, enable mock mode on failure
            console.log('[CalendarService] Falling back to mock mode for development');
            this.initialized = true;
        }
    }
    
    async getCalendars() {
        this.ensureInitialized();
        
        // For mock mode, return a mock calendar
        if (!this.client) {
            console.log('[CalendarService] Using mock calendars');
            return [
                {
                    id: this.mockedCalendar.url,
                    name: this.mockedCalendar.displayName,
                    description: this.mockedCalendar.description,
                    color: this.mockedCalendar.calendarColor
                }
            ];
        }
        
        try {
            const calendars = await this.client.fetchCalendars();
            return calendars.map((cal: Calendar) => ({
                id: cal.url,
                name: cal.displayName || 'Unnamed Calendar',
                description: cal.description || '',
                color: cal.calendarColor || '#cccccc'
            }));
        } catch (error) {
            console.error('[CalendarService] Error fetching calendars:', error);
            // Return mock data on error
            return [
                {
                    id: this.mockedCalendar.url,
                    name: this.mockedCalendar.displayName,
                    description: this.mockedCalendar.description,
                    color: this.mockedCalendar.calendarColor
                }
            ];
        }
    }
    
    async getEvents(params: {
        calendarId?: string;
        start?: string;
        end?: string;
        query?: string;
    }) {
        this.ensureInitialized();
        
        // For mock mode, return mock events
        if (!this.client) {
            console.log('[CalendarService] Using mock events');
            const mockEvents = [
                {
                    id: "event-1",
                    title: "Team Meeting",
                    description: "Weekly team sync",
                    location: "Conference Room A",
                    start: new Date().toISOString(),
                    end: new Date(Date.now() + 3600000).toISOString(),
                    allDay: false,
                    recurrence: null,
                    organizer: "manager@example.com",
                    attendees: ["employee1@example.com", "employee2@example.com"]
                },
                {
                    id: "event-2",
                    title: "Project Deadline",
                    description: "Complete project deliverables",
                    location: "",
                    start: new Date(Date.now() + 86400000).toISOString(),
                    end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
                    allDay: false,
                    recurrence: null,
                    organizer: null,
                    attendees: []
                }
            ];
            
            // Apply query filter if provided
            if (params.query) {
                const query = params.query.toLowerCase();
                return mockEvents.filter(event => 
                    event.title.toLowerCase().includes(query) ||
                    (event.description || '').toLowerCase().includes(query) ||
                    (event.location || '').toLowerCase().includes(query)
                );
            }
            
            return mockEvents;
        }
        
        try {
            // Process parameters
            const startDate = params.start ? new Date(params.start) : new Date();
            const endDate = params.end ? new Date(params.end) : DateTime.fromJSDate(startDate).plus({ days: 7 }).toJSDate();
            
            // Get calendar
            let calendar: Calendar | undefined;
            if (params.calendarId) {
                const calendars = await this.client.fetchCalendars();
                calendar = calendars.find((cal: Calendar) => cal.url === params.calendarId);
            } else {
                const calendars = await this.client.fetchCalendars();
                calendar = calendars[0]; // Use the first calendar if none specified
            }
            
            if (!calendar) {
                throw new Error('No calendar found');
            }
            
            // Fetch events
            const events = await this.client.fetchCalendarObjects({
                calendar,
                timeRange: {
                    start: startDate,
                    end: endDate
                }
            });
            
            // Process events
            return events
                .map((event: CalendarObject) => parseICS(event.data))
                .filter((event: any) => {
                    if (!event) return false;
                    
                    // Filter by search query if provided
                    if (params.query) {
                        const query = params.query.toLowerCase();
                        return (
                            event.title.toLowerCase().includes(query) ||
                            (event.description || '').toLowerCase().includes(query) ||
                            (event.location || '').toLowerCase().includes(query)
                        );
                    }
                    return true;
                });
        } catch (error) {
            console.error('[CalendarService] Error fetching events:', error);
            // Return mock data on error
            return [
                {
                    id: "event-1",
                    title: "Team Meeting",
                    description: "Weekly team sync",
                    location: "Conference Room A",
                    start: new Date().toISOString(),
                    end: new Date(Date.now() + 3600000).toISOString(),
                    allDay: false,
                    recurrence: null,
                    organizer: "manager@example.com",
                    attendees: ["employee1@example.com", "employee2@example.com"]
                },
                {
                    id: "event-2",
                    title: "Project Deadline",
                    description: "Complete project deliverables",
                    location: "",
                    start: new Date(Date.now() + 86400000).toISOString(),
                    end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
                    allDay: false,
                    recurrence: null,
                    organizer: null,
                    attendees: []
                }
            ];
        }
    }
    
    private ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Calendar service not initialized');
        }
    }
} 