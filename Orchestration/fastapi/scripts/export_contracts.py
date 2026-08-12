import json
from pathlib import Path
from typing import Any

from app.contracts.jobs import ValidationJobRequestV1
from app.contracts.results import ValidationJobResultV1


def _schema(model: type[Any], *, schema_id: str, title: str) -> dict[str, Any]:
    schema = model.model_json_schema(by_alias=True, mode="serialization")
    return {"$id": schema_id, "title": title, **schema}


def main() -> None:
    output = Path(__file__).resolve().parents[2] / "contracts" / "v1"
    output.mkdir(parents=True, exist_ok=True)
    schemas = {
        "validation-job-request.schema.json": _schema(
            ValidationJobRequestV1,
            schema_id="https://catalogguard.local/contracts/v1/validation-job-request.schema.json",
            title="CatalogGuard ValidationJobRequest v1",
        ),
        "validation-job-result.schema.json": _schema(
            ValidationJobResultV1,
            schema_id="https://catalogguard.local/contracts/v1/validation-job-result.schema.json",
            title="CatalogGuard ValidationJobResult v1",
        ),
    }
    for filename, schema in schemas.items():
        (output / filename).write_text(
            json.dumps(schema, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
