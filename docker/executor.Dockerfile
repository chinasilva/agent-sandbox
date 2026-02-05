# Executor - Agent execution environment
FROM node:20-alpine

WORKDIR /app

# Install essential tools for agent operations
RUN apk add --no-cache \
    git \
    curl \
    jq \
    openssh-client \
    && git config --global user.name "Agent" \
    && git config --global user.email "agent@sandbox.local"

COPY package*.json ./
RUN npm ci --only=production

COPY executor ./executor
COPY config ./config

# Create workspace directory
RUN mkdir -p /app/workspace && chmod 777 /app/workspace

CMD ["node", "executor/index.js"]
