FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files and install deps
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source (note: .dockerignore excludes .env.local so env comes from compose)
COPY . .

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Use next dev for hot-reload in dev; NEXT_PUBLIC_API_URL is set by docker-compose
CMD ["npm", "run", "dev"]
