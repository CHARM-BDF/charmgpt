import { readFileSync } from 'fs';
import { join } from 'path';

// Get direct environment variables with defaults
export const CALDAV_SERVER_URL = process.env.CALDAV_SERVER_URL || 'https://caldav.icloud.com/';
export const CALDAV_USERNAME = process.env.CALDAV_USERNAME;
export const CALDAV_PASSWORD = process.env.CALDAV_PASSWORD;
export const CALDAV_DEFAULT_CALENDAR = process.env.CALDAV_DEFAULT_CALENDAR;

// Check for user config file (as fallback)
let userConfig = {};
try {
    const configPath = process.env.CALENDAR_CONFIG_PATH || join(process.cwd(), 'config.json');
    const configData = readFileSync(configPath, 'utf8');
    userConfig = JSON.parse(configData);
} catch (error) {
    // Config file not found, will use environment variables
    // This is expected when using variables from mcp_server_config.json
}

export interface CalendarConfig {
    serverUrl: string;
    username: string;
    password: string;
    defaultCalendar?: string;
}

export function getCalendarConfig(): CalendarConfig {
    // Environment variables take precedence over config file
    return {
        serverUrl: CALDAV_SERVER_URL || (userConfig as any).serverUrl,
        username: CALDAV_USERNAME || (userConfig as any).username,
        password: CALDAV_PASSWORD || (userConfig as any).password,
        defaultCalendar: CALDAV_DEFAULT_CALENDAR || (userConfig as any).defaultCalendar
    };
}

export function validateConfig(config: CalendarConfig): void {
    if (!config.serverUrl) {
        throw new Error('Missing CALDAV_SERVER_URL');
    }
    if (!config.username) {
        throw new Error('Missing CALDAV_USERNAME');
    }
    if (!config.password) {
        throw new Error('Missing CALDAV_PASSWORD');
    }
} 