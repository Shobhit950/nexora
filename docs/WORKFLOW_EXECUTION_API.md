# Run a saved workflow

`POST /api/workflows/:id/run` runs a saved workflow synchronously. Send a Bearer access token from `POST /api/auth/login` and a JSON body with one field, `input`.

```json
{
  "input": {
    "text": "hello nexora",
    "metadata": { "source": "postman" }
  }
}
```

The API accepts uncompressed JSON bodies up to 16 KiB and limits nesting within `input` to 24 levels. Only JSON-compatible values and safe object keys are allowed. For graphs with a Text Transform node, supply a string at `input.text`. Other input fields are passed through the built-in nodes. Graphs without a Text Transform can accept any permitted JSON value, including `null`. The runner gets its user identity from the JWT and its graph from PostgreSQL.

The lookup matches the workflow UUID and authenticated user UUID in the same PostgreSQL query. The Phase 3A engine receives the saved JSONB nodes and edges after the lookup completes. It validates the graph and runs the nodes in edge order. Draft status is compatible with manual execution. Running a workflow leaves the saved row untouched and does not keep a database transaction open.

## Response

An execution report includes `workflowId`, `workflowName`, `status`, `startedAt`, `finishedAt`, `durationMs`, `output`, and an ordered `nodes` array. Overall and per-node statuses are `success`, `failed`, or `cancelled`. Timestamps are UTC ISO 8601 strings. A failed or cancelled report has a null final output and an `error` with a stable code and message. Node results include input and timing, plus output on success or an error on failure.

| HTTP status | Meaning |
| --- | --- |
| `200` | Execution succeeded. If a cancellation can still be reported to the caller, the report has status `cancelled`. |
| `400` | Invalid UUID, malformed body, or invalid input. If the Text Transform rejects its input, this includes the execution report and the nodes already attempted. |
| `401` | Missing or invalid Bearer token. |
| `404` | The workflow could not be found for the authenticated user. |
| `413` | Request body exceeds 16 KiB. |
| `415` | Unsupported request encoding. |
| `422` | The saved graph failed engine validation. The report includes graph issues. |
| `504` | The engine exceeded its five-second execution limit. The report includes completed and interrupted nodes. |
| `500` | An unexpected server or execution error. |

The server sets the execution limit. A disconnected client cancels work through the engine's abort signal. Responses that contain reports use `Cache-Control: no-store`. This endpoint is intended for short local MVP runs. Long-running and background workflows will need a job queue and a separate results API.

## Try it in Postman

Start the backend against the local PostgreSQL database with the existing migrations applied. The default backend URL is `http://localhost:8000`.

1. Send `POST /api/auth/login` with your email and password as JSON. Copy the response's `accessToken`.
2. Set Authorization to **Bearer Token** for the workflow requests and use that token. Send `POST /api/workflows` with `{"name":"Uppercase and wait"}`. Copy the workflow `id` from the response.
3. Send `PATCH /api/workflows/{id}` with the following raw JSON body to save a draft graph.

```json
{
  "nodes": [
    { "id": "start", "type": "manualTrigger", "position": { "x": 0, "y": 0 }, "data": {} },
    { "id": "uppercase", "type": "transform", "position": { "x": 200, "y": 0 }, "data": { "operation": "uppercase" } },
    { "id": "wait", "type": "delay", "position": { "x": 400, "y": 0 }, "data": { "durationMs": 100 } }
  ],
  "edges": [
    { "id": "start-uppercase", "source": "start", "target": "uppercase" },
    { "id": "uppercase-wait", "source": "uppercase", "target": "wait" }
  ]
}
```

4. Send `POST /api/workflows/{id}/run` with `Content-Type: application/json` and `{"input":{"text":"hello nexora"}}`. Expect HTTP 200, `output.text` set to `HELLO NEXORA`, and results ordered `start`, `uppercase`, `wait`.
5. Try `{"input":{"text":42}}` to see an HTTP 400 report with `INVALID_TRANSFORM_INPUT`. To test cancellation by deadline, save the same graph with a delay greater than 5,000 ms, then run again. Expect HTTP 504 and a cancelled delay result.

