#!/bin/bash

# Local Build Script for Development
# Usage: ./scripts/build-local.sh [registry-url] [version]

set -e

# Configuration
REGISTRY_URL=${1:-"scai-dev.common.repositories.cloud.sap/aspire-ai"}
VERSION=${2:-"latest"}

echo "🚀 Building images locally for current platform"
echo "📦 Registry: $REGISTRY_URL"
echo "📦 Version: $VERSION"

# Build AI Core Proxy
echo "📦 Building AI Core Proxy..."
cd models/ai-core
docker build -t $REGISTRY_URL/ai-core-proxy:$VERSION .
cd ../..

# Build MCP Aggregator Service
echo "📦 Building MCP Aggregator Service..."
cd mcp-layers/mcp-aggregator
docker build -t $REGISTRY_URL/mcp-aggregator:$VERSION .
cd ..

# Build Chat Agent
echo "📦 Building Chat Agent..."
cd agents/chat
docker build -t $REGISTRY_URL/chat-agent:$VERSION .
cd ../..

# Build Host Service
echo "📦 Building Host Service..."
cd host
docker build -t $REGISTRY_URL/aspire-host:$VERSION .
cd ..

echo "✅ All images built successfully for local development!"
echo "💡 Use ./scripts/build-and-push.sh for multi-platform production builds"
