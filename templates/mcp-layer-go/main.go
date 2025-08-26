package main

import (
	"context"
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

func main() {
	// Initialize OpenTelemetry
	ctx := context.Background()
	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize tracer: %v", err)
	}
	defer shutdown()

	// Get configuration from environment variables
	targetMCP := os.Getenv("MCP_SERVER_URL") // Keep for backward compatibility


	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	// Parse the aggregator URL
	target, err := url.Parse(targetMCP)
	if err != nil {
		log.Fatalf("Failed to parse aggregator URL: %v", err)
	}

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom director to add tracing headers
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)

		// Extract trace context from the current request
		ctx := req.Context()
		span := trace.SpanFromContext(ctx)

		// Inject trace context into headers for downstream service
		propagator := otel.GetTextMapPropagator()
		propagator.Inject(ctx, propagation.HeaderCarrier(req.Header))

		// Add custom attributes to the span
		span.SetAttributes(
			attribute.String("mcp.proxy.target", targetMCP),
			attribute.String("mcp.proxy.method", req.Method),
			attribute.String("mcp.proxy.path", req.URL.Path),
		)
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		ctx := r.Context()
		span := trace.SpanFromContext(ctx)
		span.RecordError(err)
		span.SetAttributes(attribute.String("mcp.proxy.error", err.Error()))

		log.Printf("Proxy error: %v", err)
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
	}

	// Create HTTP handler with OpenTelemetry instrumentation
	handler := otelhttp.NewHandler(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, span := tracer.Start(r.Context(), "mcp-proxy-request")
			defer span.End()

			// Add request attributes
			span.SetAttributes(
				attribute.String("http.method", r.Method),
				attribute.String("http.url", r.URL.String()),
				attribute.String("http.user_agent", r.UserAgent()),
				attribute.String("mcp.proxy.service", "mcp-aggregator"),
			)

			// Update request context
			r = r.WithContext(ctx)

			// Log the request
			log.Printf("Proxying %s %s to %s", r.Method, r.URL.Path, targetMCP)

			// Forward to the proxy
			proxy.ServeHTTP(w, r)
		}),
		"mcp-policy-guard",
	)

	// Add health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Add readiness check endpoint
	http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		// Check if aggregator service is reachable
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(targetMCP + "/health")
		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Aggregator service not ready"))
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Ready"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Aggregator service not healthy"))
		}
	})

	// Handle all other requests with the proxy
	http.Handle("/", handler)

	log.Printf("MCP Policy Guard starting on port %s, forwarding to %s", port, targetMCP)
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
		serviceName = "mcp-policy-guard"
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
	tracer = otel.Tracer("mcp-policy-guard")

	// Return shutdown function
	return func() {
		if err := tp.Shutdown(context.Background()); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}, nil
}
