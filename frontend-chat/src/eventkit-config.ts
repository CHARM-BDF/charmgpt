// EventKit configuration - doesn't require credentials
// This is a simplified version of config.ts that works with EventKit only

export interface EventKitConfig {
    // Currently no configuration needed for EventKit
    // But we'll keep this interface for future extensions
}

export function getEventKitConfig(): EventKitConfig {
    return {};
}

export function validateEventKitConfig(_config: EventKitConfig): void {
    // No validation needed - EventKit uses system permissions
} 