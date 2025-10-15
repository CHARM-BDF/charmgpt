# Kappa MCP Server

Local MCP wrapper for the remote Kappa simulation server that generates CSV artifacts for Python plotting.

## Features

- Wraps remote Kappa server calls
- Converts simulation results to CSV format
- Stores CSV files in backend storage
- Generates artifacts compatible with Python MCP
- Full MCP SDK integration with logging

## Installation

```bash
cd custom-mcp-servers/kappa-mcp
npm install
npm run build
```

## Usage

The server is automatically started by the backend when configured in `mcp_server_config.json`.

### Tool: `run_kappa_simulation`

Run a Kappa simulation and generate CSV output.

**Parameters:**
- `ka` (string, required): Kappa model code to simulate
- `l` (number, optional): Simulation limit in time units (default: 100)
- `p` (number, optional): Plot period - how often to record data points (default: 1.0)

**Example:**

```json
{
  "ka": "%agent: A(x)\n%agent: B(x)\n%init: 1000 A(x[.])\n%init: 1000 B(x[.])\nA(x[.]),B(x[.]) -> A(x[1]),B(x[1]) @ 0.001",
  "l": 1000,
  "p": 10.0
}
```

## Integration with Python MCP

After running a Kappa simulation, you can use the generated CSV with Python:

```python
import pandas as pd
import matplotlib.pyplot as plt
import os

# The CSV is automatically available via dataFiles
# Assuming the file was passed as 'simulation_data'
df.plot(x='time', y=['species_A', 'species_B'])
plt.title('Kappa Simulation Results')
plt.xlabel('Time')
plt.ylabel('Concentration')
plt.savefig(os.path.join(os.environ['OUTPUT_DIR'], 'simulation_plot.png'))
```

## Remote Server Configuration

The remote Kappa server URL is configured in the code:

```typescript
const KAPPA_SERVER_URL = "https://kappa-async.livecode.ch";
```

This server runs the KaSim simulation engine. The API endpoint is `/run` for synchronous execution.

You can modify this to point to a different Kappa server instance if needed.

## Development

```bash
# Watch mode for development
npm run dev

# Build
npm run build

# Start production server
npm start
```

## Architecture

This MCP server acts as a local wrapper that:

1. Receives simulation requests via MCP protocol
2. Forwards them to the remote KaSim server at `https://kappa-async.livecode.ch`
3. Receives simulation results (CSV time-series data)
4. Stores the CSV in the backend's file storage
5. Returns an artifact reference for use by other tools (like Python MCP)

The KaSim server returns CSV output directly, which is then stored and made available for plotting and analysis.

This architecture allows the Kappa simulation to run on a remote server while integrating seamlessly with the local MCP ecosystem and Python plotting capabilities.

