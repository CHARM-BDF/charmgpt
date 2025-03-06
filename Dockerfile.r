FROM r-base:latest

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
RUN R -e "install.packages(c('jsonlite', 'ggplot2', 'tidyverse'), repos='https://cloud.r-project.org/')"

# Create output directory
RUN mkdir /app/output

CMD ["R"] 