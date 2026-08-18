from fastapi import APIRouter, Request, Response

router = APIRouter(tags=["operations"])


@router.get("/internal/metrics", include_in_schema=False)
async def metrics(request: Request) -> Response:
    return Response(
        content=request.app.state.metrics.render(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
