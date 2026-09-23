# Production Dockerfile for Pavo License API
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000
ENV DB_PATH=/app/data/licenses.db

# Install dependencies first for better caching
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy source code
COPY src/ ./src/

# Create data directory for SQLite persistent database
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user
USER node

# Expose API port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the API server
CMD ["node", "src/server.js"]
