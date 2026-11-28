import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareExecutionHistory } from '../db/execution-history.mapper';
import type { ExecutionPayloadSummary } from '../db/execution-history.types';
import type { WorkflowJsonValue } from '../db/workflow.types';
import { executeWorkflow } from '../engine/execution-engine';
import type { NodeExecutionResult } from '../engine/execution.types';
import type { WorkflowRunReport } from '../services/workflow-run.service';

const ownerId = 'bcd34aa6-f6c9-48d7-b995-93a7f6f2546e';
const workflowId = '52d06877-bf83-4d39-a692-ad9fb90246b8';
const workflowName = 'Uppercase sample';
const trigger = { id: 'start', type: 'manualTrigger', position: { x: 0, y: 0 }, data: {} };
const transform = { id: 'uppercase', type: 'transform', position: { x: -1, y: 0 }, data: { operation: 'uppercase' } };
const graph = {
  nodes: [transform, trigger],
  edges: [{ id: 'next', source: 'start', target: 'uppercase' }],
};
const triggerOnly = { nodes: [trigger], edges: [] };

async function run(input: WorkflowJsonValue): Promise<WorkflowRunReport> {
  return { workflowId, workflowName, ...await executeWorkflow(graph, input) };
}

test('maps a real engine report into ordered rows with timestamps and duration', async () => {
  const input = { text: 'hello nexora' };
  const report = await run(input);
  assert.equal(report.status, 'success');
  const prepared = prepareExecutionHistory(ownerId, input, report);
  assert.deepEqual(prepared.execution, {
    userId: ownerId,
    workflowId,
    workflowNameSnapshot: workflowName,
    status: 'success',
    input: { type: 'object', redacted: true },
    output: { type: 'object', redacted: true },
    errorCode: null,
    errorMessage: null,
    startedAt: new Date(report.startedAt),
    finishedAt: new Date(report.finishedAt),
    durationMs: report.durationMs,
  });
  assert.deepEqual(prepared.steps.map(step => [step.stepOrder, step.nodeId, step.nodeType, step.status]), [
    [0, 'start', 'manualTrigger', 'success'],
    [1, 'uppercase', 'transform', 'success'],
  ]);
  for (const [index, step] of prepared.steps.entries()) {
    const node: NodeExecutionResult | undefined = report.nodes[index];
    assert.ok(node);
    assert.equal(step.startedAt.toISOString(), node.startedAt);
    assert.equal(step.finishedAt.toISOString(), node.finishedAt);
    assert.equal(step.durationMs, node.durationMs);
  }
  assert.deepEqual(report.output, { text: 'HELLO NEXORA' });
});

test('stores only a bounded type marker regardless of payload keys and size', async () => {
  const key = 'sample-credential-key';
  const value = 'sample-unlabeled-secret'.repeat(10_000);
  const input = { text: value, [key]: { refreshToken: value } };
  const prepared = prepareExecutionHistory(ownerId, input, await run(input));
  for (const row of [prepared.execution, ...prepared.steps]) {
    assert.deepEqual(row.input, { type: 'object', redacted: true });
    assert.deepEqual(row.output, { type: 'object', redacted: true });
    assert.ok(Buffer.byteLength(JSON.stringify(row.input)) <= 33);
  }
  assert.doesNotMatch(JSON.stringify(prepared), /sample-credential-key|sample-unlabeled-secret|refreshToken/i);
});

test('keeps only the kind of each JSON value and distinguishes successful null from missing output', async () => {
  const examples: Array<[WorkflowJsonValue, ExecutionPayloadSummary['type']]> = [
    [null, 'null'], [false, 'boolean'], [1234, 'number'],
    ['unlabeled secret', 'string'], [['secret'], 'array'], [{ secret: true }, 'object'],
  ];
  for (const [input, type] of examples) {
    const report = { workflowId, workflowName, ...await executeWorkflow(triggerOnly, input) };
    const { execution, steps } = prepareExecutionHistory(ownerId, input, report);
    assert.deepEqual(execution.input, { type, redacted: true });
    assert.ok(Buffer.byteLength(JSON.stringify(execution.input)) <= 34);
    assert.deepEqual(execution.output, { type, redacted: true });
    assert.deepEqual(steps[0]?.output, { type, redacted: true });
  }
});

test('retains failed step data safely and replaces raw error messages', async () => {
  const input = { text: 1234 };
  const report = await run(input);
  assert.equal(report.status, 'failed');
  const failedNode = report.nodes[1];
  assert.ok(failedNode?.status === 'failed');
  report.error.message = 'credential from an internal error';
  failedNode.error.message = 'credential from a node error';
  const prepared = prepareExecutionHistory(ownerId, input, report);
  for (const result of [prepared.execution, prepared.steps[1]]) {
    assert.ok(result);
    assert.equal(result.status, 'failed');
    assert.equal(result.output, null);
    assert.equal(result.errorCode, 'INVALID_TRANSFORM_INPUT');
    assert.equal(result.errorMessage, 'Transform input must be an object with a string text field.');
  }
  assert.doesNotMatch(JSON.stringify(prepared), /credential/);
});

test('drops raw graph issues and supports a failure or cancellation with zero steps', async () => {
  const invalid = await executeWorkflow({ nodes: [], edges: [] });
  assert.ok(invalid.status === 'failed' && invalid.error.code === 'INVALID_GRAPH');
  invalid.error.issues[0]!.message = 'internal graph detail';
  const cancelled = await executeWorkflow(graph, null, { signal: AbortSignal.abort('private cancellation reason') });
  for (const [result, code] of [[invalid, 'INVALID_GRAPH'], [cancelled, 'ABORTED']] as const) {
    const prepared = prepareExecutionHistory(ownerId, null, { workflowId, workflowName, ...result });
    assert.deepEqual(prepared.steps, []);
    assert.equal(prepared.execution.status, result.status);
    assert.equal(prepared.execution.output, null);
    assert.equal(prepared.execution.errorCode, code);
    assert.doesNotMatch(JSON.stringify(prepared), /internal graph detail|private cancellation reason/);
  }
});

test('rejects malformed identifiers, timing, and excessive step counts', async () => {
  const report = await run({ text: 'ok' });
  assert.throws(() => prepareExecutionHistory('not-a-uuid', null, report), /UUIDs/);
  assert.throws(() => prepareExecutionHistory(ownerId, null, { ...report, workflowId: 'bad' }), /UUIDs/);
  assert.throws(() => prepareExecutionHistory(ownerId, null, { ...report, workflowName: 'x'.repeat(121) }), /workflow name/);
  assert.throws(() => prepareExecutionHistory(ownerId, null, { ...report, finishedAt: 'invalid' }), /timestamps/);
  assert.throws(() => prepareExecutionHistory(ownerId, null, { ...report, durationMs: Infinity }), /duration/);
  const [first] = report.nodes;
  assert.ok(first);
  assert.throws(() => prepareExecutionHistory(ownerId, null, { ...report, nodes: [{ ...first, nodeId: 'invalid id' }] }), /node ID/);
  assert.throws(() => prepareExecutionHistory(ownerId, null, { ...report, nodes: [{ ...first, durationMs: -1 }] }), /duration/);
  assert.throws(() => prepareExecutionHistory(ownerId, null, { ...report, nodes: Array(101).fill(first) }), /100 steps/);
});
