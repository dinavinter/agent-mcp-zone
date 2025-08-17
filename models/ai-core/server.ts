import { Application, Router, Context } from "https://deno.land/x/oak@v13.2.5/mod.ts";
import { getConfig, validateConfig, Config } from "./config.ts";
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible';
import { generateText } from 'npm:ai';

interface TokenInfo {
  access_token: string;
  expires_at: number;
}

interface Deployment {
  id: string;
  name: string;
}

class AICoreProxy {
  private tokenInfo: TokenInfo | null = null;
  private deployments: Deployment[] = [];
  public config: Config;

  constructor() {
    this.config = getConfig();
    
    // Validate configuration
    const errors = validateConfig(this.config);
    if (errors.length > 0) {
      console.error("❌ Configuration errors:");
      errors.forEach(error => console.error(`  - ${error}`));
      throw new Error("Invalid configuration");
    }
    
    console.log("✅ Configuration validated");
  }

  private async getToken(): Promise<string> {
    // Check if token exists and is not expired (with a 60-second buffer)
    if (
      this.tokenInfo &&
      this.tokenInfo.expires_at > (Date.now() + 60000)
    ) {
      return this.tokenInfo.access_token;
    }

    console.log("Authenticating with SAP AI Core...");

    const tokenUrl = `${this.config.authUrl.replace(/\/$/, "")}/oauth/token`;
    const payload = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in * 1000);
    
    this.tokenInfo = {
      access_token: data.access_token,
      expires_at: expiresAt,
    };

