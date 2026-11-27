import type { WorkflowJsonValue } from '../db/workflow.types';
import { executeWorkflow } from '../engine/execution-engine';
import type { ExecutionResult } from '../engine/execution.types';
import { getWorkflow } from './workflow.service';

const executionTimeoutMs = 5_000;

export type WorkflowRunReport = ExecutionResult & { workflowId: string; workflowName: string };

export async function runWorkflow(
  userId: string,
  id: string,
  input: WorkflowJsonValue,
  signal: AbortSignal,
): Promise<WorkflowRunReport | undefined> {
  const workflow = await getWorkflow(userId, id);
  if (!workflow) return undefined;

  const result = await executeWorkflow({ nodes: workflow.nodes, edges: workflow.edges }, input, {
    timeoutMs: executionTimeoutMs,
    signal,
  });
  return { workflowId: workflow.id, workflowName: workflow.name, ...result };
}
