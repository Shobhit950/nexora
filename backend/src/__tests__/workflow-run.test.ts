import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import { after, before, test, type TestContext } from 'node:test';
import type { WorkflowRunReport } from '../services/workflow-run.service';
import { executionGraph, json, startTestServer } from './workflow-run.fixtures';

// Load the real app and JWT middleware without connecting to PostgreSQL.
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.JWT_ACCESS_SECRET = 'test-only-signing-secret-for-the-workflow-run-suite';
process.env.REFRESH_TOKEN_DAYS = '7';
const { default: app } = require('../app') as typeof import('../app');
const { signAccessToken } = require('../services/access-token.service') as typeof import('../services/access-token.service');
const workflowService = require('../services/workflow.service') as typeof import('../services/workflow.service');

const ownerId = randomUUID();
const otherId = randomUUID();
const id = randomUUID();
const ownerToken = signAccessToken(ownerId);
const now = new Date();
const draft = {
  id, userId: ownerId, name: 'Uppercase and wait', description: null, status: 'draft' as const,
  createdAt: now, updatedAt: now, ...executionGraph(),
};
let server: Awaited<ReturnType<typeof startTestServer>>;

before(async () => { server = await startTestServer(app); });
after(async () => { await server?.close(); });

function replaceLookup(t: TestContext, workflow = draft) {
  return t.mock.method(workflowService, 'getWorkflow', async (userId: string, workflowId: string) =>
    userId === workflow.userId && workflowId === workflow.id ? workflow : undefined);
}

function run(workflowId: string, init: RequestInit) {
  return fetch(`${server.url}/api/workflows/${workflowId}/run`, { method: 'POST', ...init });
}

test('runs a saved draft in edge order and returns the transform and delay results', async t => {
  const lookup = replaceLookup(t);
  const input = { text: 'hello nexora', metadata: { tags: ['demo', null], trial: true } };
  const response = await run(id, json({ input }, ownerToken));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(lookup.mock.calls.map(call => call.arguments), [[ownerId, id]]);

  const report = await response.json() as WorkflowRunReport;
  const expected = { ...input, text: 'HELLO NEXORA' };
  assert.equal(report.workflowId, id);
  assert.equal(report.workflowName, draft.name);
  assert.equal(report.status, 'success');
  assert.deepEqual(report.output, expected);
  assert.deepEqual(report.nodes.map(node => [node.nodeId, node.nodeType, node.status]), [
    ['start', 'manualTrigger', 'success'], ['uppercase', 'transform', 'success'], ['wait', 'delay', 'success'],
  ]);
  const [trigger, transform, wait] = report.nodes;
  assert.ok(trigger?.status === 'success' && transform?.status === 'success' && wait?.status === 'success');
  assert.deepEqual(trigger.output, input);
  assert.deepEqual(transform.input, input);
  assert.deepEqual(transform.output, expected);
  assert.deepEqual(wait.input, expected);
  assert.deepEqual(wait.output, expected);
  assert.ok(wait.durationMs >= 15);
  for (const timing of [report, ...report.nodes]) {
    assert.equal(new Date(timing.startedAt).toISOString(), timing.startedAt);
    assert.equal(new Date(timing.finishedAt).toISOString(), timing.finishedAt);
    assert.ok(Date.parse(timing.finishedAt) >= Date.parse(timing.startedAt));
    assert.ok(Number.isFinite(timing.durationMs) && timing.durationMs >= 0);
  }
});

test('rejects missing or invalid Bearer tokens before parsing the body or loading a workflow', async t => {
  const lookup = replaceLookup(t);
  for (const token of [undefined, 'invalid-token']) {
    const response = await run(id, { ...json({}, token), body: '{' });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  }
  assert.equal(lookup.mock.callCount(), 0);
});

test('rejects an invalid workflow UUID before the database lookup', async t => {
  const lookup = replaceLookup(t);
  const response = await run('invalid-uuid', json({ input: null }, ownerToken));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid workflow request', fields: ['id'] });
  assert.equal(lookup.mock.callCount(), 0);
});

test('returns the same 404 for missing workflows and workflows owned by another user', async t => {
  const lookup = replaceLookup(t);
  const missingId = randomUUID();
  for (const [workflowId, token] of [[missingId, ownerToken], [id, signAccessToken(otherId)]] as const) {
    const response = await run(workflowId, json({ input: null }, token));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Workflow not found' });
  }
  assert.deepEqual(lookup.mock.calls.map(call => call.arguments), [[ownerId, missingId], [otherId, id]]);
});

test('rejects malformed, oversized, deeply nested and unexpected run payloads before lookup', async t => {
  const lookup = replaceLookup(t);
  const nested: unknown = Array.from({ length: 25 }).reduce<unknown>(value => [value], 'nested');
  const cases: [RequestInit, number][] = [
    [json({}, ownerToken), 400],
    [json([{ input: null }], ownerToken), 400],
    [json({ input: {}, userId: otherId }, ownerToken), 400],
    [json({ input: {}, timeoutMs: 60_000 }, ownerToken), 400],
    [json({ input: {}, nodes: [], edges: [] }, ownerToken), 400],
    [json({ input: nested }, ownerToken), 400],
    [json({ input: 'x'.repeat(17 * 1024) }, ownerToken), 413],
    [{ ...json(null, ownerToken), body: '{' }, 400],
    [{ ...json(null, ownerToken), body: '{"input":{"nested":{"__proto__":{"unsafe":true}}}}' }, 400],
    [{ ...json(null, ownerToken), body: '{"input":{"number":1e999}}' }, 400],
    [{
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
      body: 'compressed',
    }, 415],
  ];
  for (const [request, status] of cases) {
    const response = await run(id, request);
    assert.equal(response.status, status);
    const payload = await response.json() as { error: unknown };
    assert.equal(typeof payload.error, 'string');
  }
  assert.equal(lookup.mock.callCount(), 0);
});

