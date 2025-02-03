# MCP Store and UI Integration Documentation

## Store Implementation

### 1. Core Store Structure
```typescript
// MCP Store using Zustand
import { create } from 'zustand';

// Core Types
export interface ServerTool {
    name: string;
    description?: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, unknown>;
    };
}

export interface ServerStatus {
    name: string;
    isRunning: boolean;
    tools?: ServerTool[];
}

// Store State Interface
interface MCPStoreState {
    servers: ServerStatus[];
    lastChecked: Date | null;
    isLoading: boolean;
    fetchStatus: () => Promise<void>;
}
```

### 2. Store Creation and Methods
```typescript
export const useMCPStore = create<MCPStoreState>((set) => ({
    // Initial State
    servers: [],
    lastChecked: null,
    isLoading: false,

    // Methods
    fetchStatus: async () => {
        set({ isLoading: true });
        try {
            const response = await fetch('/api/server-status');
            const data = await response.json();
            set({ 
                servers: data.servers,
                lastChecked: new Date(),
                isLoading: false 
            });
        } catch (error) {
            console.error('Failed to fetch server status:', error);
            set({ isLoading: false });
        }
    }
}));
```

## UI Integration

### 1. Server Status Display Component
```typescript
import React from 'react';
import { useMCPStore } from '../store/mcpStore';

export const ServerStatusDisplay: React.FC = () => {
    const { servers, isLoading, lastChecked, fetchStatus } = useMCPStore();

    return (
        <div className="server-status-container">
            <div className="status-header">
                <h2>MCP Server Status</h2>
                <button 
                    onClick={fetchStatus}
                    disabled={isLoading}
                >
                    Refresh
                </button>
            </div>
            
            {isLoading ? (
                <div className="loading">Loading server status...</div>
            ) : (
                <div className="servers-grid">
                    {servers.map(server => (
                        <div key={server.name} className="server-card">
                            <h3>{server.name}</h3>
                            <div className={`status-indicator ${server.isRunning ? 'active' : 'inactive'}`}>
                                {server.isRunning ? 'Running' : 'Offline'}
                            </div>
                            {server.tools && (
                                <div className="tools-list">
                                    <h4>Available Tools:</h4>
                                    <ul>
                                        {server.tools.map(tool => (
                                            <li key={tool.name}>
                                                <span className="tool-name">{tool.name}</span>
                                                {tool.description && (
                                                    <span className="tool-description">{tool.description}</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            {lastChecked && (
                <div className="last-checked">
                    Last updated: {lastChecked.toLocaleString()}
                </div>
            )}
        </div>
    );
};
```

### 2. Tool Selection Component
```typescript
import React from 'react';
import { useMCPStore } from '../store/mcpStore';

export const ToolSelector: React.FC<{
    onToolSelect: (tool: ServerTool) => void;
}> = ({ onToolSelect }) => {
    const { servers } = useMCPStore();
    
    return (
        <div className="tool-selector">
            {servers.map(server => (
                server.isRunning && server.tools && (
                    <div key={server.name} className="server-tools">
                        <h3>{server.name}</h3>
                        <div className="tools-grid">
                            {server.tools.map(tool => (
                                <button
                                    key={tool.name}
                                    onClick={() => onToolSelect(tool)}
                                    className="tool-button"
                                >
                                    <span className="tool-name">{tool.name}</span>
                                    {tool.description && (
                                        <span className="tool-description">{tool.description}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            ))}
        </div>
    );
};
```

### 3. Styling
```css
/* Server Status Styles */
.server-status-container {
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
}

.status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.servers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
}

.server-card {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
}

.status-indicator {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    margin-top: 0.5rem;
}

.status-indicator.active {
    background: var(--success-light);
    color: var(--success);
}

.status-indicator.inactive {
    background: var(--error-light);
    color: var(--error);
}

/* Tool Selector Styles */
.tool-selector {
    margin-top: 1rem;
}

.tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.tool-button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    transition: all 0.2s;
}

.tool-button:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
}
```

## Store Usage Patterns

### 1. Component Integration
```typescript
import { useMCPStore } from '../store/mcpStore';

// In your component
const YourComponent: React.FC = () => {
    const { servers, fetchStatus } = useMCPStore();

    // Fetch status on mount
    useEffect(() => {
        fetchStatus();
    }, []);

    // Re-fetch every 30 seconds
    useEffect(() => {
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // Rest of your component logic
};
```

### 2. Error Handling
```typescript
const ErrorBoundary: React.FC = ({ children }) => {
    const { isLoading } = useMCPStore();
    const [error, setError] = useState<Error | null>(null);

    if (error) {
        return (
            <div className="error-container">
                <h3>Error Loading MCP Servers</h3>
                <p>{error.message}</p>
                <button onClick={() => setError(null)}>Retry</button>
            </div>
        );
    }

    return <>{children}</>;
};
```

### 3. Loading States
```typescript
const LoadingIndicator: React.FC = () => {
    const { isLoading } = useMCPStore();

    if (!isLoading) return null;

    return (
        <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>Loading MCP Servers...</p>
        </div>
    );
};
```

## Best Practices

### 1. Store Updates
- Fetch server status on component mount
- Implement polling for status updates
- Handle loading and error states
- Cache results appropriately

### 2. UI Responsiveness
- Show loading states during updates
- Provide clear error messages
- Enable manual refresh
- Display last update timestamp

### 3. Tool Selection
- Validate tool availability before selection
- Show tool descriptions and requirements
- Handle offline servers gracefully
- Provide search/filter capabilities

### 4. Error Handling
- Show user-friendly error messages
- Provide retry mechanisms
- Log errors for debugging
- Handle network issues gracefully

## Performance Optimization

### 1. State Management
- Minimize store updates
- Use selective subscriptions
- Implement memoization
- Batch related updates

### 2. UI Rendering
- Use React.memo for pure components
- Implement virtualization for long lists
- Lazy load components
- Optimize re-renders

### 3. Data Fetching
- Implement caching
- Use optimistic updates
- Handle race conditions
- Implement request debouncing

## Accessibility Considerations

### 1. Keyboard Navigation
- Ensure focusable elements
- Implement keyboard shortcuts
- Provide focus indicators
- Maintain tab order

### 2. Screen Readers
- Add ARIA labels
- Provide status announcements
- Include alternative text
- Use semantic HTML

### 3. Visual Accessibility
- Maintain color contrast
- Support color blindness
- Allow text scaling
- Provide visual feedback 