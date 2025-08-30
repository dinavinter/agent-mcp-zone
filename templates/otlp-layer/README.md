# OTLP Layer (TypeScript)

This template provides a minimal TypeScript-based MCP proxy layer. It proxies requests to a downstream MCP server using stdio, SSE, or streamable HTTP transports, adds OpenTelemetry tracing, and demonstrates generic behavior by appending a `proxyProcessed` field to JSON responses.

## Features
- MCP proxy built with `mcp-proxy`
- `tapTransport` integration that emits OpenTelemetry spans
- Simple `/tool` endpoint for testing

## Running locally
```bash
npm install
npm run build
node dist/main.js
```
Set the following environment variables as needed:
- `MCP_SERVER_URL` – target MCP server URL (for `sse` and `stream` transports)
- `MCP_SERVER_TRANSPORT` – `stdio`, `sse`, or `stream` (default `stream`)
- `MCP_SERVER_CMD` / `MCP_SERVER_ARGS` – command and args when using `stdio`
- `PORT` – port to listen on (default `8080`)
- `OTEL_EXPORTER_OTLP_ENDPOINT` – OTLP traces endpoint
- `OTEL_SERVICE_NAME` – service name for telemetry

## Testing

Run the included Node test to verify the `/tool` endpoint responds correctly:

```bash
npm test
```
