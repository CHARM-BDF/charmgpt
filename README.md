# CharmGPT

A data science environment with integrated chat and visualization capabilities.

## Features

- Interactive Python code execution
- Real-time data visualization
- Chat interface for assistance
- History of code artifacts and outputs
- Support for matplotlib plots
- Code execution in isolated Docker containers

## Setup

### Prerequisites

- Node.js (v16 or higher)
- Docker
- Python 3.x

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/charmgpt.git
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
cd server
docker build -t my-python-app .
```

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

### Code Execution

1. Write or paste Python code in the code editor
2. Click "Run" to execute the code
3. View results in the output panel

### Data Visualization

The application supports matplotlib plots. Here's an example:

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

### Artifacts

- Code and its output are saved as artifacts
- Visualizations are automatically captured and displayed
- Previous artifacts can be rerun or modified

## Security

- Code execution happens in isolated Docker containers
- Network access is disabled by default
- Memory and CPU limits are enforced

## Project Structure

```
charmgpt/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── contexts/          # React contexts
│   └── config/            # Configuration files
├── server/                # Backend server
│   ├── src/              # Server source code
│   └── Dockerfile        # Python environment
└── README.md
```

## Technologies

- Frontend: React, TypeScript, Material-UI
- Backend: Node.js, Express
- Code Execution: Docker, Python
- Visualization: Matplotlib
