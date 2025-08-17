# Use Deno latest
FROM denoland/deno:latest

# Set working directory
WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno cache main.tsx

# Copy source code
COPY . .

# Use existing deno user (already exists in denoland/deno image)
USER deno

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000

# Run the application
CMD ["deno", "task", "start"]
