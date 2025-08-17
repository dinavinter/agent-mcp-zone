import { Hono } from "npm:hono";
import { streamText } from "npm:ai";
import { createOpenAICompatible   } from 'npm:@ai-sdk/openai-compatible';
import {streamText as streanTextResponse} from 'npm:hono/streaming'


const app = new Hono();

// Get AI Core proxy URL from environment (OpenAI-compatible)
const AI_CORE_PROXY_URL = Deno.env.get("AI_CORE_PROXY_URL") || "http://localhost:3002";
const AI_CORE_OPENAI_URL = `${AI_CORE_PROXY_URL}/v1`; // OpenAI-compatible endpoint

// Function to start the AI Core proxy server
async function startAICoreServer() {
  console.log("🚀 Starting AI Core proxy server...");
  
  try {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-net",
        "--allow-env", 
        "--allow-read",
        "--env-file=.env",
        "server.ts"
      ],
      cwd: Deno.cwd(),
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();
    
    // Wait a bit for the server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("✅ AI Core proxy server started");
    return process;
  } catch (error) {
    console.error("❌ Failed to start AI Core proxy server:", error);
    throw error;
  }
}

// Start the server when this script runs
let serverProcess: Deno.ChildProcess | null = null;

// Create OpenAI-compatible client with debugging
console.log("🔧 Creating OpenAI-compatible client with:");
console.log("  - Base URL:", AI_CORE_OPENAI_URL);
console.log("  - Name: ai-core");

const aiCoreClient = createOpenAICompatible({
  name: "ai-core",
  baseURL: AI_CORE_OPENAI_URL,
  apiKey: "dummy-key", // Not used by our proxy
});

console.log("✅ OpenAI-compatible client created:", aiCoreClient);

// Test the URL function to see what URLs it's generating
const testModel = aiCoreClient.chatModel("gpt-4.1");
console.log("🔗 Testing URL generation...");
console.log("  - Test model created:", testModel);
console.log("  - Model type:", typeof testModel);

// Note: We can't directly test the URL function due to internal implementation details
// The createOpenAICompatible library handles this internally when used with streamText

