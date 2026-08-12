from fastapi import APIRouter, Request, Response

router = APIRouter(tags=["operations"])


@router.get(
    "/internal/metrics",
    operation_id="getOrchestrationMetrics",
    summary="Read Prometheus metrics",
    description=(
        "Returns internal Prometheus text exposition for request duration, request outcomes, "
        "job intake, and service-authentication outcomes. Expose only on the private "
        "operations network."
    ),
    response_class=Response,
    responses={
        200: {
            "description": "Prometheus text exposition.",
            "content": {
                "text/plain": {
                    "schema": {"type": "string"},
                    "example": "# HELP catalogguard_http_requests_total HTTP requests...",
                }
            },
        }
    },
)
async def metrics(request: Request) -> Response:
    return Response(
        content=request.app.state.metrics.render(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
