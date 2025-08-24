# ...existing code...
#!/usr/bin/env bash
# Simple kubectl port-forward helper
# Configure these (service names and ports) to match your cluster
NAMESPACE="${NAMESPACE:-aap}"
# Format: svcname:localPort:svcPort
FORWARDS=(
#   "aspire-otlp:18889:18889"
  "aspire-dashboard:18888:18888"
  "chat:3000:3000"
  "mcp-policy-guard:8090:8090"
)

# Check kubectl
if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found in PATH" >&2
  exit 1
fi

PIDS=()

start_forward() {
  local svc="$1"
  local local_port="$2"
  local svc_port="$3"

  echo "Checking service '${svc}' in namespace '${NAMESPACE}'..."
  if ! kubectl get svc "$svc" -n "$NAMESPACE" >/dev/null 2>&1; then
    echo "❌ Service '$svc' not found in namespace '$NAMESPACE'."
    echo "   Available services:"
    kubectl get svc -n "$NAMESPACE"
    return 1
  fi

  # Check endpoints (are there pods behind the service?)
  endpoints_count=$(kubectl get endpoints "$svc" -n "$NAMESPACE" -o jsonpath='{.subsets}' 2>/dev/null || echo "")
  if [ -z "$endpoints_count" ] || [ "$endpoints_count" = "[]" ]; then
    echo "⚠️  Service '$svc' has no endpoints (no pods selected / not Ready). Trying to find a pod to port-forward instead..."
    # Try to find a pod that looks like the service name
    pod=$(kubectl get pods -n "$NAMESPACE" -o jsonpath="{range .items[?(@.metadata.name | contains("chat"))]}{.metadata.name}{'\n'}{end}" | head -n1)
    if [ -z "$pod" ]; then
      pod=$(kubectl get pods -n "$NAMESPACE" --no-headers -o custom-columns=NAME:.metadata.name | grep -E "$svc|chat" | head -n1 || true)
    fi
    if [ -z "$pod" ]; then
      echo "❌ No matching pod found for '$svc'."
      echo "   Pods in namespace:"
      kubectl get pods -n "$NAMESPACE"
      return 1
    fi

    echo "Starting port-forward pod/${pod} ${local_port}:${svc_port} (ns=${NAMESPACE})"
    kubectl port-forward "pod/${pod}" "${local_port}:${svc_port}" -n "${NAMESPACE}" >/dev/null 2>&1 &
    PIDS+=($!)
    sleep 0.3
    return 0
  fi

  # If service has endpoints, port-forward the service
  echo "Starting port-forward svc/${svc} ${local_port}:${svc_port} (ns=${NAMESPACE})"
  kubectl port-forward "svc/${svc}" "${local_port}:${svc_port}" -n "${NAMESPACE}" >/dev/null 2>&1 &
  PIDS+=($!)
  sleep 0.3
}

cleanup() {
  echo
  echo "Stopping port-forwards..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  wait 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM

# Start all forwards
for spec in "${FORWARDS[@]}"; do
  IFS=":" read -r svc local_port svc_port <<< "$spec"
  start_forward "$svc" "$local_port" "$svc_port" || echo "Failed to start forward for $svc"
done

echo "Port-forwards started. Processes: ${PIDS[*]}"
echo "Press Ctrl+C to stop."

# Wait forever (until SIGINT)
while true; do
  sleep 60 &
  wait $!
done
# ...existing code...