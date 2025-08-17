#!/bin/bash

# Create Kubernetes secret for Docker registry credentials
# Automatically extracts reposscai user credentials from Docker config

set -e

# Fixed configuration
REGISTRY="scai-dev.common.repositories.cloud.sap"
NAMESPACE="default"
SECRET_NAME="image-pull-secret"
DOCKER_USERNAME="reposscai"

echo "🔐 Creating Kubernetes Docker Registry Secret"
echo "=============================================="
echo "Registry:    $REGISTRY"
echo "Namespace:   $NAMESPACE"
echo "Secret:      $SECRET_NAME"
echo "User:        $DOCKER_USERNAME"
echo ""

# Check if kubectl is configured
if ! kubectl cluster-info > /dev/null 2>&1; then
    echo "❌ Error: kubectl is not configured or cluster is not accessible"
    echo "Please configure kubectl and ensure cluster connectivity"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running or not accessible"
    echo "Please start Docker and try again"
    exit 1
fi

# Extract Docker credentials for reposscai user
DOCKER_CONFIG_FILE="$HOME/.docker/config.json"

if [ ! -f "$DOCKER_CONFIG_FILE" ]; then
    echo "❌ Error: Docker config file not found at $DOCKER_CONFIG_FILE"
    echo "Please run 'docker login $REGISTRY' with reposscai credentials first"
    exit 1
fi

# Check if registry credentials exist in Docker config
if ! grep -q "$REGISTRY" "$DOCKER_CONFIG_FILE"; then
    echo "❌ Error: No credentials found for $REGISTRY in Docker config"
    echo "Please run 'docker login $REGISTRY' with reposscai credentials first"
    exit 1
fi

# Extract the auth token for the registry
AUTH_TOKEN=$(jq -r ".auths[\"$REGISTRY\"].auth" "$DOCKER_CONFIG_FILE" 2>/dev/null)

if [ "$AUTH_TOKEN" = "null" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Error: No auth token found for $REGISTRY"
    echo "Please run 'docker login $REGISTRY' with reposscai credentials first"
    exit 1
fi

# Decode the auth token to verify it's for reposscai user
DECODED_CREDS=$(echo "$AUTH_TOKEN" | base64 -d)
STORED_USERNAME=$(echo "$DECODED_CREDS" | cut -d':' -f1)

if [ "$STORED_USERNAME" != "$DOCKER_USERNAME" ]; then
    echo "❌ Error: Docker config contains credentials for '$STORED_USERNAME', expected '$DOCKER_USERNAME'"
    echo "Please run 'docker login $REGISTRY' with reposscai credentials"
    exit 1
fi

DOCKER_PASSWORD=$(echo "$DECODED_CREDS" | cut -d':' -f2-)

echo "✅ Found credentials for reposscai user"

# Create namespace if it doesn't exist
echo "🔄 Ensuring namespace '$NAMESPACE' exists..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Delete existing secret if it exists
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" > /dev/null 2>&1; then
    echo "🗑️  Removing existing secret '$SECRET_NAME'..."
    kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE"
fi

# Create the secret using extracted credentials
echo "🔄 Creating Kubernetes secret with reposscai credentials..."

kubectl create secret docker-registry "$SECRET_NAME" \
    --docker-server="$REGISTRY" \
    --docker-username="$DOCKER_USERNAME" \
    --docker-password="$DOCKER_PASSWORD" \
    --docker-email="reposscai@sap.com" \
    --namespace="$NAMESPACE"

if [ $? -eq 0 ]; then
    echo "✅ Successfully created Kubernetes secret for reposscai user!"
    echo ""
    echo "📋 Secret information:"
    kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o yaml | grep -E "(name:|namespace:|type:)"
    echo ""
    echo "🔍 Verify secret registry:"
    kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | jq -r '.auths | keys[]' 2>/dev/null || echo "Registry: $REGISTRY"
    echo ""
    echo "📋 Secret is ready for Helm deployment"
    echo ""
    echo "🚀 Next steps:"
    echo "   Deploy: ./scripts/deploy-helm.sh"
else
    echo "❌ Failed to create secret"
    exit 1
fi