app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Core Proxy Test Client</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }

            .header {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }

            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 10px;
                font-weight: 700;
            }

            .header p {
                font-size: 1.1rem;
                opacity: 0.9;
            }

            .content {
                padding: 40px;
            }

            .section {
                margin-bottom: 40px;
                padding: 30px;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                background: #f9fafb;
            }

            .section h2 {
                color: #374151;
                margin-bottom: 20px;
                font-size: 1.5rem;
                font-weight: 600;
            }

            .status {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 0.875rem;
            }

            .status.healthy {
                background: #dcfce7;
                color: #166534;
            }

            .status.error {
                background: #fef2f2;
                color: #dc2626;
            }

            .status.loading {
                background: #fef3c7;
                color: #d97706;
            }

            .models-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }

            .model-card {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 20px;
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .model-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }

            .model-card.selected {
                border-color: #4f46e5;
                background: #f0f9ff;
            }

            .model-card h3 {
                color: #374151;
                margin-bottom: 10px;
                font-size: 1.1rem;
            }

            .model-card .model-id {
                color: #6b7280;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 0.875rem;
                background: #f3f4f6;
                padding: 4px 8px;
                border-radius: 4px;
            }

            .chat-section {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                padding: 30px;
            }

            .form-group {
                margin-bottom: 20px;
            }

            .form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #374151;
            }

            .form-group textarea,
            .form-group input {
                width: 100%;
                padding: 12px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 1rem;
                transition: border-color 0.2s ease;
            }

            .form-group textarea:focus,
            .form-group input:focus {
                outline: none;
                border-color: #4f46e5;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }

            .form-group textarea {
                min-height: 120px;
                resize: vertical;
            }

            .btn {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 10px 25px rgba(79, 70, 229, 0.3);
            }

            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }

            .response {
                margin-top: 20px;
                padding: 20px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                white-space: pre-wrap;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 0.875rem;
                max-height: 400px;
                overflow-y: auto;
            }

            .loading {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #4f46e5;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 10px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .error {
                color: #dc2626;
                background: #fef2f2;
                border: 1px solid #fecaca;
                padding: 12px;
                border-radius: 8px;
                margin-top: 10px;
            }

            .info {
                background: #dbeafe;
                border: 1px solid #93c5fd;
                padding: 12px;
                border-radius: 8px;
                margin-top: 10px;
                color: #1e40af;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧪 AI Core Proxy Test Client</h1>
                <p>Testing OpenAI compatibility with npm:ai and @ai-sdk/openai-compatible</p>
            </div>

            <div class="content">
                <!-- Connection Status -->
                <div class="section">
                    <h2>🔗 Connection Status</h2>
                    <div id="connectionStatus">
                        <span class="status loading">Checking...</span>
                    </div>
                    <div class="info">
                        <strong>AI Core Proxy URL:</strong> ${AI_CORE_PROXY_URL}
                    </div>
                </div>

                <!-- Available Models -->
                <div class="section">
                    <h2>📋 Available Models</h2>
                    <button class="btn" onclick="loadModels()">Refresh Models</button>
                    <div id="modelsContainer">
                        <p>Click "Refresh Models" to load available models</p>
                    </div>
                </div>

                <!-- Chat Interface -->
                <div class="chat-section">
                    <h2>💬 Test Chat with npm:ai</h2>
                    <form id="chatForm">
                        <div class="form-group">
                            <label for="systemMessage">System Message (optional):</label>
                            <textarea id="systemMessage" placeholder="You are a helpful assistant..."></textarea>
                        </div>

                        <div class="form-group">
                            <label for="userMessage">Your Message:</label>
                            <textarea id="userMessage" placeholder="Type your message here..." required></textarea>
                        </div>

                        <div class="form-group">
                            <label for="maxTokens">Max Tokens:</label>
                            <input type="number" id="maxTokens" value="1000" min="1" max="8192">
                        </div>

                        <div class="form-group">
                            <label for="temperature">Temperature:</label>
                            <input type="number" id="temperature" value="0.7" min="0" max="2" step="0.1">
                        </div>

                        <button type="submit" class="btn" id="sendBtn">
                            Send Message
                        </button>
                    </form>

                    <div id="responseContainer"></div>
                </div>
            </div>
        </div>

        <script>
            let selectedModel = null;
            const API_BASE = '';
            const AI_CORE_PROXY_URL = '${AI_CORE_PROXY_URL}';

            // Check connection status
            async function checkConnection() {
                try {
                    // First check if the test client is running
                    const clientResponse = await fetch(\`\${API_BASE}/health\`);
                    const clientData = await clientResponse.json();
                    
                    // Then check if the AI Core proxy is accessible
                    const proxyResponse = await fetch('/api/models');
                    
                    const statusEl = document.getElementById('connectionStatus');
                    if (clientResponse.ok && proxyResponse.ok) {
                        statusEl.innerHTML = \`<span class="status healthy">✅ Connected to \${clientData.service} and AI Core Proxy</span>\`;
                    } else {
                        statusEl.innerHTML = \`<span class="status error">❌ Connection Error</span>\`;
                    }
                } catch (error) {
                    document.getElementById('connectionStatus').innerHTML = 
                        \`<span class="status error">❌ Connection Failed: \${error.message}</span>\`;
                }
            }

            // Load available models
            async function loadModels() {
                const container = document.getElementById('modelsContainer');
                
                container.innerHTML = '<p>Loading models...</p>';
                
                try {
                    const response = await fetch('/api/models');
                    const data = await response.json();
                    
                    if (response.ok && (data.models || data.data)) {
                        // Handle both old format (data.models) and new OpenAI format (data.data)
                        const models = data.models || data.data || [];
                        
                        // Update models grid
                        container.innerHTML = \`
                            <div class="models-grid">
                                \${models.map(model => \`
                                    <div class="model-card" onclick="selectModel('\${model.id}')">
                                        <h3>\${model.name || model.id}</h3>
                                        <div class="model-id">\${model.id}</div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    } else {
                        container.innerHTML = \`<div class="error">Error loading models: \${data.error || 'Unknown error'}</div>\`;
                    }
                } catch (error) {
                    container.innerHTML = \`<div class="error">Failed to load models: \${error.message}</div>\`;
                }
            }

            // Select a model
            function selectModel(modelId) {
                selectedModel = modelId;
                
                // Update UI to show selected model
                document.querySelectorAll('.model-card').forEach(card => {
                    card.classList.remove('selected');
                });
                
                event.target.closest('.model-card').classList.add('selected');
                
                // Show selected model info
                document.getElementById('modelsContainer').innerHTML += \`
                    <div class="info" style="margin-top: 20px;">
                        <strong>Selected Model:</strong> \${modelId}
                    </div>
                \`;
            }

            // Send chat message using npm:ai
            async function sendMessage(event) {
                event.preventDefault();
                
                if (!selectedModel) {
                    alert('Please select a model first');
                    return;
                }
                
                const sendBtn = document.getElementById('sendBtn');
                const responseContainer = document.getElementById('responseContainer');
                
                const systemMessage = document.getElementById('systemMessage').value;
                const userMessage = document.getElementById('userMessage').value;
                const maxTokens = parseInt(document.getElementById('maxTokens').value);
                const temperature = parseFloat(document.getElementById('temperature').value);
                
                if (!userMessage) {
                    alert('Please enter a message');
                    return;
                }
                
                // Update UI
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<span class="loading"></span>Sending...';
                responseContainer.innerHTML = '<div class="response">Sending request...</div>';
                
                try {
                    // Use the npm:ai client to make the request
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: selectedModel,
                            systemMessage,
                            userMessage,
                            maxTokens,
                            temperature
                        })
                    });
                    
                    if (response.ok) {
                        // Handle streaming response
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let responseText = '';
                        
                        responseContainer.innerHTML = '<div class="response">Receiving response...</div>';
                        
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            
                            const chunk = decoder.decode(value);
                            responseText += chunk;
                            
                            // Update the response container with the accumulated text
                            responseContainer.innerHTML = \`<div class="response">\${responseText}</div>\`;
                        }
                    } else {
                        const errorData = await response.text();
                        responseContainer.innerHTML = \`<div class="error">Error: \${errorData}</div>\`;
                    }
                } catch (error) {
                    responseContainer.innerHTML = \`<div class="error">Request failed: \${error.message}</div>\`;
                } finally {
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = 'Send Message';
                }
            }

            // Event listeners
            document.getElementById('chatForm').addEventListener('submit', sendMessage);
            
            // Initialize
            checkConnection();
            loadModels();
            
            // Auto-refresh connection every 30 seconds
            setInterval(checkConnection, 30000);
        </script>
    </body>
    </html>
  `);
});

app.get("./models", async (c) => {
  const response = await fetch(`${AI_CORE_PROXY_URL}/v1/models`);
  const data = await response.json();
  return c.json(data);
});

// API endpoint for chat - direct call to AI Core proxy
app.post("/api/chat", (c) => streanTextResponse(c, async (stream) => {
  try {
    const { model, systemMessage, userMessage, maxTokens, temperature } = await c.req.json();

    console.log("🔍 Chat request received:", { model, systemMessage, userMessage, maxTokens, temperature });

    // Create messages array
    const messages: any[] = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: userMessage });

    console.log("📝 Messages array:", messages);

    // Direct call to AI Core proxy
    console.log("🚀 Making direct request to AI Core proxy...");
    const response = await fetch(`${AI_CORE_PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Core proxy error: ${response.status} - ${errorText}`);
    }

    console.log("✅ AI Core proxy response received, streaming to client...");
    
    // Stream the response directly to the client
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      console.log("📄 Streaming chunk to client:", chunk);
      stream.write(chunk);
    }
    
    console.log("✅ Streaming completed");
    
  } catch (error) {
    console.error("❌ Chat error:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    stream.write(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}))

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "ai-core-test-client" });
});

