# Firebase App Hosting Dockerfile for SvelteKit
# This file is automatically used by Firebase App Hosting

FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY build ./build
COPY package.json ./

# Expose port 8080 (required by Cloud Run)
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080
ENV HOST=0.0.0.0

# Start the application
CMD ["node", "build/index.js"]

