# MCP Policy Guard

A Go-based Model Context Protocol (MCP) policy guard that forwards requests to a downstream MCP server (guard service) while adding OpenTelemetry tracing for observability.

## Features

- **Request Forwarding**: Proxies all MCP requests to the downstream guard service
- **OpenTelemetry Tracing**: Adds comprehensive tracing with span creation and context propagation
- **Health Checks**: Provides health and readiness endpoints for Kubernetes deployments
- **Error Handling**: Proper error handling and logging for proxy operations
- **Kubernetes Ready**: Designed for cloud-native deployments

## Configuration

The proxy is configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8090` | Port for the proxy to listen on |
| `GUARD_URL` | `http://guard:7000` | URL of the downstream guard service |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://aspire-dashboard:18889` | OpenTelemetry collector endpoint |
| `OTEL_SERVICE_NAME` | `mcp-policy-guard` | Service name for tracing |

## Endpoints

- `/` - Proxies all requests to the guard service
- `/health` - Health check endpoint (returns 200 OK)
- `/ready` - Readiness check endpoint (checks guard service availability)

## Tracing

The proxy instruments all incoming requests with OpenTelemetry spans that include:

- HTTP method, URL, and user agent
- Target service information
- Request/response timing
- Error information when failures occur
- Trace context propagation to downstream services

## Building

```bash
go mod tidy
go build -o mcp-policy-guard .
```

## Running Locally

```bash
export GUARD_URL=http://localhost:7000
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:18889
./mcp-policy-guard
```

## Docker

```bash
docker build -t mcp-policy-guard .
docker run -p 8090:8090 \
  -e GUARD_URL=http://guard:7000 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://aspire-dashboard:18889 \
  mcp-policy-guard
```

## Architecture

```
Client → MCP Policy Guard (Go) → Guard Service (Python/FastMCP) → Downstream MCP Server
         ↓
    OpenTelemetry
    Tracing Data
         ↓
    Aspire Dashboard
```

The proxy sits between clients and the guard service, adding observability without modifying the existing MCP protocol flow.
