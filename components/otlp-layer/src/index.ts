

 import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { env } from 'process';
import process from "node:process";
import { InMemoryEventStore, startHTTPServer } from 'mcp-proxy';
import { createProxyServer } from './transport-proxy.ts';
 
// Setup OpenTelemetry diagnostics
_diagSetup();

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:18889/v1/traces'
  }),
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'otlp-layer'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});
await sdk.start();

 
const createGracefulShutdown = ({
  server,
  timeout,
}: {
  server: Pick<Server, "close"> 
  timeout: number;
}) => {
  const gracefulShutdown =async () => {
    console.info("received shutdown signal; shutting down");
    
    // timeout to force exit
    setTimeout(() => {
      process.exit(1);
    }, timeout);

    await server.close();
    await sdk.shutdown();
  };
 
  process.once("SIGTERM", gracefulShutdown);
  process.once("SIGINT", gracefulShutdown);


};

const main = async () => {
  try { 
    createGracefulShutdown({
      server: await startHTTPServer({
        createServer: createProxyServer,
        eventStore: new InMemoryEventStore(),
        host: env.HOST || "0.0.0.0",
        port: Number(env.PORT || "8080"),
        streamEndpoint: "/",
        enableJsonResponse: true
    }),
      timeout: env.SHUTDOWN_TIMEOUT
        ? Number(env.SHUTDOWN_TIMEOUT)
        : 10_000,
    });
  } catch (error) {
    console.error("could not start the proxy", error); 
    // We give an extra second for logs to flush
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  } 
};


function _diagSetup() {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}


await main();