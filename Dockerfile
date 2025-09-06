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

# Enable file watching for hot reload (HTTP dev mode)
CMD ["bun", "run", "dev:http"]
