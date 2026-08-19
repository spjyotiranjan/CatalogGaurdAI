# Phase 2 feed-upload fixtures

Use these files from the seller feed-upload screen. Each file is intentionally under the default 10 MiB upload limit and has a distinct checksum, so it can be uploaded once per seller account.

| File | What it verifies | Expected result |
| --- | --- | --- |
| `phase2-valid-product-listing.csv` | Supported canonical headers, optional values, whitespace/case normalization, prices, and zero inventory. | All 12 rows normalize successfully when the ingestion job is processed. |
| `phase2-mixed-row-outcomes.csv` | Header aliases, good rows alongside missing required data, ambiguous/invalid decimals, and invalid inventory. | Seven rows are accepted and seven rows are recorded as failed; the job itself can complete because bad rows do not hide good rows. |
| `phase2-rejected-upload.csv` | The Web upload guard before R2 storage and Orchestration dispatch. | Upload is rejected with an error asking for a comma-separated header row and data row. |

## Important current boundary

The upload flow stores a file, creates the job, and sends it to Orchestration. Phase 2 provides the streaming ingestion service, but Phase 4 owns the continuously running worker and automatic result callback. Until that worker is in place, a UI-uploaded feed can stay in `PROCESSING`; use the automated ingestion tests to verify the row-level processing implementation.

## CSV rules exercised here

- CSV is UTF-8 and comma separated.
- `sku`, external product identifier, and title are required for a normalized row. In the current `catalog-map/v1` mapping, `sku` also acts as the external product identifier when a separate ID column is absent.
- Decimal numbers use `.`; comma-separated or scientific-notation values are rejected.
- Inventory must be a non-negative integer; `0` is valid.
- Extra supported aliases include `product title`, `product description`, `price`, and `stock`.
