import type { WorkflowJsonValue } from '../db/workflow.types';
import type { ConfiguredWorkflowNode } from '../validators/workflow-graph.schema';

export type ExecutionOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type GraphIssue = {
  code: 'INVALID_CONFIGURATION' | 'TRIGGER_COUNT' | 'DUPLICATE_NODE_ID' | 'DUPLICATE_EDGE_ID'
    | 'UNKNOWN_NODE' | 'BRANCHING' | 'MERGING' | 'CYCLE' | 'TRIGGER_HAS_PREDECESSOR' | 'DISCONNECTED';
  message: string;
  path?: string[];
  nodeId?: string;
  edgeId?: string;
};

export type ExecutionError =
  | { code: 'INVALID_GRAPH'; message: string; issues: GraphIssue[] }
  | {
    code: 'INVALID_INPUT' | 'INVALID_TIMEOUT' | 'INVALID_TRANSFORM_INPUT' | 'NODE_EXECUTION_FAILED'
      | 'ABORTED' | 'TIMEOUT';
    message: string;
  };

export type ExecutionStatus = 'success' | 'failed' | 'cancelled';

type Timing = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type NodeExecutionResult = Timing & {
  nodeId: string;
  nodeType: ConfiguredWorkflowNode['type'];
  input: WorkflowJsonValue;
} & (
  | { status: 'success'; output: WorkflowJsonValue }
  | { status: 'failed' | 'cancelled'; error: ExecutionError }
);

export type ExecutionResult = Timing & {
  nodes: NodeExecutionResult[];
} & (
  | { status: 'success'; output: WorkflowJsonValue }
  | { status: 'failed' | 'cancelled'; output: null; error: ExecutionError }
);
