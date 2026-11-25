import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import type { WorkflowEdge } from '../../db/workflow.types';
import type { ConfiguredWorkflowNode } from '../../validators/workflow-graph.schema';
import { executeWorkflow } from '../execution-engine';
import type { ExecutionResult, GraphIssue } from '../execution.types';

const position = { x: 0, y: 0 };
const trigger: ConfiguredWorkflowNode = { id: 'start', type: 'manualTrigger', position, data: {} };
const transform: ConfiguredWorkflowNode = {
  id: 'transform', type: 'transform', position: { x: -200, y: 200 }, data: { operation: 'uppercase' },
};
const delay: ConfiguredWorkflowNode = {
  id: 'delay', type: 'delay', position: { x: -400, y: -200 }, data: { durationMs: 8 },
};

function edge(source: string, target: string, id = `${source}-${target}`): WorkflowEdge {
  return { id, source, target };
}

const linearGraph = {
  nodes: [delay, transform, trigger],
  edges: [edge('transform', 'delay'), edge('start', 'transform')],
};

function assertTiming(timing: Pick<ExecutionResult, 'startedAt' | 'finishedAt' | 'durationMs'>) {
  assert.equal(new Date(timing.startedAt).toISOString(), timing.startedAt);
  assert.equal(new Date(timing.finishedAt).toISOString(), timing.finishedAt);
  assert.ok(Date.parse(timing.finishedAt) >= Date.parse(timing.startedAt));
  assert.ok(Number.isFinite(timing.durationMs) && timing.durationMs >= 0);
}

