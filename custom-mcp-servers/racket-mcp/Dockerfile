FROM racket/racket:8.15-full

# Install system dependencies for GUI/plotting support with Xvfb
RUN apt-get update && apt-get install -y \
    xvfb \
    x11-utils \
    libgtk-3-0 \
    libx11-dev \
    libxrender1 \
    libxext6 \
    libxft2 \
    libxinerama1 \
    libxcursor1 \
    libxcomposite1 \
    libxdamage1 \
    libfontconfig1 \
    libcairo2 \
    libpango-1.0-0 \
    libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install required Racket packages
RUN raco pkg install --auto --no-docs \
    data-frame

WORKDIR /app

# Create temp and logs directories
RUN mkdir -p /app/temp /app/logs

# Create startup script for Xvfb
COPY start-with-xvfb.sh /app/start-with-xvfb.sh
RUN chmod +x /app/start-with-xvfb.sh

# Set environment variables for headless operation (optimized for lower memory usage)
ENV DISPLAY=:99
ENV XVFB_WHD=800x600x16

CMD ["/app/start-with-xvfb.sh"]
