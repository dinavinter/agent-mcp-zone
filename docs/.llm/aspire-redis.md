.NET Aspire Redis®* distributed caching integration
08/12/2025
Choose a hosting resource that supports the Redis protocol

Includes: Hosting integration included Hosting integration —&— Client integration included Client integration

Learn how to use the .NET Aspire Redis distributed caching integration. The Aspire.StackExchange.Redis.DistributedCaching library is used to register an IDistributedCache provider backed by a Redis server with the docker.io/library/redis container image.

Hosting integration
The Redis hosting integration models a Redis resource as the RedisResource type. To access this type and APIs for expressing them as resources in your AppHost project, add the 📦 Aspire.Hosting.Redis NuGet package:

.NET CLI
PackageReference
.NET CLI

Copy
dotnet add package Aspire.Hosting.Redis
For more information, see dotnet add package or Manage package dependencies in .NET applications.

Add Redis resource
In your AppHost project, call AddRedis on the builder instance to add a Redis resource:

C#

Copy
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");

builder.AddProject<Projects.ExampleProject>()
       .WithReference(cache);

// After adding all resources, run the app...
When .NET Aspire adds a container image to the AppHost, as shown in the preceding example with the docker.io/Redis/Redis image, it creates a new Redis instance on your local machine. A reference to your Redis resource (the cache variable) is added to the ExampleProject.

The WithReference method configures a connection in the ExampleProject named "cache". For more information, see Container resource lifecycle.

 Tip

If you'd rather connect to an existing Redis instance, call AddConnectionString instead. For more information, see Reference existing resources.

Add Redis resource with Redis Insights
To add the Redis Insights to the Redis resource, call the WithRedisInsight method:

C#

Copy
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache")
                   .WithRedisInsight();

builder.AddProject<Projects.ExampleProject>()
       .WithReference(cache);

// After adding all resources, run the app...
Redis Insights is a free graphical interface for analyzing Redis data across all operating systems and Redis deployments with the help of our AI assistant, Redis Copilot. .NET Aspire adds another container image docker.io/redis/redisinsight to the AppHost that runs the commander app.

 Note

To configure the host port for the RedisInsightResource chain a call to the WithHostPort API and provide the desired port number.

Add Redis resource with Redis Commander
To add the Redis Commander to the Redis resource, call the WithRedisCommander method:

C#

Copy
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache")
                   .WithRedisCommander();

builder.AddProject<Projects.ExampleProject>()
       .WithReference(cache);

// After adding all resources, run the app...
Redis Commander is a Node.js web application used to view, edit, and manage a Redis Database. .NET Aspire adds another container image docker.io/rediscommander/redis-commander to the AppHost that runs the commander app.

 Tip

To configure the host port for the RedisCommanderResource chain a call to the WithHostPort API and provide the desired port number.

Add Redis resource with data volume
To add a data volume to the Redis resource, call the WithDataVolume method on the Redis resource:

C#

Copy
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache")
                   .WithDataVolume(isReadOnly: false);

builder.AddProject<Projects.ExampleProject>()
       .WithReference(cache);

// After adding all resources, run the app...
The data volume is used to persist the Redis data outside the lifecycle of its container. The data volume is mounted at the /data path in the Redis container and when a name parameter isn't provided, the name is generated at random. For more information on data volumes and details on why they're preferred over bind mounts, see Docker docs: Volumes.

Add Redis resource with data bind mount
To add a data bind mount to the Redis resource, call the WithDataBindMount method:

C#

Copy
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache")
                   .WithDataBindMount(
                       source: @"C:\Redis\Data",
                       isReadOnly: false);

builder.AddProject<Projects.ExampleProject>()
       .WithReference(cache);

// After adding all resources, run the app...
 Important

Data bind mounts have limited functionality compared to volumes, which offer better performance, portability, and security, making them more suitable for production environments. However, bind mounts allow direct access and modification of files on the host system, ideal for development and testing where real-time changes are needed.

Data bind mounts rely on the host machine's filesystem to persist the Redis data across container restarts. The data bind mount is mounted at the C:\Redis\Data on Windows (or /Redis/Data on Unix) path on the host machine in the Redis container. For more information on data bind mounts, see Docker docs: Bind mounts.

Add Redis resource with persistence
To add persistence to the Redis resource, call the WithPersistence method with either the data volume or data bind mount:

C#

Copy
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache")
                   .WithDataVolume()
                   .WithPersistence(
                       interval: TimeSpan.FromMinutes(5),
                       keysChangedThreshold: 100);

builder.AddProject<Projects.ExampleProject>()
       .WithReference(cache);

// After adding all resources, run the app...
The preceding code adds persistence to the Redis resource by taking snapshots of the Redis data at a specified interval and threshold. The interval is time between snapshot exports and the keysChangedThreshold is the number of key change operations required to trigger a snapshot. For more information on persistence, see Redis docs: Persistence.

Hosting integration health checks
The Redis hosting integration automatically adds a health check for the appropriate resource type. The health check verifies that the server is running and that a connection can be established to it.

The hosting integration relies on the 📦 AspNetCore.HealthChecks.Redis NuGet package.

Client integration
To get started with the .NET Aspire Redis distributed caching integration, install the 📦 Aspire.StackExchange.Redis.DistributedCaching NuGet package in the client-consuming project, i.e., the project for the application that uses the Redis distributed caching client. The Redis client integration registers an IDistributedCache instance that you can use to interact with Redis.

