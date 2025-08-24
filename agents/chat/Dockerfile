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

#error: Creating '/app/node_modules/.deno/node_modules'
 #    0: Permission denied (os error 13)
# Allow write permissions for deno user

RUN deno cache client.tsx

RUN mkdir -p /app/node_modules && \
    chown -R deno:deno /app/node_modules \
    && chmod -R u+w /app/node_modules
# Use existing deno user (already exists in denoland/deno image)
USER deno

# 
 
 
# Set environment variables
ENV PORT=8080

EXPOSE $PORT

# Run the application
CMD ["deno", "serve", "-A", "client.tsx"]
