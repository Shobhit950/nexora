import { z } from 'zod';
import { workflowStatus } from '../db/schema';
import type { WorkflowEdge, WorkflowNode } from '../db/workflow.types';

const name = z.string().trim().min(1).max(120).refine(value => !value.includes('\0'));
const description = z.string().trim().max(2_000).refine(value => !value.includes('\0'));
const graphId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/);
const coordinate = z.number().min(-1_000_000).max(1_000_000);
const nodeFields = {
  id: graphId,
  position: z.strictObject({ x: coordinate, y: coordinate }),
};

// Only allow specific non-secret settings. New node types need an explicit schema.
const nodeSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...nodeFields, type: z.literal('manualTrigger'), data: z.strictObject({}) }),
  z.strictObject({
    ...nodeFields,
    type: z.literal('transform'),
    data: z.strictObject({ operation: z.enum(['trim', 'uppercase', 'lowercase']) }),
  }),
  z.strictObject({
    ...nodeFields,
    type: z.literal('delay'),
    data: z.strictObject({ durationMs: z.number().int().min(1).max(60_000) }),
  }),
]);

const edgeSchema = z.strictObject({
  id: graphId,
  source: graphId,
  target: graphId,
  sourceHandle: graphId.nullable().optional(),
  targetHandle: graphId.nullable().optional(),
  type: z.enum(['default', 'straight', 'step', 'smoothstep']).optional(),
}).transform(({ sourceHandle, targetHandle, type, ...edge }): WorkflowEdge => ({
  ...edge,
  ...(sourceHandle !== undefined && { sourceHandle }),
  ...(targetHandle !== undefined && { targetHandle }),
  ...(type !== undefined && { type }),
}));

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
  nodes: z.array(nodeSchema).max(100).optional(),
  edges: z.array(edgeSchema).max(200).optional(),
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
