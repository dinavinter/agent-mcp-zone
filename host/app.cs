#pragma warning disable ASPIREINTERACTION001
#pragma warning disable ASPIREHOSTINGPYTHON001
#pragma warning disable ASPIREPUBLISHERS001
using static Aspire.Hosting.InputType;

//todo: session redis
var builder = DistributedApplication.CreateBuilder(args);
// var imageRegistry = builder.AddParameter("image-registry","scai-dev.common.repositories.cloud.sap", true)
//     .WithDescription("Container image registry for publishing images")
//     .WithCustomInput(p => new()
//     {
//         InputType = Text,
//         Value = "scai-dev.common.repositories.cloud.sap",
//         Label = p.Name,
//         Placeholder = "Container image registry (e.g. Docker Hub user or Azure Container Registry name)",
//         Description = p.Description
//     }).WithDescription("Container image registry");


// AI Core Configuration
var aiCoreConfig = builder.AddParameter("ai-core-resource-group")
    .WithDescription("Resource group for AI Core")
    .WithCustomInput(p => new()
    {
        Required = false,
        InputType = Text,
        Value = "default",
        Options =
        [
            new KeyValuePair<string, string>("default", "default"),
        ],
        Label = p.Name,
        Placeholder = "Select AI Core configuration",
        Description = p.Description,
      
    }).WithDescription("AI Core configuration profile");
// AI Core Credentials Secret
var aiCoreCredentials = builder.AddParameter("ai-core-credentials")
    .WithDescription("SAP AI Core credentials JSON (upload or paste)")
    .WithCustomInput(p => new()
    {
        InputType = Text,
        Value = "",
        Label = p.Name,
        Placeholder = "Paste AI Core credentials JSON or upload key file",
        Description = p.Description
    }).WithDescription("AI Core credentials in JSON format");


// AI Core Proxy Service
var aiCoreProxy = builder.AddDenoTask("ai-core", "../models/ai-core", "start")
    .WithHttpEndpoint(port: 3002, env: "PORT")
    .WithEnvironment("AI_CORE_CREDENTIALS_JSON", aiCoreCredentials)
    .WithEnvironment("AI_CORE_RESOURCE_GROUP", aiCoreConfig)
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-ai-core")
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("aspire-ai/ai-core:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("../models/ai-core", "Dockerfile");})
    .WithOtlpExporter()
    .WithEndpoint();

// AI Core Test Client Service
// var aiCoreTestClient = builder.AddDenoTask("ai-core-client", "../models/ai-core", "client")
//     .WithHttpEndpoint(port: 3003, env: "PORT")
//     .WithEnvironment("AI_CORE_PROXY_URL", aiCoreProxy.GetEndpoint("http"))
//     .WithEndpoint();


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
            new KeyValuePair<string, string>("cloudflare", "https://docs.mcp.cloudflare.com/sse"),
        ],
        Label = p.Name,
        Placeholder = $"Select or type mcp server to guard {p.Name}",
        Description = p.Description
    }).WithDescription("Target McP server URL")
    .WithUrl("https://aiam-mcps-everything.cfapps.eu12.hana.ondemand.com/mcp");



var mcpAggregator = builder
    .AddUvApp(       
        name: "mcp-aggregator",
        projectDirectory: "../mcp-aggregator",
        scriptPath: "main.py"
        
    )
    .WithHttpEndpoint(port: 7000, env: "PORT", name: "http" )
    .WithEnvironment("MCP_SERVER_URL", targetMcP)
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-aggregator")
    .WithEnvironment("withPrivateRegistry", "true")
    .WithEnvironment("TARGETPLATFORM", "linux/amd64")
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("aspire-ai/mcp-aggregator:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("../mcp-aggregator");
    })
    .WithOtlpExporter()
    .WithExternalHttpEndpoints();


// MCP Policy Guard - Go-based proxy with OpenTelemetry tracing
var mcpPolicyGuard = builder
    .AddGolangApp("mcp-policy-guard", "../mcp-policy-guard")
    .WithReference(mcpAggregator)
    .WaitFor(mcpAggregator)
    .WithHttpEndpoint(port: 8090, env: "PORT", name: "http")
    .WithEnvironment("GUARD_URL", mcpAggregator.GetEndpoint("http"))
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-policy-guard")
    .WithEnvironment("withPrivateRegistry", "true")
    .WithEnvironment("TARGETPLATFORM", "linux/amd64")
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("aspire-ai/mcp-policy-guard:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("../mcp-policy-guard");
    })
    .WithOtlpExporter()
    .WithExternalHttpEndpoints();

// Chat agent with AI Core support

var chat=builder.AddDenoTask("chat", "../agents/chat", "start")
    .WithReference(aiCoreProxy)
    .WithReference(mcpPolicyGuard)
    .WaitFor(mcpPolicyGuard)
    .WithEnvironment("MCP_SERVER_URL", mcpPolicyGuard.GetEndpoint("http"))
    .WithEnvironment("OPENAI_BASE_URL", aiCoreProxy.GetEndpoint("http"))
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-chat")
    .WithHttpEndpoint(env: "PORT")
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("aspire-ai/chat:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap"); 
        d.WithBuildArg("BASE_IMAGE", "denoland/deno:alpine-1.36.4");
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithBuildArg("platform", "linux/amd64");
        d.WithDockerfile("../agents/chat");
    });



builder
    .AddMcpInspector("inspector")
    .WithMcpServer(mcpPolicyGuard, isDefault: true)
    .WaitFor(mcpPolicyGuard)
    .WithEnvironment("MCP_SERVER_URL", mcpPolicyGuard.GetEndpoint("http"))
    .WithEnvironment("DEFAULT_MCP_SERVER", mcpPolicyGuard.Resource.Name)
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-inspector")
     
    .WithUrlForEndpoint(McpInspectorResource.ClientEndpointName, annotation =>
    {
        annotation.DisplayText = "Client";
        annotation.DisplayOrder = 1;
        annotation.DisplayLocation = UrlDisplayLocation.SummaryAndDetails;
    })
    .WithUrlForEndpoint(McpInspectorResource.ServerProxyEndpointName, annotation =>
    {
        annotation.DisplayText = "Server";
        annotation.DisplayOrder = 3;
        annotation.DisplayLocation = UrlDisplayLocation.DetailsOnly;
    })
    // .PublishAsDockerFile(d =>
    // {
    //     d.WithImageTag("aspire-ai/inspector:latest");
    //     d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
    //     
    //     d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
    //     d.WithDockerfile("inspector", "../inspector", "Dockerfile");
    // })

    .WithOtlpExporter()
    ;

builder.Build().Run();
