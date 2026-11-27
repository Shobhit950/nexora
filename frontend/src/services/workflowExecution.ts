import { isAxiosError } from 'axios';
import { api } from '../auth/api';
import type { WorkflowNode } from './workflowApi';

export type WorkflowJson = null | boolean | number | string | WorkflowJson[] | { [key: string]: WorkflowJson };
export type RunStatus = 'success' | 'failed' | 'cancelled';

type GraphIssue = { code: string; message: string; path?: string[]; nodeId?: string; edgeId?: string };
export type RunError = { code: string; message: string; issues?: GraphIssue[] };
type Timing = { startedAt: string; finishedAt: string; durationMs: number };

export type RunNodeResult = Timing & { nodeId: string; nodeType: WorkflowNode['type']; input: WorkflowJson } & (
  { status: 'success'; output: WorkflowJson } | { status: 'failed' | 'cancelled'; error: RunError }
);

export type WorkflowRunReport = Timing & { workflowId: string; workflowName: string; nodes: RunNodeResult[] } & (
  { status: 'success'; output: WorkflowJson } | { status: 'failed' | 'cancelled'; output: null; error: RunError }
);

export async function runWorkflow(id: string, input: WorkflowJson, signal: AbortSignal): Promise<WorkflowRunReport> {
  try {
    const { data } = await api.post<WorkflowRunReport>(
      `/api/workflows/${encodeURIComponent(id)}/run`, { input }, { requiresAuth: true, signal },
    );
    return data;
  } catch (error) {
    // The authenticated client handles 401 first. Report-bearing errors are execution results.
    if (isAxiosError<WorkflowRunReport | { error: string }>(error)) {
      const data = error.response?.data;
      if (data && typeof data === 'object' && 'workflowId' in data && data.workflowId === id &&
          (data.status === 'failed' || data.status === 'cancelled') && Array.isArray(data.nodes) &&
          typeof data.error?.message === 'string') return data;
    }
    throw error;
  }
}

export function workflowRunError(error: unknown): string {
  if (isAxiosError(error)) {
    switch (error.response?.status) {
      case 400: return 'The server rejected the run input. Check the JSON and try again.';
      case 401: return 'Your session expired. Sign in again to run the workflow.';
      case 403:
      case 404: return 'This workflow is unavailable. Open it again from My Workflows.';
      case 413: return 'The run input exceeds the 16 KB request limit.';
      case 422: return 'The saved workflow graph is invalid. Check its nodes and connections.';
      case 504: return 'The workflow reached its execution time limit.';
      case undefined: return 'The server could not be reached or stopped responding. Check your connection and try again.';
    }
  }
  return 'Unable to run the workflow. Try again.';
}
