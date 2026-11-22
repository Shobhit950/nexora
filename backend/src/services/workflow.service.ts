import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../config/db';
import { workflows } from '../db/schema';
import {
  workflowGraphError,
  type CreateWorkflowInput,
  type ListWorkflowsInput,
  type UpdateWorkflowInput,
} from '../validators/workflow.validator';

export class InvalidWorkflowGraphError extends Error {}

function ownedWorkflow(userId: string, id: string) {
  return and(eq(workflows.userId, userId), eq(workflows.id, id));
}

export async function createWorkflow(userId: string, input: CreateWorkflowInput) {
  const [workflow] = await db.insert(workflows)
    .values({ userId, name: input.name, description: input.description })
    .returning();

  if (!workflow) throw new Error('Workflow insert returned no row');
  return workflow;
}

export async function listWorkflows(userId: string, { page, limit, search, status }: ListWorkflowsInput) {
  const where = and(
    eq(workflows.userId, userId),
    status ? eq(workflows.status, status) : undefined,
    search ? ilike(workflows.name, `%${search.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
  );

  return db.transaction(async tx => {
    const items = await tx.select({
      id: workflows.id,
      userId: workflows.userId,
      name: workflows.name,
      description: workflows.description,
      status: workflows.status,
      createdAt: workflows.createdAt,
      updatedAt: workflows.updatedAt,
    })
      .from(workflows)
      .where(where)
      .orderBy(desc(workflows.updatedAt), desc(workflows.id))
      .limit(limit)
      .offset((page - 1) * limit);

    const [result] = await tx.select({ total: count() }).from(workflows).where(where);
    const total = result?.total ?? 0;
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

export async function getWorkflow(userId: string, id: string) {
  const [workflow] = await db.select().from(workflows).where(ownedWorkflow(userId, id)).limit(1);
  return workflow;
}

export async function updateWorkflow(userId: string, id: string, patch: UpdateWorkflowInput) {
  const where = ownedWorkflow(userId, id);

  return db.transaction(async tx => {
    // Lock the current graph so concurrent partial updates cannot orphan edges.
    const [current] = await tx.select({ nodes: workflows.nodes, edges: workflows.edges })
      .from(workflows).where(where).for('update');
    if (!current) return undefined;

    if (patch.nodes !== undefined || patch.edges !== undefined) {
      const error = workflowGraphError(patch.nodes ?? current.nodes, patch.edges ?? current.edges);
      if (error) throw new InvalidWorkflowGraphError(error);
    }

    const [workflow] = await tx.update(workflows).set(patch).where(where).returning();
    return workflow;
  });
}

export async function deleteWorkflow(userId: string, id: string) {
  const [workflow] = await db.delete(workflows).where(ownedWorkflow(userId, id)).returning({ id: workflows.id });
  return Boolean(workflow);
}
