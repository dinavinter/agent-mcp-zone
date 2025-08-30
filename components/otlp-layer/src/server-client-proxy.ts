import { IncomingMessage } from "http";
import { proxyServer, tapTransport } from "mcp-proxy";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import { createTransport } from "./transport-client.ts";
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import { tap } from "./log.ts";
 

//to use if we want to use mcp server instead of direct transport proxying

const createServerProxy = async (request: IncomingMessage) => {
  console.log("Creating server for request", {
    url: request.url,
    method: request.method,
    headers: request.headers,
  });

  const client = new Client({ name: "otlp-proxy", version: "1.0.0" }, {
    enforceStrictCapabilities: false,
  });

  const transport = tapTransport(createTransport(request), tap("proxy-transport"));
  await client.connect(transport);

  const serverVersion = client.getServerVersion() as {
    name: string;
    version: string;
  };

  const serverCapabilities = client.getServerCapabilities() as {
    capabilities: Record<string, unknown>;
  };
  const server = new Server(serverVersion, {
    capabilities: serverCapabilities,
  });

  proxyServer({
    client,
    server,
    serverCapabilities,
  });

  return server;
};
 