// Models endpoint
app.get("/api/models", async (c) => {
  try {
    const response = await fetch(`${AI_CORE_PROXY_URL}/models`);
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Debug endpoint to test createOpenAICompatible directly
app.get("/api/debug-client", async (c) => {
  try {
    console.log("🔍 Debug endpoint called");
    console.log("🔧 AI Core Client:", aiCoreClient);
    console.log("🔧 Client type:", typeof aiCoreClient);
    console.log("🔧 Client properties:", Object.getOwnPropertyNames(aiCoreClient));
    
    // Test creating a chat model
    const testModel = aiCoreClient.chatModel("gpt-4.1");
    console.log("🤖 Test chat model:", testModel);
    console.log("🤖 Test model type:", typeof testModel);
    console.log("🤖 Test model properties:", Object.getOwnPropertyNames(testModel));
    
    return c.json({
      client: {
        type: typeof aiCoreClient,
        properties: Object.getOwnPropertyNames(aiCoreClient)
      },
      testModel: {
        type: typeof testModel,
        properties: Object.getOwnPropertyNames(testModel)
      }
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

const port = parseInt(Deno.env.get("PORT") || "3003");

// Main startup function
async function main() {
  try {
    // Start the AI Core proxy server
    serverProcess = await startAICoreServer();
    
    console.log(`🚀 AI Core Test Client starting on port ${port}...`);
    console.log(`🔗 AI Core Proxy URL: ${AI_CORE_PROXY_URL}`);
    
    // Start the test client server
    Deno.serve({
      port: port
    }, app.fetch);
    
  } catch (error) {
    console.error("❌ Failed to start services:", error);
    Deno.exit(1);
  }
}

// Cleanup function
function cleanup() {
  console.log("🛑 Shutting down...");
  if (serverProcess) {
    serverProcess.kill();
  }
}

// Handle shutdown signals
Deno.addSignalListener("SIGINT", cleanup);
Deno.addSignalListener("SIGTERM", cleanup);

// Start the application
main();
