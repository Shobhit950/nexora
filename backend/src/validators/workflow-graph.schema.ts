import { z } from 'zod';
import type { WorkflowEdge } from '../db/workflow.types';

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

export const workflowNodesSchema = z.array(nodeSchema).max(100);
export const workflowEdgesSchema = z.array(edgeSchema).max(200);
export type ConfiguredWorkflowNode = z.infer<typeof nodeSchema>;
