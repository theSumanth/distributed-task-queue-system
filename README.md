# distributed-task-queue-system

## Prometheus metrics

Metrics are exposed per process:

- API: `GET /metrics` on the API port, for example `app:8080/metrics` in Docker Compose.
- Queue worker: `queue-worker:9101/metrics`.
- Outbox worker: `outbox-worker:9102/metrics`.

Set `METRICS_TOKEN` to require `Authorization: Bearer <token>` for all metrics endpoints. When the token is empty, metrics are available on the configured internal host/port without authentication.

The emitted labels are intentionally low-cardinality. They use route templates, known job types/statuses, queue states, and normalized database operation/table names instead of raw URLs, job IDs, SQL text, payloads, error messages, or correlation IDs.
