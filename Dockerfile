# Multi-Stage Production Dockerfile for AI Interview Engine Backend
FROM node:20-alpine AS base

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose backend application port
EXPOSE 5000

# Start production server
CMD ["node", "server.js"]
