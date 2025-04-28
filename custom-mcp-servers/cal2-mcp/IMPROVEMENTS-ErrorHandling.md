# CalendarHelper Error Handling Improvements

## Current State

The current error handling in the CalendarHelper system has some limitations:

1. **Basic exit codes**:
   - Only handles permission denials (exit code 2)
   - Uses standard EX_USAGE (64) for invalid commands
   - No standardized error codes for other failure modes

2. **Error reporting**:
   - Errors are sent to stderr as plain text
   - No structured format for errors
   - Limited context in error messages

3. **Permission handling**:
   - Permission prompts can be confusing to users
   - No clear recovery path for denied permissions

## Proposed Improvements

### 1. Standardized Error Codes

Implement a consistent set of error codes:

| Code | Meaning |
|------|---------|
| 0    | Success |
| 1    | Generic Error |
| 2    | Permission Denied |
| 3    | Network/Connection Error |
| 4    | Calendar Not Found |
| 5    | Event Not Found |
| 6    | Invalid Date Format |
| 64   | Invalid Command/Usage |
| 78   | Configuration Error |

### 2. Structured Error Output

When an error occurs, output a structured error JSON to stderr:

```json
{
  "error": {
    "code": 2,
    "message": "Calendar permission denied",
    "details": "User declined calendar access permission",
    "recovery": "Run 'open -W bin/CalendarHelper.app --args list-calendars' to grant permission"
  }
}
```

### 3. Improved Permission Handling

Enhance permission handling in both Swift and TypeScript layers:

1. **Swift Layer**:
   - Add clear error message with recovery instructions
   - Add a special command `check-permissions` that only verifies access
   - Include time of last permission grant/denial in error details

2. **TypeScript Layer**:
   - Add automatic recovery attempts with user guidance
   - Cache permission status to avoid repeated prompts
   - Provide clear UI feedback when permissions are needed

### 4. Retry Capability

Implement retry logic for transient failures:

1. **Swift Layer**:
   - Add exit codes that indicate retryable vs. non-retryable errors

2. **TypeScript Layer**:
   - Add configurable retry policy (count, backoff)
   - Log retry attempts and outcomes
   - Handle different error types appropriately

### 5. Error Localization

Prepare for future internationalization of error messages:

1. **Swift Layer**:
   - Use error codes as keys
   - Include a default English message

2. **TypeScript Layer**:
   - Map error codes to localized messages
   - Support for multiple languages

## Implementation Plan

### Phase 1: Swift Layer Changes

1. Modify `main.swift` to output structured error JSON:
   ```swift
   func reportError(code: Int, message: String, details: String? = nil, recovery: String? = nil) {
     let error: [String: Any] = [
       "error": [
         "code": code,
         "message": message,
         "details": details ?? "",
         "recovery": recovery ?? ""
       ]
     ]
     
     if let errorJson = try? JSONSerialization.data(withJSONObject: error),
        let errorString = String(data: errorJson, encoding: .utf8) {
       FileHandle.standardError.write(Data((errorString + "\n").utf8))
     }
     
     exit(Int32(code))
   }
   ```

2. Update permission handling:
   ```swift
   // Replace current permission handling
   store.requestAccess(to: .event) { ok, error in 
     granted = ok
     if !ok {
       let details = error?.localizedDescription ?? "Access not granted"
       permissionError = details
     }
     sem.signal() 
   }
   sem.wait()
   
   guard granted else {
     reportError(
       code: 2,
       message: "Calendar permission denied",
       details: permissionError,
       recovery: "Run 'open -W bin/CalendarHelper.app --args list-calendars' to grant permission"
     )
     exit(2)
   }
   ```

### Phase 2: TypeScript Layer Changes

1. Update `eventkit-service.ts` to handle structured errors:
   ```typescript
   // Error handling in the run method
   p.on("close", c => {
     if (c === 0) {
       // Success handling...
     } else {
       // Try to parse error as JSON
       try {
         const errorData = JSON.parse(err || "{}");
         if (errorData.error) {
           const { code, message, details, recovery } = errorData.error;
           console.error(`[EventKitService] Error ${code}: ${message}`);
           this.writeToLogFile(`STRUCTURED ERROR: code=${code}, message=${message}, details=${details}\n`);
           
           // Handle specific error codes
           if (code === 2) { // Permission denied
             rej(new Error(`Calendar permission denied. ${recovery}`));
           } else {
             rej(new Error(`${message} (${code}): ${details}`));
           }
         } else {
           // Fall back to generic error
           console.error(`[EventKitService] Helper failed with code ${c}: ${err}`);
           this.writeToLogFile(`HELPER FAILED: code ${c}, error: ${err}\n`);
           rej(new Error(`Helper error (${c}): ${err}`));
         }
       } catch (e) {
         // Not JSON, use old error handling
         console.error(`[EventKitService] Helper failed with code ${c}: ${err}`);
         this.writeToLogFile(`HELPER FAILED: code ${c}, error: ${err}\n`);
         rej(new Error(`Helper error (${c}): ${err}`));
       }
     }
   });
   ```

2. Add retry capability:
   ```typescript
   async runWithRetry(args: string[], retries = 3): Promise<any[]> {
     let attempt = 0;
     let lastError: any;
     
     while (attempt < retries) {
       try {
         return await this.run(args);
       } catch (error) {
         lastError = error;
         
         // Check if error is retryable
         if (this.isRetryableError(error) && attempt < retries - 1) {
           attempt++;
           console.error(`[EventKitService] Retrying (${attempt}/${retries}) after error: ${error.message}`);
           this.writeToLogFile(`RETRY: attempt=${attempt}, error=${error.message}\n`);
           
           // Exponential backoff
           await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
         } else {
           throw error;
         }
       }
     }
     
     throw lastError;
   }
   
   private isRetryableError(error: any): boolean {
     // Determine if an error should be retried
     if (error.message.includes("code=2")) return false; // Permission denied - not retryable
     if (error.message.includes("code=64")) return false; // Usage error - not retryable
     
     return true; // Other errors may be transient
   }
   ```

## Testing and Validation

1. Create test cases for each error condition
2. Verify error handling in both layers
3. Test retry logic with simulated failures
4. Validate user experience during permission failures

## Future Considerations

1. **Extended Error Context**: Include more context in errors (user, time, system info)
2. **Error Analytics**: Track error patterns to inform improvements
3. **Interactive Recovery**: GUI-based recovery for permission issues 