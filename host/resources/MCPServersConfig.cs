#pragma warning disable ASPIREINTERACTION001
#pragma warning disable ASPIREHOSTINGPYTHON001
#pragma warning disable ASPIREPUBLISHERS001
using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Humanizer;
using Microsoft.Extensions.DependencyInjection;

namespace AspireHost.resources;

public class McpServer
{
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? ApiKey { get; set; }
    public int Timeout { get; set; } = 300; // Default timeout in milliseconds
    public bool Disabled { get; set; } = false;
    public bool Type { get; set; } = true;
    public string? Command { get; set; }
    public string[]? args { get; set; } = [];
}
public class MCPServersConfig: IResource
{
    public string FilePath { get; set; } = "mcp-servers.json";

    public MCPServersConfig(string filePath)
    {
        FilePath = filePath;
    }
    
    /// <inheritdoc />
    public string Name { get; } = "mcp-servers-config";

    /// <inheritdoc />
    public ResourceAnnotationCollection Annotations { get; } = new();
    
    public async Task SaveAsync(IEnumerable<McpServer> servers)
    {
        await File.WriteAllTextAsync(FilePath, JsonSerializer.Serialize(servers, new JsonSerializerOptions
        {
            WriteIndented = true
        }));
    }
    
    public async Task<List<McpServer>> LoadAsync()
    {
        if (!File.Exists(FilePath))
        {
            return new List<McpServer>();
        }

        var json = await File.ReadAllTextAsync(FilePath);
        try
        {
            var servers = JsonSerializer.Deserialize<List<McpServer>>(json);
            return servers ?? new List<McpServer>();
        }
        catch (JsonException)
        {
            // Handle JSON parsing errors if necessary
            return new List<McpServer>();
        }
    }
    
    public async Task AddServerAsync(McpServer server)
    {
        var servers = await LoadAsync();
        servers.Add(server);
        await SaveAsync(servers);
    }

}


public static class MCPServersConfigExtensions
{
    public static IResourceBuilder<MCPServersConfig> AddMCPServersConfig(this IDistributedApplicationBuilder builder,
        string filePath = "./mcp-servers.json")
    {
        var mcpServers = builder.AddResource(new MCPServersConfig(filePath));

        return mcpServers.WithAddMCPServersCommand(filePath);
    }

    public static IResourceBuilder<T> WithAddMCPServersCommand<T>(this IResourceBuilder<T> builder,
        string filePath = "./config.json") where T : IResource
    {

        builder.WithCommand(name: "add-mcp-servers", "Add New Server", executeCommand: async (context) =>
        {
            var interactionService = context.ServiceProvider.GetService<IInteractionService>();
            if (interactionService is not { IsAvailable: true })
            {
                throw new InvalidOperationException("Interaction service is not available.");
            }

            var interactionResult = await interactionService.PromptInputsAsync("Add MCP Server",
                message: "Fill in the new MCP Server details", inputs: new[]
                {
                    new InteractionInput()
                    {
                        Label = "url",
                        InputType = InputType.Text,
                        Value = "https://aiam-mcps-mcp-everything-router.cfapps.eu12.hana.ondemand.com/mcp",
                        Required = true,
                        Description = "The URL of the MCP server to configure.",
                        Placeholder = "https://example.com/mcp"
                    },
                    new InteractionInput()
                    {
                        Label = "name",
                        InputType = InputType.Text,
                        Value = "My MCP Server",
                        Required = true,
                    },
                    new InteractionInput()
                    {
                        Label = "description",
                        InputType = InputType.Text,
                        Value = "My custom MCP server",
                        Required = false,
                    },
                    new InteractionInput()
                    {
                        Label = "type",
                        InputType = InputType.Text,
                        Value = "http",
                        Required = true,
                        Description = "The transport type for the MCP server (e.g., http, sse).",
                        Options = new Dictionary<string, string>()
                        {
                            ["http"] = "http",
                            ["sse"] = "sse",
                            ["stdio"] = "stdio"
                        }.ToImmutableArray()
                    }
                }, options: new()
                {
                    ShowDismiss = true,
                    PrimaryButtonText = "Add",
                    SecondaryButtonText = "Cancel",
                }, cancellationToken: context.CancellationToken);

            if (interactionResult is { Data: { Count: > 0 }, Canceled: false })
            {
                var config = interactionResult.Data.ToDictionary(d => d.Label, d => d.Value ?? string.Empty);
                var existingFile = File.Exists(filePath) ? await File.ReadAllTextAsync(filePath) : "{}";
              
                var configFile = JsonSerializer.Deserialize<Dictionary<string, object>>(existingFile) ?? new Dictionary<string, object>();
                configFile[config["name"]] = config;

                await File.WriteAllTextAsync(filePath,
                    JsonSerializer.Serialize(new
                    {
                        mcpServers = configFile
                    }, new JsonSerializerOptions { WriteIndented = true }),
                    Encoding.UTF8,
                    new CancellationTokenSource(TimeSpan.FromSeconds(20)).Token);


            }

            return CommandResults.Success();
        }, commandOptions: new CommandOptions()
        {
            Description = "Add a new MCP server to the configuration file.",
            IconName = "Add",
            IconVariant = IconVariant.Filled,
            IsHighlighted = true,
            UpdateState = c => ResourceCommandState.Enabled
        });
        return builder;
    }

}