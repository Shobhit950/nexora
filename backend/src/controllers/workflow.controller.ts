import type { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthLocals } from '../middleware/require-auth';
import {
  createWorkflow, deleteWorkflow, getWorkflow, InvalidWorkflowGraphError, listWorkflows, updateWorkflow,
} from '../services/workflow.service';
import {
  createWorkflowSchema, listWorkflowsSchema, updateWorkflowSchema, workflowParamsSchema,
} from '../validators/workflow.validator';

type AuthResponse = Response<unknown, AuthLocals>;

export async function createWorkflowController(req: Request, res: AuthResponse) {
  const workflow = await createWorkflow(res.locals.userId, createWorkflowSchema.parse(req.body));
  res.status(201).json(workflow);
}

export async function listWorkflowsController(req: Request, res: AuthResponse) {
  res.json(await listWorkflows(res.locals.userId, listWorkflowsSchema.parse(req.query)));
}

export async function getWorkflowController(req: Request, res: AuthResponse) {
  const { id } = workflowParamsSchema.parse(req.params);
  const workflow = await getWorkflow(res.locals.userId, id);
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(workflow);
}

export async function updateWorkflowController(req: Request, res: AuthResponse) {
  const { id } = workflowParamsSchema.parse(req.params);
  const workflow = await updateWorkflow(res.locals.userId, id, updateWorkflowSchema.parse(req.body));
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(workflow);
}

export async function deleteWorkflowController(req: Request, res: AuthResponse) {
  const { id } = workflowParamsSchema.parse(req.params);
  if (!await deleteWorkflow(res.locals.userId, id)) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.status(204).end();
}

export const handleWorkflowError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map(issue => issue.path.join('.') || 'request'))];
    res.status(400).json({ error: 'Invalid workflow request', fields });
    return;
  }
  if (error instanceof InvalidWorkflowGraphError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof Error && 'status' in error) {
    if (error.status === 413) {
      res.status(413).json({ error: 'Workflow request is too large' });
      return;
    }
    if (error.status === 400) {
      res.status(400).json({ error: 'Invalid workflow request' });
      return;
    }
    if (error.status === 415) {
      res.status(415).json({ error: 'Unsupported workflow request encoding' });
      return;
    }
  }

  console.error('Workflow request failed');
  res.status(500).json({ error: 'Unable to process workflow request' });
};
