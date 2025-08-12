# Racket MCP Server

A Model Context Protocol (MCP) server that provides Racket code execution capabilities in a secure, containerized environment.

## Features

- Execute Racket code with various built-in libraries
- Secure sandboxed execution using Docker  
- **Full plotting and data visualization support with Xvfb**
- Headless GUI operations for PNG/image generation
- Memory and execution time limits
- File output support with automatic path management

## Setup


### Build Docker Image
```bash
docker build --platform=linux/amd64 -t my-racket-mcp .
```

## Supported Racket Libraries

The server supports these Racket libraries:
- `racket/base` - Core functionality
- `racket/list` - List operations
- `racket/string` - String manipulation
- `racket/math` - Mathematical functions
- `racket/file` - File operations
- `plot` - Data visualization
- `json` - JSON handling
- `csv-reading` - CSV file processing
- And many more...

## Example Code

### Basic Arithmetic
```racket
(displayln (+ 2 2))
```

### List Processing
```racket
#lang racket
(require racket/list)
(define numbers '(1 2 3 4 5))
(displayln (apply + numbers))
```

### Plotting
```racket
#lang racket
(require plot racket/file)

; Configure for headless operation
(plot-new-window? #f)

; Create a sine wave plot
(define output-dir (getenv "OUTPUT_DIR"))
(plot-file (function sin -6.28 6.28)
           (build-path output-dir "sine_wave.png")
           #:title "Sine Wave"
           #:x-label "x (radians)" 
           #:y-label "sin(x)"
           #:width 800
           #:height 600)
(displayln "Plot saved successfully!")
```

### Complex Plots
```racket
#lang racket
(require plot racket/file)

(plot-new-window? #f)
(define output-dir (getenv "OUTPUT_DIR"))

; Multiple function plot
(plot-file (list (function sin -6.28 6.28 #:color 'red #:label "sin(x)")
                 (function cos -6.28 6.28 #:color 'blue #:label "cos(x)"))
           (build-path output-dir "trig_functions.png")
           #:title "Trigonometric Functions"
           #:width 1000
           #:height 700)
```

## Performance & Resource Configuration

### Memory & Timeout Settings
- **Container Memory**: 512MB (optimized for plotting operations)
- **Execution Timeout**: 45 seconds (increased for complex plots)
- **CPU Limit**: 2.0 cores (better performance on multi-core systems)

### Display Configuration
- **Virtual Display**: Xvfb on :99 (headless GUI support)
- **Resolution**: 800x600x16 (memory-optimized for plotting)
- **Graphics**: Full GTK/Cairo support for plot rendering

### Troubleshooting
- **Exit Code 137**: Increase Docker memory if plots fail
- **Platform Issues**: Use correct `--platform` flag for your architecture
- **Slow Performance**: Avoid `--platform=linux/amd64` on Apple Silicon
