# Backend Dockerfile — Multi-stage Production Build

# --- Stage 1: Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install system dependencies needed for Prisma
RUN apk add --no-cache openssl

# Copy package manifests and Prisma schema
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Generate Prisma client
RUN DATABASE_URL="postgresql://dummy:5432/mydb" npx prisma generate

# --- Stage 2: Runtime ---
FROM node:22-alpine AS runtime

WORKDIR /app

# Install runtime system dependencies
RUN apk add --no-cache openssl

# Copy artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy application source & schema
COPY src ./src/
COPY scripts ./scripts/
COPY prisma ./prisma/

# Security: Set ownership and run as non-root user
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
