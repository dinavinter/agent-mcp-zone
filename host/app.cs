#pragma warning disable ASPIREINTERACTION001
#pragma warning disable ASPIREHOSTINGPYTHON001
#pragma warning disable ASPIREPUBLISHERS001
using AspireHost.resources;
using Microsoft.Extensions.DependencyInjection;
using static Aspire.Hosting.InputType;

//todo: session redis
var builder = DistributedApplication.CreateBuilder(args);

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
var aiCoreCredentials = builder.AddParameter("ai-core-key", secret:true)
    .WithDescription("SAP AI Core credentials JSON (upload or paste)")
    .WithCustomInput(p => new()
    {
        InputType = Text,
        Label = p.Name,
        Placeholder = "Paste AI Core credentials JSON or upload key file",
        Description = p.Description
    }).WithDescription("AI Core credentials in JSON format");

var aiCoreProxy = builder.AddContainer("ai-core-proxy", "scai-dev.common.repositories.cloud.sap/aap/sap-ai-proxy:latest")
    .WithHttpEndpoint(env: "PORT" , port: 3002, targetPort: 3002)
    .WithEnvironment("AICORE_CONFIG", aiCoreCredentials)
    .WithEnvironment("AICORE_RESOURCE_GROUP", aiCoreConfig)
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-ai-core")
    .WithOtlpExporter();


// MCP Guard with OAuth, Policy and Aggregation layers

var mcpGuard = builder.AddResource(new McpGuardResource())
    .WithCommand("explain", "Explain", executeCommand: async context =>
    {
        var interactionService = context.ServiceProvider.GetRequiredService<IInteractionService>();
        if (interactionService is not { IsAvailable: true })
        {
            throw new InvalidOperationException("Interaction service is not available.");
        }

        //example message box with markdown
        await interactionService.PromptMessageBoxAsync(
            "MCP Guard: Details",
            """
            ## 🛡️ MCP Guard

            > MCP Guard is an MCP proxy that protect downstream MCP servers with authentication, authorization, grant management and rate limiting.

            The Guard implemented with multiple layers, each implemented as its own MCP Proxy/middleware , allowing for modularity and flexibility in deployment.

            ###### The layers include:
            - **OAuth**:  Supports OAuth2, API Key, and custom token-based authentication methods to verify client identities.
            - **Policy Enforcement**: *Policy Enforcement* Implements role-based and attribute-based access control to ensure clients can only access permitted resources and actions.
            - **Aggregation**: Combines responses from multiple MCP servers, providing a unified interface for clients to interact with various backend services.

            ###### TBD:
              - **Logging and Monitoring **: Integrates with logging and monitoring systems to track access patterns, detect anomalies, and generate audit trails for compliance purposes.
              - **Audit **: Records detailed logs of all access and actions performed through the MCP Guard, facilitating auditing and compliance checks.
              - **Rate Limiting **: Controls the rate of incoming requests to prevent abuse and ensure fair usage among clients.
              - **Consent and Grants**: Manages user consents and permissions for accessing specific tools or data, ensuring compliance with user preferences.
              - **Session Management**: Maintains agent and user sessions, allowing for seamless interactions across multiple requests without repeated authentication.
            """,


            new MessageBoxInteractionOptions
            {
                Intent = MessageIntent.Information,
                EnableMessageMarkdown = true,
                PrimaryButtonText = "Awesome"
            }
        );

        return CommandResults.Success();
    });


var mcpAggregator = builder
    .AddContainer("aggregator", "mcp-aggregator")
    .WithImageRegistry("scai-dev.common.repositories.cloud.sap")
    .WithImageTag("latest")
    .WithHttpEndpoint(port: 3001, env: "PORT", name: "http", targetPort: 3001)
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-aggregator")
    .WithEnvironment("withPrivateRegistry", "true")
    .WithEnvironment("TARGETPLATFORM", "linux/amd64") 
    .WithOtlpExporter()
    .WithExternalHttpEndpoints()
    .WithCommand("explain", "Explain", executeCommand: async context =>
    {
        var interactionService = context.ServiceProvider.GetRequiredService<IInteractionService>();
        if (interactionService is not { IsAvailable: true })
        {
            throw new InvalidOperationException("Interaction service is not available.");
        }

        //example message box with markdown
        await interactionService.PromptMessageBoxAsync(
            "MCP Aggregator Layer",
            """
            You can find the source code on GitHub
            
            [✏️ https://github.tools.sap/AIAM/mcp-aggregator](https://github.tools.sap/AIAM/mcp-aggregator) 
            
            > Aggregates multiple MCP servers into a single endpoint.
            
            #### API Endpoints
            PORT 3001
            **draft**
            The MCP Aggregator exposes the follwing endpoint:
            
            - `POST /mcp` - MCP request handling
            - `GET /health` - Health check endpoint
            
            
            #### Configuration

            ```json
            {
                "mcpServers": {
                  "github": {
                    "type": "http",
                    "url": "https://api.githubcopilot.com/mcp/"
                  }, 
                  "sequential-thinking": {
                    "command": "npx",
                    "args": [
                      "-y",
                      "@modelcontextprotocol/server-sequential-thinking"
                  ] } } 
            }
            ```

            """,
            new MessageBoxInteractionOptions
            {
                Intent =MessageIntent.Information,
                EnableMessageMarkdown = true,
                PrimaryButtonText = "Awesome"
            }
        );

        return CommandResults.Success();
    })
    //TODO: fix bind mount to allow updates of mcp-servers.json.
    // .WithBindMount("./aggregator", "/aggregator", isReadOnly: false)
    .WithAddMCPServersCommand("./mcp-servers.json")
    .WithParentRelationship(mcpGuard);


