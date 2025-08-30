import express from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Setup OpenTelemetry diagnostics
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://aspire-dashboard:18889/v1/traces'
  }),
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'mcp-typescript-layer'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

const app = express();
const target = process.env.MCP_SERVER_URL || 'http://localhost:3000';

app.get('/tool', (_req: express.Request, res: express.Response) => {
  res.json({ message: 'Hello from TypeScript MCP layer tool!' });
});

const proxy = createProxyMiddleware({
  target,
  changeOrigin: true,
  selfHandleResponse: true,
  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(responseBuffer.toString('utf8'));
        (data as any).proxyProcessed = true;
        return JSON.stringify(data);
      } catch (err) {
        // ignore JSON parse errors
      }
    }
    return responseBuffer;
  })
}) as any;

app.use('/', proxy);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`TypeScript MCP layer listening on port ${port}, proxying to ${target}`);
});

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
