#!/bin/bash

# Start Xvfb (X Virtual Framebuffer) for headless GUI operations (optimized for lower memory)
echo "Starting Xvfb virtual display..."
Xvfb :99 -screen 0 800x600x16 -ac +extension GLX +render -noreset -nolisten tcp &
XVFB_PID=$!

# Wait a moment for Xvfb to start
sleep 2

# Verify Xvfb is running
if ps -p $XVFB_PID > /dev/null; then
    echo "Xvfb started successfully on display :99"
else
    echo "Failed to start Xvfb"
    exit 1
fi

# Set the DISPLAY environment variable
export DISPLAY=:99

# Test if display is available
if xdpyinfo >/dev/null 2>&1; then
    echo "X11 display is available"
else
    echo "Warning: X11 display test failed, but continuing..."
fi

# Function to cleanup on exit
cleanup() {
    echo "Stopping Xvfb..."
    kill $XVFB_PID 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup SIGTERM SIGINT

# Start the Racket program with provided arguments
echo "Starting Racket application..."
exec racket "$@"