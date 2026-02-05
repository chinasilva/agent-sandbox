# Agent Sandbox - Complete Docker Image
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY config ./config

# Create workspace directory
RUN mkdir -p /app/workspace && chmod 777 /app/workspace

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3000/health

# Start command
CMD ["node", "src/api/server.js"]
