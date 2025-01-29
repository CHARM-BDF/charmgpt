# CHARMGPT

A collaborative data science environment with integrated chat and visualization capabilities. This project combines React and TypeScript for the frontend with an Express backend that provides unified interfaces for LLM providers and Python code execution.

## Features

- Interactive Python code execution with matplotlib visualization
- Real-time chat interface with LLM support (Claude, Ollama)
- History of code artifacts and outputs
- Support for multiple LLM providers
- Code execution in isolated Docker containers

## Setup

### Prerequisites

- Node.js (v16 or higher)
- Docker
- Python 3.x
- Ollama (if using local models)
- Anthropic API key (if using Claude)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/metareflection/charmgpt.git
cd charmgpt
```

2. Install dependencies:
```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
```

3. Build the Docker image:
```bash
docker build -t my-python-app .
```

### Configuration

1. Create a `.env` file in the `server` directory:
```env
PORT=3000
ANTHROPIC_API_KEY=your_anthropic_api_key
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LLM_PROVIDER=ollama  # or 'claude'
```

2. If using Ollama:
   - Install Ollama from https://ollama.ai
   - Pull your desired model: `ollama pull qwen2.5`

3. LLM Provider Selection:
   - Set DEFAULT_LLM_PROVIDER to 'ollama' for local execution
   - Set DEFAULT_LLM_PROVIDER to 'claude' for Anthropic's Claude
   - When using Claude, make sure ANTHROPIC_API_KEY is set

### Running the Application

1. Start the server:
```bash
cd server
npm run dev
```

2. Start the frontend (in a new terminal):
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Usage

### Code Execution & Visualization

1. Write or paste Python code in the code editor
2. Click "Run" to execute the code
3. View results and plots in the output panels

Example visualization code:
```python
import numpy as np
import matplotlib.pyplot as plt

# Generate random data
np.random.seed(42)
data = np.random.randn(1000)

# Create a histogram
plt.figure(figsize=(10, 6))
plt.hist(data, bins=30, alpha=0.7, color='blue')
plt.title('Histogram of Random Data')
plt.xlabel('Value')
plt.ylabel('Frequency')
plt.grid(True)

print(f"Mean: {data.mean():.2f}")
print(f"Std Dev: {data.std():.2f}")
```

### Chat Interface

The chat interface supports two LLM providers:

1. Claude (Anthropic):
   - Requires API key in `.env`
   - Higher quality responses
   - Better code understanding

2. Ollama (Local):
   - Free and runs locally
   - No API key needed
   - Faster responses
   - Supports multiple models

You can switch between providers in the chat interface.

### Artifacts

- Code and its output are saved as artifacts
- Visualizations are automatically captured and displayed
- Previous artifacts can be rerun or modified

## Security

- Code execution happens in isolated Docker containers
- Network access is disabled by default
- Memory and CPU limits are enforced
- API keys are stored server-side only

## Project Structure

```
charmgpt/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── contexts/          # React contexts
│   └── config/            # Configuration files
├── server/                # Backend server
│   ├── src/
│   │   ├── routes/       # Express routes
│   │   ├── services/     # Docker and LLM services
│   │   └── config/       # Server configuration
│   └── Dockerfile        # Python environment
└── README.md
```

## Technologies

- Frontend: React, TypeScript, Material-UI
- Backend: Node.js, Express
- Code Execution: Docker, Python
- Visualization: Matplotlib
- LLM Integration: Claude API, Ollama
