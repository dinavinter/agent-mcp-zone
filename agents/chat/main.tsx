import {StreamableHTTPClientTransport} from "npm:@modelcontextprotocol/sdk/client/streamableHttp.js";
import {experimental_createMCPClient as createMcpClient} from "npm:ai";
import {Hono} from "npm:hono";
import {streamText} from 'npm:hono/streaming'

const app = new Hono();

// AI Core configuration from environment variables
const AI_CORE_CONFIG = {
    CLIENT_ID: Deno.env.get("AI_CORE_CLIENT_ID") || "99a49c91-c0af-477b-89ff-5d180b7f401d!b1328962|xsuaa_std!b318061",
    CLIENT_SECRET: Deno.env.get("AI_CORE_CLIENT_SECRET") || "",
    AUTH_URL: Deno.env.get("AI_CORE_AUTH_URL") || "",
    BASE_URL: Deno.env.get("AI_CORE_BASE_URL") || "",
    RESOURCE_GROUP: Deno.env.get("AI_CORE_RESOURCE_GROUP") || "default"
};

// Helper function to get AI Core access token
async function getAICoreAccessToken() {
    if (!AI_CORE_CONFIG.CLIENT_ID || !AI_CORE_CONFIG.CLIENT_SECRET || !AI_CORE_CONFIG.AUTH_URL) {
        throw new Error("AI Core configuration is incomplete. Please check environment variables.");
    }

    const tokenUrl = `${AI_CORE_CONFIG.AUTH_URL}/oauth/token`;
    const credentials = btoa(`${AI_CORE_CONFIG.CLIENT_ID}:${AI_CORE_CONFIG.CLIENT_SECRET}`);
    
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    
    if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }
    
    const tokenData = await response.json();
    return tokenData.access_token;
}

// Helper function to get available deployments
async function getAICoreDeployments() {
    const token = await getAICoreAccessToken();
    
    const response = await fetch(`${AI_CORE_CONFIG.BASE_URL}/v2/lm/deployments?$top=1000`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'AI-Resource-Group': AI_CORE_CONFIG.RESOURCE_GROUP,
        },
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Available deployments:", JSON.stringify(data, null, 2));
    
    // Filter for running deployments and format them
    const formattedDeployments = [];
    for (const dep of data.resources || []) {
        if (dep.targetStatus === "RUNNING") {
            try {
                const modelName = dep.details?.resources?.backend_details?.model?.name;
                const deploymentId = dep.id;
                if (modelName && deploymentId) {
                    formattedDeployments.push({
                        id: deploymentId,
                        name: modelName
                    });
                }
            } catch (error) {
                console.warn(`Warning: Skipping deployment ${dep.id} due to unexpected data structure.`);
                continue;
            }
        }
    }
    
    return formattedDeployments;
}

