import { z } from 'zod';
import { workflowStatus } from '../db/schema';
import type { WorkflowEdge, WorkflowNode } from '../db/workflow.types';
import { workflowEdgesSchema, workflowNodesSchema } from './workflow-graph.schema';

const name = z.string().trim().min(1).max(120).refine(value => !value.includes('\0'));
const description = z.string().trim().max(2_000).refine(value => !value.includes('\0'));
export const workflowParamsSchema = z.strictObject({ id: z.uuid() });

export const createWorkflowSchema = z.strictObject({
  name,
  description: description.optional(),
});

const pageNumber = z.string().regex(/^[1-9][0-9]{0,4}$/).transform(Number);
export const listWorkflowsSchema = z.strictObject({
  page: pageNumber.pipe(z.number().max(10_000)).default(1),
  limit: pageNumber.pipe(z.number().max(100)).default(20),
  search: z.string().trim().min(1).max(120).refine(value => !value.includes('\0')).optional(),
  status: z.enum(workflowStatus.enumValues).optional(),
});

export const updateWorkflowSchema = z.strictObject({
  name: name.optional(),
  description: description.nullable().optional(),
  nodes: workflowNodesSchema.optional(),
  edges: workflowEdgesSchema.optional(),
}).refine(patch => Object.keys(patch).length > 0, 'Supply at least one workflow field.');

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type ListWorkflowsInput = z.infer<typeof listWorkflowsSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

export function workflowGraphError(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const nodeIds = new Set(nodes.map(node => node.id));
  if (nodeIds.size !== nodes.length) return 'Node IDs must be unique.';

  const edgeIds = new Set(edges.map(edge => edge.id));
  if (edgeIds.size !== edges.length) return 'Edge IDs must be unique.';

  if (edges.some(edge => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
    return 'Every edge must connect two existing nodes.';
  }
}
