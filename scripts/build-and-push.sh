#!/bin/bash
#  for mac build and push multi-arch images - workaround for  aspirate build images with platform

# Build and Push Script for Kyma Deployment
# Usage: ./scripts/build-and-push.sh [registry-url] [domain-name]
set -e

# Configuration
REGISTRY_URL=${1:-"scai-dev.common.repositories.cloud.sap"}
DOMAIN_NAME=${2:-"aspire-ai"}
VERSION=${3:-"latest"}

echo "🚀 Building and pushing images to $REGISTRY_URL"
echo "🌐 Domain: $DOMAIN_NAME"
echo "📦 Version: $VERSION"

# Setup Docker Buildx for multi-platform builds
echo "🔧 Setting up Docker Buildx for multi-platform builds..."
docker buildx create --name multi-platform-builder --use --bootstrap || true

# Generate Aspire Helm charts
echo "🔧 Generating Aspire Helm charts..."



##build all components  and push to registry
#aspirate generate --output-format helm --secret-password aiam --private-registry --non-interactive --include-dashboard --container-registry "$REGISTRY_URL" --container-build-arg "platform"="linux/amd64" --container-build-arg "version=$VERSION" 
#aspirate build --non-interactive --container-registry "$REGISTRY_URL"   --container-build-arg "platform"="linux/amd64" --container-build-arg "version=$VERSION" 


# fix platform for guard service
echo "📦 Building Guard Service..."
docker buildx build --platform linux/amd64 -t "$REGISTRY_URL/aspire-ai/guard:$VERSION" --push ./guard

docker buildx build --platform linux/amd64 -t "$REGISTRY_URL/aspire-ai/chat:$VERSION" --push ./agents/chat

docker buildx build --platform linux/amd64 -t "$REGISTRY_URL/aspire-ai/ai-core:$VERSION" --push ./models/ai-core

echo "📦 Building MCP Policy Guard Service..."
docker buildx build --platform linux/amd64 -t "$REGISTRY_URL/aspire-ai/mcp-policy-guard:$VERSION" --push ./mcp-policy-guard


docker manifest inspect "$REGISTRY_URL/aspire-ai/guard:$VERSION" || echo "Manifest not found, skipping inspection"
 
docker manifest inspect "$REGISTRY_URL/aspire-ai/chat:$VERSION" || echo "Manifest not found, skipping inspection"

docker manifest inspect "$REGISTRY_URL/aspire-ai/ai-core:$VERSION" || echo "Manifest not found, skipping inspection"

docker manifest inspect "$REGISTRY_URL/aspire-ai/mcp-policy-guard:$VERSION" || echo "Manifest not found, skipping inspection"



echo "✅ Helm charts generated successfully!"
echo "🎯 Ready to deploy to Kyma with: helm upgrade aspire-ai host/aspirate-output/Chart/ -n aspire-ai --install --create-namespace"
