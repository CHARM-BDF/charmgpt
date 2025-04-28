# CalendarHelper Caching Strategy

## Current State

The current implementation of the EventKit service has no caching mechanism:

1. Each request for calendars or events:
   - Spawns a new process
   - Requires a full permission request
   - Performs a complete fetch from the EventKit database

2. This approach has several inefficiencies:
   - Repeated process creation overhead
   - Multiple permission requests
   - Repeated identical queries

## Proposed Caching Solution

Implement a two-tiered caching system in the TypeScript layer:

### 1. Calendar List Caching

Calendars change infrequently, making them ideal for longer-term caching:

```typescript
interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;  // Time to live in milliseconds
}

interface CalendarCacheOptions {
  ttl?: number;         // Time to live (default: 1 hour)
  forceRefresh?: boolean; // Bypass cache
}
```

Implementation:

```typescript
// In EventKitService class
private calendarCache: CachedData<any[]> | null = null;
private readonly DEFAULT_CALENDAR_TTL = 60 * 60 * 1000; // 1 hour

async listCalendars(options: CalendarCacheOptions = {}): Promise<any[]> {
  const { ttl = this.DEFAULT_CALENDAR_TTL, forceRefresh = false } = options;
  
  // Check if we have a valid cache
  if (
    !forceRefresh &&
    this.calendarCache &&
    (Date.now() - this.calendarCache.timestamp) < this.calendarCache.ttl
  ) {
    console.error(`[EventKitService] Using cached calendars (${this.calendarCache.data.length})`);
    this.writeToLogFile(`CACHE HIT: Using ${this.calendarCache.data.length} cached calendars\n`);
    return [...this.calendarCache.data]; // Return a copy to prevent mutation
  }
  
  // Fetch fresh data
  console.error(`[EventKitService] Fetching fresh calendar list`);
  const calendars = await this.run(["list-calendars"]);
  
  // Update cache
  this.calendarCache = {
    data: calendars,
    timestamp: Date.now(),
    ttl
  };
  
  console.error(`[EventKitService] Updated calendar cache with ${calendars.length} calendars`);
  this.writeToLogFile(`CACHE UPDATE: Stored ${calendars.length} calendars\n`);
  
  return [...calendars]; // Return a copy
}
```

### 2. Event Caching

Events change more frequently, requiring a more sophisticated caching strategy:

```typescript
interface EventCacheKey {
  days: number;
  calendarIds?: string[];  // For future filtering
}

interface EventCacheOptions extends CalendarCacheOptions {
  calendarIds?: string[]; // For future filtering
}

// In EventKitService class
private eventCache: Map<string, CachedData<any[]>> = new Map();
private readonly DEFAULT_EVENT_TTL = 5 * 60 * 1000; // 5 minutes

private generateEventCacheKey(options: EventCacheKey): string {
  const { days, calendarIds } = options;
  let key = `days=${days}`;
  
  if (calendarIds && calendarIds.length > 0) {
    // Sort to ensure consistent key generation regardless of array order
    key += `:cals=${calendarIds.sort().join(',')}`;
  }
  
  return key;
}

async listEvents(options: EventCacheOptions = {}): Promise<any[]> {
  const { 
    days = 7, 
    ttl = this.DEFAULT_EVENT_TTL,
    forceRefresh = false,
    calendarIds
  } = options;
  
  const cacheKey = this.generateEventCacheKey({ days, calendarIds });
  
  // Check cache
  if (
    !forceRefresh &&
    this.eventCache.has(cacheKey)
  ) {
    const cache = this.eventCache.get(cacheKey)!;
    
    // Check if cache is still valid
    if ((Date.now() - cache.timestamp) < cache.ttl) {
      console.error(`[EventKitService] Using cached events (${cache.data.length})`);
      this.writeToLogFile(`CACHE HIT: Using ${cache.data.length} cached events for key ${cacheKey}\n`);
      return [...cache.data]; // Return a copy
    }
  }
  
  // Build command arguments
  const args = ["list-events", String(days)];
  
  // Fetch fresh data
  console.error(`[EventKitService] Fetching fresh events for next ${days} days`);
  const events = await this.run(args);
  
  // Apply any client-side filtering (for future calendar filtering)
  let filteredEvents = events;
  if (calendarIds && calendarIds.length > 0) {
    filteredEvents = events.filter(event => 
      calendarIds.includes(event.calendar)
    );
  }
  
  // Update cache
  this.eventCache.set(cacheKey, {
    data: filteredEvents,
    timestamp: Date.now(),
    ttl
  });
  
  console.error(`[EventKitService] Updated event cache with ${filteredEvents.length} events`);
  this.writeToLogFile(`CACHE UPDATE: Stored ${filteredEvents.length} events for key ${cacheKey}\n`);
  
  return [...filteredEvents]; // Return a copy
}
```

