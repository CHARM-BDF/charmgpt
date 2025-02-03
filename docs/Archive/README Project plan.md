# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
# MCP-Enabled Chat Interface

A React TypeScript application that implements a chat interface with support for the Model Context Protocol (MCP). This application allows interaction with AI models while providing access to external tools, resources, and prompts through MCP servers.

## Features

- 💬 Chat interface with user/assistant messages
- 📑 Artifact window for displaying code, diagrams, and other content
- 🔧 MCP server integration for external tools
- 💾 Local storage persistence
- 🎨 Clean, responsive UI with Tailwind CSS

## Project Structure

```
src/
├── components/
│   ├── chat/               # Chat interface components
│   │   ├── ChatInput.tsx   # Message input component
│   │   ├── ChatMessages.tsx # Message display component
│   │   └── ChatInterface.tsx # Main chat layout
│   ├── artifacts/          # Artifact handling components
│   │   ├── ArtifactWindow.tsx # Artifact display window
│   │   ├── ArtifactContent.tsx # Content renderer
│   │   └── ArtifactList.tsx   # Artifact navigation
│   └── mcp/               # MCP integration components
│       ├── MCPTools.tsx   # Tool display and execution
│       ├── MCPServerControl.tsx # Server management
│       └── MCPResourceBrowser.tsx # Resource browser
├── store/                # State management
│   ├── chatStore.ts     # Chat and artifact state
│   └── mcpStore.ts      # MCP server state
├── types/               # TypeScript definitions
│   ├── chat.ts         # Chat interface types
│   ├── artifacts.ts    # Artifact types
│   └── mcp.ts          # MCP protocol types
├── tools/              # Tool implementations
│   ├── webSearch.ts    # Web search tool
│   └── types.ts        # Tool types
└── utils/              # Utility functions
    ├── mcp.ts          # MCP helpers
    └── formatting.ts   # Text formatting
```

## Core Components

### Chat Components

- **ChatInterface**: Main layout component that orchestrates all other components
  - Manages the split view between chat and artifacts
  - Handles MCP server integration
  - Coordinates message and artifact display

- **ChatMessages**: Displays the conversation history
  - Renders user and assistant messages
  - Provides artifact links in messages
  - Handles message styling

- **ChatInput**: Message input component
  - Handles user input submission
  - Triggers message creation
  - Provides basic input validation

### Artifact Components

- **ArtifactWindow**: Manages artifact display area
  - Split view with artifact list and content
  - Handles artifact selection
  - Provides window controls

- **ArtifactContent**: Renders artifact content
  - Supports multiple content types:
    - Code with syntax highlighting
    - SVG images
    - Mermaid diagrams
    - Plain text
  - Handles content-specific styling

### MCP Components

- **MCPTools**: Displays available MCP tools
  - Lists tools from connected servers
  - Shows tool descriptions
  - Provides tool execution interface

- **MCPServerControl**: Manages MCP server connections
  - Server selection dropdown
  - Connection controls
  - Server status display

## State Management

### Chat Store (Zustand)

Manages chat and artifact state:
- Message history
- Artifact collection
- Artifact window visibility
- Artifact selection

### MCP Store (Zustand)

Handles MCP server state:
- Server connections
- Available tools
- Resource access
- Prompt templates

## Setting Up the Project

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Basic understanding of React and TypeScript

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

## MCP Integration

This project integrates with the Model Context Protocol, allowing interaction with various MCP servers.

### Supported MCP Features

1. **Tools**
   - Execute external commands
   - Access external APIs
   - Perform computations

2. **Resources**
   - Access file systems
   - Read databases
   - Fetch external content

3. **Prompts**
   - Use predefined templates
   - Execute guided workflows

### Adding MCP Servers

To add a new MCP server:

1. Configure the server in `MCPServerControl`
2. Implement necessary type definitions
3. Add server-specific tool handlers
4. Update the UI to expose new capabilities

## Next Steps

### Immediate TODOs

1. **Authentication**
   - [ ] Add user authentication
   - [ ] Implement session management
   - [ ] Add role-based access control

2. **MCP Enhancements**
   - [ ] Add more tool implementations
   - [ ] Implement resource browser
   - [ ] Add prompt template support

3. **UI Improvements**
   - [ ] Add dark mode support
   - [ ] Implement message threading
   - [ ] Add loading states
   - [ ] Improve error handling

### Future Features

1. **Advanced Chat Features**
   - Message editing
   - Rich text support
   - File attachments
   - Message reactions

2. **Enhanced MCP Integration**
   - Tool composition
   - Resource caching
   - Prompt customization
   - Server health monitoring

3. **Developer Experience**
   - Add comprehensive testing
   - Improve documentation
   - Add development tools
   - Create example implementations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- State managed with [Zustand](https://github.com/pmndrs/zustand)
- MCP integration with [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)