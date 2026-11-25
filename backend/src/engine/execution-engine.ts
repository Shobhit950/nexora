import { performance } from 'node:perf_hooks';
import type { WorkflowJsonValue } from '../db/workflow.types';
import type { ConfiguredWorkflowNode } from '../validators/workflow-graph.schema';
import type { ExecutionError, ExecutionOptions, ExecutionResult, NodeExecutionResult } from './execution.types';
import { executeDelay } from './executors/delay.executor';
import { executeManualTrigger } from './executors/manual-trigger.executor';
import { executeTransform, InvalidTransformInputError } from './executors/transform.executor';
import { validateExecutionGraph } from './graph-validator';

const timeoutReason = Symbol('execution timeout');
const maxTimeoutMs = 2_147_483_647;

function startTiming(started = performance.now()) {
  const startedAt = new Date().toISOString();
  return () => ({
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: performance.now() - started,
  });
}

function isJsonValue(value: unknown, ancestors: Set<object>): value is WorkflowJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const isArray = Array.isArray(value);
  if (!isArray && Object.getPrototypeOf(value) !== Object.prototype) return false;

  ancestors.add(value);
  for (const entry of isArray ? value : Object.values(value)) {
    if (!isJsonValue(entry, ancestors)) return false;
  }
  ancestors.delete(value);
  return true;
}

function parseInput(input: unknown): WorkflowJsonValue | undefined {
  try {
    const snapshot: unknown = structuredClone(input);
    return isJsonValue(snapshot, new Set()) ? snapshot : undefined;
  } catch {
    // Uncloneable values or excessive nesting are invalid input.
    return undefined;
  }
}

function executeNode(node: ConfiguredWorkflowNode, input: WorkflowJsonValue, signal: AbortSignal) {
  switch (node.type) {
    case 'manualTrigger':
      return executeManualTrigger(input);
    case 'transform':
      return executeTransform(input, node.data.operation);
    case 'delay':
      return executeDelay(input, node.data.durationMs, signal);
  }
}

async function runNode(
  node: ConfiguredWorkflowNode,
  input: WorkflowJsonValue,
  signal: AbortSignal,
  cancellationError: () => ExecutionError | undefined,
): Promise<NodeExecutionResult> {
  const finish = startTiming();
  const details = { nodeId: node.id, nodeType: node.type, input };
  try {
    const output: WorkflowJsonValue = await executeNode(node, input, signal);
    const error = cancellationError();
    return error
      ? { ...details, status: 'cancelled', error, ...finish() }
      : { ...details, status: 'success', output, ...finish() };
  } catch (cause) {
    const cancelled = cancellationError();
    const error: ExecutionError = cancelled ?? (cause instanceof InvalidTransformInputError
      ? { code: 'INVALID_TRANSFORM_INPUT', message: cause.message }
      : { code: 'NODE_EXECUTION_FAILED', message: 'The node could not complete execution.' });
    return { ...details, status: cancelled ? 'cancelled' : 'failed', error, ...finish() };
  }
}

/** Run a saved graph or in-memory fixture. The optional input defaults to JSON null. */
export async function executeWorkflow(
  graph: unknown,
  initialInput: unknown = null,
  { signal: externalSignal, timeoutMs }: ExecutionOptions = {},
): Promise<ExecutionResult> {
  const started = performance.now();
  const finish = startTiming(started);
  const nodes: NodeExecutionResult[] = [];
  const stop = (status: 'failed' | 'cancelled', error: ExecutionError): ExecutionResult => ({
    status, error, output: null, nodes, ...finish(),
  });

  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > maxTimeoutMs)) {
    return stop('failed', { code: 'INVALID_TIMEOUT', message: 'Timeout must be a whole number from 1 to 2147483647 ms.' });
  }

  const timeout = new AbortController();
  const signal = externalSignal ? AbortSignal.any([externalSignal, timeout.signal]) : timeout.signal;
  const deadline = timeoutMs === undefined ? undefined : started + timeoutMs;
  const timer = timeoutMs !== undefined && !signal.aborted
    ? setTimeout(() => timeout.abort(timeoutReason), timeoutMs)
    : undefined;

  function cancellationError(): ExecutionError | undefined {
    // A synchronous executor may reach the deadline before the timer callback runs.
    if (!signal.aborted && deadline !== undefined && performance.now() >= deadline) timeout.abort(timeoutReason);
    if (!signal.aborted) return undefined;
    return signal.reason === timeoutReason
      ? { code: 'TIMEOUT', message: 'Workflow execution exceeded its timeout.' }
      : { code: 'ABORTED', message: 'Workflow execution was cancelled.' };
  }

  try {
    const beforeValidation = cancellationError();
    if (beforeValidation) return stop('cancelled', beforeValidation);

    const validation = validateExecutionGraph(graph);
    if (!validation.valid) {
      return stop('failed', { code: 'INVALID_GRAPH', message: 'Workflow graph is invalid.', issues: validation.issues });
    }

    let input = parseInput(initialInput);
    if (input === undefined) {
      return stop('failed', { code: 'INVALID_INPUT', message: 'Workflow input must be JSON-compatible data.' });
    }

    for (const node of validation.orderedNodes) {
      const beforeNode = cancellationError();
      if (beforeNode) return stop('cancelled', beforeNode);

      const result = await runNode(node, input, signal, cancellationError);
      nodes.push(result);
      if (result.status !== 'success') return stop(result.status, result.error);
      input = result.output;
    }
    return { status: 'success', output: input, nodes, ...finish() };
  } finally {
    clearTimeout(timer);
  }
}
