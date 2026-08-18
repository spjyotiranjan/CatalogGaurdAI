from prometheus_client import CollectorRegistry, Counter, Histogram, generate_latest


class OrchestrationMetrics:
    def __init__(self) -> None:
        self.registry = CollectorRegistry(auto_describe=True)
        self.http_requests = Counter(
            "catalogguard_http_requests_total",
            "HTTP requests by method, route, and outcome.",
            ("method", "route", "status"),
            registry=self.registry,
        )
        self.http_duration = Histogram(
            "catalogguard_http_request_duration_seconds",
            "HTTP request duration by method and route.",
            ("method", "route"),
            registry=self.registry,
        )
        self.job_intake = Counter(
            "catalogguard_job_intake_total",
            "Validation job intake outcomes.",
            ("outcome",),
            registry=self.registry,
        )
        self.service_authentication = Counter(
            "catalogguard_service_authentication_total",
            "Service authentication outcomes.",
            ("outcome",),
            registry=self.registry,
        )

    def render(self) -> bytes:
        return generate_latest(self.registry)
