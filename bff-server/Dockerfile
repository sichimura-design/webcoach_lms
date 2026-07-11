FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install AWS CLI and bash
RUN apk add --no-cache \
    bash \
    curl \
    python3 \
    py3-pip \
    && pip3 install --break-system-packages --no-cache-dir awscli \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application files
COPY . .

# Copy startup script
COPY start-with-parameter-store.sh /app/
RUN chmod +x /app/start-with-parameter-store.sh

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application with parameter store support
CMD ["bash", "/app/start-with-parameter-store.sh"]
