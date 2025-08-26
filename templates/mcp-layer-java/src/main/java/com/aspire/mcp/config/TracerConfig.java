package com.aspire.mcp.config;

import io.opentelemetry.api.trace.Tracer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TracerConfig {

    @Bean
    public Tracer tracer() {
        return io.opentelemetry.api.GlobalOpenTelemetry.getTracer("mcp-java");
    }
}
