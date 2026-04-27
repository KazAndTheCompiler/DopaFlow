"""Distributed tracing with OpenTelemetry and Jaeger."""

from __future__ import annotations

import asyncio
import functools
import os
from collections.abc import Callable
from typing import Any

from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlite3 import SQLite3Instrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.trace import Span, Status, StatusCode

from app.core.version import APP_VERSION

# Global tracer provider
_tracer_provider: TracerProvider | None = None


def configure_tracing(
    service_name: str = "dopaflow",
    jaeger_endpoint: str | None = None,
    otlp_endpoint: str | None = None,
    console_export: bool = False,
    sample_rate: float = 1.0,
) -> TracerProvider:
    """Configure OpenTelemetry tracing.

    Args:
        service_name: Name of the service
        jaeger_endpoint: Jaeger collector endpoint (e.g., "http://jaeger:14268/api/traces")
        otlp_endpoint: OTLP collector endpoint (e.g., "http://otel-collector:4317")
        console_export: Export spans to console for debugging
        sample_rate: Sampling rate (0.0 to 1.0)
    """
    global _tracer_provider

    resource = Resource.create(
        {
            SERVICE_NAME: service_name,
            SERVICE_VERSION: APP_VERSION,
            "deployment.environment": os.getenv("ENVIRONMENT", "production"),
        }
    )

    provider = TracerProvider(
        resource=resource,
        sampler=trace.sampling.TraceIdRatioBased(sample_rate),
    )

    # Jaeger exporter
    if jaeger_endpoint:
        jaeger_exporter = JaegerExporter(
            agent_host_name=jaeger_endpoint.split(":")[1].replace("//", ""),
            agent_port=int(jaeger_endpoint.split(":")[-1]) if ":" in jaeger_endpoint else 6831,
        )
        provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))

    # OTLP exporter
    if otlp_endpoint:
        otlp_exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

    # Console exporter for debugging
    if console_export:
        console_exporter = ConsoleSpanExporter()
        provider.add_span_processor(BatchSpanProcessor(console_exporter))

    trace.set_tracer_provider(provider)
    _tracer_provider = provider

    return provider


def instrument_app(app) -> None:
    """Instrument FastAPI app with OpenTelemetry."""
    FastAPIInstrumentor.instrument_app(app)


def instrument_sqlite() -> None:
    """Instrument SQLite with OpenTelemetry."""
    SQLite3Instrumentor().instrument()


def get_tracer(name: str = "dopaflow") -> trace.Tracer:
    """Get a tracer instance."""
    return trace.get_tracer(name)


class TracingContext:
    """Context manager for manual span creation."""

    def __init__(
        self,
        span_name: str,
        attributes: dict[str, Any] | None = None,
        kind: trace.SpanKind = trace.SpanKind.INTERNAL,
    ):
        self.span_name = span_name
        self.attributes = attributes or {}
        self.kind = kind
        self._span: Span | None = None
        self._token: Any = None

    def __enter__(self) -> Span:
        tracer = get_tracer()
        self._span = tracer.start_as_current_span(
            self.span_name,
            kind=self.kind,
            attributes=self.attributes,
        )
        self._token = self._span.__enter__()
        return self._span

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._span:
            if exc_val:
                self._span.set_status(
                    Status(StatusCode.ERROR, description=str(exc_val))
                )
                self._span.record_exception(exc_val)
            self._span.__exit__(exc_type, exc_val, exc_tb)


def traced(
    span_name: str | None = None,
    attributes: dict[str, Any] | None = None,
):
    """Decorator to trace function execution."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            name = span_name or func.__name__
            with TracingContext(name, attributes):
                return func(*args, **kwargs)

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            name = span_name or func.__name__
            with TracingContext(name, attributes):
                return await func(*args, **kwargs)

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return wrapper

    return decorator


def add_span_attributes(span: Span | None, attributes: dict[str, Any]) -> None:
    """Add attributes to current span."""
    if span:
        for key, value in attributes.items():
            span.set_attribute(key, value)


def get_current_span() -> Span | None:
    """Get the current span from context."""
    return trace.get_current_span()


def set_span_error(error: Exception) -> None:
    """Mark current span as error."""
    span = get_current_span()
    if span:
        span.set_status(Status(StatusCode.ERROR, description=str(error)))
        span.record_exception(error)
