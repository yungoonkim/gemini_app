# Use official Node.js 20 LTS slim image
FROM node:20-slim

# Set working directory inside container
WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose default Cloud Run port
EXPOSE 8080

# Environment defaults
ENV PORT=8080
ENV NODE_ENV=production

# Start Express server
CMD ["node", "server.js"]