// Direct AI Core chat completion
async function* streamAICoreResponse(prompt: string, tools: any[] = [], modelName?: string, mcpClient?: any) {
    const token = await getAICoreAccessToken();
    
    // Get available deployments
    const deployments = await getAICoreDeployments();
    
    // Find the deployment for the specified model or use a GPT model by default
    let deployment = deployments.find(d => d.name.includes('gpt-')) || deployments[0];
    if (modelName) {
        deployment = deployments.find(d => d.name === modelName) || deployment;
    }
    
    if (!deployment) {
        throw new Error("No deployments found in AI Core");
    }
    
    console.log("Using deployment:", deployment.id, "for model:", deployment.name);
    
    const messages = [{ role: 'user', content: prompt }];
    const body: any = {
        model: deployment.id,
        messages,
        stream: true,
    };
    
    if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
    }
    
    const response = await fetch(`${AI_CORE_CONFIG.BASE_URL}/v2/inference/deployments/${deployment.id}/chat/completions?api-version=2024-12-01-preview`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'AI-Resource-Group': AI_CORE_CONFIG.RESOURCE_GROUP,
        },
        body: JSON.stringify(body),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Core API error response:", errorText);
        throw new Error(`AI Core API error: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') return;
                
                try {
                    const parsed = JSON.parse(data);
                    
                    // Handle tool calls
                    if (parsed.choices?.[0]?.delta?.tool_calls && mcpClient) {
                        const toolCall = parsed.choices[0].delta.tool_calls[0];
                        if (toolCall) {
                            console.log("Tool call detected:", toolCall);
                            
                            // Execute the tool call
                            try {
                                const toolName = toolCall.function?.name;
                                const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
                                
                                console.log(`Executing tool: ${toolName} with args:`, toolArgs);
                                
                                // Call the MCP tool
                                const result = await mcpClient.callTool(toolName, toolArgs);
                                console.log("Tool result:", result);
                                
                                yield `\n[Tool ${toolName} executed successfully]\n`;
                                
                            } catch (toolError) {
                                console.error("Tool execution error:", toolError);
                                yield `\n[Tool execution failed: ${toolError}]\n`;
                            }
                        }
                    }
                    
                    // Handle content
                    if (parsed.choices?.[0]?.delta?.content) {
                        yield parsed.choices[0].delta.content;
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }
        }
    }
}

// API endpoints
app.post("/api/chat", async (c) => {
    let body;
    const contentType = c.req.header("content-type") || "";
    
    console.log("Content-Type:", contentType);
    
    if (contentType.includes("application/json")) {
        try {
            body = await c.req.json();
        } catch {
            return c.json({ error: "Invalid JSON" }, 400);
        }
    } else {
        // Handle form data
        try {
            const formData = await c.req.parseBody();
            console.log("Form data received:", formData);
            body = {
                prompt: formData.prompt || "",
                mcpServerUrl: formData.mcpServerUrl || "",
                model: formData.model || ""
            };
            console.log("Parsed body:", body);
        } catch (error) {
            console.error("Form data parsing error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return c.json({ error: "Invalid form data", details: errorMessage }, 400);
        }
    }
    
    const { prompt, mcpServerUrl, model } = body;

    if (!prompt) {
        return c.json({ error: "Prompt is required" }, 400);
    }

    try {
        let tools: any[] = [];
        
        let mcpClient: any = null;
        
        // Connect to MCP server if URL is provided
        if (mcpServerUrl) {
            try {
                console.log("Connecting to MCP server:", mcpServerUrl);
                mcpClient = await createMcpClient({
                    transport: new StreamableHTTPClientTransport(new URL(mcpServerUrl)),
                });
                const mcpTools = await mcpClient.tools();
                console.log("Raw MCP tools:", JSON.stringify(mcpTools, null, 2));
                
                // Convert MCP tools to AI Core compatible format
                tools = Object.values(mcpTools).map((tool: any) => {
                    console.log("Processing tool:", tool);
                    
                    // Extract tool name from description or use a default
                    const toolName = tool.name || 
                                   (tool.description ? tool.description.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '_') : "unknown_tool");
                    
                    // Get parameters schema
                    let parameters = {
                        type: "object",
                        properties: {},
                        required: []
                    };
                    
                    if (tool.inputSchema?.jsonSchema) {
                        parameters = tool.inputSchema.jsonSchema;
                    } else if (tool.inputSchema?.properties) {
                        parameters = {
                            type: "object",
                            properties: tool.inputSchema.properties,
                            required: tool.inputSchema.required || []
                        };
                    }
                    
                    return {
                        type: "function",
                        function: {
                            name: toolName,
                            description: tool.description || "MCP tool",
                            parameters: parameters
                        }
                    };
                });
                console.log("Converted tools:", JSON.stringify(tools, null, 2));
                console.log("Available MCP tools:", tools.length);
            } catch (error) {
                console.error("MCP server connection error:", error);
                // Continue without MCP tools if connection fails
                tools = [];
            }
        }

        return streamText(c, async (stream) => {
            try {
                for await (const chunk of streamAICoreResponse(prompt, tools, model, mcpClient)) {
                    stream.write(chunk);
                }
                console.log("Streaming complete.");
            } catch (error) {
                console.error("Error streaming response:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                stream.write(`Error: ${errorMessage}`);
            }
        });
    } catch (error) {
        console.error("Error in chat endpoint:", error);
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
});

app.get("/api/deployments", async (c) => {
    try {
        const deployments = await getAICoreDeployments();
        return c.json({ deployments });
    } catch (error) {
        console.error("Error fetching deployments:", error);
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
});

app.get("/api/health", async (c) => {
    try {
        await getAICoreAccessToken();
        return c.json({ status: "healthy", provider: "SAP AI Core" });
    } catch (error) {
        return c.json({ status: "unhealthy", error: error instanceof Error ? error.message : String(error) }, 500);
    }
});

// Simple web UI
app.get("/", (c) =>
    c.html(`
<!DOCTYPE html>
<html>
<head>
    <title>AI Core MCP Client</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/htmx.org@1.9.9"></script>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen">
        <div class="max-w-4xl mx-auto p-6">
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">AI Core MCP Client</h1>
                <p class="text-gray-600">SAP AI Core integration with MCP tools</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Chat Interface -->
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h2 class="text-xl font-semibold mb-4">Chat Interface</h2>
                    
                    <form hx-post="/api/chat" hx-target="#response" hx-swap="innerHTML" hx-trigger="submit">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">MCP Server URL</label>
                            <input
                                name="mcpServerUrl"
                                type="text"
                                value="${Deno.env.get("MCP_SERVER_URL") || ""}"
                                placeholder="https://your-mcp-server.com/mcp"
                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Model (optional)</label>
                            <select
                                name="model"
                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Auto-select first available</option>
                            </select>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
                            <textarea 
                                name="prompt" 
                                rows="4" 
                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                placeholder="Enter your prompt here..."
                                required
                            ></textarea>
                        </div>
                        
                        <button 
                            type="submit" 
                            class="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                            Send to AI Core
                        </button>
                    </form>
                </div>

                <!-- Response Area -->
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h2 class="text-xl font-semibold mb-4">Response</h2>
                    <div id="response" class="min-h-[300px] p-4 bg-gray-50 rounded-lg border">
                        <p class="text-gray-500">Response will appear here...</p>
                    </div>
                </div>
            </div>

            <!-- Status Section -->
            <div class="mt-6 bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-xl font-semibold mb-4">System Status</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 class="font-medium text-green-800">AI Core Connection</h3>
                        <div id="ai-core-status" class="text-sm text-green-600">Checking...</div>
                    </div>
                    <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 class="font-medium text-blue-800">MCP Server</h3>
                        <div id="mcp-status" class="text-sm text-blue-600">Not connected</div>
                    </div>
                    <div class="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h3 class="font-medium text-purple-800">Available Models</h3>
                        <div id="models-status" class="text-sm text-purple-600">Loading...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Check system status on page load
        document.addEventListener('DOMContentLoaded', function() {
            // Check AI Core health
            fetch('/api/health')
                .then(response => response.json())
                .then(data => {
                    const statusEl = document.getElementById('ai-core-status');
                    if (data.status === 'healthy') {
                        statusEl.textContent = 'Connected';
                        statusEl.className = 'text-sm text-green-600';
                    } else {
                        statusEl.textContent = 'Error: ' + data.error;
                        statusEl.className = 'text-sm text-red-600';
                    }
                })
                .catch(error => {
                    document.getElementById('ai-core-status').textContent = 'Connection failed';
                    document.getElementById('ai-core-status').className = 'text-sm text-red-600';
                });

            // Load available models
            fetch('/api/deployments')
                .then(response => response.json())
                .then(data => {
                    const modelsEl = document.getElementById('models-status');
                    if (data.deployments && data.deployments.length > 0) {
                        modelsEl.textContent = data.deployments.length + ' models available';
                    } else {
                        modelsEl.textContent = 'No models found';
                    }
                })
                .catch(error => {
                    document.getElementById('models-status').textContent = 'Failed to load';
                });
        });
    </script>
</body>
</html>
    `)
);

const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT") || "3000") : 3000;
Deno.serve({ port }, app.fetch);
