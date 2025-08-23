#pragma warning disable ASPIREINTERACTION001
#pragma warning disable ASPIREHOSTINGPYTHON001
#pragma warning disable ASPIREPUBLISHERS001
using static Aspire.Hosting.InputType;

var builder = DistributedApplication.CreateBuilder(args);
var imageRegistry = builder.AddParameter("image-registry","scai-dev.common.repositories.cloud.sap", true)
    .WithDescription("Container image registry for publishing images")
    .WithCustomInput(p => new()
    {
        InputType = Text,
        Value = "scai-dev.common.repositories.cloud.sap",
        Label = p.Name,
        Placeholder = "Container image registry (e.g. Docker Hub user or Azure Container Registry name)",
        Description = p.Description
    }).WithDescription("Container image registry");


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
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("aspire-ai/ai-core:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("../models/ai-core", "Dockerfile");})
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
            new KeyValuePair<string, string>("github", "https://api.githubcopilot.com/mcp/"),
        ],
        Label = p.Name,
        Placeholder = $"Select or type mcp server to guard {p.Name}",
        Description = p.Description
    }).WithDescription("Target McP server URL")
    .WithUrl("https://aiam-mcps-everything.cfapps.eu12.hana.ondemand.com/mcp");

var pythonProxy = builder
    .AddUvApp(       
        name: "guard",
        projectDirectory: "../guard",
        scriptPath: "main.py"
        
    )
    .WaitFor(targetMcP) 
    .WithHttpEndpoint(port: 7000, env: "PORT", name: "http" )
    .WithEnvironment("MCP_SERVER_URL", targetMcP)
    .WithEnvironment("withPrivateRegistry", "true")
    .WithEnvironment("TARGETPLATFORM", "linux/amd64") 
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("aspire-ai/guard:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("../guard");
    })
   // .WithOtlpExporter()
    .WithExternalHttpEndpoints();

// Chat agent with AI Core support

var chat=builder.AddDenoTask("chat", "../agents/chat", "start")
    .WithReference(aiCoreProxy)
    .WithReference(pythonProxy)
    .WaitFor(pythonProxy)
    .WithEnvironment("MCP_SERVER_URL", pythonProxy.GetEndpoint("http"))
    .WithEnvironment("OPENAI_BASE_URL", aiCoreProxy.GetEndpoint("http"))
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
    .WithMcpServer(pythonProxy, isDefault: true)
    .WaitFor(pythonProxy)
    .WithEnvironment("MCP_SERVER_URL", pythonProxy.GetEndpoint("http"))
    .WithEnvironment("DEFAULT_MCP_SERVER", pythonProxy.Resource.Name)
     
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

   // .WithOtlpExporter()
    ;

builder.Build().Run();
