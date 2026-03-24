# Loocbooc API Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy API package files
COPY api/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy API source
COPY api/src ./src

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/index.js"]
