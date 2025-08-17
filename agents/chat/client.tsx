/** @jsxImportSource npm:hono/jsx */

import { StreamableHTTPClientTransport } from "npm:@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  experimental_createMCPClient as createMcpClient,
  smoothStream,
  streamText,
    readUIMessageStream
} from "npm:ai";
import { azure } from "npm:@ai-sdk/azure";
import { Hono } from "npm:hono";
import { streamSSE, streamText as stream } from "npm:hono/streaming";
import { cors } from "npm:hono/cors";
import * as Y from "npm:yjs";
import { env } from 'npm:hono/adapter'

const chats = new Y.Doc();

// import { SSEEdgeClientTransport } from "./sse.ts";

const app = new Hono();
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      return origin || "*";
    },

    allowMethods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH", "HEAD"],
  }),
);
// Simple HTML UI for testing
app.use("*", async (c, next) => {
    try {
        return await next();
    } catch (e) {
        console.error(e);
        return c.json({ error: (e as Error).message }, 500);
    }
});

app.get("/", (c) =>{
 const chatId=`${Date.now()}`;
  const { MCP_SERVER_URL } = env<{ MCP_SERVER_URL: string }>(c)

    return  c.html(
    <html>
      <head>
        <title>Simple MCP Client</title>
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4">
        </script>
        <script
          src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.6/dist/htmx.min.js"
          crossOrigin="anonymous"
        >
        </script>
        <script
          src="https://cdn.jsdelivr.net/npm/htmx-ext-sse@2.2.2"
          crossOrigin="anonymous"
        >
        </script>
      </head>
      <body hx-ext="sse">
        <div class="p-6 max-w-xl mx-auto"
        >
          <h1 class="text-2xl font-bold mb-4">Simple MCP Client</h1>

          <form
            hx-post={`chats/${chatId}/prompt`}
            hx-target="#response"
            hx-swap="textContent"
            hx-trigger="submit"
          >
            <input
              name="url"
              type="text"
              placeholder="MCP Server URL"
              class="w-full p-2 border rounded mb-2"
              required
              value={MCP_SERVER_URL}
            />
            <textarea
              name="prompt"
              rows={3}
              class="w-full p-2 border rounded"
              placeholder="Enter prompt..."
              required
              value={"What tools do you have?"}
            >
            </textarea>
            <button
              type="submit"
              class="bg-blue-500 text-white px-4 py-2 rounded mt-2"
            >
              Test MCP Server
            </button>
          </form>
          <div
            class="mt-4 p-4 bg-gray-100 rounded"
            sse-swap="chat"
            hx-swap="innerHTML"
            sse-connect={`/chats/${chatId}/messages`}
          >
          </div>
          <pre
           id={`status`}
           sse-connect={`/chats/${chatId}/status`}
           sse-swap={`status`}
           hx-swap="innerHTML"
           class="mt-4 p-4 bg-gray-100 rounded"
           />
          <pre
            id="response"
            
            hx-swap={"innerHTML"}
            class="mt-4 p-4 bg-gray-100 rounded"
          ></pre>
        </div>
      </body>
    </html>,
  )
});

type Message = {
  content: string;
  role: "user" | "assistant";
  date: string;
  messageId: number;
};
app.get("/chats/:chatId/messages", (c) => {
  const chat = chats.getArray<Message>(c.req.param("chatId"));

    return streamSSE(c, async (sse) => {
    sse.writeSSE({
      event: "chat",
      data: (
        <div class="mt-4 p-4 bg-gray-50 rounded">
          <span class="text-gray-500">--- Chat started ---</span>
          <div
            class="mt-4 p-4 bg-gray-100 rounded"
            sse-swap="message"
            hx-swap="beforeend"
          >
          </div>
        </div>
      ),
      id: String(Date.now()),
    });

    
    const sendMessage = ({content, role, messageId, date}:Message) => {
        if (!msgs[messageId]) {
            sse.writeSSE({
                event: "message",
                data: (
                    <div
                        class={`my-2 p-2 rounded ${
                            role === "user" ? "bg-blue-100 text-right" : "bg-gray-200"
                        }`}
                        sse-swap={`msg-${messageId}`}
                    >
                        {content}
                    </div>
                ),
                id: String(date),
            });
        }
        else {
            sse.writeSSE({
                data: content,
                id: String(Date.now()),
                event: `msg-${messageId}`,
            });
        }
        
   }
    
    const msgs={} as Record<number, boolean>;
    chat.forEach(sendMessage);
    
    const observer = (event: Y.YEvent<any>) => {
      const newMessages = event.changes.delta.flatMap(({ insert }) => insert).filter(Boolean);
      for (const item of newMessages) {
          sendMessage(item);
      }
    };
    chat.observe(observer);
     // Cleanup on connection close
    sse.onAbort(() => {
      chat.unobserve(observer);
     });

    while (!sse.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      // Keep the connection alive
      sse.writeSSE({ event: "ping", data: "ping", id: String(Date.now()) });
    }
  });
});



