

import { startHTTPServer, proxyServer, tapTransport } from 'mcp-proxy';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Setup OpenTelemetry diagnostics
_diagSetup();

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://aspire-dashboard:18889/v1/traces'
  }),
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'otlp-layer'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});
await sdk.start();

const tracer = trace.getTracer('otlp-layer');
const target = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
const transportType = process.env.MCP_SERVER_TRANSPORT || 'stream';
const port = Number(process.env.PORT) || 8080;


const mcpServer = new Server({
  c
});

await startHTTPServer({
  port,
  streamEndpoint: '/',
  createServer: async () => { 
    const tap = tapTransport(
      new StreamableHTTPClientTransport(new URL(target)),
      (event) => {
        tracer.startActiveSpan('transport-event', span => {
          span.setAttribute('event.type', event.type);
          span.end();
        });
        if (event.type === 'onmessage') {
          const msg = event.message as any;
          if (msg.result && typeof msg.result === 'object') {
            msg.result.proxyProcessed = true;
          }
        }
      }
    );
   
    return  {
      connect: async (transport) => { 
        transport.onmessage = tap.onmessage;
        transport.onerror = tap.onerror;
        transport.onclose = tap.onclose; 
        await tap.start();
      },
      close: async () => {
        await tap.close();
      }
    }
 
  },
  
  onClose: async (server) => {
    const client = (server as any).upstreamClient as Client | undefined;
    await client?.close();
  },
  onUnhandledRequest: async (req, res) => {
    if (req.url === '/tool') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Hello from OTLP layer tool!' }));
    } else {
      res.writeHead(404).end();
    }
  }
});


console.log(`OTLP layer listening on port ${port}, transport ${transportType}, proxying to ${target}`);



process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});

function _diagSetup() {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