var mcpPolicyGuard = builder
    .AddGolangApp("policy", "../templates/mcp-layer-go")
    .WaitFor(mcpAggregator)
    .WithHttpEndpoint(port: 8090, env: "PORT", name: "http")
    .WithEnvironment("MCP_SERVER_URL", $"{mcpAggregator.GetEndpoint("http")}/mcp")
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-policy-guard")
    .WithEnvironment("withPrivateRegistry", "true")
    .WithEnvironment("TARGETPLATFORM", "linux/amd64")
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("aspire-ai/mcp-policy-guard:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("../templates/mcp-layer-go");
    })
    .WithOtlpExporter()
    .WithExternalHttpEndpoints()
    .WithCommand("explain", "Explain", executeCommand: async context =>
    {
        var interactionService = context.ServiceProvider.GetRequiredService<IInteractionService>();
        if (interactionService is not { IsAvailable: true })
        {
            throw new InvalidOperationException("Interaction service is not available.");
        }

        //example message box with markdown
        await interactionService.PromptMessageBoxAsync(
            "\u264a  MCP Policy Layer",
            """
            You can find the source code on GitHub
            [✏️ https://github.tools.sap/AIAM/mcp-guard/tree/i551404_testing](https://github.tools.sap/AIAM/mcp-guard/tree/i551404_testing) 

            > Provides MCP Proxy that evaluate and enforce fine-grained, dynamic AuthZ rules before downstream forwarding
            
            #### API Endpoints
            PORT 8090
            **draft**
            -  `POST /` - MCP request handling
            -  `GET /health` - Health check endpoint
            -  `GET /policies` - View and manage policies
            -  `POST /policies` - Add new policy
             
             
            """,
            new MessageBoxInteractionOptions
            {
                Intent = MessageIntent.Information,
                EnableMessageMarkdown = true,
                PrimaryButtonText = "Awesome"
            }
        );

        return CommandResults.Success();
    }) .WithParentRelationship(mcpGuard);

var mcpOAuth = builder
    .AddGolangApp("oauth", "../templates/mcp-layer-go")
    .WithReference(mcpPolicyGuard)
    .WaitFor(mcpPolicyGuard)
    .WithHttpEndpoint(port: 8080, env: "PORT", name: "http")
    .WithEnvironment("MCP_SERVER_URL", mcpPolicyGuard.GetEndpoint("http"))
    .WithEnvironment("OTEL_SERVICE_NAME", "mcp-oauth-guard")
    .WithEnvironment("withPrivateRegistry", "true")
    .WithEnvironment("TARGETPLATFORM", "linux/amd64")
    .PublishAsDockerFile(d =>
    {
        d.WithImageTag("mcp-guard/oauth:latest");
        d.WithImageRegistry("scai-dev.common.repositories.cloud.sap");
        d.WithBuildArg("TARGETPLATFORM", "linux/amd64");
        d.WithDockerfile("../templates/mcp-layer-go");
    })
    .WithOtlpExporter()
    .WithExternalHttpEndpoints()
    .WithParentRelationship(mcpGuard)
    .WithCommand("explain", "Explain", executeCommand: async context =>
    {
        var interactionService = context.ServiceProvider.GetRequiredService<IInteractionService>();
        if (interactionService is not { IsAvailable: true })
        {
            throw new InvalidOperationException("Interaction service is not available.");
        }

        //example message box with markdown
        await interactionService.PromptMessageBoxAsync(
            "\ud83d\udd10 MCP OAuth Layer",
            """
            You can find the source code on GitHub
            [✏️ https://github.tools.sap/AIAM/mcp-oauth](https://github.tools.sap/AIAM/mcp-oauth) 

            > OAuth2 and API Key authentication for MCP clients.
            
            ### API Endpoints
            **draft**
            - PORT 8080
            - `POST /` - MCP request handling
            - `GET /health` - Health check endpoint
            - `POST /login` - OAuth2 login endpoint
            - `GET /oauth/callback` - OAuth2 callback endpoint
            
            > Provides MCP Proxy that handles OAuth2 authentication and token management.
             
            """,
            new MessageBoxInteractionOptions
            {
                Intent = MessageIntent.Information,
                EnableMessageMarkdown = true,
                PrimaryButtonText = "Awesome"
            }
        );

        return CommandResults.Success();
    });


// Chat agent with AI Core support

var chat=builder.AddDenoTask("chat", "../agents/chat", "start")
    .WaitFor(aiCoreProxy)
    .WithReference(mcpOAuth)
    .WaitFor(mcpOAuth)
    .WithEnvironment("MCP_SERVER_URL", mcpOAuth.GetEndpoint("http"))
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


//MCP Inspector - With default server to OAuth proxy
 
builder
    .AddMcpInspector("inspector")
    .WithMcpServer(mcpOAuth, isDefault: true)
    .WaitFor(mcpOAuth)
    .WithEnvironment("MCP_SERVER_URL", mcpOAuth.GetEndpoint("http"))
    .WithEnvironment("DEFAULT_MCP_SERVER", mcpOAuth.Resource.Name)
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

    .WithOtlpExporter() ;
   

builder.Build().Run();

public class McpGuardResource:IResource
{
    /// <inheritdoc />
    public string Name { get; } = "scai-mcp-guard";

    /// <inheritdoc />
    public ResourceAnnotationCollection Annotations { get; } = new();
}

