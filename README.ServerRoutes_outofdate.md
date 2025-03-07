# Server Routes Guide

## Overview
This document explains how the server architecture works and details all the necessary steps and files that need to be updated when creating a new route. The server is built using Express.js with TypeScript and follows a modular architecture pattern.

## Server Architecture

### Key Directories and Files
```
server/
├── src/
│   ├── config.ts           # Configuration settings
│   ├── index.ts           # Main server entry point
│   ├── routes/            # Route handlers
│   │   ├── markdown.ts    # Markdown processing (Claude)
│   │   ├── criteriaheader.ts  # Header analysis (OpenAI)
│   │   ├── criteriaspliter.ts # Criteria splitting (OpenAI)
│   │   └── proxy.ts      # External API proxying
│   ├── services/         # Shared services
│   │   ├── openai.ts    # OpenAI client
│   │   └── markdownService.ts  # Markdown processing
│   └── utils/            # Utility functions
│       └── logger.ts    # Logging utility
```

## Current Routes Overview

### 1. Markdown Processing (`/api/markdown`)
- Converts raw text to structured markdown
- Uses Claude API
- Requires `ANTHROPIC_API_KEY`

### 2. Criteria Header Analysis (`/api/criteriaheader`)
- Analyzes clinical trial criteria headers
- Uses OpenAI GPT-4
- Requires `OPENAI_API_KEY`

### 3. Criteria Splitting (`/api/criteriaspliter`)
- Splits composite criteria into atomic requirements
- Uses OpenAI GPT-4
- Requires `OPENAI_API_KEY`

### 4. External API Proxy (`/api`)
- Proxies requests to ClinicalTrials.gov API
- Implements caching

### 5. Criteria to Patient Validation (`/api/criteria2patient`)
- Evaluates if patient data satisfies clinical trial criteria
- Uses OpenAI GPT-4
- Requires `OPENAI_API_KEY`

#### Steps to Implement
1. **Environment Variables**
   - Ensure `OPENAI_API_KEY` is set in the `.env` file.

2. **Create Route Handler**
   - File: `server/src/routes/criteria2patient.ts`
   - Follow the standard structure:
     ```typescript
     import express from 'express';
     import { z } from 'zod';
     import { config } from '../config';
     import { logger } from '../utils/logger';

     const router = express.Router();

     // Request validation schema
     const RequestSchema = z.object({
       criteriaQuestion: z.string(),
       patientData: z.object({}).passthrough()
     });

     // Route handler
     router.post('/process', async (req, res) => {
       try {
         // Implementation
       } catch (error) {
         logger.error('Error in route:', error);
         res.status(500).json({
           error: error instanceof Error ? error.message : 'Failed to process request'
         });
       }
     });

     export default router;
     ```

3. **Register Route in Server**
   - File: `server/src/index.ts`
   - Import and register the new router:
     ```typescript
     import criteriaToPatientRouter from './routes/criteria2patient';
     // ... other imports

     // Register route
     app.use('/api/criteria2patient', criteriaToPatientRouter);
     ```

4. **Update Logging**
   - Ensure consistent logging for debugging and monitoring.

5. **Testing**
   - Add tests for the new route in the `__tests__` directory.
   - Test both success and error cases.

6. **Documentation**
   - Update this README with examples of how to use the new route, including expected input and output.

### 1. Environment Variables
**File: `server/.env` and root `.env`**
- Add any new API keys or configuration values needed by the route
- Update both files to maintain development/production consistency
- Example:
  ```env
  OPENAI_API_KEY=your_key_here
  NEW_SERVICE_API_KEY=another_key_here
  ```

### 2. Configuration Updates
**File: `server/src/config.ts`**
- Add new configuration values for the route
- Update the config interface/type if adding new properties
- Example:
  ```typescript
  export const config = {
    // ... existing config
    api: {
      openai: {
        key: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4-0125-preview'
      },
      newService: {
        key: process.env.NEW_SERVICE_API_KEY || '',
        endpoint: 'https://api.newservice.com'
      }
    }
  };
  ```

### 3. Create Route Handler
**File: `server/src/routes/[routeName].ts`**
- Create new file in routes directory
- Follow the standard structure:
  ```typescript
  import express from 'express';
  import { z } from 'zod';  // For request validation
  import { config } from '../config';
  import { logger } from '../utils/logger';

  const router = express.Router();

  // Request validation schema
  const RequestSchema = z.object({
    // Define expected request body structure
  });

  // Route handler
  router.post('/endpoint', async (req, res) => {
    try {
      // Implementation
    } catch (error) {
      logger.error('Error in route:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to process request'
      });
    }
  });

  export default router;
  ```

