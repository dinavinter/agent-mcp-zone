from fastmcp import FastMCP
from fastmcp.server.proxy import ProxyClient
import os
from dotenv import load_dotenv

load_dotenv()

print("Starting MCP Aggregator..." + "\n" + os.getenv("MCP_SERVER_URL"))
# mcp_proxy.py      
config = {
    "mcpServers": {
        "default": {  # For single server configs, 'default' is commonly used
            "url":  os.getenv("MCP_SERVER_URL"),
            "transport": os.getenv("MCP_SERVER_TRANSPORT", "http"),
            "name": os.getenv("MCP_SERVER_NAME", "mcp-middleware")
        }
    }
}

# Create a proxy with full MCP feature support
proxy = FastMCP.as_proxy(
    ProxyClient(config),
    name=os.getenv("NAME", "mcp-guard")
)

# Run the proxy (e.g., via stdio for Claude Desktop)
if __name__ == "__main__":
    proxy.run(transport="http", host="0.0.0.0", port=os.getenv("PORT", 8080), path="/")  
