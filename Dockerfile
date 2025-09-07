# Use official Bun image for development
FROM oven/bun:1.1.13

WORKDIR /app

# Copy package and lock files first for better caching
COPY package.json bun.lock ./

# Install all dependencies (including dev)
RUN bun install

# Copy the rest of the app
COPY . .

# Expose the HTTP port
EXPOSE 3000

# Set environment variables (override in production as needed)
ENV NODE_ENV=development
ENV DATABASE_TYPE=sqlite
ENV API_KEY=test-api-key-for-docker

# Run our simplified read-only server
CMD ["bun", "run", "src/simple-http-server.ts"]
