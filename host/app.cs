#pragma warning disable ASPIREINTERACTION001
#pragma warning disable ASPIREHOSTINGPYTHON001
#pragma warning disable ASPIREPUBLISHERS001
using static Aspire.Hosting.InputType;

var builder = DistributedApplication.CreateBuilder(args);

var targetMcP = builder.AddParameter("mcp-server")
    .WithDescription("The URL of the external service.")
    .WithCustomInput(p => new()
    {
        InputType = Text,
        Value = "https://aiam-mcps-everything.cfapps.eu12.hana.ondemand.com/mcp",
        Options =
        [
            new KeyValuePair<string, string>("everything",
                "https://aiam-mcps-everything.cfapps.eu12.hana.ondemand.com/mcp"),
            new KeyValuePair<string, string>("github", "https://api.githubcopilot.com/mcp/"),
        ],
        Label = p.Name,
        Placeholder = $"Select or type mcp server to gaurd {p.Name}",
        Description = p.Description
    }).WithDescription("Target McP server URL");



var pythonProxy = builder
    .AddPythonApp("guard", "../guard", "main.py")
    .WaitFor(targetMcP)
    .WithHttpEndpoint(port: 7000, env: "PORT", name: "http")
    .WithEnvironment("MCP_SERVER_URL", targetMcP)
  //  .WithOtlpExporter()
    .WithExternalHttpEndpoints();

builder
    .AddMcpInspector("inspector")
    .WithMcpServer(pythonProxy, isDefault: true)
    .WaitFor(pythonProxy)
    .WithEnvironment("MCP_SERVER_URL", pythonProxy.GetEndpoint("http"))
    .WithEnvironment("DEFAULT_MCP_SERVER", pythonProxy.Resource.Name)
    .WithUrlForEndpoint(McpInspectorResource.ClientEndpointName, annotation =>
    {
        annotation.DisplayText = "Client";
        annotation.DisplayOrder = 2;
    })

   // .WithOtlpExporter()
    ;

builder.Build().Run();
