# MCP Aggregator

A multi-server MCP (Model Context Protocol) proxy that aggregates and routes requests to multiple MCP servers. This service acts as a unified interface for accessing multiple MCP servers through a single endpoint.

## Features

- **Multi-Server Support**: Connect to multiple MCP servers simultaneously
- **Flexible Configuration**: Support both JSON and individual environment variable configuration
- **FastMCP Integration**: Built on FastMCP for robust MCP protocol handling
- **OpenTelemetry Ready**: Prepared for distributed tracing integration
- **HTTP Transport**: Supports HTTP-based MCP server communication

## Configuration

### Option 1: JSON Configuration (Recommended)

Set the `MCP_SERVERS_JSON` environment variable with a JSON configuration:

```json
{
  "mcpServers": {
    "default": {
      "url": "https://aiam-mcps-everything.cfapps.eu12.hana.ondemand.com/mcp",
      "transport": "http",
      "name": "everything"
    },
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "transport": "http",
      "name": "github"
    },
    "custom": {
      "url": "https://your-custom-mcp-server.com/mcp",
      "transport": "http",
      "name": "custom-server"
    }
  }
}
```

### Option 2: Individual Environment Variables

For simpler setups, you can use individual environment variables:

```bash
# Number of servers
MCP_SERVER_COUNT=2

# Server 0 (default)
MCP_SERVER_URL=https://aiam-mcps-everything.cfapps.eu12.hana.ondemand.com/mcp
MCP_SERVER_TRANSPORT=http
MCP_SERVER_NAME=everything

# Server 1
MCP_SERVER_1_URL=https://api.githubcopilot.com/mcp/
MCP_SERVER_1_TRANSPORT=http
MCP_SERVER_1_NAME=github
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_SERVERS_JSON` | JSON configuration for multiple servers | - |
| `MCP_SERVER_COUNT` | Number of servers (for individual config) | 1 |
| `MCP_SERVER_URL` | URL of the default server | - |
| `MCP_SERVER_TRANSPORT` | Transport protocol for default server | http |
| `MCP_SERVER_NAME` | Name of the default server | default |
| `MCP_SERVER_{i}_URL` | URL of server i | - |
| `MCP_SERVER_{i}_TRANSPORT` | Transport protocol for server i | http |
| `MCP_SERVER_{i}_NAME` | Name of server i | server_{i} |
| `PORT` | Port to run the service on | 8080 |
| `NAME` | Service name | mcp-aggregator |

## Usage

### Running Locally

1. Install dependencies:
   ```bash
   cd mcp-aggregator
   uv sync
   ```

2. Set up environment variables (see Configuration section)

3. Run the service:
   ```bash
   uv run main.py
   ```

### Running with Docker

```bash
docker build -t mcp-aggregator .
docker run -p 7000:8080 \
  -e MCP_SERVERS_JSON='{"mcpServers":{"default":{"url":"https://example.com/mcp","transport":"http","name":"example"}}}' \
  mcp-aggregator
```

### Running with Aspire

The service is configured in the Aspire application (`host/app.cs`) and can be started with:

```bash
cd host
dotnet run
```

## API Endpoints

The MCP Aggregator exposes standard MCP endpoints:

- `POST /` - MCP request handling
- `GET /health` - Health check endpoint

## Architecture

```
┌─────────────────┐
│   MCP Client    │
│   (Chat, etc.)  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ MCP Aggregator  │
│   (This App)    │
└─────────┬───────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌─────────┐ ┌─────────┐
│ MCP     │ │ MCP     │
│Server 1 │ │Server 2 │
└─────────┘ └─────────┘
```

## Integration with MCP Policy Guard

The MCP Aggregator is designed to work with the MCP Policy Guard service, which provides additional security and policy enforcement:

```
Chat Client → MCP Policy Guard → MCP Aggregator → Multiple MCP Servers
```

## Development

### Project Structure

```
mcp-aggregator/
├── main.py              # Main application entry point
├── pyproject.toml       # Python project configuration
├── README.md           # This file
└── Dockerfile          # Docker configuration
```

### Adding New Features

1. **New Transport Types**: Extend the configuration parsing in `main.py`
2. **Authentication**: Add authentication handling in the FastMCP proxy setup
3. **Load Balancing**: Implement load balancing logic for multiple servers
4. **Health Checks**: Add health check endpoints for individual servers

## Troubleshooting

### Common Issues

1. **Server Connection Failed**: Check server URLs and network connectivity
2. **Configuration Errors**: Validate JSON format and environment variables
3. **Port Conflicts**: Ensure the configured port is available

### Debug Mode

Enable debug logging by setting:

```bash
export PYTHONPATH=.
python -u main.py
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the agent application programming framework.
