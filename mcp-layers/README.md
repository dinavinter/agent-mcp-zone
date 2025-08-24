# MCP Layers

This directory contains the Model Context Protocol (MCP) services that form the middleware layer of the agent application programming framework.

## Directory Structure

```
mcp-layers/
├── mcp-aggregator/     # Python-based MCP aggregator
│   ├── main.py         # Main FastMCP proxy application
│   ├── pyproject.toml  # Python dependencies and configuration
│   ├── Dockerfile      # Container build instructions
│   └── README.md       # Service documentation
├── mcp-policy-guard/   # Go-based MCP policy guard
│   ├── main.go         # Main Go proxy application
│   ├── go.mod          # Go module dependencies
│   ├── Dockerfile      # Container build instructions
│   └── README.md       # Service documentation
└── README.md           # This file
```

## Architecture

The MCP layers provide a two-tier architecture for MCP request processing:

```
Client → MCP Policy Guard → MCP Aggregator → Multiple MCP Servers
     ↓              ↓                    ↓              ↓
  mcp-chat    mcp-policy-guard    mcp-aggregator    everything, cloudflare-docs, etc.
```

### MCP Policy Guard (`mcp-policy-guard/`)

- **Language**: Go
- **Purpose**: Policy enforcement and request validation
- **Features**:
  - Request forwarding with policy checks
  - OpenTelemetry tracing
  - Health and readiness endpoints
  - Kubernetes deployment support

### MCP Aggregator (`mcp-aggregator/`)

- **Language**: Python (FastMCP)
- **Purpose**: Multi-server MCP aggregation
- **Features**:
  - Multi-server configuration support
  - JSON and individual environment variable configuration
  - Request aggregation and routing
  - Health check endpoints

## Configuration

### Environment Variables

#### MCP Policy Guard
```bash
PORT=8090                                    # Service port
GUARD_URL=http://mcp-aggregator:7000        # Backward compatibility
AGGREGATOR_URL=http://mcp-aggregator:7000   # New standard
OTEL_SERVICE_NAME=mcp-policy-guard          # Tracing service name
```

#### MCP Aggregator
```bash
PORT=7000                                   # Service port
MCP_SERVER_URL=https://example.com/mcp     # Single server URL
MCP_SERVER_TRANSPORT=http                  # Transport protocol
MCP_SERVER_NAME=example                    # Server name
OTEL_SERVICE_NAME=mcp-aggregator           # Tracing service name
```

### Multi-Server Configuration (JSON)
```json
{
  "mcpServers": {
    "default": {
      "url": "https://aiam-mcps-everything.cfapps.eu12.hana.ondemand.com/mcp",
      "transport": "http",
      "name": "everything"
    },
    "github": {
      "url": "https://docs.mcp.cloudflare.com/sse/",
      "transport": "sse",
      "name": "cloudflare-docs"
    }
  }
}
```

## Development

### Building Services

```bash
# Build MCP Aggregator
cd mcp-layers/mcp-aggregator
uv sync
uv run main.py

# Build MCP Policy Guard
cd mcp-layers/mcp-policy-guard
go build -o mcp-policy-guard .
./mcp-policy-guard
```

### Docker Builds

```bash
# Build MCP Aggregator
docker build -t mcp-aggregator mcp-layers/mcp-aggregator/

# Build MCP Policy Guard
docker build -t mcp-policy-guard mcp-layers/mcp-policy-guard/
```

### Testing

```bash
# Test MCP Policy Guard health
curl http://localhost:8090/health

# Test MCP Aggregator health
curl http://localhost:7000/health
```

## Integration

These services are integrated into the main Aspire application through:

- **Aspire Configuration**: `host/app.cs`
- **Manifest**: `host/manifest.json`
- **Helm Charts**: `helm/templates/`
- **Build Scripts**: `scripts/build-*.sh`

## Observability

Both services include comprehensive OpenTelemetry tracing:

- **Distributed Tracing**: End-to-end request tracking
- **Health Checks**: Kubernetes readiness probes
- **Metrics**: Performance and error monitoring
- **Logging**: Structured logging with correlation IDs

## Deployment

The services are designed for Kubernetes deployment with:

- **Helm Charts**: Complete deployment manifests
- **Docker Images**: Multi-platform container builds
- **Health Checks**: Liveness and readiness probes
- **Resource Limits**: CPU and memory constraints
- **Service Discovery**: Internal and external endpoints
