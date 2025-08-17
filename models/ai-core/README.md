# AI Core Proxy

A simple Deno-based proxy server for SAP AI Core that provides a REST API interface for AI model interactions.

## Features

- **Authentication**: Automatic OAuth token management with caching
- **Model Discovery**: Fetches and caches available AI Core deployments
- **Multi-Model Support**: Supports OpenAI, Anthropic, and Gemini model families
- **Streaming Responses**: Handles streaming responses from AI Core
- **Health Checks**: Built-in health check endpoint

## Configuration

### Option 1: JSON Credentials (Recommended for Aspire)

Set the `AI_CORE_CREDENTIALS_JSON` environment variable with the full credentials JSON:

```bash
AI_CORE_CREDENTIALS_JSON='{"clientid":"your_client_id","clientsecret":"your_secret","url":"https://auth.url","serviceurls":{"AI_API_URL":"https://api.url"}}'
AI_CORE_RESOURCE_GROUP=default
PORT=3002
```

### Option 2: Individual Environment Variables

```bash
AI_CORE_CLIENT_ID=your_client_id
AI_CORE_CLIENT_SECRET=your_client_secret
AI_CORE_AUTH_URL=https://your-subdomain.authentication.sap.hana.ondemand.com
AI_CORE_BASE_URL=https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com
AI_CORE_RESOURCE_GROUP=default
PORT=3002
```

## Web Interface

Access the web interface at `http://localhost:3002/` to:
- Check service health
- View available models
- Test chat completions with a user-friendly interface

## API Endpoints

### Health Check
```
GET /health
```

### Get Available Models
```
GET /models
```

### Chat Completion
```
POST /chat/completions
```

Request body format:
```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 8192,
  "temperature": 0.7
}
```

## Test Client 

A Hono-based test client is available to verify OpenAI compatibility using npm:ai and @ai-sdk/openai-compatible.

### Setup
```bash
# Install npm dependencies
npm install

# Run the test client
deno task client

# Or run both proxy and test client together
deno task start-client-server
```

### Access Test Client
- **URL**: `http://localhost:3003/`
- **Features**:
  - Connection status to AI Core Proxy
  - Model selection and testing
  - Chat interface using npm:ai
  - Streaming responses

## Running the Server

### Development
```bash
deno task dev
```

### Production
```bash
deno task start
```

### Test Client
```bash
deno task client
```

### Both Services Together
```bash
deno task start-client-server
```

## Model Support

The proxy automatically detects and handles different model families:

- **OpenAI Family**: GPT models, O1, O3, O4
- **Anthropic Family**: Claude models
- **Gemini Family**: Google Gemini models

Each model family uses the appropriate AI Core API endpoint and response parsing.
