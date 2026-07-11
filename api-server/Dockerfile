FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including AWS CLI
RUN apt-get update && apt-get install -y \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./
COPY entities/ ./entities/
COPY dto/ ./dto/
COPY mappers/ ./mappers/
COPY routers/ ./routers/
COPY agents/ ./agents/

# Copy startup script
COPY start-with-parameter-store.sh /app/
RUN chmod +x /app/start-with-parameter-store.sh

# Create chromadb directory
RUN mkdir -p /app/chromadb

# Expose port
EXPOSE 8001

# Run the application with parameter store support
CMD ["bash", "/app/start-with-parameter-store.sh"]
