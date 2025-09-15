# Multi-stage Docker build for Jira MCP Server
# Security-hardened production image

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Install security updates and remove package manager
RUN apk update && apk upgrade \
    && apk add --no-cache \
        dumb-init \
        curl \
    && apk del apk-tools \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Copy environment template
COPY --chown=nodejs:nodejs .env.example ./.env.example

# Create directories for logs and temp files
RUN mkdir -p /app/logs /app/tmp \
    && chown -R nodejs:nodejs /app/logs /app/tmp

# Security: Remove write permissions from application directory
RUN chmod -R 755 /app \
    && chmod -R 750 /app/logs /app/tmp

# Switch to non-root user
USER nodejs

# Expose health check port only
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Metadata labels
LABEL org.opencontainers.image.title="Jira MCP Server" \
      org.opencontainers.image.description="Enterprise MCP server for Jira integration" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.vendor="Your Organization" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/your-org/jira-mcp-server" \
      org.opencontainers.image.documentation="https://github.com/your-org/jira-mcp-server#readme"