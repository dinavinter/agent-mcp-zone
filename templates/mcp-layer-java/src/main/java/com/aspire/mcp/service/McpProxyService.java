package com.aspire.mcp.service;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.TextMapSetter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
public class McpProxyService {

    private final WebClient webClient;
    private final JwtTokenService jwtTokenService;
    private final Tracer tracer;
    private final String policyGuardUrl;

    @Autowired
    public McpProxyService(WebClient webClient, 
                          JwtTokenService jwtTokenService, 
                          Tracer tracer,
                          @Value("${policy.guard.url:http://mcp-policy-guard:8090}") String policyGuardUrl) {
        this.webClient = webClient;
        this.jwtTokenService = jwtTokenService;
        this.tracer = tracer;
        this.policyGuardUrl = policyGuardUrl;
    }

    public Mono<String> forwardRequest(String path, HttpMethod method, Map<String, String> headers, String body) {
        Span span = tracer.spanBuilder("mcp-java-forward-request").startSpan();
        try (var scope = span.makeCurrent()) {
            // Generate mock token
            String token = jwtTokenService.generateMockToken();
            
            // Add tracing attributes
            span.setAttribute("mcp.java.target", policyGuardUrl);
            span.setAttribute("mcp.java.method", method.name());
            span.setAttribute("mcp.java.path", path);
            span.setAttribute("oauth.token_generated", true);

            // Prepare headers
            HttpHeaders requestHeaders = new HttpHeaders();
            headers.forEach(requestHeaders::add);
            requestHeaders.setBearerAuth(token);
            requestHeaders.setContentType(MediaType.APPLICATION_JSON);

            // Inject trace context into headers
            TextMapSetter<HttpHeaders> setter = (carrier, key, value) -> carrier.add(key, value);
            Context.current().getPropagators().getTextMapPropagator().inject(Context.current(), requestHeaders, setter);

            // Build the request
            WebClient.RequestBodySpec requestSpec = webClient
                    .method(method)
                    .uri(policyGuardUrl + path)
                    .headers(h -> h.addAll(requestHeaders));

            // Add body if present
            if (body != null && !body.isEmpty()) {
                requestSpec.bodyValue(body);
            }

            return requestSpec
                    .retrieve()
                    .bodyToMono(String.class)
                    .doOnSuccess(response -> {
                        span.setAttribute("mcp.java.response.success", true);
                    })
                    .doOnError(error -> {
                        span.recordException(error);
                        span.setAttribute("mcp.java.response.success", false);
                    });

        } finally {
            span.end();
        }
    }
}
