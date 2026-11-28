import { z } from 'zod';
import type { ExecutionError, ExecutionResult, NodeExecutionResult } from '../engine/execution.types';
import type { WorkflowRunReport } from '../services/workflow-run.service';
import type { ExecutionPayloadSummary, PreparedExecutionHistory } from './execution-history.types';
import type { WorkflowJsonValue } from './workflow.types';

const uuid = z.uuid();
const timestamp = z.iso.datetime();
const safeErrorMessages: Record<ExecutionError['code'], string> = {
  INVALID_GRAPH: 'Workflow graph is invalid.',
  INVALID_INPUT: 'Workflow input must be JSON-compatible data.',
  INVALID_TIMEOUT: 'Workflow timeout configuration is invalid.',
  INVALID_TRANSFORM_INPUT: 'Transform input must be an object with a string text field.',
  NODE_EXECUTION_FAILED: 'The node could not complete execution.',
  ABORTED: 'Workflow execution was cancelled.',
  TIMEOUT: 'Workflow execution exceeded its timeout.',
};

function summarizePayload(value: WorkflowJsonValue): ExecutionPayloadSummary {
  // Even unlabeled strings or numbers can be credentials. Keep only the outer JSON type.
  if (value === null) return { type: 'null', redacted: true };
  if (Array.isArray(value)) return { type: 'array', redacted: true };
  if (typeof value === 'string') return { type: 'string', redacted: true };
  if (typeof value === 'number') return { type: 'number', redacted: true };
  if (typeof value === 'boolean') return { type: 'boolean', redacted: true };
  return { type: 'object', redacted: true };
}

function prepareOutcome(result: ExecutionResult | NodeExecutionResult) {
  if (!timestamp.safeParse(result.startedAt).success || !timestamp.safeParse(result.finishedAt).success ||
      !Number.isFinite(result.durationMs) || result.durationMs < 0) {
    throw new Error('Execution history requires valid timestamps and a finite, non-negative duration.');
  }

  const timing = {
    startedAt: new Date(result.startedAt),
    finishedAt: new Date(result.finishedAt),
    durationMs: result.durationMs,
  };
  if (result.status === 'success') {
    return { ...timing, status: result.status, output: summarizePayload(result.output), errorCode: null, errorMessage: null };
  }

  const { code } = result.error;
  if (!Object.hasOwn(safeErrorMessages, code)) throw new Error('Unknown execution error code.');
  return { ...timing, status: result.status, output: null, errorCode: code, errorMessage: safeErrorMessages[code] };
}

/** Use the authenticated owner, the original input, and the report from the owner-scoped run. */
export function prepareExecutionHistory(
  userId: string,
  input: WorkflowJsonValue,
  report: WorkflowRunReport,
): PreparedExecutionHistory {
  if (!uuid.safeParse(userId).success || !uuid.safeParse(report.workflowId).success) {
    throw new Error('Execution history requires valid owner and workflow UUIDs.');
  }
  if (report.workflowName.trim().length === 0 || report.workflowName.length > 120 || report.workflowName.includes('\0')) {
    throw new Error('Execution history requires a valid workflow name.');
  }
  if (report.nodes.length > 100) throw new Error('Execution history supports up to 100 steps per run.');

  return {
    execution: {
      userId,
      workflowId: report.workflowId,
      workflowNameSnapshot: report.workflowName,
      input: summarizePayload(input),
      ...prepareOutcome(report),
    },
    steps: report.nodes.map((node, stepOrder) => {
      if (!/^[A-Za-z0-9_.-]{1,64}$/.test(node.nodeId)) throw new Error('Execution history requires a valid node ID.');
      return {
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        stepOrder,
        input: summarizePayload(node.input),
        ...prepareOutcome(node),
      };
    }),
  };
}
