# Cypress System Testing Plan for Charm-MCP

## Overview
This document outlines the complete plan for adding Cypress system testing to the Charm-MCP monorepo. The tests will focus on end-to-end workflows using the application from the `frontend-client` directory with Ollama running via Docker.

## Project Structure
```
system-tests/
├── e2e/
│   └── basic-workflow.cy.ts
├── fixtures/
│   └── test-data.json
├── support/
│   ├── commands.ts
│   ├── e2e.ts
│   └── types.ts
├── etc/
│   ├── start-services.sh
│   ├── stop-services.sh
│   ├── check-prerequisites.sh
│   └── wait-for-services.sh
├── package.json
├── cypress.config.ts
├── tsconfig.json
├── eslint.config.js
├── README.md
└── CYPRESS_PLAN.md
```

## Key Requirements
- **TypeScript**: Full TypeScript support with proper type definitions
- **ESLint**: Follows frontend-client patterns with Cypress-specific rules
- **Docker Integration**: Ollama runs via Docker container
- **Minimal Tests**: Focused on core application workflow only
- **No CI/CD**: Manual testing workflow only
- **No Monitoring**: No logging or monitoring requirements

## Dependencies

### Package.json
```json
{
  "name": "system-tests",
  "version": "1.0.0",
  "description": "Cypress system tests for Charm-MCP",
  "type": "module",
  "scripts": {
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "lint": "eslint .",
    "lint:auto": "eslint --fix .",
    "type-check": "tsc --noEmit",
    "check:prerequisites": "./etc/check-prerequisites.sh",
    "start:services": "./etc/start-services.sh",
    "stop:services": "./etc/stop-services.sh"
  },
  "devDependencies": {
    "cypress": "^13.6.0",
    "wait-on": "^7.2.0",
    "cross-env": "^7.0.3",
    "@eslint/js": "^9.17.0",
    "eslint": "^9.17.0",
    "eslint-plugin-cypress": "^2.15.1",
    "typescript-eslint": "^8.18.2",
    "globals": "^15.14.0",
    "typescript": "~5.6.2",
    "@types/node": "^22.10.7"
  }
}
```

## Configuration Files

### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["cypress", "node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "cypress.config.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

### ESLint Configuration (eslint.config.js)
```javascript
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import cypressPlugin from 'eslint-plugin-cypress'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      'plugin:cypress/recommended'
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        cy: 'readonly',
        Cypress: 'readonly'
      },
    },
    plugins: {
      cypress: cypressPlugin,
    },
    rules: {
      // Only add rules that are specifically needed for this project
    },
  }
)
```

### Cypress Configuration (cypress.config.ts)
```typescript
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
})
```

## Type Definitions (support/types.ts)
```typescript
/// <reference types="cypress" />

export interface OllamaModel {
  name: string
  size: number
  modified_at: string
  digest: string
}

export interface ServiceStatus {
  status: 'running' | 'stopped' | 'error'
  port: number
  url: string
}

export interface TestConfig {
  baseUrl: string
  ollamaUrl: string
  backendUrl: string
  timeout: number
}
```

## Test Implementation (e2e/basic-workflow.cy.ts)
The test covers 5 main areas:

1. **Chat Interface Loading**: Verifies the main chat interface loads successfully
2. **Ollama Model Integration**: Checks Ollama models are available and selectable
3. **Chat Input Functionality**: Tests actual chat input interaction
4. **Backend API Integration**: Verifies backend API communication
5. **UI Navigation**: Checks for common UI elements and navigation

## Shell Scripts

### Service Management Scripts
- **check-prerequisites.sh**: Verifies Docker, Ollama image, and port availability
- **start-services.sh**: Starts all services (Ollama, Python MCP, R MCP, backend, frontend)
- **stop-services.sh**: Stops all services and cleans up containers

### Docker Containers Managed
- **ollama-test**: Ollama with required models (deepseek-coder:latest, llama3.2)
- **python-mcp-test**: Python MCP server
- **r-mcp-test**: R MCP server

## Usage Workflow

### Manual Testing
```bash
# Check prerequisites
npm run check:prerequisites

# Start services
npm run start:services

# Run tests
npm run test:e2e

# Stop services
npm run stop:services
```

### Development
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:auto

# Open Cypress UI
npm run test:e2e:open
```

## Services Required
- **Frontend**: http://localhost:5173 (from frontend-client)
- **Backend**: http://localhost:3001 (from backend-mcp-client)
- **Python MCP**: http://localhost:3002 (Docker container)
- **R MCP**: http://localhost:3003 (Docker container)
- **Ollama**: http://localhost:11434 (Docker container)

## Key Features
- **TypeScript Support**: Full type safety with custom type definitions
- **ESLint Integration**: Follows frontend-client patterns + Cypress-specific rules
- **Docker Integration**: Ollama runs entirely via Docker
- **Real Application Testing**: Tests actual chat interface workflow
- **Flexible Selectors**: Uses fallback selectors for UI elements
- **Error Handling**: Graceful handling of missing elements or services
- **Automatic Setup**: All services and containers managed automatically

## Prerequisites
- Docker running
- Node.js for backend and frontend services
- Required ports available (3001, 5173, 3002, 3003, 11434)

## Implementation Status
- [x] Project structure planned
- [x] Configuration files defined
- [x] Type definitions created
- [x] Test implementation written
- [x] Shell scripts designed
- [x] Documentation prepared
- [ ] Files created and implemented
- [ ] Dependencies installed
- [ ] Scripts made executable
- [ ] Tests run and validated 