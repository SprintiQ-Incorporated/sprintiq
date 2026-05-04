# Task Queue API

Async AI task processing via QStash workers.

## Lifecycle

```
queued → running → complete
                 → failed
                 → dead_lettered (DLQ)
```

- **queued**: Row inserted, QStash message published
- **running**: Worker received the message, processing started
- **complete**: Worker finished successfully, `result` and `result_meta` populated
- **failed**: Worker caught an error, `error_message` populated
- **dead_lettered**: QStash exhausted retries, DLQ callback fired

## Enqueue Task

```
POST /api/tasks/enqueue
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-CSRF-Token` | Yes | CSRF protection token |
| `X-SprintIQ-Source` | No | Overrides body `source` field (e.g. `cli`) |

### Request Body

```json
{
  "workspaceId": "uuid",
  "task_type": "epic_breakdown",
  "queue": "fast",
  "source": "web",
  "payload": { ... }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `workspaceId` | UUID | Yes | — | Target workspace |
| `task_type` | string | Yes | — | Task type identifier |
| `queue` | `fast` \| `heavy` \| `embeddings` | No | `fast` | Worker queue |
| `source` | string | No | `web` | Request origin |
| `payload` | object | Yes | — | Task-specific data |

### Response (202)

```json
{
  "taskId": "uuid",
  "messageId": "qstash-msg-id",
  "status": "queued",
  "pollUrl": "/api/tasks/{taskId}"
}
```

## Poll Task Status

```
GET /api/tasks/{taskId}
```

Requires Supabase auth (cookie or JWT). RLS enforces workspace scoping — returns 404 if the user is not a member of the task's workspace.

### Response

```json
{
  "taskId": "uuid",
  "status": "running",
  "queue": "fast",
  "task_type": "epic_breakdown",
  "source": "web",
  "created_at": "2026-02-26T00:00:00Z",
  "started_at": "2026-02-26T00:00:01Z",
  "completed_at": null,
  "failed_at": null,
  "result": null,
  "result_meta": null,
  "error": null
}
```

### `result_meta` (on completion)

```json
{
  "model": "claude-sonnet-4-6-20250514",
  "input_tokens": 1200,
  "output_tokens": 800,
  "cost_usd": 0.012,
  "duration_ms": 3400
}
```

### Caching

- In-flight tasks (`queued`, `running`): `Cache-Control: no-store`
- Terminal states (`complete`, `failed`, `dead_lettered`): `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=60`

## Polling Guidance

### Web UI
- Poll every **2 seconds**
- Stop on terminal status (`complete`, `failed`, `dead_lettered`)
- Maximum **150 polls** (5 minutes) before showing timeout UI

### CLI
- Authenticate via Supabase JWT in `Authorization: Bearer <token>` header
- Same polling interval and limits as web