    console.log("✅ Authentication successful.");
    return this.tokenInfo.access_token;
  }

  private async getDeployments(): Promise<Deployment[]> {
    // Return cached deployments if available
    if (this.deployments.length > 0) {
      return this.deployments;
    }

    console.log("Fetching deployments from SAP AI Core...");
    const token = await this.getToken();
    const headers = {
      "Authorization": `Bearer ${token}`,
      "AI-Resource-Group": this.config.resourceGroup,
    };

    const url = `${this.config.baseUrl.replace(/\/$/, "")}/v2/lm/deployments?$top=1000`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch deployments: ${response.statusText}`);
    }

    const data = await response.json();
    const apiDeployments = data.resources || [];

    // Filter for running deployments and format them
    const formattedDeployments: Deployment[] = [];
    for (const dep of apiDeployments) {
      if (dep.targetStatus === "RUNNING") {
        try {
          const modelName = dep.details?.resources?.backend_details?.model?.name;
          const deploymentId = dep.id;
          if (modelName && deploymentId) {
            formattedDeployments.push({
              id: deploymentId,
              name: modelName,
            });
          }
        } catch (error: unknown) {
          console.warn(`Warning: Skipping deployment ${dep.id} due to unexpected data structure.`);
          continue;
        }
      }
    }

    this.deployments = formattedDeployments;
    console.log(`✅ Found ${this.deployments.length} running deployments.`);
    return this.deployments;
  }

  private getDeploymentIdForModel(modelName: string): string {
    const deployment = this.deployments.find(dep => dep.name === modelName);
    if (!deployment) {
      throw new Error(`No running deployment found for model '${modelName}'`);
    }
    return deployment.id;
  }

  // API Routes
  async getModels(ctx: Context) {
  try {
    console.log("📋 === GET MODELS REQUEST START ===");
    console.log("📨 Request headers:", Object.fromEntries(ctx.request.headers.entries()));
    console.log("🌐 Request URL:", ctx.request.url.toString());
    console.log("🔍 Request method:", ctx.request.method);

    // Configuration is already validated in constructor

    const deployments = await this.getDeployments();
    const models = deployments.map(dep => ({
      id: dep.name,
      object: "model",
      created: Math.floor(Date.now() / 1000), // Unix timestamp
      owned_by: "ai-core"
    }));

    console.log("📋 Models found:", models.length);
    console.log("📋 Models:", JSON.stringify(models, null, 2));

    // OpenAI-compatible response format
    ctx.response.body = {
      object: "list",
      data: models
    };
    console.log("✅ === GET MODELS REQUEST END ===");
  } catch (error: unknown) {
    console.error("❌ Error fetching models:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    ctx.response.status = 500;
    ctx.response.body = { error: `Connection Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

  async chatCompletion(ctx: Context) {
    try {
      console.log("🚀 === CHAT COMPLETION REQUEST START ===");
      console.log("📨 Request headers:", Object.fromEntries(ctx.request.headers.entries()));
      console.log("🌐 Request URL:", ctx.request.url.toString());
      console.log("🔍 Request method:", ctx.request.method);
      
      const body = await ctx.request.body.json();
      console.log("📦 Request body:", JSON.stringify(body, null, 2));
      
      const token = await this.getToken();
      
      // Extract model name from the request
      const rawModelId = body.model || "";
      // For AI Core, we use the full model name as is
      const modelId = rawModelId;
      console.log("🔍 Chat completion request:");
      console.log("Raw model ID:", rawModelId);
      console.log("Model ID:", modelId);
      const deploymentId = this.getDeploymentIdForModel(modelId);
      console.log("Deployment ID:", deploymentId);
      const messages = body.messages || [];
      console.log("💬 Messages count:", messages.length);
      console.log("💬 Messages:", JSON.stringify(messages, null, 2));

      // Build request parameters
      const { url, payload } = this.buildRequestParams(
        this.config.baseUrl,
        deploymentId,
        modelId,
        messages,
        body
      );

      const headers = {
        "Authorization": `Bearer ${token}`,
        "AI-Resource-Group": this.config.resourceGroup,
        "Content-Type": "application/json",
      };

      // Debug: Log the request details
      console.log("🔍 Making request to AI Core:");
      console.log("URL:", url);
      console.log("Headers:", JSON.stringify(headers, null, 2));
      console.log("Payload:", JSON.stringify(payload, null, 2));

      // Make streaming request to AI Core
      console.log("📡 Sending request to AI Core...");
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      console.log("📥 AI Core response status:", response.status);
      console.log("📥 AI Core response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ AI Core API error response:", errorText);
        throw new Error(`AI Core API error: ${response.statusText} - ${errorText}`);
      }

      // Check if this is a streaming request
      const isStreaming = body.stream === true;
      console.log("🌊 Is streaming request:", isStreaming);

      if (isStreaming) {
        console.log("🌊 Setting up streaming response...");
        ctx.response.headers.set("Content-Type", "text/event-stream");
        ctx.response.headers.set("Cache-Control", "no-cache");
        ctx.response.headers.set("Connection", "keep-alive");
        
        // Stream the response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body reader available");
        }

        console.log("🌊 Starting to stream response...");
        const encoder = new TextEncoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("✅ Streaming completed");
            break;
          }
          
          const chunk = new TextDecoder().decode(value);
          console.log("📄 Raw chunk:", chunk);
          
          // Send the chunk to the client
          ctx.response.body = encoder.encode(chunk);
        }
             } else {
         // Non-streaming response - convert to OpenAI format
         ctx.response.headers.set("Content-Type", "application/json");
         
         // Read the response as text first to see what we're getting
         const responseText = await response.text();
         console.log("📥 AI Core response:", responseText);
         
         try {
           // Parse the streaming response to extract the actual content
           const lines = responseText.split('\n');
           let extractedContent = '';
           
           for (const line of lines) {
             if (line.startsWith('data: ')) {
               const data = line.slice(6);
               if (data === '[DONE]') break;
               
               try {
                 const parsed = JSON.parse(data);
                 if (parsed.choices?.[0]?.delta?.content) {
                   extractedContent += parsed.choices[0].delta.content;
                 }
               } catch (e) {
                 // Ignore parsing errors
               }
             }
           }
           
           // Convert to OpenAI-compatible format
           const openAIResponse = {
             id: `chatcmpl-${Date.now()}`,
             object: "chat.completion",
             created: Math.floor(Date.now() / 1000),
             model: modelId,
             choices: [{
               message: {
                 role: "assistant",
                 content: extractedContent || "No response content"
               },
               finish_reason: "stop",
               index: 0
             }],
             usage: {
               prompt_tokens: 0,
               completion_tokens: 0,
               total_tokens: 0
             }
           };
           
           ctx.response.body = openAIResponse;
         } catch (error) {
           // Fallback response
           ctx.response.body = {
             id: `chatcmpl-${Date.now()}`,
             object: "chat.completion",
             created: Math.floor(Date.now() / 1000),
             model: modelId,
             choices: [{
               message: {
                 role: "assistant",
                 content: "Error processing response"
               },
               finish_reason: "stop",
               index: 0
             }],
             usage: {
               prompt_tokens: 0,
               completion_tokens: 0,
               total_tokens: 0
             }
           };
         }
       }

      console.log("✅ === CHAT COMPLETION REQUEST END ===");

    } catch (error: unknown) {
      console.error("❌ Error during chat completion:", error);
      console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
      ctx.response.status = 500;
      ctx.response.body = { error: `Error during model inference: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private buildRequestParams(
    baseUrl: string,
    deploymentId: string,
    modelId: string,
    messages: any[],
    body: any
  ): { url: string; payload: any } {
    // Convert messages to OpenAI format
    const openaiMessages = messages
      .filter((msg: any) => msg.role !== "system")
      .map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));

    const systemPrompt = messages.find((msg: any) => msg.role === "system")?.content;

    // Classify models
    const isOpenAIFamily = /gpt-|o1|o3|o4/.test(modelId);
    const isAnthropicFamily = /anthropic--|claude/.test(modelId);
    const isGeminiFamily = /gemini/.test(modelId);

    // OpenAI-compatible models
    if (isOpenAIFamily) {
      const url = `${baseUrl.replace(/\/$/, "")}/v2/inference/deployments/${deploymentId}/chat/completions?api-version=2024-12-01-preview`;
      const payload: any = {
        messages: systemPrompt 
          ? [{ role: "system", content: systemPrompt }, ...openaiMessages]
          : openaiMessages,
        stream: true,
      };

      if (!["o1", "o3-mini", "o3", "o4-mini"].includes(modelId)) {
        payload.max_tokens = body.max_tokens || this.config.maxTokens;
        payload.temperature = body.temperature || this.config.temperature;
      }

      return { url, payload };
    }

    // Anthropic models
    if (isAnthropicFamily) {
      if (/3\.5|3\.7|4/.test(modelId)) {
        const url = `${baseUrl.replace(/\/$/, "")}/v2/inference/deployments/${deploymentId}/converse-stream`;
        const payload = {
          system: systemPrompt ? [{ text: systemPrompt }] : [],
          messages: openaiMessages.map((msg: any) => ({
            role: msg.role,
            content: [{ text: msg.content }],
          })),
          inference_config: {
            max_tokens: body.max_tokens || this.config.maxTokens,
            temperature: body.temperature || this.config.temperature,
          },
        };
        return { url, payload };
      } else {
        const url = `${baseUrl.replace(/\/$/, "")}/v2/inference/deployments/${deploymentId}/invoke-with-response-stream`;
        const payload = {
          system: systemPrompt,
          messages: openaiMessages,
          max_tokens: body.max_tokens || this.config.maxTokens,
          anthropic_version: "bedrock-2023-05-31",
        };
        return { url, payload };
      }
    }

    // Gemini models
    if (isGeminiFamily) {
      const url = `${baseUrl.replace(/\/$/, "")}/v2/inference/deployments/${deploymentId}/models/${modelId}:streamGenerateContent`;
      const payload = {
        contents: openaiMessages.map((msg: any) => ({
          role: msg.role !== "assistant" ? "user" : "model",
          parts: [{ text: msg.content }],
        })),
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generation_config: {
          max_output_tokens: body.max_tokens || this.config.maxTokens,
          temperature: body.temperature || this.config.temperature,
        },
      };
      return { url, payload };
    }

    // Default to OpenAI format
    console.warn(`Model '${modelId}' not specifically classified. Defaulting to OpenAI-compatible API format.`);
    const url = `${baseUrl.replace(/\/$/, "")}/v2/inference/deployments/${deploymentId}/chat/completions?api-version=2024-12-01-preview`;
    const payload = {
      messages: systemPrompt 
        ? [{ role: "system", content: systemPrompt }, ...openaiMessages]
        : openaiMessages,
      stream: this.config.stream,
      max_tokens: body.max_tokens || this.config.maxTokens,
      temperature: body.temperature || this.config.temperature,
    };
    return { url, payload };
  }

  private parseStreamResponse(data: any, modelId: string): string | null {
    const isOpenAIFamily = /gpt-|o1|o3|o4/.test(modelId);
    const isAnthropicFamily = /anthropic--|claude/.test(modelId);
    const isGeminiFamily = /gemini/.test(modelId);

    // OpenAI Parser
    if (isOpenAIFamily || (!isAnthropicFamily && !isGeminiFamily)) {
      const choices = data.choices || [];
      if (choices.length > 0) {
        const delta = choices[0].delta || {};
        if (delta.content !== undefined && delta.content !== null) {
          return delta.content;
        }
      }
    }

    // Anthropic Parser
    if (isAnthropicFamily) {
      if (data.type === "content_block_start" || data.type === "content_block_delta") {
        const contentBlock = data.content_block || data.delta || {};
        if (contentBlock.type === "text_delta" || contentBlock.type === "text") {
          return contentBlock.text || "";
        }
      } else if (data.contentBlockDelta) {
        const delta = data.contentBlockDelta.delta || {};
        if (delta.text !== undefined) {
          return delta.text;
        }
      }
    }

    // Gemini Parser
    if (isGeminiFamily) {
      const candidates = data.candidates || [];
      if (candidates.length > 0 && candidates[0].content) {
        const parts = candidates[0].content.parts || [];
        if (parts.length > 0 && parts[0].text !== undefined) {
          return parts[0].text;
        }
      }
    }

    return null;
  }
}

// Create router and application
const router = new Router();
const app = new Application();
const aiCoreProxy = new AICoreProxy();

// Health check endpoint
router.get("/health", (ctx) => {
  ctx.response.body = { status: "ok", service: "ai-core-proxy" };
});

// Get available models (OpenAI-compatible)
router.get("/v1/models", (ctx) => aiCoreProxy.getModels(ctx));
router.get("/models", (ctx) => aiCoreProxy.getModels(ctx)); // Keep original for backward compatibility

// Chat completion endpoint (OpenAI-compatible)
router.post("/v1/chat/completions", (ctx) => aiCoreProxy.chatCompletion(ctx));
router.post("/chat/completions", (ctx) => aiCoreProxy.chatCompletion(ctx)); // Keep original for backward compatibility

// Serve the HTML interface
router.get("/", async (ctx) => {
  try {
    const html = await Deno.readTextFile("./index.html");
    ctx.response.headers.set("Content-Type", "text/html");
    ctx.response.body = html;
  } catch (error) {
    ctx.response.status = 404;
    ctx.response.body = "HTML interface not found";
  }
});

router.get("/test-with-vercel-ai", async (ctx) => {
  
});

// Use router
app.use(router.routes());
app.use(router.allowedMethods());

// Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Start server
console.log(`🚀 AI Core Proxy server starting on port ${aiCoreProxy.config.port}...`);

await app.listen({ port: parseInt(Deno.env.get("PORT") || "3002") });
