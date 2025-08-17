#!/bin/bash

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
#
## Build and push AI Core Proxy
#echo "📦 Building AI Core Proxy..."
#cd models/ai-core
#docker buildx build --platform linux/amd64,linux/arm64 -t $REGISTRY_URL/ai-core-proxy:$VERSION --push .
#cd ../..
#
## Build and push Guard Service
#echo "📦 Building Guard Service..."
#cd guard
#docker buildx build --platform linux/amd64,linux/arm64 -t $REGISTRY_URL/guard:$VERSION --push .
#cd ..
#
## Build and push Chat Agent
#echo "📦 Building Chat Agent..."
#cd agents/chat
#docker buildx build --platform linux/amd64,linux/arm64 -t $REGISTRY_URL/chat-agent:$VERSION --push .
#cd ../..
#
## Build and push Host Service
#echo "📦 Building Host Service..."
#cd host
#docker buildx build --platform linux/amd64,linux/arm64 -t $REGISTRY_URL/aspire-host:$VERSION --push .
#cd ..
#
#echo "✅ All images built and pushed successfully!"

# Generate Aspire Helm charts
echo "🔧 Generating Aspire Helm charts..."



##build all components  and push to registry
aspirate generate --output-format helm --secret-password aiam --private-registry --non-interactive --include-dashboard --container-registry "$REGISTRY_URL" --container-build-arg "platform"="linux/amd64" --container-build-arg "version=$VERSION" 
aspirate build --non-interactive --container-registry "$REGISTRY_URL"   --container-build-arg "platform"="linux/amd64" --container-build-arg "version=$VERSION" 
docker manifest inspect "$REGISTRY_URL/aspire-ai/guard:latest" || echo "Manifest not found, skipping inspection"

# fix platform for guard service
echo "📦 Building Guard Service..."
docker buildx build --platform linux/amd64 -t "$REGISTRY_URL/guard:$VERSION" --push ./guard

docker manifest inspect "$REGISTRY_URL/aspire-ai/guard:$VERSION" || echo "Manifest not found, skipping inspection"
 

echo "✅ Helm charts generated successfully!"
echo "🎯 Ready to deploy to Kyma with: helm upgrade aspire-ai host/aspirate-output/Chart/ -n aspire-ai --install --create-namespace"
