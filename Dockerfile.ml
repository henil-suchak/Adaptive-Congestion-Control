FROM python:3.10-slim

# Install system dependencies for NS-3 AI bridge
RUN apt-get update && apt-get install -y \
    build-essential \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY ml-engine-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your source code
COPY ml-engine-python/ .

# Run the ML Engine
CMD ["python", "main.py"]