package com.aspire.mcp.service;

import io.jsonwebtoken.Claims;
import io.opentelemetry.api.trace.Tracer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtTokenServiceTest {

    @Mock
    private Tracer tracer;

    @Mock
    private Tracer.SpanBuilder spanBuilder;

    @Mock
    private Tracer.Span span;

    private JwtTokenService jwtTokenService;

    @BeforeEach
    void setUp() {
        when(tracer.spanBuilder(anyString())).thenReturn(spanBuilder);
        when(spanBuilder.startSpan()).thenReturn(span);
        when(span.makeCurrent()).thenReturn(mock(Tracer.SpanContext.class));
        
        jwtTokenService = new JwtTokenService(tracer);
    }

    @Test
    void testGenerateMockToken() {
        String token = jwtTokenService.generateMockToken();
        
        assertNotNull(token);
        assertTrue(token.split("\\.").length == 3); // JWT has 3 parts
        
        verify(span).setAttribute("oauth.token_generated", true);
        verify(span).setAttribute("oauth.token_issuer", "https://mock-oauth-provider.com");
        verify(span).setAttribute("oauth.token_subject", "mock-user-123");
        verify(span).end();
    }

    @Test
    void testParseToken() {
        String token = jwtTokenService.generateMockToken();
        Claims claims = jwtTokenService.parseToken(token);
        
        assertNotNull(claims);
        assertEquals("https://mock-oauth-provider.com", claims.getIssuer());
        assertEquals("mock-user-123", claims.getSubject());
        assertEquals("mcp-services", claims.getAudience());
        assertEquals("mock.user@example.com", claims.get("email"));
        assertEquals("Mock User", claims.get("name"));
    }

    @Test
    void testIsTokenValid() {
        String token = jwtTokenService.generateMockToken();
        assertTrue(jwtTokenService.isTokenValid(token));
        
        assertFalse(jwtTokenService.isTokenValid("invalid.token.here"));
    }
}
