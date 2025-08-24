# MCP OAuth Service

A proxy service that adds mock OAuth authorization headers to MCP requests before forwarding them to the policy guard.

## Overview

The MCP OAuth service acts as an authorization layer in the MCP request pipeline. It generates mock JWT tokens with group claims and adds them as `Authorization` headers to all requests before forwarding them to the MCP Policy Guard.

## Architecture

```
Client → MCP OAuth → MCP Policy Guard → MCP Aggregator → Multiple MCP Servers
     ↓           ↓                    ↓                    ↓
  mcp-chat   mcp-oauth         mcp-policy-guard    mcp-aggregator
```

## Features

- **Mock JWT Token Generation**: Creates JWT tokens with mock claims including groups
- **Authorization Header Injection**: Automatically adds `Authorization: Bearer <token>` headers
- **OpenTelemetry Tracing**: Comprehensive distributed tracing
- **Health Checks**: Kubernetes-ready health and readiness endpoints
- **Token Debugging**: `/token` endpoint for viewing generated tokens

## Mock Token Claims

The service generates JWT tokens with the following claims:

```json
{
  "iss": "https://mock-oauth-provider.com",
  "sub": "mock-user-123",
  "aud": "mcp-services",
  "exp": 1234567890,
  "iat": 1234567890,
  "groups": ["admin", "developers", "mcp-users"],
  "email": "mock.user@example.com",
  "name": "Mock User"
}
```

## Configuration

### Environment Variables

```bash
PORT=8080                                    # Service port (default: 8080)
POLICY_GUARD_URL=http://mcp-policy-guard:8090  # Policy guard service URL
OTEL_SERVICE_NAME=mcp-oauth                  # Tracing service name
OTEL_EXPORTER_OTLP_ENDPOINT=http://aspire-dashboard:18889  # OTLP endpoint
```

## Development

### Building Locally

```bash
cd mcp-layers/mcp-oauth
go mod tidy
go build -o mcp-oauth .
./mcp-oauth
```

### Docker Build

```bash
docker build -t mcp-oauth mcp-layers/mcp-oauth/
docker run -p 8080:8080 mcp-oauth
```

## API Endpoints

### Health Check
```bash
GET /health
```
Returns `200 OK` if the service is healthy.

### Readiness Check
```bash
GET /ready
```
Returns `200 OK` if the service and downstream policy guard are ready.

### Token Info
```bash
GET /token
```
Returns the current mock JWT token and metadata for debugging.

### Proxy
```bash
ANY /*
```
Proxies all other requests to the policy guard with added authorization headers.

## Testing

```bash
# Test health endpoint
curl http://localhost:8080/health

# Test readiness endpoint
curl http://localhost:8080/ready

# View generated token
curl http://localhost:8080/token

# Test proxy with authorization
curl http://localhost:8080/some/mcp/endpoint
```

## Integration

This service integrates into the main Aspire application through:

- **Aspire Configuration**: `host/app.cs`
- **Manifest**: `host/manifest.json`
- **Helm Charts**: `helm/templates/`
- **Build Scripts**: `scripts/build-*.sh`

## Future Enhancements

This service is designed to be replaced with a real OAuth implementation when the MCP Authorization specification is finalized (target: 2025-06-18). The current mock implementation provides:

- Development and testing capabilities
- Consistent authorization headers
- Group-based access control simulation
- Easy migration path to real OAuth providers

## Observability

The service includes comprehensive OpenTelemetry tracing:

- **Distributed Tracing**: End-to-end request tracking
- **Token Generation Metrics**: Success/failure rates
- **Health Checks**: Kubernetes readiness probes
- **Structured Logging**: Request and error logging with correlation IDs
