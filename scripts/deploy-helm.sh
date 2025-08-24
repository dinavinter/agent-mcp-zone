#!/bin/bash

# Build and push all images
./build-and-push.sh

# Deploy using our custom Helm charts
echo "🚀 Deploying to Kubernetes using Helm..."
helm upgrade aspire-ai  ./host/aspirate-output/Chart/ -n aspire-ai --install --create-namespace

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."
kubectl rollout status deployment/mcp-policy-guard -n aspire-ai --timeout=300s
kubectl rollout status deployment/mcp-aggregator -n aspire-ai --timeout=300s
kubectl rollout status deployment/chat -n aspire-ai --timeout=300s
kubectl rollout status deployment/ai-core -n aspire-ai --timeout=300s
kubectl rollout status deployment/aspire-dashboard -n aspire-ai --timeout=300s

# Show pod status
echo "📋 Pod Status:"
kubectl get pods -n aspire-ai

