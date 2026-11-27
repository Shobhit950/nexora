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
