from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import Settings

_configured_provider: TracerProvider | None = None


def configure_telemetry(settings: Settings) -> TracerProvider:
    global _configured_provider
    if _configured_provider is not None:
        return _configured_provider

    provider = TracerProvider(
        resource=Resource.create(
            {
                "service.name": settings.service_name,
                "service.version": settings.service_version,
                "deployment.environment.name": settings.environment,
            }
        )
    )
    if settings.otel_exporter_otlp_endpoint is not None:
        exporter = OTLPSpanExporter(endpoint=str(settings.otel_exporter_otlp_endpoint))
        provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _configured_provider = provider
    return provider
