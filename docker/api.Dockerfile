# API Service - Lightweight Node.js
FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --only=production

COPY api ./api
COPY config ./config

EXPOSE 3000

CMD ["node", "api/server.js"]