## Automated checks

Run these from `backend`.

- `npm test` builds the backend and runs the Phase 3A engine tests and HTTP tests with a mocked database lookup. It uses the real JWT middleware and execution engine.
- `npm run test:integration` requires the configured, migrated development PostgreSQL database. It creates isolated test accounts, saves and runs a draft through the API, verifies ownership and existing workflow CRUD and session routes, and removes its fixtures.

## Execution history storage

Migration `0002_add_execution_history.sql` defines the storage for completed execution reports. The current run endpoint returns its report directly. A later phase will persist the execution row and its ordered steps together in one transaction.

| Execution field | Purpose |
| --- | --- |
| `id` | Database-generated UUID for the run. |
| `userId` | Required owner UUID. User deletion cascades to that user's runs and steps. |
| `workflowId` | Link to the saved workflow. Workflow deletion sets it to null and preserves history. |
| `workflowNameSnapshot` | Name captured at execution time, retained across renames and deletion. |
| `status` | `success`, `failed`, or `cancelled`, from the engine report. |
| `input`, `output` | Redacted JSONB markers for the run input and available final output. Failed and cancelled runs have SQL null output. |
| `errorCode`, `errorMessage` | Engine error code and fixed, safe message for unsuccessful runs. Both are null on success. |
| `startedAt`, `finishedAt` | Engine start and finish times as timestamps with time zone. |
| `durationMs` | Engine-measured elapsed milliseconds, including fractional precision. |
| `createdAt` | Database insertion time used for retention. |

| Step field | Purpose |
| --- | --- |
| `id`, `executionId` | Database-generated step UUID and required parent run UUID. Deleting the run deletes its steps. |
| `nodeId`, `nodeType` | Identify the node that ran and the executor used. |
| `stepOrder` | Zero-based position in the engine report. Unique within a run. |
| `status`, `input`, `output` | Node outcome and redacted JSONB markers. Output is SQL null when the step failed or was cancelled. |
| `errorCode`, `errorMessage` | Safe error details for unsuccessful steps. |
| `startedAt`, `finishedAt`, `durationMs` | Timing measured for that node. |

### Privacy and payload limits

Phase 3 accepts ordinary JSON, including free-form text and nested metadata. A token or password can appear under any key or as a top-level value. The history mapper stores only markers such as `{"type":"object","redacted":true}`. The marker has a fixed shape with six allowed types, at most 34 bytes in compact JSON. The database checks enforce that shape. A successful JSON null value has its own marker. The mapper also caps a report at 100 steps and looks up stored error messages by error code. Exception text, graph issue details, and raw payloads stay out of the history record.

Use workflow names and node IDs as non-secret labels. The name snapshot and node identifiers preserve those labels as supplied by the saved workflow. The storage mapper takes the authenticated owner's UUID and never needs authorization headers, JWTs, refresh tokens, or integration credentials. Future node integrations should keep credentials in dedicated secret storage and preserve the marker policy for arbitrary payloads. Any richer history fields should come from a reviewed allowlist of bounded, non-secret metadata.

### Ownership and retention

Every history list or detail query must scope by the authenticated user's UUID. Authorize step reads through the owner-scoped execution row. A persistence implementation should derive the owner and workflow IDs from the existing authenticated run and handle workflow deletion during a run. Execution indexes cover newest-first lists, workflow and status filters, and owner-scoped time ranges for chart counts and duration summaries. The unique step index supports ordered retrieval and the `createdAt` index supports expiry jobs.

Choose a retention period before enabling history writes. Delete expired executions in batches so their steps cascade. Any aggregate charts that need a longer window can retain owner-scoped counts and duration summaries under a separate policy. Account deletion should also be reflected in backups and derived data according to the deployment's retention policy.
