# CHARMGPT

A collaborative data science environment with LLM support. This project combines React, TypeScript, and Vite for the frontend with an Express/TypeScript backend that provides a unified interface for different LLM providers.

## Features

- Interactive code editor for Python
- Real-time chat interface with LLM support (Claude, Ollama)
- Data visualization capabilities
- Artifact history tracking
- Support for multiple LLM providers

## Getting Started

### Prerequisites

- Docker
- Node.js (v16 or higher)
- npm (v7 or higher)
- Ollama (if using local models)
- Anthropic API key (if using Claude)

## Docker Installation

`docker build -t my-python-app .`

### Installation

1. Install client dependencies:
```bash
npm install
```

2. Install server dependencies:
```bash
cd server
npm install
```

### Configuration

1. Create a `.env` file in the `server` directory:
```env
PORT=3000
ANTHROPIC_API_KEY=your_anthropic_api_key
OLLAMA_BASE_URL=http://localhost:11434
```

2. If using Ollama:
   - Install Ollama from https://ollama.ai
   - Pull your desired model: `ollama pull qwen2.5`

### Running the Application

1. Start the server:
```bash
cd server
npm run dev
```

2. In a new terminal, start the client:
```bash
npm run dev
```

The client will be available at http://localhost:5173

## Project Structure

```
├── src/                  # Client source code
│   ├── components/       # React components
│   └── services/        # API services
├── server/              # Server source code
│   ├── src/
│   │   ├── routes/     # Express routes
│   │   └── services/   # LLM services
│   └── .env            # Server configuration
└── README.md
```

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
