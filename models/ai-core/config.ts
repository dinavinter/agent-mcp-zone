// AI Core Proxy Configuration

export interface AICoreCredentials {
  appname?: string;
  clientid: string;
  clientsecret: string;
  "credential-type"?: string;
  identityzone?: string;
  identityzoneid?: string;
  serviceurls?: {
    AI_API_URL: string;
  };
  url: string;
}

export interface Config {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  baseUrl: string;
  resourceGroup: string;
  port: number;
  maxTokens: number;
  temperature: number;
  stream: boolean;
}

export function getConfig(): Config {
  const credentialsJson = Deno.env.get("AI_CORE_CREDENTIALS_JSON");
  let credentials: AICoreCredentials | null = null;
  
  if (credentialsJson) {
    try {
      credentials = JSON.parse(credentialsJson) ;
      console.log("✅ Parsed AI Core credentials successfully");
      console.log("Client ID:", credentials?.clientid);
      console.log("Auth URL:", credentials?.url);
      console.log("API URL:", credentials?.serviceurls?.AI_API_URL);
    } catch (error) {
      console.error("Failed to parse AI Core credentials JSON:", error);
    }
  } else {
    console.log("⚠️ No AI_CORE_CREDENTIALS_JSON found, using individual env vars");
  }
  
  const config = {
    clientId: Deno.env.get("AI_CORE_CLIENT_ID") || credentials?.clientid || "",
    clientSecret: Deno.env.get("AI_CORE_CLIENT_SECRET") || credentials?.clientsecret || "",
    authUrl: Deno.env.get("AI_CORE_AUTH_URL") || credentials?.url || "",
    baseUrl: Deno.env.get("AI_CORE_BASE_URL") || credentials?.serviceurls?.AI_API_URL || "",
    resourceGroup: Deno.env.get("AI_CORE_RESOURCE_GROUP") || "default",
    port: parseInt(Deno.env.get("PORT") || "3002"),
    maxTokens: parseInt(Deno.env.get("MAX_TOKENS") || "8192"),
    temperature: parseFloat(Deno.env.get("TEMPERATURE") || "0.7"),
    stream: Deno.env.get("STREAM") !== "false",
  };
  
  console.log("🔧 Final config:", {
    clientId: config.clientId ? "***" : "NOT SET",
    authUrl: config.authUrl,
    baseUrl: config.baseUrl,
    resourceGroup: config.resourceGroup
  });
  
  return config;
}

export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  if (!config.clientId) {
    errors.push("AI_CORE_CLIENT_ID is required");
  }

  if (!config.clientSecret) {
    errors.push("AI_CORE_CLIENT_SECRET is required");
  }

  if (!config.authUrl) {
    errors.push("AI_CORE_AUTH_URL is required");
  }

  if (!config.baseUrl) {
    errors.push("AI_CORE_BASE_URL is required");
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push("PORT must be between 1 and 65535");
  }

  if (config.maxTokens < 1) {
    errors.push("MAX_TOKENS must be greater than 0");
  }

  if (config.temperature < 0 || config.temperature > 2) {
    errors.push("TEMPERATURE must be between 0 and 2");
  }

  return errors;
}
