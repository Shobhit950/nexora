import { setTimeout } from 'node:timers/promises';
import type { WorkflowJsonValue } from '../../db/workflow.types';

export async function executeDelay(
  input: WorkflowJsonValue,
  durationMs: number,
  signal: AbortSignal,
): Promise<WorkflowJsonValue> {
  await setTimeout(durationMs, undefined, { signal });
  return input;
}