### 3. Cache Management

Add methods to manage the cache:

```typescript
// Clear all caches
clearCache(): void {
  this.calendarCache = null;
  this.eventCache.clear();
  console.error(`[EventKitService] All caches cleared`);
  this.writeToLogFile(`CACHE CLEAR: All caches cleared\n`);
}

// Clear only event cache
clearEventCache(): void {
  this.eventCache.clear();
  console.error(`[EventKitService] Event cache cleared`);
  this.writeToLogFile(`CACHE CLEAR: Event cache cleared\n`);
}

// Get cache statistics
getCacheStats(): { calendars: boolean, events: number } {
  return {
    calendars: !!this.calendarCache,
    events: this.eventCache.size
  };
}
```

### 4. Cache Invalidation Triggers

Implement automatic cache invalidation for specific scenarios:

1. **Time-based expiration**: Using TTL as described above
2. **User-triggered refresh**: Via `forceRefresh` parameter
3. **Error-triggered invalidation**: Clear cache on certain error types

```typescript
private handleCacheInvalidation(error: any): void {
  // Check if error should invalidate cache
  if (error.message.includes("Calendar permission denied")) {
    // Permission errors should clear all caches
    this.clearCache();
  }
}
```

## Enhanced TypeScript Service Implementation

The updated `eventkit-service.ts` with caching:

```typescript
export class EventKitService {
  private helperScript = new URL("../../bin/run-helper.sh", import.meta.url).pathname;
  private logFilePath: string;
  
  // Cache storage
  private calendarCache: CachedData<any[]> | null = null;
  private eventCache: Map<string, CachedData<any[]>> = new Map();
  
  // Cache TTL defaults
  private readonly DEFAULT_CALENDAR_TTL = 60 * 60 * 1000; // 1 hour
  private readonly DEFAULT_EVENT_TTL = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    this.logFilePath = path.join(path.dirname(this.helperScript), "eventkit-service.log");
    this.writeToLogFile(`\n--- EventKitService initialized at ${new Date().toISOString()} ---\n`);
  }
  
  // Existing methods...
  
  // Updated methods with caching
  async listCalendars(options: CalendarCacheOptions = {}): Promise<any[]> {
    // Implementation as described in section 1
  }
  
  async listEvents(options: EventCacheOptions = {}): Promise<any[]> {
    // Implementation as described in section 2
  }
  
  // Cache management methods
  clearCache(): void {
    // Implementation as described in section 3
  }
  
  clearEventCache(): void {
    // Implementation as described in section 3
  }
  
  getCacheStats(): { calendars: boolean, events: number } {
    // Implementation as described in section 3
  }
}
```

## Performance Benefits

The caching strategy provides several benefits:

1. **Reduced Process Creation**: Fewer helper process spawns
2. **Decreased Permission Requests**: Minimized EventKit permission dialogs
3. **Lower Latency**: Faster response times for cached data
4. **Reduced Resource Usage**: Less CPU and memory consumption

## Limitations and Considerations

1. **Cache Staleness**: Events might change between cache refreshes
2. **Memory Usage**: Large event sets could consume significant memory
3. **Cache Consistency**: External calendar changes won't trigger invalidation

## Future Enhancements

1. **Persistent Caching**: Save cache to disk for persistence across restarts
2. **Selective Invalidation**: Invalidate only specific parts of cache
3. **Change Detection**: Implement change detection to trigger invalidation
4. **Smart Prefetching**: Preload cache based on usage patterns

## Testing Strategy

1. **Unit Tests**: Verify cache hit/miss logic
2. **Performance Tests**: Measure response time improvements
3. **Stress Tests**: Evaluate behavior under high load
4. **Integration Tests**: Ensure cached data matches fresh data

## Implementation Timeline

1. Add basic TypeScript caching (calendar and event)
2. Implement cache management methods
3. Add cache invalidation triggers
4. Implement unit tests for caching behavior 