app.get("/chats/:chatId/status", (c) => {
    return streamSSE(c, async (sse) => {
        const status = chats.getMap<string>(c.req.param("chatId") + "-status");
        sse.writeSSE({
            event: `status`,
            data: status.get("message") || status.get("status") || "Idle 💤, Ready for prompt 🤔.",
            id: String(Date.now()),
        });
        const observer = (event: Y.YEvent<any>) => {
            sse.writeSSE({
                event: `status`,
                data: status.get("message") || status.get("status") || "Idle 💤, Ready for prompt 🤔.",
                id: String(Date.now()),
            });
        };
        status.observe(observer);
        sse.onAbort(() => {
            status.unobserve(observer);
        });
        while (!sse.aborted) {
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            // Keep the connection alive
            sse.writeSSE({ event: "ping", data: "ping", id: String(Date.now()) });
        }
    });
});

app.use("/chats/:chatId/prompt", async (c, next) => {
    const status = chats.getMap<string>(c.req.param("chatId") + "-status");
    try {
        const s = status.get("status");
        // if (s === "processing") {
        //     return c.json({ error: "Another request is still processing. Please wait." }, 429);
        // }
        return await next();
    } catch (e) {
        console.error(e);
        chats.transact(() => {
            status.set("status", "error");
            status.set("message", `❌ Error: ${(e as Error).message}`);
            status.set("updatedAt", new Date().toISOString());
        });
        return c.json({ error: (e as Error).message }, 500);
    }
});

app.post("/chats/:chatId/prompt", async (c) => {
      const status =chats.getMap<string>(c.req.param("chatId") + "-status");
      chats.transact(() => {
          status.set("status", "processing");
          status.set("updatedAt", new Date().toISOString());
          status.set("message", "⏳ Processing...");
      });
      const chat = chats.getArray<Message>(c.req.param("chatId"));
      const body = await c.req.parseBody();
      const message = body.prompt as string;
      const url = body.url as string;
      const mcpClient = await createMcpClient({
          transport: new StreamableHTTPClientTransport(new URL(url)),
      });
     status.set("message", `🤖 Connected to MCP at ${url}`);

     const mcpTools = await mcpClient.tools();
       
     status.set("message", `🛠️ Loaded ${Object.keys(mcpTools).length} tools from MCP at ${url}`);

      console.log("Received message:", message);
      chat.push([{
          content: message,
          role: "user",
          date: new Date().toISOString(),
          messageId: chat.length,
      }]);
      const messageId = chat.length;

      const result = streamText({
          model: azure("gpt-4o"),
          system:
              "You are a helpful assistant that helps users using the tools provided.",
          messages: chat.toArray(),
          experimental_transform: smoothStream({
              delayInMs: 20, // optional: defaults to 10ms
              chunking: "line", // optional: defaults to 'word'
          }),
          tools: mcpTools,
          
      });
    status.set("message", `🤖 Streaming response...`);

    for await (const uiMessage of readUIMessageStream({ stream: result.toUIMessageStream(),
    })) {
        status.set("message", `🤖 Received ${uiMessage.parts.length} message parts...`);

        chats.transact(() => { 
            // Handle different part types
            uiMessage.parts.forEach(part => {
                chats.getArray(`${part.type}:${c.req.param("chatId")}`).push([part]); 
            });
        })
    }

    chat.push([{
        content: await result.text,
        role: "assistant",
        date: new Date().toISOString(),
        messageId: messageId,
    }]);
      
      
      chats.transact(() => {
          status.set("status", "done");
          status.set("updatedAt", new Date().toISOString());
          status.set("message", "Done ✅, Ready for next prompt 🤔.");
      });
      
      return c.text("✅");
 
});

export default app;
