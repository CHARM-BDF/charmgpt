FROM rocker/tidyverse

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libgsl-dev \
    libfontconfig1-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
# Note: tidyverse already includes: ggplot2, dplyr, tidyr, readr, purrr, tibble, stringr, forcats
RUN R -e "install.packages(c(\
    # Statistics and modeling\
    'lme4', 'nlme', 'mgcv', 'survival',\
    # Machine Learning\
    'caret', 'randomForest', 'xgboost', 'e1071',\
    # Data Import/Export\
    'readxl', 'writexl', 'haven', 'arrow',\
    # Additional Visualization\
    'plotly', 'viridis', 'RColorBrewer', 'scales'\
    ), repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Create output directory
RUN mkdir /app/output

CMD ["R"] 