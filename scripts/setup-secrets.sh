#!/bin/bash

# Setup Kubernetes Secrets Script
# Usage: ./scripts/setup-secrets.sh

set -e

echo "🔐 Setting up Kubernetes secrets..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Create namespace if it doesn't exist
kubectl create namespace agent-analyse-account --dry-run=client -o yaml | kubectl apply -f -

# Prompt for AI Core credentials
echo "📝 Please provide your AI Core credentials:"
read -p "AI Core Client ID: " AI_CORE_CLIENT_ID
read -s -p "AI Core Client Secret: " AI_CORE_CLIENT_SECRET
echo
read -p "AI Core Auth URL: " AI_CORE_AUTH_URL
read -p "AI Core Base URL: " AI_CORE_BASE_URL

# Create AI Core credentials JSON
AI_CORE_CREDENTIALS_JSON=$(cat <<EOF
{
  "clientId": "$AI_CORE_CLIENT_ID",
  "clientSecret": "$AI_CORE_CLIENT_SECRET",
  "authUrl": "$AI_CORE_AUTH_URL",
  "baseUrl": "$AI_CORE_BASE_URL"
}
EOF
)

# Create secret
kubectl create secret generic agent-secrets \
  --namespace=agent-analyse-account \
  --from-literal=AI_CORE_CREDENTIALS_JSON="$AI_CORE_CREDENTIALS_JSON" \
  --from-literal=AI_CORE_CLIENT_ID="$AI_CORE_CLIENT_ID" \
  --from-literal=AI_CORE_CLIENT_SECRET="$AI_CORE_CLIENT_SECRET" \
  --from-literal=AI_CORE_AUTH_URL="$AI_CORE_AUTH_URL" \
  --from-literal=AI_CORE_BASE_URL="$AI_CORE_BASE_URL" \
  --dry-run=client -o yaml > k8s/secret.yaml

echo "✅ Secrets created and saved to k8s/secret.yaml"
echo "🔒 Remember to never commit this file to version control!"
echo "📋 You can now deploy with: ./scripts/deploy-to-kyma.sh"
