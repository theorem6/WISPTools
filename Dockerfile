# Firebase App Hosting Dockerfile for SvelteKit
# This file is automatically used by Firebase App Hosting

FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy built application
COPY build ./build
COPY package.json ./

# Expose port 8080 (required by Cloud Run)
EXPOSE 8080

# Set environment variables for Cloud Run
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Health check (optional, helps Cloud Run know when container is ready)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/_health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the Node.js server
CMD ["node", "build/index.js"]

