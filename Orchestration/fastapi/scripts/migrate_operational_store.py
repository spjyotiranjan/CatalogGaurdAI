import asyncio

from app.core.config import get_settings
from app.repositories.operational import OperationalRepository


async def migrate() -> None:
    settings = get_settings()
    repository = OperationalRepository(settings.operational_db_path)
    await repository.migrate()
    print(
        "Operational store migration complete: "
        f"schema v{repository.SCHEMA_VERSION} at {settings.operational_db_path}"
    )


if __name__ == "__main__":
    asyncio.run(migrate())
