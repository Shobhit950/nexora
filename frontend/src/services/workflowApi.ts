import { api } from '../auth/api';

export type WorkflowStatus = 'draft' | 'active' | 'inactive';

export type WorkflowSummary = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
};

type WorkflowNodeSettings =
  | { type: 'manualTrigger'; data: Record<string, never> }
  | { type: 'transform'; data: { operation: 'trim' | 'uppercase' | 'lowercase' } }
  | { type: 'delay'; data: { durationMs: number } };

export type WorkflowNode = WorkflowNodeSettings & {
  id: string;
  position: { x: number; y: number };
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: 'default' | 'straight' | 'step' | 'smoothstep';
};

export type Workflow = WorkflowSummary & { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
export type CreateWorkflowInput = { name: string; description?: string };
export type UpdateWorkflowInput = {
  name?: string;
  description?: string | null;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
};
export type WorkflowQuery = { page?: number; limit?: number; search?: string; status?: WorkflowStatus };
export type WorkflowList = {
  items: WorkflowSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const url = '/api/workflows';
const authenticated = { requiresAuth: true };

export async function listWorkflows(params: WorkflowQuery = {}, signal?: AbortSignal) {
  const { data } = await api.get<WorkflowList>(url, { ...authenticated, params, signal });
  return data;
}

export async function getWorkflow(id: string, signal?: AbortSignal) {
  const { data } = await api.get<Workflow>(url + '/' + encodeURIComponent(id), { ...authenticated, signal });
  return data;
}

export async function createWorkflow(input: CreateWorkflowInput) {
  const { data } = await api.post<Workflow>(url, input, authenticated);
  return data;
}

export async function updateWorkflow(id: string, input: UpdateWorkflowInput) {
  const { data } = await api.patch<Workflow>(url + '/' + encodeURIComponent(id), input, authenticated);
  return data;
}

export async function deleteWorkflow(id: string) {
  await api.delete(url + '/' + encodeURIComponent(id), authenticated);
}
