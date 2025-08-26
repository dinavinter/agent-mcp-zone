# MCP Layer - Python


## Features

- **Multi-Server Support**: Connect to multiple MCP servers simultaneously
- **Flexible Configuration**: Support both JSON and individual environment variable configuration
- **FastMCP Integration**: Built on FastMCP for robust MCP protocol handling
- **OpenTelemetry Ready**: Prepared for distributed tracing integration
- **HTTP Transport**: Supports HTTP-based MCP server communication
 


### Running Locally

1. Install dependencies:
   ```bash
   uv sync
   ```


3. Run the service:
   ```bash
   uv run main.py
   ```


### Add to Aspire
```csharp
var myMcpLayer = builder
    .AddUvApp(       
        name: "my-layer-name",
        projectDirectory: "/location-of-your-code-directory",
        scriptPath: "main.py" 
    )
    .WithHttpEndpoint(port: 7000, env: "PORT", name: "http" )
    .WithEnvironment("MCP_SERVER_URL", targetMcP)
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-aggregator")
    .WithEnvironment("withPrivateRegistry", "true")
    .WithEnvironment("TARGETPLATFORM", "linux/amd64")
    .PublishAsDockerFile(d =>
    {
        d.WithImageName("mcp-guard/my-layer-name");
        d.WithImageTag("latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("/your-location-of-your-code-directory/Dockerfile");
    })
    .WithOtlpExporter()
    .WithExternalHttpEndpoints();


```
 
### Adding New Features

1. **New Transport Types**: Extend the configuration parsing in `main.py`
2. **Authentication**: Add authentication handling in the FastMCP proxy setup
3. **Load Balancing**: Implement load balancing logic for multiple servers
4. **Health Checks**: Add health check endpoints for individual servers

## Troubleshooting

1. **Server Connection Failed**: Check server URLs and network connectivity
2. **Configuration Errors**: Validate JSON format and environment variables
3. **Port Conflicts**: Ensure the configured port is available

### Debug Mode

Enable debug logging by setting:

```bash
export PYTHONPATH=.
python -u main.py
```