test('executes trigger, transform, and delay in edge order with serializable results', async () => {
  const input = { text: 'Nexora', source: { labels: ['draft', null], retry: false } };
  const result = await executeWorkflow(linearGraph, input);
  const expected = { ...input, text: 'NEXORA' };
  assert.equal(result.status, 'success');
  assert.deepEqual(result.output, expected);
  assert.deepEqual(result.nodes.map(({ nodeId, nodeType, status }) => [nodeId, nodeType, status]), [
    ['start', 'manualTrigger', 'success'],
    ['transform', 'transform', 'success'],
    ['delay', 'delay', 'success'],
  ]);
  const [first, second, third] = result.nodes;
  assert.ok(first?.status === 'success' && second?.status === 'success' && third?.status === 'success');
  assert.deepEqual(first.input, input);
  assert.strictEqual(first.input, first.output);
  assert.strictEqual(first.output, second.input);
  assert.strictEqual(second.output, third.input);
  assert.strictEqual(third.input, third.output);
  assert.notStrictEqual(second.input, second.output);
  assert.equal(input.text, 'Nexora');
  assertTiming(result);
  for (const node of result.nodes) {
    assertTiming(node);
    assert.ok(result.durationMs >= node.durationMs);
  }
  assert.ok(Date.parse(second.startedAt) >= Date.parse(first.finishedAt));
  assert.ok(Date.parse(third.startedAt) >= Date.parse(second.finishedAt));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

const transforms = [
  ['trim', '  Nexora \n', 'Nexora'],
  ['uppercase', 'Nexora', 'NEXORA'],
  ['lowercase', 'Nexora', 'nexora'],
] as const;

for (const [operation, text, expected] of transforms) {
  test(`transforms text with ${operation} without changing other fields`, async () => {
    const graph = { nodes: [trigger, { ...transform, data: { operation } }], edges: [edge('start', 'transform')] };
    const input = Object.freeze({ text, count: 5 });
    const result = await executeWorkflow(graph, input);
    assert.equal(result.status, 'success');
    assert.deepEqual(result.output, { text: expected, count: 5 });
    assert.equal(input.text, text);
  });
}

test('supports a trigger-only graph, default input, and all JSON data types', async () => {
  const graph = { nodes: [trigger], edges: [] };
  const defaultInput = await executeWorkflow(graph);
  assert.equal(defaultInput.status, 'success');
  assert.equal(defaultInput.output, null);
  const input: unknown = JSON.parse('["hello", 2, true, null, {"__proto__":{"nested":true}}]');
  const result = await executeWorkflow(graph, input);
  assert.equal(result.status, 'success');
  assert.deepEqual(result.output, input);
});

const invalidGraphs: { label: string; graph: unknown; issue: GraphIssue['code'] }[] = [
  { label: 'missing manual trigger', graph: { nodes: [transform], edges: [] }, issue: 'TRIGGER_COUNT' },
  { label: 'multiple manual triggers', graph: { nodes: [trigger, { ...trigger, id: 'other' }], edges: [] }, issue: 'TRIGGER_COUNT' },
  { label: 'duplicate node IDs', graph: { nodes: [trigger, { ...transform, id: 'start' }], edges: [] }, issue: 'DUPLICATE_NODE_ID' },
  { label: 'duplicate edge IDs', graph: { ...linearGraph, edges: [edge('start', 'transform', 'same'), edge('transform', 'delay', 'same')] }, issue: 'DUPLICATE_EDGE_ID' },
  { label: 'unknown source', graph: { ...linearGraph, edges: [edge('missing', 'transform')] }, issue: 'UNKNOWN_NODE' },
  { label: 'unknown target', graph: { ...linearGraph, edges: [edge('start', 'missing')] }, issue: 'UNKNOWN_NODE' },
  { label: 'a branch', graph: { ...linearGraph, edges: [edge('start', 'transform'), edge('start', 'delay')] }, issue: 'BRANCHING' },
  { label: 'a merge', graph: { ...linearGraph, edges: [edge('start', 'delay'), edge('transform', 'delay')] }, issue: 'MERGING' },
  { label: 'a cycle containing the trigger', graph: { ...linearGraph, edges: [...linearGraph.edges, edge('delay', 'start')] }, issue: 'CYCLE' },
  { label: 'a separate cycle', graph: { ...linearGraph, edges: [edge('transform', 'delay'), edge('delay', 'transform')] }, issue: 'CYCLE' },
  { label: 'a self-loop', graph: { nodes: [trigger], edges: [edge('start', 'start')] }, issue: 'CYCLE' },
  { label: 'a disconnected node', graph: { ...linearGraph, edges: [edge('start', 'transform')] }, issue: 'DISCONNECTED' },
  { label: 'an incoming edge to the trigger', graph: { nodes: [trigger, transform], edges: [edge('transform', 'start')] }, issue: 'TRIGGER_HAS_PREDECESSOR' },
  { label: 'unsupported node type', graph: { nodes: [{ ...trigger, type: 'unsupported' }], edges: [] }, issue: 'INVALID_CONFIGURATION' },
  { label: 'unsupported operation', graph: { ...linearGraph, nodes: [trigger, { ...transform, data: { operation: 'reverse' } }] }, issue: 'INVALID_CONFIGURATION' },
  { label: 'extra settings on a supported node', graph: { nodes: [{ ...trigger, data: { secretSetting: true } }], edges: [] }, issue: 'INVALID_CONFIGURATION' },
  { label: 'an invalid edge shape', graph: { nodes: [trigger], edges: [{ id: 'missing-fields' }] }, issue: 'INVALID_CONFIGURATION' },
  { label: 'a missing edge array', graph: { nodes: [trigger] }, issue: 'INVALID_CONFIGURATION' },
  ...[0, 60_001, 1.5, '10'].map(durationMs => ({
    label: `delay duration ${JSON.stringify(durationMs)}`,
    graph: { ...linearGraph, nodes: [trigger, transform, { ...delay, data: { durationMs } }] },
    issue: 'INVALID_CONFIGURATION' as const,
  })),
];

for (const { label, graph, issue } of invalidGraphs) {
  test(`rejects ${label} before running any node`, async () => {
    const result = await executeWorkflow(graph);
    assert.ok(result.status === 'failed' && result.error.code === 'INVALID_GRAPH');
    assert.equal(result.error.issues[0]?.code, issue);
    assert.equal(result.output, null);
    assert.deepEqual(result.nodes, []);
    assertTiming(result);
  });
}

test('reports a safe schema validation path without echoing unexpected setting names', async () => {
  const result = await executeWorkflow({ nodes: [{ ...trigger, data: { unexpectedSecret: 'secret-value' } }], edges: [] });
  assert.ok(result.status === 'failed' && result.error.code === 'INVALID_GRAPH');
  assert.deepEqual(result.error.issues[0]?.path, ['nodes', '0', 'data']);
  assert.doesNotMatch(JSON.stringify(result), /unexpectedSecret|secret-value/);
});

test('unreadable graph data returns a safe validation failure', async () => {
  const graph = {
    get nodes() { throw new Error('private configuration details'); },
    edges: [],
  };
  const result = await executeWorkflow(graph);
  assert.ok(result.status === 'failed' && result.error.code === 'INVALID_GRAPH');
  assert.equal(result.error.issues[0]?.code, 'INVALID_CONFIGURATION');
  assert.deepEqual(result.nodes, []);
  assert.doesNotMatch(JSON.stringify(result), /private configuration details/);
});

test('rejects non-JSON input before execution', async () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  for (const input of [{ value: 1n }, { value: Infinity }, new Date(), cyclic, Array(1)]) {
    const result = await executeWorkflow({ nodes: [trigger], edges: [] }, input);
    assert.ok(result.status === 'failed' && result.error.code === 'INVALID_INPUT');
    assert.deepEqual(result.nodes, []);
  }
});

test('stops after a transform fails and preserves completed node results', async () => {
  const result = await executeWorkflow(linearGraph, { text: 42 });
  assert.ok(result.status === 'failed' && result.error.code === 'INVALID_TRANSFORM_INPUT');
  assert.deepEqual(result.nodes.map(node => node.status), ['success', 'failed']);
  const failed = result.nodes[1];
  assert.equal(failed?.nodeId, 'transform');
  assert.deepEqual(failed?.input, { text: 42 });
  assert.ok(failed?.status === 'failed');
  assert.deepEqual(failed.error, result.error);
  assert.equal('output' in failed, false);
  assert.equal(result.output, null);
});

test('delay leaves the event loop free and passes its input unchanged', async () => {
  const graph = {
    nodes: [trigger, { ...delay, data: { durationMs: 25 } }, transform],
    edges: [edge('start', 'delay'), edge('delay', 'transform')],
  };
  const order: string[] = [];
  const tick = setTimeout(5).then(() => order.push('timer'));
  const run = executeWorkflow(graph, { text: 'abc' }).then(result => {
    order.push('workflow');
    return result;
  });
  const [result] = await Promise.all([run, tick]);
  assert.deepEqual(order, ['timer', 'workflow']);
  assert.equal(result.status, 'success');
  assert.deepEqual(result.output, { text: 'ABC' });
  const wait = result.nodes[1];
  assert.ok(wait?.status === 'success');
  assert.ok(wait.durationMs >= 20);
  assert.strictEqual(wait.input, wait.output);
});

const longDelayGraph = {
  nodes: [trigger, { ...delay, data: { durationMs: 60_000 } }, transform],
  edges: [edge('start', 'delay'), edge('delay', 'transform')],
};

test('pre-aborted execution starts no nodes and omits the external abort reason', async () => {
  const result = await executeWorkflow(linearGraph, { text: 'Hello' }, {
    signal: AbortSignal.abort(new Error('private abort reason')),
    timeoutMs: 60_000,
  });
  assert.ok(result.status === 'cancelled' && result.error.code === 'ABORTED');
  assert.deepEqual(result.nodes, []);
  assert.doesNotMatch(JSON.stringify(result), /private abort reason/);
});

test('aborting a delay cancels it immediately and skips downstream nodes', { timeout: 2_000 }, async () => {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort('private abort reason'), 10);
  try {
    const result = await executeWorkflow(longDelayGraph, { text: 'Hello' }, {
      signal: controller.signal, timeoutMs: 60_000,
    });
    assert.ok(result.status === 'cancelled' && result.error.code === 'ABORTED');
    assert.deepEqual(result.nodes.map(node => [node.nodeType, node.status]), [
      ['manualTrigger', 'success'], ['delay', 'cancelled'],
    ]);
    assert.equal(result.output, null);
    assert.doesNotMatch(JSON.stringify(result), /private abort reason/);
  } finally {
    clearTimeout(timer);
  }
});

test('the overall timeout interrupts an unfinished delay', { timeout: 2_000 }, async () => {
  const result = await executeWorkflow(longDelayGraph, { text: 'Hello' }, { timeoutMs: 50 });
  assert.ok(result.status === 'cancelled' && result.error.code === 'TIMEOUT');
  assert.deepEqual(result.nodes.map(node => node.status), ['success', 'cancelled']);
  const cancelled = result.nodes[1];
  assert.ok(cancelled?.status === 'cancelled');
  assert.deepEqual(cancelled.error, result.error);
  assertTiming(cancelled);
  assertTiming(result);
});

test('clears the deadline when the workflow finishes successfully', { timeout: 2_000 }, async () => {
  const result = await executeWorkflow({ nodes: [trigger], edges: [] }, null, { timeoutMs: 60_000 });
  assert.equal(result.status, 'success');
});

test('rejects an invalid timeout without running nodes', async () => {
  for (const timeoutMs of [0, -1, 2.5, Infinity, 2_147_483_648]) {
    const result = await executeWorkflow(linearGraph, { text: 'Hello' }, { timeoutMs });
    assert.ok(result.status === 'failed' && result.error.code === 'INVALID_TIMEOUT');
    assert.deepEqual(result.nodes, []);
  }
});
