from app.repositories.operational import OperationalRepository


class DurableQueue:
    """Repository-backed queue seam; worker claim/ack behavior arrives in Phase 4."""

    def __init__(self, repository: OperationalRepository) -> None:
        self._repository = repository

    async def readiness_check(self) -> None:
        await self._repository.ping()

    async def depth(self) -> int:
        return await self._repository.queue_depth()
