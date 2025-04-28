# README.PLAN.CalInfokit

## System Overview

The Calendar Helper system is a macOS/iOS calendar integration utility that consists of several components:

1. **Swift Helper (`CalendarHelper`)**: A standalone Swift binary that interfaces with EventKit
2. **Helper Script (`run-helper.sh`)**: A shell script wrapper to execute the Swift binary
3. **EventKit Service (`eventkit-service.ts`)**: A TypeScript service that spawns the helper script and processes its output
4. **MCP Logging Integration**: Potential integration with the Model Context Protocol (MCP) logging system

## Current Implementation

### Swift Helper (CalendarHelper)

The Swift helper is a command-line tool with two main functions:
- `list-calendars`: Lists all available calendars with their IDs, titles, and sources
- `list-events [days]`: Lists all events for the next N days (default: 7)

Key features:
- Handles EventKit permissions requests
- Outputs JSON-formatted data to stdout
- Logs detailed information to stderr
- Uses a semaphore to handle asynchronous permission requests

### Helper Script (run-helper.sh)

A simple bash wrapper that:
- Locates the CalendarHelper binary relative to its own location
- Passes all arguments through to the binary

### EventKit Service (eventkit-service.ts)

A TypeScript service that:
- Initializes and ensures the helper script is executable
- Provides methods to list calendars and events
- Handles execution of the helper script using Node.js child processes
- Parses JSON output and handles errors
- Implements detailed logging to both console and a log file

## Strategies and Improvements

### 1. Binary Distribution Strategy

**Current State:**
- The Swift binary must be compiled and included with the application
- No clear build process documented for rebuilding the binary

**Options:**
1. **Include Pre-built Binary**: Ship a pre-compiled binary with the application
   - Pros: Simple distribution
   - Cons: Not customizable, may have compatibility issues across macOS versions
   
2. **Build During Installation**: Compile the Swift code during app installation
   - Pros: Ensures compatibility with user's system
   - Cons: Requires Swift toolchain on user's machine, complicates installation

3. **Dynamic Compilation**: Compile on first use if binary doesn't exist
   - Pros: Fallback capability if binary is missing
   - Cons: Requires Swift toolchain, may fail silently

**Recommendation:** Include pre-built binary but add rebuild instructions and script.

### 2. Error Handling Enhancement

**Current State:**
- Basic error handling for permission denials (exit code 2)
- Limited error information passed back to the TypeScript layer

**Improvements:**
1. Standardize error codes across the Swift binary for different failure modes
2. Add structured error output in JSON format
3. Improve permission handling with clearer instructions for users
4. Add retry capability for transient failures

### 3. MCP Integration

**Current State:**
- No direct integration with MCP logging system
- EventKit service logs to its own file and to console

**Integration Options:**
1. **Direct MCP Integration**: Modify Swift code to output in MCP format
   - Pros: Native integration
   - Cons: Increases complexity of Swift code, ties it to MCP

2. **TypeScript Bridge**: Keep EventKit service as-is, but forward logs to MCP
   - Pros: Maintains separation of concerns
   - Cons: Duplicated logging, potential for lost messages

3. **Hybrid Approach**: Simple structured output from Swift, enhanced in TypeScript
   - Pros: Balance of simplicity and integration
   - Cons: Requires changes to both layers

**Recommendation:** Implement option 3 (Hybrid) by adding simple JSON log output to Swift and handling in TypeScript.

### 4. Calendar Data Caching

**Current State:**
- Each request spawns a new process
- No caching of calendar or event data

**Improvements:**
1. Implement in-memory caching with TTL for calendar list (rarely changes)
2. Add optional caching for events with configurable staleness parameters
3. Add "force refresh" option to bypass cache

### 5. Enhanced Calendar Filtering

**Current State:**
- `list-events` returns all events across all calendars
- No filtering capabilities in the Swift binary

**Potential Enhancements:**
1. Add calendar filtering by ID
2. Add keyword filtering for event titles
3. Add status filtering (confirmed, tentative, etc.)
4. Add location-based filtering

**Implementation Approaches:**
1. Add parameters to Swift binary
2. Implement filtering in TypeScript layer
3. Combination approach with basic filters in Swift, advanced in TypeScript

**Recommendation:** Start with basic filtering in Swift (by calendar ID) and implement more complex filtering in TypeScript.

### 6. Performance Optimization

**Current State:**
- Each request spawns a new process
- Full EventKit permission request on each invocation

**Optimizations:**
1. Implement a daemon mode for the Swift binary
2. Use IPC instead of process spawning
3. Cache permission grants
4. Optimize JSON serialization for large event sets

### 7. Security Considerations

**Current Areas for Review:**
1. Permission handling and user privacy
2. Data exposure in logs
3. Script execution security
4. Error message information disclosure

**Improvements:**
1. Sanitize sensitive data in logs
2. Improve permission messaging
3. Add integrity verification for the binary
4. Implement secure IPC if moving to daemon mode

## Implementation Plan

### Phase 1: Stabilization

1. Document the build process for the Swift binary
2. Enhance error handling and reporting
3. Add basic caching in the EventKit service
4. Sanitize logs to remove sensitive information

### Phase 2: Feature Enhancement

1. Implement calendar filtering in the Swift binary
2. Add MCP logging integration (hybrid approach)
3. Improve permission handling and user guidance
4. Add integration tests

### Phase 3: Performance and Security

1. Evaluate daemon mode vs. process spawning
2. Implement chosen IPC mechanism
3. Optimize for large calendar sets
4. Complete security review and hardening

## Technical Debt and Considerations

1. **Binary Distribution**: The reliance on a pre-built binary creates maintenance challenges
2. **Permission Model**: EventKit permissions are complex and change across macOS versions
3. **Process Overhead**: Spawning a new process for each request is inefficient
4. **Error Propagation**: The multi-layer architecture complicates error handling
5. **Testing**: Calendar access makes automated testing challenging

## Conclusion

The CalendarHelper system provides a solid foundation for calendar integration, using Swift's native EventKit APIs with a TypeScript bridge for integration with the larger application. The planned enhancements focus on improving reliability, performance, and security while maintaining the separation of concerns between the native Swift code and the TypeScript application layer.

By implementing these strategies in phases, we can improve the system incrementally while maintaining backward compatibility and minimizing disruption to the existing functionality. 