### 4. Register Route in Server
**File: `server/src/index.ts`**
- Import the new router
- Register it with the app
- Add to the startup logging
```typescript
import newRouter from './routes/[routeName]';
// ... other imports

// Register route
app.use('/api/[route-path]', newRouter);

// Update startup logging
app.listen(config.port, () => {
  console.log(`New endpoint available at http://localhost:${config.port}/api/[route-path]`);
});
```

### 5. Create Required Services
**Directory: `server/src/services/`**
- Create any new services needed by the route
- Example for a new API client:
  ```typescript
  // services/newService.ts
  import { config } from '../config';
  
  export const newService = {
    // Service methods
  };
  ```

### 6. Update Logging
**File: `server/src/utils/logger.ts`**
- Add any new logging categories if needed
- Ensure error handling is consistent

## Important Considerations

### 1. Error Handling
- All routes should use the standard error handling pattern
- Wrap route handlers in try-catch blocks
- Use the logger utility for consistent error logging
- Return standardized error responses

### 2. Request Validation
- Always validate request bodies using Zod schemas
- Define clear validation rules
- Return meaningful validation error messages

### 3. Configuration Management
- Keep sensitive values in environment variables
- Use the config file for shared settings
- Document new configuration options

### 4. Type Safety
- Maintain TypeScript types for request/response objects
- Define interfaces for new data structures
- Use strict type checking

### 5. Testing
- Add tests for new routes in `__tests__` directory
- Test both success and error cases
- Validate response formats

## Common Patterns

### Route Handler Structure
```typescript
router.post('/endpoint', async (req, res) => {
  try {
    // 1. Validate request
    const validatedData = RequestSchema.parse(req.body);

    // 2. Process request
    const result = await processData(validatedData);

    // 3. Send response
    res.json(result);
  } catch (error) {
    // 4. Handle errors
    logger.error('Error in route:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process request'
    });
  }
});
```

### Request Validation
```typescript
const RequestSchema = z.object({
  required_field: z.string(),
  optional_field: z.number().optional(),
  enum_field: z.enum(['value1', 'value2']),
  nested_object: z.object({
    field: z.string()
  })
});
```

## Troubleshooting

### Common Issues
1. **404 Not Found**
   - Check if route is properly registered in `index.ts`
   - Verify URL path matches registration

2. **500 Internal Server Error**
   - Check environment variables
   - Verify service dependencies
   - Review error logs

3. **Validation Errors**
   - Confirm request body matches schema
   - Check for missing required fields
   - Validate data types

## Best Practices

1. **Route Organization**
   - Keep related endpoints in the same router
   - Use clear, descriptive route names
   - Follow RESTful conventions

2. **Code Structure**
   - Separate business logic from route handlers
   - Use services for reusable functionality
   - Keep route handlers focused on request/response handling

3. **Security**
   - Validate all inputs
   - Sanitize responses
   - Use appropriate HTTP methods
   - Implement rate limiting where needed

4. **Performance**
   - Implement caching where appropriate
   - Use async/await for asynchronous operations
   - Handle errors gracefully

## Deployment Considerations

1. **Environment Variables**
   - Ensure all required variables are set in production
   - Use appropriate production values
   - Keep sensitive data secure

2. **Logging**
   - Configure appropriate log levels for production
   - Ensure sensitive data is not logged
   - Set up error monitoring

3. **Security**
   - Enable CORS appropriately
   - Set secure headers
   - Configure rate limiting

## Maintenance

1. **Regular Updates**
   - Keep dependencies updated
   - Review and update API versions
   - Monitor for security updates

2. **Monitoring**
   - Set up health checks
   - Monitor error rates
   - Track performance metrics

3. **Documentation**
   - Keep README files updated
   - Document API changes
   - Maintain change log

## Additional Considerations for Route Development

### 1. API Endpoint Testing
- Ensure that each new route has a corresponding test case to verify its functionality. This includes both success and error scenarios.

### 2. Asynchronous Processing
- If the route involves asynchronous processing (like calling an external API), ensure that the code handles promises correctly and includes error handling for failed requests.

### 3. Data Validation
- Use a validation library like Zod to validate incoming request data. This ensures that the data structure is correct before processing.

### 4. Environment Configuration
- Ensure that all necessary environment variables are documented and loaded correctly. This includes API keys and any other configuration needed for the route.

### 5. Logging
- Add logging at key points in the route to help with debugging and monitoring. This includes logging configuration details, request data, and any errors encountered.

### 6. Security
- Ensure that sensitive data is not logged or exposed. Use environment variables for API keys and other sensitive information.

### 7. Rate Limiting
- Consider adding rate limiting to routes that may be called frequently to prevent abuse and manage load.

### 8. Documentation
- Update the README with examples of how to use the new route, including expected input and output.

### 9. Error Handling
- Ensure that all errors are caught and handled gracefully, providing meaningful error messages to the client.

### 10. Code Comments
- Add comments to the code to explain complex logic or important decisions, making it easier for others to understand and maintain. 