.NET CLI
PackageReference
.NET CLI

Copy
dotnet add package Aspire.StackExchange.Redis.DistributedCaching
Add Redis client
In the Program.cs file of your client-consuming project, call the AddRedisDistributedCache extension to register the required services for distributed caching and add a IDistributedCache for use via the dependency injection container.

C#

Copy
builder.AddRedisDistributedCache(connectionName: "cache");
 Tip

The connectionName parameter must match the name used when adding the Redis resource in the AppHost project. For more information, see Add Redis resource.

You can then retrieve the IDistributedCache instance using dependency injection. For example, to retrieve the cache from a service:

C#

Copy
public class ExampleService(IDistributedCache cache)
{
    // Use cache...
}
For more information on dependency injection, see .NET dependency injection.

Add keyed Redis client
Due to its limitations, you cannot register multiple IDistributedCache instances simultaneously. However, there may be scenarios where you need to register multiple Redis clients and use a specific IDistributedCache instance for a particular connection name. To register a keyed Redis client that will be used for the IDistributedCache service, call the AddKeyedRedisDistributedCache method:

C#

Copy
builder.AddKeyedRedisClient(name: "chat");
builder.AddKeyedRedisDistributedCache(name: "product");
Then you can retrieve the IDistributedCache instance using dependency injection. For example, to retrieve the connection from an example service:

C#

Copy
public class ExampleService(
    [FromKeyedServices("chat")] IConnectionMultiplexer chatConnectionMux,
    IDistributedCache productCache)
{
    // Use product cache...
}
For more information on keyed services, see .NET dependency injection: Keyed services.

Configuration
The .NET Aspire Redis distributed caching integration provides multiple options to configure the Redis connection based on the requirements and conventions of your project.

Use a connection string
When using a connection string from the ConnectionStrings configuration section, you can provide the name of the connection string when calling builder.AddRedisDistributedCache:

C#

Copy
builder.AddRedisDistributedCache("cache");
And then the connection string will be retrieved from the ConnectionStrings configuration section:

JSON

Copy
{
  "ConnectionStrings": {
    "cache": "localhost:6379"
  }
}
For more information on how to format this connection string, see the Stack Exchange Redis configuration docs.

Use configuration providers
The .NET Aspire Stack Exchange Redis distributed caching integration supports Microsoft.Extensions.Configuration. It loads the StackExchangeRedisSettings from configuration by using the Aspire:StackExchange:Redis key. Example appsettings.json that configures some of the options:

JSON

Copy
{
  "Aspire": {
    "StackExchange": {
      "Redis": {
        "ConfigurationOptions": {
          "ConnectTimeout": 3000,
          "ConnectRetry": 2
        },
        "DisableHealthChecks": true,
        "DisableTracing": false
      }
    }
  }
}
For the complete Redis distributed caching client integration JSON schema, see Aspire.StackExchange.Redis.DistributedCaching/ConfigurationSchema.json.

Use inline delegates
You can also pass the Action<StackExchangeRedisSettings> delegate to set up some or all the options inline, for example to configure DisableTracing:

C#

Copy
builder.AddRedisDistributedCache(
    "cache",
    settings => settings.DisableTracing = true);
You can also set up the ConfigurationOptions using the Action<ConfigurationOptions> configureOptions delegate parameter of the AddRedisDistributedCache method. For example to set the connection timeout:

C#

Copy
builder.AddRedisDistributedCache(
    "cache",
     null,
     static options => options.ConnectTimeout = 3_000);
Client integration health checks
By default, .NET Aspire client integrations have health checks enabled for all services. Similarly, many .NET Aspire hosting integrations also enable health check endpoints. For more information, see:

.NET app health checks in C#
Health checks in ASP.NET Core
The .NET Aspire Redis distributed caching integration handles the following:

Adds the health check when StackExchangeRedisSettings.DisableHealthChecks is false, which attempts to connect to the container instance.
Integrates with the /health HTTP endpoint, which specifies all registered health checks must pass for app to be considered ready to accept traffic.
Observability and telemetry
.NET Aspire integrations automatically set up Logging, Tracing, and Metrics configurations, which are sometimes known as the pillars of observability. For more information about integration observability and telemetry, see .NET Aspire integrations overview. Depending on the backing service, some integrations may only support some of these features. For example, some integrations support logging and tracing, but not metrics. Telemetry features can also be disabled using the techniques presented in the Configuration section.

Logging
The .NET Aspire Redis distributed caching integration uses the following Log categories:

Aspire.StackExchange.Redis
Microsoft.Extensions.Caching.StackExchangeRedis
Tracing
The .NET Aspire Redis distributed caching integration will emit the following Tracing activities using OpenTelemetry:

OpenTelemetry.Instrumentation.StackExchangeRedis
Metrics
The .NET Aspire Redis Distributed caching integration currently doesn't support metrics by default due to limitations with the StackExchange.Redis library.

See also
Stack Exchange Redis docs
.NET Aspire integrations
.NET Aspire GitHub repo
*: Redis is a registered trademark of Redis Ltd. Any rights therein are reserved to Redis Ltd. Any use by Microsoft is for referential purposes only and does not indicate any sponsorship, endorsement or affiliation between Redis and Microsoft. Return to top?

