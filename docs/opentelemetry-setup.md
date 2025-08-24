# OpenTelemetry Setup for Agent Application

This document describes the OpenTelemetry (OTel) implementation across the different services in the agent application.

## Overview

OpenTelemetry has been integrated into all major services to provide comprehensive distributed tracing:

- **MCP Aggregator Service** (Python/FastMCP): Multi-server MCP proxy with tracing (`mcp-layers/mcp-aggregator/`)
- **Chat Service** (TypeScript/Deno): Web interface with MCP client tracing
- **AI Core Service** (TypeScript/Deno): AI model proxy with tracing
- **Inspector Service**: MCP inspector with tracing

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chat Client   │───▶│ MCP Policy Guard│───▶│ MCP Aggregator  │
│   (mcp-chat)    │    │ (mcp-policy-    │    │ (mcp-aggregator)│
└─────────────────┘    │   guard)        │    └─────────┬───────┘
         │             └─────────────────┘              │
         ▼                                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Core       │    │   Inspector     │    │  Multiple MCP   │
│   (mcp-ai-core) │    │ (mcp-inspector) │    │   Servers       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Services and Tracing

### 1. MCP Aggregator Service (Python) - `mcp-layers/mcp-aggregator/`

**Location**: `mcp-layers/mcp-aggregator/main.py`

**Features**:
- Multi-server MCP request/response tracing
- Trace context propagation in MCP metadata
- Automatic span creation for each MCP operation
- Aggregation of multiple MCP servers

**Key Spans**:
- `mcp_request`: Tracks incoming MCP requests
- `mcp_client_creation`: MCP client initialization
- `mcp_tools_loading`: Tool discovery operations
- `mcp_server_aggregation`: Multi-server aggregation operations

**Configuration**:
```python
OTEL_SERVICE_NAME=mcp-aggregator
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### 2. Chat Service (TypeScript/Deno)

**Location**: `agents/chat/client.tsx`, `agents/chat/telemetry.ts`

**Features**:
- HTTP request/response tracing
- MCP client operation tracing
- AI model streaming tracing
- Trace context injection in HTTP headers

**Key Spans**:
- `http_request`: HTTP request handling
- `chat_prompt`: Complete chat prompt processing
- `mcp_client_creation`: MCP client setup
- `mcp_tools_loading`: Tool loading operations
- `ai_model_streaming`: AI model response streaming
- `ui_message_processing`: UI message handling

**Configuration**:
```typescript
OTEL_SERVICE_NAME=mcp-chat
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### 3. AI Core Service (TypeScript/Deno)

**Location**: `models/ai-core/server.ts`, `models/ai-core/telemetry.ts`

**Features**:
- AI Core API operation tracing
- Authentication token management tracing
- Deployment discovery tracing
- Model inference tracing

**Key Spans**:
- `ai_core_authentication`: Token acquisition and management
- `ai_core_deployments_fetch`: Deployment discovery
- `ai_core_chat_completion`: Model inference operations

**Configuration**:
```typescript
OTEL_SERVICE_NAME=mcp-ai-core
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### 5. Inspector Service

**Features**:
- MCP inspection operation tracing
- Built-in Aspire OTLP exporter

**Configuration**:
```typescript
OTEL_SERVICE_NAME=mcp-inspector
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

## Environment Configuration

Add these variables to your `.env` file:

```bash
# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=mcp-aggregator
OTEL_SERVICE_NAME_CHAT=mcp-chat
OTEL_SERVICE_NAME_AI_CORE=mcp-ai-core
```

## Aspire Dashboard Integration

The Aspire configuration (`host/app.cs`) includes:

1. **OTLP Exporter**: Each service has `.WithOtlpExporter()` enabled
2. **Environment Variables**: OpenTelemetry configuration passed to each service
3. **Service Names**: Unique service names for each component

## Trace Flow Example

A typical trace flow for a chat interaction:

1. **Chat Service** (`mcp-chat`)
   - `http_request` - Receives HTTP request
   - `chat_prompt` - Processes user prompt
   - `mcp_client_creation` - Creates MCP client
   - `mcp_tools_loading` - Loads available tools

2. **MCP Policy Guard** (`mcp-layers/mcp-policy-guard`)
   - `mcp-proxy-request` - Receives and validates requests
   - Forwards to MCP Aggregator

3. **MCP Aggregator** (`mcp-aggregator`)
   - `mcp_request` - Receives MCP request from policy guard
   - Aggregates and forwards to multiple external MCP servers

4. **AI Core Service** (`mcp-ai-core`)
   - `ai_core_authentication` - Gets authentication token
   - `ai_core_chat_completion` - Processes AI model request
   - `ai_core_deployments_fetch` - Discovers available models

## Viewing Traces

### Using Aspire Dashboard

1. Start the application with Aspire:
   ```bash
   cd host
   dotnet run
   ```

2. Open the Aspire Dashboard (usually at http://localhost:18888)

3. Navigate to the "Traces" section to view distributed traces

### Using Jaeger (Alternative)

1. Start Jaeger:
   ```bash
   docker run -d --name jaeger \
     -e COLLECTOR_OTLP_ENABLED=true \
     -p 16686:16686 \
     -p 4317:4317 \
     jaegertracing/all-in-one:latest
   ```

2. Update `OTEL_EXPORTER_OTLP_ENDPOINT` to point to Jaeger:
   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
   ```

3. Access Jaeger UI at http://localhost:16686

## Key Benefits

1. **End-to-End Visibility**: Track requests across all services
2. **Performance Monitoring**: Identify bottlenecks in the MCP pipeline
3. **Error Tracking**: Correlate errors across services
4. **Debugging**: Understand the flow of MCP operations
5. **Distributed Context**: Maintain trace context across service boundaries

## Customization

### Adding Custom Attributes

You can add custom attributes to spans:

```typescript
// In telemetry.ts
span.setAttribute("custom.key", "custom.value");
span.setAttribute("user.id", userId);
span.setAttribute("request.size", requestSize);
```

### Adding Events

Add events to spans for important milestones:

```typescript
span.addEvent("user.authentication.completed", {
  userId: "123",
  method: "oauth"
});
```

### Error Handling

Errors are automatically captured and linked to spans:

```typescript
try {
  // operation
} catch (error) {
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  span.recordException(error);
  throw error;
}
```

## Troubleshooting

### Common Issues

1. **No traces appearing**: Check OTLP endpoint connectivity
2. **Missing spans**: Verify service names are unique
3. **Context not propagating**: Ensure trace headers are being passed

### Debug Mode

Enable debug logging by setting:

```bash
OTEL_LOG_LEVEL=debug
```

### Health Checks

Each service includes health check endpoints that can be used to verify OpenTelemetry initialization:

- Chat: `GET /health`
- AI Core: `GET /health`
- MCP Aggregator: Built into FastMCP

## Future Enhancements

1. **Metrics Collection**: Add OpenTelemetry metrics
2. **Log Correlation**: Link logs to traces
3. **Custom Instrumentation**: Add domain-specific spans
4. **Sampling**: Implement trace sampling strategies
5. **Alerting**: Set up alerts based on trace data
