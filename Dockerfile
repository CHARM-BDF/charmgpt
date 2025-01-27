FROM python:3.9-slim

WORKDIR /app

# Install Python packages
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    seaborn \
    scikit-learn

# Create output directory
RUN mkdir /app/output

# Set matplotlib to non-interactive mode
ENV MPLBACKEND=Agg

CMD ["python"]