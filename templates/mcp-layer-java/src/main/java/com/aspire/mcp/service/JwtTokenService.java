package com.aspire.mcp.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtTokenService {

    private final Tracer tracer;
    private final SecretKey secretKey;

    @Autowired
    public JwtTokenService(Tracer tracer) {
        this.tracer = tracer;
        this.secretKey = Keys.secretKeyFor(SignatureAlgorithm.HS256);
    }

    public String generateMockToken() {
        Span span = tracer.spanBuilder("generate-mock-token").startSpan();
        try (var scope = span.makeCurrent()) {
            Instant now = Instant.now();
            Instant expiration = now.plusSeconds(3600); // 1 hour

            Map<String, Object> claims = new HashMap<>();
            claims.put("iss", "https://mock-oauth-provider.com");
            claims.put("sub", "mock-user-123");
            claims.put("aud", "mcp-services");
            claims.put("groups", Arrays.asList("admin", "developers", "mcp-users"));
            claims.put("email", "mock.user@example.com");
            claims.put("name", "Mock User");

            String token = Jwts.builder()
                    .setClaims(claims)
                    .setIssuedAt(Date.from(now))
                    .setExpiration(Date.from(expiration))
                    .signWith(secretKey)
                    .compact();

            span.setAttribute("oauth.token_generated", true);
            span.setAttribute("oauth.token_issuer", "https://mock-oauth-provider.com");
            span.setAttribute("oauth.token_subject", "mock-user-123");

            return token;
        } finally {
            span.end();
        }
    }

    public Claims parseToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(secretKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean isTokenValid(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
