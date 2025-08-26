package com.aspire.mcp.controller;

import com.aspire.mcp.service.JwtTokenService;
import com.aspire.mcp.service.McpProxyService;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/")
public class McpProxyController {

    private final McpProxyService mcpProxyService;
    private final JwtTokenService jwtTokenService;
    private final Tracer tracer;

    @Autowired
    public McpProxyController(McpProxyService mcpProxyService, 
                            JwtTokenService jwtTokenService, 
                            Tracer tracer) {
        this.mcpProxyService = mcpProxyService;
        this.jwtTokenService = jwtTokenService;
        this.tracer = tracer;
    }

    @RequestMapping(value = "/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
    public Mono<ResponseEntity<String>> proxyRequest(
            HttpServletRequest request,
            @RequestBody(required = false) String body,
            @RequestHeader Map<String, String> headers) {
        
        Span span = tracer.spanBuilder("mcp-java-request").startSpan();
        try (var scope = span.makeCurrent()) {
            String path = request.getRequestURI();
            HttpMethod method = HttpMethod.valueOf(request.getMethod());
            
            // Add request attributes to span
            span.setAttribute("http.method", method.name());
            span.setAttribute("http.url", request.getRequestURL().toString());
            span.setAttribute("http.user_agent", request.getHeader("User-Agent"));
            span.setAttribute("mcp.java.service", "mcp-policy-guard");

            // Filter out sensitive headers
            Map<String, String> filteredHeaders = headers.entrySet().stream()
                    .filter(entry -> !entry.getKey().toLowerCase().contains("authorization"))
                    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

            return mcpProxyService.forwardRequest(path, method, filteredHeaders, body)
                    .map(response -> ResponseEntity.ok(response))
                    .onErrorResume(error -> {
                        span.recordException(error);
                        span.setAttribute("mcp.java.error", error.getMessage());
                        return Mono.just(ResponseEntity.status(502).body("Bad Gateway: " + error.getMessage()));
                    });
        } finally {
            span.end();
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }

    @GetMapping("/ready")
    public Mono<ResponseEntity<String>> ready() {
        // Check if policy guard service is reachable
        return mcpProxyService.forwardRequest("/health", HttpMethod.GET, new HashMap<>(), null)
                .map(response -> ResponseEntity.ok("Ready"))
                .onErrorResume(error -> 
                    Mono.just(ResponseEntity.status(503).body("Policy guard service not ready")));
    }

    @GetMapping("/token")
    public ResponseEntity<Map<String, Object>> token() {
        try {
            String token = jwtTokenService.generateMockToken();
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("note", "This is a mock token for development purposes");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to generate token"));
        }
    }
}
