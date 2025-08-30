# MCP TypeScript Layer

This template provides a minimal TypeScript-based MCP proxy layer. It proxies requests to a downstream MCP server, adds OpenTelemetry tracing, and demonstrates generic behavior by appending a `proxyProcessed` field to JSON responses.

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
- `MCP_SERVER_URL` – target MCP server URL
- `PORT` – port to listen on (default `8080`)
- `OTEL_EXPORTER_OTLP_ENDPOINT` – OTLP traces endpoint
- `OTEL_SERVICE_NAME` – service name for telemetry
