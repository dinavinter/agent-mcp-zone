#!/bin/bash

# Create Kubernetes secret for Docker registry credentials using username/password
# Usage: ./create-docker-secret-manual.sh [namespace] [secret-name]

set -e

# Configuration
REGISTRY="scai-dev.common.repositories.cloud.sap"
DEFAULT_NAMESPACE="default"
DEFAULT_SECRET_NAME="image-pull-secret"

# Get parameters
NAMESPACE=${1:-$DEFAULT_NAMESPACE}
SECRET_NAME=${2:-$DEFAULT_SECRET_NAME}

echo "🔐 Creating Kubernetes Docker Registry Secret (Manual)"
echo "====================================================="
echo "Registry:    $REGISTRY"
echo "Namespace:   $NAMESPACE"
echo "Secret:      $SECRET_NAME"
echo ""

# Check if kubectl is configured
if ! kubectl cluster-info > /dev/null 2>&1; then
    echo "❌ Error: kubectl is not configured or cluster is not accessible"
    echo "Please configure kubectl and ensure cluster connectivity"
    exit 1
fi

# Prompt for credentials
echo "🔑 Please enter your Docker registry credentials:"
read -p "Username: " DOCKER_USERNAME
read -s -p "Password/Token: " DOCKER_PASSWORD
echo ""
read -p "Email (optional): " DOCKER_EMAIL

# Default email if not provided
if [ -z "$DOCKER_EMAIL" ]; then
    DOCKER_EMAIL="user@example.com"
fi

# Create namespace if it doesn't exist
echo "🔄 Ensuring namespace '$NAMESPACE' exists..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Delete existing secret if it exists
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" > /dev/null 2>&1; then
    echo "🗑️  Removing existing secret '$SECRET_NAME'..."
    kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE"
fi

# Create the secret
echo "🔄 Creating Kubernetes secret..."

kubectl create secret docker-registry "$SECRET_NAME" \
    --docker-server="$REGISTRY" \
    --docker-username="$DOCKER_USERNAME" \
    --docker-password="$DOCKER_PASSWORD" \
    --docker-email="$DOCKER_EMAIL" \
    --namespace="$NAMESPACE"

if [ $? -eq 0 ]; then
    echo "✅ Successfully created Kubernetes secret!"
    echo ""
    echo "📋 Secret information:"
    kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o yaml | grep -E "(name:|namespace:|type:)"
    echo ""
    echo "📋 Usage in Helm values:"
    echo "imagePullSecrets:"
    echo "  - name: $SECRET_NAME"
    echo ""
    echo "🚀 Next steps:"
    echo "   Deploy: ./scripts/deploy-helm.sh $NAMESPACE"
else
    echo "❌ Failed to create secret"
    exit 1
fi
