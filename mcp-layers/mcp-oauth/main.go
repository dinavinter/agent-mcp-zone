package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.23.0"
	"go.opentelemetry.io/otel/trace"
)

var tracer trace.Tracer

// MockClaims represents the JWT claims structure
type MockClaims struct {
	Iss   string   `json:"iss"`
	Sub   string   `json:"sub"`
	Aud   string   `json:"aud"`
	Exp   int64    `json:"exp"`
	Iat   int64    `json:"iat"`
	Groups []string `json:"groups"`
	Email string   `json:"email"`
	Name  string   `json:"name"`
}

// generateMockToken creates a mock JWT token with groups claim
func generateMockToken() (string, error) {
	// Create mock claims
	now := time.Now()
	claims := MockClaims{
		Iss:    "https://mock-oauth-provider.com",
		Sub:    "mock-user-123",
		Aud:    "mcp-services",
		Exp:    now.Add(1 * time.Hour).Unix(),
		Iat:    now.Unix(),
		Groups: []string{"admin", "developers", "mcp-users"},
		Email:  "mock.user@example.com",
		Name:   "Mock User",
	}

	// Convert to JSON
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("failed to marshal claims: %w", err)
	}

	// Encode as base64 (simplified mock JWT)
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString(claimsJSON)
	
	// Generate mock signature (random bytes)
	signature := make([]byte, 32)
	if _, err := rand.Read(signature); err != nil {
		return "", fmt.Errorf("failed to generate signature: %w", err)
	}
	sig := base64.RawURLEncoding.EncodeToString(signature)

	// Combine into JWT format
	token := fmt.Sprintf("%s.%s.%s", header, payload, sig)
	return token, nil
}

func main() {
	// Initialize OpenTelemetry
	ctx := context.Background()
	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize tracer: %v", err)
	}
	defer shutdown()

	// Get configuration from environment variables
	policyGuardURL := os.Getenv("POLICY_GUARD_URL")
	if policyGuardURL == "" {
		policyGuardURL = "http://mcp-policy-guard:8090" // Default to Kubernetes service name
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Parse the policy guard URL
	target, err := url.Parse(policyGuardURL)
	if err != nil {
		log.Fatalf("Failed to parse policy guard URL: %v", err)
	}

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom director to add tracing headers and mock authorization
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)

		// Extract trace context from the current request
		ctx := req.Context()
		span := trace.SpanFromContext(ctx)

		// Inject trace context into headers for downstream service
		propagator := otel.GetTextMapPropagator()
		propagator.Inject(ctx, propagation.HeaderCarrier(req.Header))

		// Generate and add mock authorization header
		mockToken, err := generateMockToken()
		if err != nil {
			log.Printf("Failed to generate mock token: %v", err)
			// Continue without token rather than failing
		} else {
			req.Header.Set("Authorization", "Bearer "+mockToken)
			span.SetAttributes(attribute.String("oauth.token_generated", "true"))
		}

		// Add custom attributes to the span
		span.SetAttributes(
			attribute.String("mcp.oauth.target", policyGuardURL),
			attribute.String("mcp.oauth.method", req.Method),
			attribute.String("mcp.oauth.path", req.URL.Path),
		)
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		ctx := r.Context()
		span := trace.SpanFromContext(ctx)
		span.RecordError(err)
		span.SetAttributes(attribute.String("mcp.oauth.error", err.Error()))

		log.Printf("OAuth proxy error: %v", err)
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
	}

	// Create HTTP handler with OpenTelemetry instrumentation
	handler := otelhttp.NewHandler(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, span := tracer.Start(r.Context(), "mcp-oauth-request")
			defer span.End()

			// Add request attributes
			span.SetAttributes(
				attribute.String("http.method", r.Method),
				attribute.String("http.url", r.URL.String()),
				attribute.String("http.user_agent", r.UserAgent()),
				attribute.String("mcp.oauth.service", "mcp-policy-guard"),
			)

			// Update request context
			r = r.WithContext(ctx)

			// Log the request
			log.Printf("OAuth proxying %s %s to %s", r.Method, r.URL.Path, policyGuardURL)

			// Forward to the proxy
			proxy.ServeHTTP(w, r)
		}),
		"mcp-oauth",
	)

	// Add health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Add readiness check endpoint
	http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		// Check if policy guard service is reachable
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(policyGuardURL + "/health")
		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Policy guard service not ready"))
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Ready"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Policy guard service not healthy"))
		}
	})

	// Add token info endpoint for debugging
	http.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		token, err := generateMockToken()
		if err != nil {
			http.Error(w, "Failed to generate token", http.StatusInternalServerError)
			return
		}

		// Decode the token to show claims
		parts := []string{}
		if len(token) > 0 {
			parts = append(parts, token)
		}

		response := map[string]interface{}{
			"token": token,
			"note":  "This is a mock token for development purposes",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	// Handle all other requests with the proxy
	http.Handle("/", handler)

	log.Printf("MCP OAuth starting on port %s, forwarding to %s", port, policyGuardURL)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func initTracer(ctx context.Context) (func(), error) {
	// Get OTLP endpoint from environment
	otlpEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if otlpEndpoint == "" {
		otlpEndpoint = "http://aspire-dashboard:18889" // Default to Aspire dashboard
	}

	serviceName := os.Getenv("OTEL_SERVICE_NAME")
	if serviceName == "" {
		serviceName = "mcp-oauth"
	}

	// Create OTLP HTTP exporter
	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(otlpEndpoint),
		otlptracehttp.WithInsecure(), // Use HTTP instead of HTTPS for internal services
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Create resource with service information
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String("1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	// Set global trace provider
	otel.SetTracerProvider(tp)

	// Set global propagator
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Create tracer
	tracer = otel.Tracer("mcp-oauth")

	// Return shutdown function
	return func() {
		if err := tp.Shutdown(context.Background()); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}, nil
}
