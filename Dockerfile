FROM python:3.9-slim

WORKDIR /app

RUN pip install --upgrade pip

RUN pip install --no-cache-dir \
    numpy \
    numcodecs \
    pandas \
    matplotlib \
    seaborn \
    scikit-learn \
    plotly \
    kaleido

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create output directory
RUN mkdir /app/output

# Set matplotlib to non-interactive mode
ENV MPLBACKEND=Agg

CMD ["python"]