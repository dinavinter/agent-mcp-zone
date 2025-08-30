import { env } from "node:process";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";   
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { IncomingMessage } from "node:http";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import process from "node:process";

const SSE_HEADERS_PASSTHROUGH = env.SSE_HEADERS_PASSTHROUGH ? JSON.parse(env.SSE_HEADERS_PASSTHROUGH) : ["authorization"];
const STREAMABLE_HTTP_HEADERS_PASSTHROUGH =env.STREAMABLE_HTTP_HEADERS_PASSTHROUGH ? JSON.parse(env.STREAMABLE_HTTP_HEADERS_PASSTHROUGH) : [
    "authorization",
    "mcp-session-id",
    "last-event-id",
];

const DEFAULT_HEADERS:Record<string, string> =env.DEFAULT_HEADERS? JSON.parse(env.DEFAULT_HEADERS) :
{
    "x-otlp-layer": "true",
}


function getArgs() {
  const url = env.MCP_SERVER_URL;
  const transportType = env.MCP_SERVER_TRANSPORT || "streamable-http";
  const command = env.MCP_SERVER_CMD;
  const args = env.MCP_SERVER_ARGS?.split(" ") ?? [];
  
  return { url, transportType, command, args };
}

const defaultEnvironment = {
  ...getDefaultEnvironment(),
  ...(env.MCP_ENV_VARS ? JSON.parse(env.MCP_ENV_VARS) : {}),
};


export const createTransport =  (req: IncomingMessage): Transport => {
    const { transportType , command, args , url} = getArgs();

    if (transportType === "stdio") {
         const env = { ...defaultEnvironment, ...process.env };

        // const { cmd, args } = findActualExecutable(command, origArgs);

        console.log(`STDIO transport: command=${command}, args=${args}`);

        const transport = new StdioClientTransport({
            command: command?.trim() || "node",
            args,
            env,
            stderr: "pipe",
        });

        return transport;
    } else if (transportType === "sse" && url) {

        const headers = getHttpHeaders(req, transportType);

        console.log(
            `SSE transport: url=${url}, headers=${JSON.stringify(headers)}`,
        );

        const transport = new SSEClientTransport(new URL(url), {
            eventSourceInit: {
                fetch: (url: URL | RequestInfo, init: (RequestInit & { client?: Deno.HttpClient; }) | undefined) => fetch(url, { ...init, headers }),
            },
            requestInit: {
                headers,
            },
        });
        return transport;
    } else if (transportType === "streamable-http" && url) {
        const headers = getHttpHeaders(req, transportType);

        const transport = new StreamableHTTPClientTransport(
            new URL(url),
            {
                requestInit: {
                    headers,
                },
            },
        );
        return transport;
    } else {
        console.error(`Invalid transport type: ${transportType}`);
        throw new Error("Invalid transport type specified");
    }
};

const getHttpHeaders = (
    req: IncomingMessage,
    transportType: string,
): HeadersInit => {
    const headers: HeadersInit = {
        Accept: transportType === "sse"
            ? "text/event-stream"
            : "text/event-stream, application/json",
    };
    const defaultHeaders = transportType === "sse"
        ? SSE_HEADERS_PASSTHROUGH
        : STREAMABLE_HTTP_HEADERS_PASSTHROUGH;

    for (const key of defaultHeaders.filter((h) => req.headers[h] !== undefined)) {
        const value = req.headers[key]!;
        headers[key] = Array.isArray(value)
                ? value[value.length - 1]
                : value; 
    }

    // If the header "x-custom-auth-header" is present, use its value as the custom header name.
    if (req.headers["x-custom-auth-header"]) {
        const customHeaderName = req.headers["x-custom-auth-header"] as string;
        const lowerCaseHeaderName = customHeaderName.toLowerCase();
        if (req.headers[lowerCaseHeaderName]) {
            const value = req.headers[lowerCaseHeaderName];
            headers[customHeaderName] = value as string;
        }
    }
     
    // Add any default headers
    for (const key of Object.keys(DEFAULT_HEADERS)) {
        if (!headers[key]) {
            headers[key] = DEFAULT_HEADERS[key];
        }
    }
    return headers;
};