test('passes through safe JSON without a text field when the graph has no transform', async t => {
  const nodes = draft.nodes.filter(node => node.type === 'manualTrigger');
  replaceLookup(t, { ...draft, nodes, edges: [] });
  for (const input of [null, true, 2, 'hello', ['hello', 2], { labels: ['demo'] }]) {
    const response = await run(id, json({ input }, ownerToken));
    assert.equal(response.status, 200);
    const report = await response.json() as WorkflowRunReport;
    assert.deepEqual(report.output, input);
  }
});

test('returns engine validation issues for an invalid saved graph without running any nodes', async t => {
  replaceLookup(t, { ...draft, edges: [] });
  const response = await run(id, json({ input: { text: 'hi' } }, ownerToken));
  assert.equal(response.status, 422);
  const report = await response.json() as WorkflowRunReport;
  assert.ok(report.status === 'failed' && report.error.code === 'INVALID_GRAPH');
  assert.equal(report.error.issues[0]?.code, 'DISCONNECTED');
  assert.deepEqual(report.nodes, []);
  assert.equal(report.output, null);
});

test('reports a real transform node failure for missing or non-string text', async t => {
  replaceLookup(t);
  for (const input of [{ text: 42 }, { metadata: true }, 'hello']) {
    const response = await run(id, json({ input }, ownerToken));
    assert.equal(response.status, 400);
    const report = await response.json() as WorkflowRunReport;
    assert.ok(report.status === 'failed' && report.error.code === 'INVALID_TRANSFORM_INPUT');
    assert.equal(report.output, null);
    assert.deepEqual(report.nodes.map(node => [node.nodeId, node.status]), [
      ['start', 'success'], ['uppercase', 'failed'],
    ]);
    const failed = report.nodes[1];
    assert.ok(failed?.status === 'failed');
    assert.deepEqual(failed.error, report.error);
  }
});

test('reports an unexpected node failure without exposing the executor exception', async t => {
  replaceLookup(t);
  const transform = require('../engine/executors/transform.executor') as typeof import('../engine/executors/transform.executor');
  t.mock.method(transform, 'executeTransform', () => { throw new Error('private executor details'); });
  const response = await run(id, json({ input: { text: 'hi' } }, ownerToken));
  assert.equal(response.status, 500);
  const report = await response.json() as WorkflowRunReport;
  assert.ok(report.status === 'failed' && report.error.code === 'NODE_EXECUTION_FAILED');
  assert.deepEqual(report.nodes.map(node => node.status), ['success', 'failed']);
  assert.doesNotMatch(JSON.stringify(report), /private executor details|stack/);
});

test('cancels an unfinished delay at the server deadline and returns a partial report', { timeout: 12_000 }, async t => {
  replaceLookup(t, { ...draft, ...executionGraph(60_000) });
  const response = await run(id, json({ input: { text: 'hi' } }, ownerToken));
  assert.equal(response.status, 504);
  const report = await response.json() as WorkflowRunReport;
  assert.ok(report.status === 'cancelled' && report.error.code === 'TIMEOUT');
  assert.equal(report.output, null);
  assert.deepEqual(report.nodes.map(node => [node.nodeId, node.status]), [
    ['start', 'success'], ['uppercase', 'success'], ['wait', 'cancelled'],
  ]);
});

test('aborts the engine when the HTTP client disconnects', { timeout: 8_000 }, async t => {
  replaceLookup(t, { ...draft, ...executionGraph(60_000) });
  const engine = require('../engine/execution-engine') as typeof import('../engine/execution-engine');
  const execute = engine.executeWorkflow;
  const events = new EventEmitter();
  const started = once(events, 'started');
  const finished = once(events, 'finished');
  t.mock.method(engine, 'executeWorkflow', async (...args: Parameters<typeof execute>) => {
    const result = execute(...args);
    events.emit('started');
    const report = await result;
    events.emit('finished', report);
    return report;
  });

  const client = new AbortController();
  const response = run(id, { ...json({ input: { text: 'hi' } }, ownerToken), signal: client.signal });
  const disconnected = assert.rejects(response, { name: 'AbortError' });
  await started;
  client.abort();
  await disconnected;
  const [report] = await finished as [WorkflowRunReport];
  assert.ok(report.status === 'cancelled' && report.error.code === 'ABORTED');
});

test('returns a generic error if the database lookup throws', async t => {
  t.mock.method(workflowService, 'getWorkflow', async () => { throw new Error('private database details'); });
  t.mock.method(console, 'error', () => {});
  const response = await run(id, json({ input: null }, ownerToken));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unable to process workflow request' });
});
