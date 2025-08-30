import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { inspect } from "node:util";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME || "otlp-layer");

export function tap(direction: string) {

    const span = tracer.startSpan("transport-tap", {
        attributes: { direction },
    });

    return (message: TransportEvent) => {
        if (message.type === "send" || message.type === "onmessage") {
            console.debug(inspect({
                type: message.type,
                direction,
                ...message.message,
            }, { colors: true, depth: 2, breakLength: 10 }));

            span.addEvent(message.type, {
                type: message.type,
                ...flattenMessage(message),
            });
        }
        if (message.type === "start") {
            console.debug("Transport started", direction);
            span.setStatus({
                code: 1,
                message: `Transport started`,
            });
            span.addEvent("started", message);
        }
        if (message.type === "close") {
            console.debug("Transport closed by remote", direction);
            span.end();
        }
        if (message.type === "onclose") {
            console.debug("Transport closed", direction);
            span.end();
        }
    };
}


function flattenMessage(
    message: { message: JSONRPCMessage; type: "onmessage" } | {
        message: JSONRPCMessage;
        type: "send";
    },
) {
    if (message.message) {
        if ("method" in message.message) {
            return {
                direction: message.type,
                jsonrpc: message.message.jsonrpc,
                method: message.message.method,
                id: message.message.id,
                params: JSON.stringify(message.message.params)?.substring(
                    0,
                    100,
                ), // limit size
            };
        } else if ("result" in message.message) {
            return {
                direction: message.type,
                jsonrpc: message.message.jsonrpc,
                id: message.message.id,
                result: JSON.stringify(message.message.result).substring(
                    0,
                    100,
                ), // limit size
            };
        } else if ("error" in message.message) {
            return {
                direction: message.type,
                jsonrpc: message.message.jsonrpc,
                id: message.message.id,
                error: JSON.stringify(message.message.error).substring(0, 100), // limit size
            };
        }
    }
    return {};
}



type TransportEvent = {
    error: Error;
    type: "onerror";
} | {
    message: JSONRPCMessage;
    type: "onmessage";
} | {
    message: JSONRPCMessage;
    type: "send";
} | {
    type: "close";
} | {
    type: "onclose";
} | {
    type: "start";
};