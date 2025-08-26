# MCP Java Layer

A Spring Boot-based MCP layer that replaces the Go OAuth service, providing the same functionality with Java MCP SDK integration.

## Overview

The MCP Java Layer acts as an authorization layer in the MCP request pipeline, similar to the original Go OAuth service. It generates mock JWT tokens with group claims and adds them as `Authorization` headers to all requests before forwarding them to the MCP Policy Guard.

## Architecture

```
Client → MCP Java → MCP Policy Guard → MCP Aggregator → Multiple MCP Servers
     ↓           ↓                    ↓                    ↓
  mcp-chat   mcp-java         mcp-policy-guard    mcp-aggregator
```

## Features

- **Mock JWT Token Generation**: Creates JWT tokens with mock claims including groups
- **Authorization Header Injection**: Automatically adds `Authorization: Bearer <token>` headers
- **OpenTelemetry Tracing**: Comprehensive distributed tracing with Java SDK
- **Health Checks**: Kubernetes-ready health and readiness endpoints
- **Token Debugging**: `/token` endpoint for viewing generated tokens
- **Spring Boot Integration**: Full Spring Boot ecosystem with MCP Java SDK
- **Reactive Programming**: Non-blocking request handling with WebFlux

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

## Technology Stack

- **Spring Boot 3.2.0**: Main application framework
- **Spring AI MCP**: MCP integration with Spring Boot
- **MCP Java SDK**: Core MCP functionality
- **JJWT**: JWT token generation and validation
- **OpenTelemetry Java**: Distributed tracing
- **WebFlux**: Reactive HTTP client
- **Java 21**: Latest LTS Java version

## Configuration

### Environment Variables

```bash
PORT=8080                                    # Service port (default: 8080)
POLICY_GUARD_URL=http://mcp-policy-guard:8090  # Policy guard service URL
OTEL_SERVICE_NAME=mcp-java                   # Tracing service name
OTEL_EXPORTER_OTLP_ENDPOINT=http://aspire-dashboard:18889  # OTLP endpoint
```

### Application Properties

The service uses Spring Boot's configuration system with `application.yml`:

```yaml
server:
  port: ${PORT:8080}

policy:
  guard:
    url: ${POLICY_GUARD_URL:http://mcp-policy-guard:8090}

otel:
  service:
    name: ${OTEL_SERVICE_NAME:mcp-java}
  exporter:
    otlp:
      endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:http://aspire-dashboard:18889}
```

## Development

### Prerequisites

- Java 21 or later
- Maven 3.8 or later
- Docker (for containerized builds)

### Building Locally

```bash
cd mcp-layers/mcp-java
mvn clean package
java -jar target/mcp-java-1.0.0.jar
```

### Running with Maven

```bash
mvn spring-boot:run
```

### Docker Build

```bash
# Build the JAR
mvn clean package -DskipTests

# Build Docker image
docker build -t mcp-java mcp-layers/mcp-java/

# Run container
docker run -p 8080:8080 mcp-java
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

## Migration from Go OAuth Service

This Java implementation provides the same functionality as the original Go OAuth service:

### Key Differences

1. **Language**: Java/Spring Boot instead of Go
2. **MCP Integration**: Uses Spring AI MCP and MCP Java SDK
3. **Reactive Programming**: WebFlux for non-blocking operations
4. **Enhanced Observability**: Spring Boot Actuator integration
5. **Better Testing**: Spring Boot Test framework

### Compatibility

- Same API endpoints (`/health`, `/ready`, `/token`, `/*`)
- Same environment variables
- Same JWT token format and claims
- Same OpenTelemetry integration
- Same Docker container interface

## Observability

The service includes comprehensive observability features:

- **Distributed Tracing**: End-to-end request tracking with OpenTelemetry
- **Metrics**: Spring Boot Actuator metrics
- **Health Checks**: Kubernetes readiness and liveness probes
- **Structured Logging**: Request and error logging with correlation IDs
- **Token Generation Metrics**: Success/failure rates

## Future Enhancements

This service is designed to be enhanced with:

- **Real OAuth Integration**: Replace mock tokens with real OAuth providers
- **MCP Authorization Spec**: Implement the official MCP Authorization specification
- **Advanced Token Management**: Token refresh, revocation, and caching
- **Policy Enforcement**: Fine-grained access control policies
- **Multi-tenancy**: Support for multiple tenant organizations

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure port 8080 is available
2. **Policy Guard Unreachable**: Check `POLICY_GUARD_URL` configuration
3. **OpenTelemetry Issues**: Verify OTLP endpoint configuration
4. **Memory Issues**: Adjust JVM heap size for production deployments

### Logs

Enable debug logging for troubleshooting:

```yaml
logging:
  level:
    com.aspire.mcp: DEBUG
```

## License

This project is part of the Aspire application stack and follows the same licensing terms.
